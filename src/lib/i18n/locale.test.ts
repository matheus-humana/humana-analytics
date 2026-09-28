import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  getLocaleCookieBootstrapScript,
  localeFromAcceptLanguage,
  resolveRequestLocale,
} from "./locale.ts";

test("the locale cookie wins over Accept-Language", () => {
  assert.equal(resolveRequestLocale("en", "pt-BR,pt;q=0.9"), "en");
  assert.equal(resolveRequestLocale("pt-BR", "en-US,en;q=0.9"), "pt-BR");
  assert.equal(resolveRequestLocale("pt-br", "en"), "pt-BR");
});

test("an invalid cookie falls back to Accept-Language", () => {
  assert.equal(resolveRequestLocale("fr", "en-US,en;q=0.9"), "en");
  assert.equal(resolveRequestLocale("", "pt-BR,en;q=0.8"), "pt-BR");
  assert.equal(resolveRequestLocale(null, null), "pt-BR");
});

test("the bootstrap copies a saved language into the cookie and does not overwrite it", () => {
  const script = getLocaleCookieBootstrapScript();
  const store = new Map<string, string>([["ha-locale:user_1", "en"]]);
  let cookie = "";
  const context = vm.createContext({
    document: {
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        cookie = value;
      },
    },
    localStorage: {
      get length() {
        return store.size;
      },
      key(index: number) {
        return [...store.keys()][index] ?? null;
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
    },
    location: { protocol: "https:" },
  });
  vm.runInContext(script, context);
  assert.match(cookie, /^ha-locale=en;/);
  assert.match(cookie, /Secure/);
  const saved = cookie;
  vm.runInContext(script, context);
  assert.equal(cookie, saved);

  cookie = "ha-locale=pt-BR";
  store.set("ha-locale:guest", "en");
  vm.runInContext(script, context);
  assert.equal(cookie, "ha-locale=pt-BR");
});

test("Accept-Language picks the highest supported language", () => {
  assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9"), "en");
  assert.equal(localeFromAcceptLanguage("pt-BR,pt;q=0.9,en-US;q=0.8"), "pt-BR");
  assert.equal(localeFromAcceptLanguage("en;q=0.4,pt-PT;q=0.9"), "pt-BR");
  assert.equal(localeFromAcceptLanguage("fr-FR,fr;q=0.9,de;q=0.8"), "pt-BR");
  assert.equal(localeFromAcceptLanguage("en;q=0,pt;q=0.5"), "pt-BR");
  assert.equal(localeFromAcceptLanguage("*"), "pt-BR");
});
