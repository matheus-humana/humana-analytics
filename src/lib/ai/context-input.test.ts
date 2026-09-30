import assert from "node:assert/strict";
import test from "node:test";

import {
  findContact,
  parseDocumentInput,
  parseProfileInput,
  projectContextForModel,
} from "./context-input.ts";

test("context input rejects emails and phone numbers", () => {
  assert.equal(findContact("time to talk user@humana.ai"), "email");
  assert.equal(findContact("call +55 11 98888-7777"), "phone");
  assert.equal(findContact("(11) 98888-7777"), "phone");
  assert.equal(findContact("11 98888-7777"), "phone");
  assert.equal(findContact("https://humana.ai", "identifier"), null);
  assert.equal(
    parseProfileInput({ siteUrl: "https://humana.ai", audience: "user@humana.ai" }).ok,
    false
  );
});

test("documents cap pasted text and keep links", () => {
  const tooLong = parseDocumentInput({
    title: "Brief",
    kind: "text",
    body: "a".repeat(20_001),
    confidential: false,
  });
  assert.equal(tooLong.ok, false);
  const link = parseDocumentInput({
    title: "Site",
    kind: "link",
    url: "https://example.com/about",
    confidential: true,
  });
  assert.equal(link.ok, true);
});

test("confidential documents are omitted and context carries no quantities", () => {
  const payload = projectContextForModel(
    {
      profile: {
        siteUrl: "https://humana.ai",
        languages: "pt-BR, en",
        audience: "Times de marketing com 40 pessoas",
        positioning: "Analista de marketing",
        goals: "Crescer 20% no trimestre",
      },
      competitors: [{ name: "Okara", domain: "okara.ai", notes: "12 clientes" }],
      documents: [
        {
          title: "Segredo 99",
          kind: "text",
          url: null,
          body: "Receita interna 123",
          confidential: true,
        },
        {
          title: "Público",
          kind: "text",
          url: null,
          body: "O site fala com o time de marketing.",
          confidential: false,
        },
      ],
    },
    "2026-09-29T15:00:00.000Z"
  );

  const encoded = JSON.stringify(payload);
  assert.equal(encoded.includes("Receita"), false);
  assert.equal(encoded.includes("Segredo"), false);
  assert.equal(encoded.includes("40"), false);
  assert.equal(encoded.includes("20%"), false);
  assert.equal(encoded.includes("12"), false);
  assert.equal(payload.confidentialOmitted, true);
  assert.match(String(payload.instruction), /source of numbers/i);
  const citation = payload.citation as { source: string; retrievedAt: string };
  assert.equal(citation.source, "Project context");
  assert.equal(citation.retrievedAt, "2026-09-29T15:00:00.000Z");
});
