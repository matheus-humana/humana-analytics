import assert from "node:assert/strict";
import test from "node:test";

import { workspaceCopy } from "./workspace-copy.ts";

test("workspace copy has the same keys in Portuguese and English", () => {
  const portuguese = Object.keys(workspaceCopy["pt-BR"]).sort();
  const english = Object.keys(workspaceCopy.en).sort();
  assert.deepEqual(portuguese, english);
  for (const key of portuguese) {
    const pt = workspaceCopy["pt-BR"][key as keyof typeof workspaceCopy["pt-BR"]];
    const en = workspaceCopy.en[key as keyof typeof workspaceCopy.en];
    assert.equal(pt.trim().length > 0, true, key);
    assert.equal(en.trim().length > 0, true, key);
  }
});
