import { test } from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("manifest packages ChatGPT, Claude Web, and Claude Code support in one extension", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
  const hostPermissions = new Set(manifest.host_permissions);
  const contentScripts = manifest.content_scripts;

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "LLM Chat Bulk Delete");
  assert.equal(hostPermissions.has("https://chatgpt.com/*"), true);
  assert.equal(hostPermissions.has("https://chat.openai.com/*"), true);
  assert.equal(hostPermissions.has("https://claude.ai/*"), true);

  assert.deepEqual(
    contentScripts.map((script) => script.matches),
    [
      ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      ["https://claude.ai/*"],
      ["https://claude.ai/*"]
    ]
  );
  assert.deepEqual(contentScripts[0].js, ["src/chatgpt/content.js"]);
  assert.deepEqual(contentScripts[0].css, ["src/chatgpt/content.css"]);
  assert.deepEqual(contentScripts[1].js, ["src/claude/page-bridge.js"]);
  assert.equal(contentScripts[1].world, "MAIN");
  assert.deepEqual(contentScripts[2].js, ["src/claude/core.js", "src/claude/content.js"]);
  assert.deepEqual(contentScripts[2].css, ["src/claude/content.css"]);

  const packagedFiles = contentScripts.flatMap((script) => [
    ...(script.js || []),
    ...(script.css || [])
  ]);
  await Promise.all(packagedFiles.map((path) => access(new URL(path, root))));
});

test("content scripts do not include UI deletion fallback code", async () => {
  const fallbackPatterns = [
    /\bdeleteViaVisibleUi\b/,
    /\bfindConfirmDeleteButton\b/,
    /\bfindDeleteMenuItem\b/,
    /\bopenContextMenu\b/,
    /\bdispatchSyntheticInput\b/,
    /\bclickElement\b/,
    /UI retry/,
    /Retrying through UI/,
    /fallback needs the chat to be visible/
  ];
  const files = [
    "src/chatgpt/content.js",
    "src/claude/core.js",
    "src/claude/content.js"
  ];

  for (const file of files) {
    const source = await readFile(new URL(file, root), "utf8");
    for (const pattern of fallbackPatterns) {
      assert.doesNotMatch(source, pattern, `${file} contains UI deletion fallback: ${pattern}`);
    }
  }
});
