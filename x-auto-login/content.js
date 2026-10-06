"use strict";

(() => {
  if (window.top !== window) return;
  const HOST = location.hostname;
  let stopped = false;
  let submitted = false;
  let menuOpened = false;
  let busy = false;
  let started = 0;
  let readySince = 0;
  let readyForm = null;
  let cachedContext = null;
  let contextAt = 0;
  let lastStatus = "";
  const touchedForms = new WeakSet();

  function visible(element) {
    if (!element?.isConnected) return false;
    const css = getComputedStyle(element);
    return css.display !== "none" && css.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function normalize(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function sameOriginLink(anchor, pathname) {
    try {
      const url = new URL(anchor.href, location.href);
      return url.origin === location.origin && url.pathname === pathname;
    } catch { return false; }
  }

  async function send(message) {
    try { return await browser.runtime.sendMessage(message); }
    catch { stopped = true; return { ok: false, enabled: false }; }
  }

  async function status(code) {
    if (lastStatus === code) return;
    lastStatus = code;
    await send({ type: "status", code });
  }

  async function claim(stage) {
    const reply = await send({ type: "claim", stage });
    if (!reply?.ok) stopped = true;
    return Boolean(reply?.ok);
  }

  function errorVisible() {
    const selectors = HOST === "webmail.polytechnique.fr"
      ? "#errorMessageDiv, .errorMessage"
      : ".form-error, .error, .alert-danger, [role=alert]";
    return [...document.querySelectorAll(selectors)].some(el => visible(el) && el.textContent.trim());
  }

  function loginForm() {
    // These pairs are from the actual public login forms, not arbitrary password fields.
    const idp = HOST === "egide.polytechnique.fr";
    const user = document.querySelector(idp ? 'input[name="j_username"]' : '#zLoginForm input[name="username"]');
    const password = document.querySelector(idp ? 'input[name="j_password"]' : '#zLoginForm input[name="password"]');
    const form = password?.form;
    const button = form?.querySelector(idp ? 'button[name="_eventId_proceed"]' : '#loginButton');
    if (!form || user?.form !== form || !visible(user) || !visible(password) || !visible(button)) return null;
    const action = new URL(form.action || location.href, location.href);
    if (action.origin !== location.origin || (idp && !action.pathname.startsWith("/idp/"))) return null;
    return { form, user, password, button };
  }

  async function submitFilledForm() {
    const fields = loginForm();
    if (!fields) return;
    if (errorVisible()) {
      await status("error");
      stopped = true;
      return;
    }
    const { form, user, password, button } = fields;
    if (touchedForms.has(form)) {
      await status("manual");
      stopped = true;
      return;
    }
    // Only inspect presence. Never copy, log, persist, or transmit either value.
    if (!user.value.trim() || !password.value || user.disabled || password.disabled || button.disabled || !form.checkValidity()) {
      readySince = 0;
      await status("waiting");
      return;
    }
    if (readyForm !== form || !readySince) {
      readyForm = form;
      readySince = Date.now();
      return;
    }
    if (Date.now() - readySince < 1200) return;
    const granted = await claim(HOST === "egide.polytechnique.fr" ? "idp-submit" : "webmail-submit");
    // Recheck after the asynchronous permission/state exchange, including tab visibility.
    if (!granted || document.visibilityState !== "visible" || !visible(button) ||
        touchedForms.has(form) || !user.value.trim() || !password.value || button.disabled || errorVisible()) return;
    stopped = true; // One submission in this document, including AJAX error responses.
    submitted = true;
    button.click(); // Preserves submitter name, CSRF fields and the site's validation handlers.
  }

  async function moodle() {
    if (/logout/i.test(location.pathname)) return;
    if (location.pathname === "/login/index.php") {
      const provider = [...document.querySelectorAll("a.login-identityprovider-btn")].find(a =>
        normalize(a.textContent) === "x - ecole polytechnique" && sameOriginLink(a, "/auth/saml2/login.php") && visible(a));
      if (provider && await claim("moodle-provider")) {
        stopped = true;
        provider.click();
      }
      return;
    }
    if (location.pathname !== "/my/courses.php") return;
    const login = [...document.querySelectorAll("a[href]")].find(a =>
      sameOriginLink(a, "/login/index.php") && visible(a) && /^(connexion|login|log in|se connecter)$/.test(normalize(a.textContent)));
    if (login && await claim("moodle-open")) {
      stopped = true;
      login.click();
    } else if (!login && document.querySelector('.usermenu a[href*="logout.php"]')) {
      await status("authenticated");
      stopped = true;
    }
  }

  async function synapses() {
    if (/logout/i.test(location.pathname)) return;
    const menu = document.querySelector("#dropdown-authentication-menu");
    if (!menu) {
      if (document.querySelector('a[href*="logout"]')) {
        await status("authenticated");
        stopped = true;
      }
      return;
    }
    const login = [...menu.querySelectorAll("a[href]")].find(a => {
      if (!sameOriginLink(a, "/login")) return false;
      return new URL(a.href).searchParams.get("type") === "Shib";
    });
    if (visible(login)) {
      if (await claim("synapses-open")) {
        stopped = true;
        login.click();
      }
      return;
    }
    const toggle = menu.querySelector('a.dropdown-toggle[data-toggle="dropdown"]');
    if (!menuOpened && visible(toggle) && await claim("synapses-menu")) {
      menuOpened = true;
      toggle.click();
    }
  }

  async function tick() {
    if (busy || document.visibilityState !== "visible") return;
    if (submitted && errorVisible()) {
      submitted = false;
      await status("error");
    }
    if (stopped) return;
    busy = true;
    try {
      if (Date.now() - contextAt > 1000 || !cachedContext) {
        cachedContext = await send({ type: "context" });
        contextAt = Date.now();
      }
      if (!cachedContext?.enabled) {
        started = 0;
        readySince = 0;
        return;
      }
      const actionable = HOST === "synapses.polytechnique.fr"
        ? Boolean(document.querySelector("#dropdown-authentication-menu"))
        : HOST === "moodle.ip-paris.fr"
          ? ["/login/index.php", "/my/courses.php"].includes(location.pathname)
          : Boolean(loginForm());
      if (!started && actionable) started = Date.now();
      if (started && Date.now() - started > 120_000) {
        await status("timeout");
        stopped = true;
        return;
      }
      if (HOST === "moodle.ip-paris.fr") await moodle();
      else if (HOST === "synapses.polytechnique.fr") await synapses();
      else if (HOST === "webmail.polytechnique.fr" || HOST === "egide.polytechnique.fr") await submitFilledForm();
    } catch {
      stopped = true;
    } finally { busy = false; }
  }

  // Firefox autofill emits trusted input events too. Watch actual editing gestures
  // instead, so filling from the password manager does not look like manual typing.
  function edited(event) {
    if (event.isTrusted && event.target instanceof HTMLInputElement &&
        ["text", "email", "password"].includes(event.target.type) && event.target.form) {
      touchedForms.add(event.target.form);
    }
  }
  document.addEventListener("keydown", event => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey &&
        (event.key.length === 1 || ["Backspace", "Delete"].includes(event.key))) edited(event);
  }, true);
  for (const kind of ["paste", "cut", "drop", "compositionstart"]) {
    document.addEventListener(kind, edited, true);
  }
  document.addEventListener("click", event => {
    const anchor = event.target.closest?.("a[href]");
    if (event.isTrusted && anchor && /logout|signout|deconnexion/.test(normalize(anchor.href + " " + anchor.textContent))) {
      stopped = true;
      void send({ type: "pause" });
    }
  }, true);
  browser.runtime.onMessage.addListener(message => {
    if (message.type === "restart") {
      const fields = loginForm();
      if (fields) touchedForms.delete(fields.form);
      stopped = false;
      submitted = false;
      menuOpened = false;
      started = 0;
      readySince = 0;
      readyForm = null;
      cachedContext = null;
      contextAt = 0;
      lastStatus = "";
      void tick();
    }
  });
  let timer = setInterval(tick, 400);
  window.addEventListener("pagehide", () => clearInterval(timer));
  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      clearInterval(timer);
      timer = setInterval(tick, 400);
      contextAt = 0;
    }
  });
  document.addEventListener("visibilitychange", () => {
    readySince = 0;
    contextAt = 0;
    void tick();
  });
  void tick();
})();
