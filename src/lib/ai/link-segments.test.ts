import assert from "node:assert/strict";
import test from "node:test";

import { linkSegments } from "./link-segments.ts";

test("URLs become link segments and trailing punctuation stays text", () => {
  assert.deepEqual(linkSegments("Veja https://web.dev/vitals/. Depois (https://a.com/x)"), [
    { kind: "text", value: "Veja " },
    { kind: "link", value: "https://web.dev/vitals/" },
    { kind: "text", value: ". Depois (" },
    { kind: "link", value: "https://a.com/x" },
    { kind: "text", value: ")" },
  ]);
});

test("text without URLs stays a single segment", () => {
  assert.deepEqual(linkSegments("Sem links aqui."), [{ kind: "text", value: "Sem links aqui." }]);
  assert.deepEqual(linkSegments(""), []);
});

test("non-http schemes are not linked", () => {
  assert.deepEqual(linkSegments("javascript:alert(1)"), [
    { kind: "text", value: "javascript:alert(1)" },
  ]);
});
