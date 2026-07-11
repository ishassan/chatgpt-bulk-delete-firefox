import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);

async function loadScript(name) {
  return readFile(new URL(name, root), "utf8");
}

async function waitFor(window, predicate, timeoutMs = 1500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = predicate();
    if (result) return result;
    await new Promise((resolve) => window.setTimeout(resolve, 20));
  }
  throw new Error("timed out waiting for condition");
}

function installStorageApi(window, initialEnabled) {
  let listener = null;
  const writes = [];
  window.browser = {
    storage: {
      local: {
        async get() {
          return { extensionEnabled: initialEnabled };
        },
        async set(value) {
          writes.push(value);
        }
      },
      onChanged: {
        addListener(callback) {
          listener = callback;
        }
      }
    }
  };
  return {
    emit(enabled) {
      listener?.({ extensionEnabled: { newValue: enabled } }, "local");
    },
    writes
  };
}

test("Claude panel follows the persisted extension toggle", async () => {
  const instance = new JSDOM(`<body><aside aria-label="Sidebar"><a href="/chat/111">Test chat</a></aside></body>`, {
    pretendToBeVisual: true,
    runScripts: "dangerously",
    url: "https://claude.ai/new"
  });

  try {
    const storage = installStorageApi(instance.window, false);
    instance.window.eval(await loadScript("src/claude/core.js"));
    instance.window.eval(await loadScript("src/claude/content.js"));
    await new Promise((resolve) => instance.window.setTimeout(resolve, 100));
    assert.equal(instance.window.document.querySelector(".cbd-panel"), null);

    storage.emit(true);
    await waitFor(instance.window, () => instance.window.document.querySelector(".cbd-panel"));
    instance.window.document.querySelector("[data-cbd-action='toggle']")?.click();
    await waitFor(instance.window, () => instance.window.document.querySelector(".cbd-selector"));

    storage.emit(false);
    await waitFor(instance.window, () => !instance.window.document.querySelector(".cbd-panel"));
    assert.equal(instance.window.document.querySelector(".cbd-selector"), null);
  } finally {
    instance.window.close();
  }
});

test("ChatGPT panel follows the persisted extension toggle", async () => {
  const instance = new JSDOM(`<body><nav><a href="/c/11111111-1111-4111-8111-111111111111">Test chat</a></nav></body>`, {
    pretendToBeVisual: true,
    runScripts: "dangerously",
    url: "https://chatgpt.com/"
  });

  try {
    const storage = installStorageApi(instance.window, false);
    instance.window.HTMLElement.prototype.getBoundingClientRect = () => ({
      bottom: 40,
      height: 32,
      left: 16,
      right: 296,
      top: 8,
      width: 280,
      x: 16,
      y: 8
    });
    instance.window.eval(await loadScript("src/chatgpt/content.js"));
    await new Promise((resolve) => instance.window.setTimeout(resolve, 100));
    assert.equal(instance.window.document.querySelector(".cgptbd-panel"), null);

    storage.emit(true);
    await waitFor(instance.window, () => instance.window.document.querySelector(".cgptbd-panel"));
    instance.window.document.querySelector("[data-cgptbd-action='toggle']")?.click();
    await waitFor(instance.window, () => instance.window.document.querySelector(".cgptbd-selector"));

    storage.emit(false);
    await waitFor(instance.window, () => !instance.window.document.querySelector(".cgptbd-panel"));
    assert.equal(instance.window.document.querySelector(".cgptbd-selector"), null);
  } finally {
    instance.window.close();
  }
});

test("toolbar popup persists and renders the enabled state", async () => {
  const instance = new JSDOM(`
    <body>
      <input id="extension-enabled" type="checkbox">
      <div id="status"></div>
    </body>
  `, { pretendToBeVisual: true, runScripts: "dangerously", url: "moz-extension://test/popup.html" });

  try {
    const storage = installStorageApi(instance.window, false);
    instance.window.eval(await loadScript("src/popup/popup.js"));
    await waitFor(instance.window, () => instance.window.document.body.dataset.ready === "true");

    const toggle = instance.window.document.querySelector("#extension-enabled");
    assert.equal(toggle.checked, false);
    assert.equal(instance.window.document.querySelector("#status")?.textContent, "Disabled");

    toggle.checked = true;
    toggle.dispatchEvent(new instance.window.Event("change", { bubbles: true }));
    await waitFor(instance.window, () => storage.writes.length === 1);
    assert.equal(JSON.stringify(storage.writes), JSON.stringify([{ extensionEnabled: true }]));
    assert.equal(instance.window.document.querySelector("#status")?.textContent, "Enabled on supported sites");
  } finally {
    instance.window.close();
  }
});
