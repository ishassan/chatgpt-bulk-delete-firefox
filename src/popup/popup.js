(() => {
  "use strict";

  const ENABLED_STORAGE_KEY = "extensionEnabled";
  const toggle = document.querySelector("#extension-enabled");
  const status = document.querySelector("#status");

  function extensionApi() {
    if (typeof browser === "object" && browser) return browser;
    if (typeof chrome === "object" && chrome) return chrome;
    return null;
  }

  function render(enabled) {
    toggle.checked = enabled;
    status.textContent = enabled ? "Enabled on supported sites" : "Disabled";
  }

  async function initialize() {
    const api = extensionApi();
    let enabled = true;
    try {
      const values = await api?.storage?.local?.get?.(ENABLED_STORAGE_KEY);
      enabled = values?.[ENABLED_STORAGE_KEY] !== false;
    } catch (_error) {
      enabled = true;
    }

    render(enabled);
    document.body.dataset.ready = "true";

    toggle.addEventListener("change", async () => {
      const nextEnabled = toggle.checked;
      render(nextEnabled);
      try {
        await api?.storage?.local?.set?.({ [ENABLED_STORAGE_KEY]: nextEnabled });
      } catch (_error) {
        render(!nextEnabled);
        status.textContent = "Could not save setting";
      }
    });
  }

  void initialize();
})();
