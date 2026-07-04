(function () {
  "use strict";

  if (window.location.hostname !== "claude.ai" || window.__claudeBulkDeletePageBridgeLoaded) {
    return;
  }

  window.__claudeBulkDeletePageBridgeLoaded = true;

  const REQUEST_EVENT = "cbd:claude-code-local-delete";
  const RESPONSE_EVENT = "cbd:claude-code-local-delete-result";
  const BRIDGE_WAIT_MS = 2500;
  const BRIDGE_POLL_MS = 50;

  setBridgeState("pending");
  void publishBridgeAvailability();

  document.addEventListener(REQUEST_EVENT, (event) => {
    void handleDeleteRequest(event);
  });

  async function handleDeleteRequest(event) {
    const request = parseDetail(event.detail);
    const requestId = request.requestId || "";
    const sessionId = request.sessionId || "";

    if (!requestId || !sessionId) {
      return;
    }

    try {
      const bridge = await waitForLocalSessionsBridge();
      setBridgeState("ready");
      await Promise.resolve(bridge.delete(sessionId));
      dispatchResponse({ ok: true, requestId });
    } catch (error) {
      if (error?.message === "local sessions bridge unavailable") {
        setBridgeState("unavailable");
      }
      dispatchResponse({
        error: error?.message || "local sessions bridge failed",
        ok: false,
        requestId
      });
    }
  }

  async function waitForLocalSessionsBridge() {
    const startedAt = Date.now();
    while (Date.now() - startedAt < BRIDGE_WAIT_MS) {
      const bridge = findLocalSessionsBridge();
      if (bridge) {
        return bridge;
      }
      await new Promise((resolve) => setTimeout(resolve, BRIDGE_POLL_MS));
    }

    throw new Error("local sessions bridge unavailable");
  }

  async function publishBridgeAvailability() {
    try {
      await waitForLocalSessionsBridge();
      setBridgeState("ready");
    } catch (_error) {
      setBridgeState("unavailable");
    }
  }

  function findLocalSessionsBridge() {
    const bridge = globalThis["claude.web"]?.LocalSessions;
    return bridge && typeof bridge.delete === "function" ? bridge : null;
  }

  function setBridgeState(state) {
    if (document.documentElement) {
      document.documentElement.dataset.cbdClaudeCodeLocalBridge = state;
    }
  }

  function parseDetail(detail) {
    try {
      return JSON.parse(String(detail || "{}"));
    } catch (_error) {
      return {};
    }
  }

  function dispatchResponse(detail) {
    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: JSON.stringify(detail)
    }));
  }
}());
