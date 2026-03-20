import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultPiToolName,
  inferCursorExecType,
} from "../../../src/bridge/shared/tool-names.js";

// ─── getDefaultPiToolName ───────────────────────────────────────────

test("getDefaultPiToolName maps read → read", () => {
  assert.equal(getDefaultPiToolName("read"), "read");
});

test("getDefaultPiToolName maps write → write", () => {
  assert.equal(getDefaultPiToolName("write"), "write");
});

test("getDefaultPiToolName maps shell → bash", () => {
  assert.equal(getDefaultPiToolName("shell"), "bash");
});

test("getDefaultPiToolName maps grep → bash", () => {
  assert.equal(getDefaultPiToolName("grep"), "bash");
});

test("getDefaultPiToolName maps ls → bash", () => {
  assert.equal(getDefaultPiToolName("ls"), "bash");
});

test("getDefaultPiToolName maps delete → bash", () => {
  assert.equal(getDefaultPiToolName("delete"), "bash");
});

test("getDefaultPiToolName maps write-binary → bash", () => {
  assert.equal(getDefaultPiToolName("write-binary"), "bash");
});

// ─── inferCursorExecType ────────────────────────────────────────────

test("inferCursorExecType infers read from piToolName read", () => {
  assert.equal(inferCursorExecType("read", { path: "a.ts" }), "read");
});

test("inferCursorExecType infers write from piToolName write", () => {
  assert.equal(
    inferCursorExecType("write", { path: "a.ts", content: "hi" }),
    "write",
  );
});

test("inferCursorExecType infers shell from generic bash command", () => {
  assert.equal(inferCursorExecType("bash", { command: "echo hello" }), "shell");
});

test("inferCursorExecType infers grep from rg command", () => {
  assert.equal(
    inferCursorExecType("bash", { command: "rg -n pattern src/" }),
    "grep",
  );
});

test("inferCursorExecType infers grep from grep command", () => {
  assert.equal(
    inferCursorExecType("bash", { command: "grep -r todo ." }),
    "grep",
  );
});

test("inferCursorExecType infers ls from ls command", () => {
  assert.equal(
    inferCursorExecType("bash", { command: "ls -A1p -- '/tmp'" }),
    "ls",
  );
});

test("inferCursorExecType infers delete from rm command", () => {
  assert.equal(
    inferCursorExecType("bash", { command: "rm '/tmp/x.txt'" }),
    "delete",
  );
});

test("inferCursorExecType infers ls from find command", () => {
  assert.equal(
    inferCursorExecType("bash", { command: "find . -name '*.ts'" }),
    "ls",
  );
});

test("inferCursorExecType infers write-binary from base64 command", () => {
  assert.equal(
    inferCursorExecType("bash", { command: "base64 -d > /tmp/img.png" }),
    "write-binary",
  );
});

test("inferCursorExecType returns undefined for edit", () => {
  assert.equal(
    inferCursorExecType("edit", { path: "a.ts", oldText: "a", newText: "b" }),
    undefined,
  );
});

test("inferCursorExecType returns undefined for unknown tool", () => {
  assert.equal(inferCursorExecType("subagent", {}), undefined);
});
