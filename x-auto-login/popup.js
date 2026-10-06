"use strict";

let tabId;
async function refresh() {
  if (tabId === undefined) return;
  const result = await browser.runtime.sendMessage({ type: "tab-status", tabId });
  document.getElementById("status").textContent = result.supported
    ? result.status : "Ouvrez Moodle, SynapseS ou le webmail dans cet onglet.";
  document.getElementById("retry").disabled = !result.supported;
  document.getElementById("pause").disabled = !result.supported || result.paused;
}

async function init() {
  const settings = await browser.runtime.sendMessage({ type: "settings" });
  for (const service of ["moodle", "synapses", "webmail"]) {
    const input = document.getElementById(service);
    input.checked = settings[service];
    input.addEventListener("change", async () => {
      await browser.runtime.sendMessage({ type: "set-setting", service, enabled: input.checked });
      await refresh();
    });
  }
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  for (const [id, type] of [["retry", "retry"], ["pause", "pause-tab"]]) {
    document.getElementById(id).addEventListener("click", async () => {
      await browser.runtime.sendMessage({ type, tabId });
      await refresh();
    });
  }
  await refresh();
  setInterval(() => refresh().catch(() => {}), 1000);
}
init().catch(() => { document.getElementById("status").textContent = "Impossible de joindre l’extension. Rechargez-la."; });
