"use strict";

// No credentials or complete page URLs cross the content-script boundary.
const DEFAULTS = { moodle: true, synapses: true, webmail: true };
const HOSTS = {
  "moodle.ip-paris.fr": "moodle",
  "synapses.polytechnique.fr": "synapses",
  "webmail.polytechnique.fr": "webmail",
  "egide.polytechnique.fr": "idp"
};
const STAGES = {
  "moodle-open": "moodle", "moodle-provider": "moodle",
  "synapses-menu": "synapses", "synapses-open": "synapses",
  "idp-submit": "idp", "webmail-submit": "webmail"
};
const FLOW_MS = 180_000;
const COOLDOWN_MS = 300_000;
const queues = new Map();

function serial(tabId, operation) {
  const previous = queues.get(tabId) || Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  queues.set(tabId, next);
  next.finally(() => {
    if (queues.get(tabId) === next) queues.delete(tabId);
  }).catch(() => {});
  return next;
}

function parsePage(url) {
  try {
    const page = new URL(url);
    return page.protocol === "https:" && (!page.port || page.port === "443") &&
      HOSTS[page.hostname] && (page.hostname !== "egide.polytechnique.fr" || page.pathname.startsWith("/idp/"))
      ? page : null;
  } catch { return null; }
}

async function preferences() {
  const { settings } = await browser.storage.local.get("settings");
  return Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, settings?.[key] !== false]));
}

async function stateFor(tabId) {
  const key = `tab-${tabId}`;
  return (await browser.storage.session.get(key))[key] || { stages: {} };
}

async function save(tabId, state) {
  await browser.storage.session.set({ [`tab-${tabId}`]: state });
}

function contextFor(page, settings, state) {
  const site = page && HOSTS[page.hostname];
  const service = site === "idp" ? state.service : site;
  const enabled = Boolean(service && settings[service] && !state.paused &&
    (site !== "idp" || state.flowUntil > Date.now()));
  return { enabled, service: service || null, paused: Boolean(state.paused),
    status: state.status || (enabled ? "Automatisation active." : "Aucun parcours de connexion actif.") };
}

async function handleContent(message, sender) {
  const page = parsePage(sender.url);
  if (!page || sender.tab?.id === undefined || sender.frameId !== 0) return { enabled: false };
  const tabId = sender.tab.id;
  return serial(tabId, async () => {
    const settings = await preferences();
    const state = await stateFor(tabId);
    const site = HOSTS[page.hostname];
    const context = contextFor(page, settings, state);
    if (message.type === "context") return context;
    if (message.type === "pause") {
      state.paused = true;
      state.status = "En pause dans cet onglet. Cliquez sur Réessayer pour reprendre.";
      await save(tabId, state);
      return { ok: true };
    }
    if (!context.enabled) return { ok: false, ...context };
    if (message.type === "status") {
      // Accept only fixed codes, never page text or input values.
      const labels = {
        waiting: "En attente du remplissage des identifiants par Firefox…",
        error: "Erreur de connexion : automatisation arrêtée. Corrigez les identifiants, puis Réessayer.",
        manual: "Saisie manuelle détectée : validez vous-même, ou cliquez sur Réessayer.",
        timeout: "Délai dépassé. Remplissez les identifiants, puis cliquez sur Réessayer.",
        authenticated: "Session déjà ouverte."
      };
      if (labels[message.code]) {
        state.status = labels[message.code];
        if (["error", "manual", "timeout"].includes(message.code)) state.paused = true;
        if (message.code === "authenticated") {
          state.stages = {};
          state.submitUntil = 0;
          state.flowUntil = 0;
        }
        await save(tabId, state);
      }
      return { ok: true };
    }
    if (message.type !== "claim" || STAGES[message.stage] !== site) return { ok: false };
    if ((message.stage === "moodle-open" && page.pathname !== "/my/courses.php") ||
        (message.stage === "moodle-provider" && page.pathname !== "/login/index.php") ||
        /logout|signout/i.test(page.pathname)) return { ok: false };

    const now = Date.now();
    const submit = message.stage.endsWith("submit");
    if (state.stages?.[message.stage] > now || (submit && state.submitUntil > now)) {
      state.status = "Étape déjà tentée : arrêt pour éviter une boucle. Cliquez sur Réessayer.";
      await save(tabId, state);
      return { ok: false, status: state.status };
    }
    if (site !== "idp") state.service = site;
    state.stages ||= {};
    state.stages[message.stage] = now + COOLDOWN_MS;
    state.flowUntil = now + FLOW_MS;
    if (submit) state.submitUntil = now + COOLDOWN_MS;
    state.status = submit ? "Formulaire envoyé. Attente de la connexion…" : "Parcours de connexion en cours…";
    await save(tabId, state);
    return { ok: true };
  });
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message.type !== "string") return;
  const popupUrl = browser.runtime.getURL("popup.html");
  if (sender.url !== popupUrl) return handleContent(message, sender);
  return (async () => {
    if (message.type === "settings") return preferences();
    if (message.type === "set-setting" && Object.hasOwn(DEFAULTS, message.service)) {
      const settings = await preferences();
      settings[message.service] = message.enabled === true;
      await browser.storage.local.set({ settings });
      return { ok: true };
    }
    if (!Number.isInteger(message.tabId)) return { ok: false };
    return serial(message.tabId, async () => {
      const state = await stateFor(message.tabId);
      const tab = await browser.tabs.get(message.tabId);
      const page = parsePage(tab.url);
      if (message.type === "tab-status") {
        return { supported: Boolean(page), ...contextFor(page, await preferences(), state) };
      }
      if (!page) return { ok: false };
      if (message.type === "retry") {
        const fresh = { stages: {}, service: state.service,
          flowUntil: state.service ? Date.now() + FLOW_MS : 0 };
        await save(message.tabId, fresh);
        await browser.tabs.sendMessage(message.tabId, { type: "restart" }).catch(() => {});
        return { ok: true };
      }
      if (message.type === "pause-tab") {
        state.paused = true;
        state.status = "Automatisation en pause dans cet onglet.";
        await save(message.tabId, state);
        return { ok: true };
      }
      return { ok: false };
    });
  })();
});

browser.tabs.onRemoved.addListener(tabId => {
  serial(tabId, () => browser.storage.session.remove(`tab-${tabId}`)).catch(() => {});
});
