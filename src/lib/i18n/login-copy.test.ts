import assert from "node:assert/strict";
import test from "node:test";

import { loginCopy } from "./login-copy.ts";

test("login copy has the same keys in Portuguese and English", () => {
  const portuguese = Object.keys(loginCopy["pt-BR"]).sort();
  const english = Object.keys(loginCopy.en).sort();
  assert.deepEqual(portuguese, english);
  for (const key of portuguese) {
    const pt = loginCopy["pt-BR"][key as keyof typeof loginCopy["pt-BR"]];
    const en = loginCopy.en[key as keyof typeof loginCopy.en];
    assert.equal(pt.trim().length > 0, true, key);
    assert.equal(en.trim().length > 0, true, key);
  }
});
