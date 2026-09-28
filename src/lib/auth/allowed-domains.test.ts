import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ALLOWED_DOMAINS,
  googleProfileMaySignIn,
  isAllowedCompanyEmail,
  parseAllowedDomains,
} from "./allowed-domains.ts";

test("the default list is the Humana domains", () => {
  assert.deepEqual(parseAllowedDomains(undefined), [...DEFAULT_ALLOWED_DOMAINS]);
  assert.deepEqual(parseAllowedDomains(""), [...DEFAULT_ALLOWED_DOMAINS]);
  assert.deepEqual(parseAllowedDomains("   "), [...DEFAULT_ALLOWED_DOMAINS]);
});

test("AUTH_ALLOWED_DOMAINS replaces the default and ignores invalid tokens", () => {
  assert.deepEqual(parseAllowedDomains("example.com, not a domain, @Example.com"), [
    "example.com",
  ]);
  assert.deepEqual(parseAllowedDomains("humana.ai, humana-ai.com"), [
    "humana.ai",
    "humana-ai.com",
  ]);
  assert.deepEqual(parseAllowedDomains("not-a-domain"), []);
});

test("company domains are allowed and other domains are not", () => {
  const domains = parseAllowedDomains(undefined);
  assert.equal(isAllowedCompanyEmail("maria@humana.ai", domains), true);
  assert.equal(isAllowedCompanyEmail("Maria@Humana.AI", domains), true);
  assert.equal(isAllowedCompanyEmail("maria+analytics@humana-ai.com", domains), true);
  assert.equal(isAllowedCompanyEmail("maria@gmail.com", domains), false);
  assert.equal(isAllowedCompanyEmail("maria@evil.humana.ai", domains), false);
  assert.equal(isAllowedCompanyEmail("maria@humana.ai.attacker.com", domains), false);
  assert.equal(isAllowedCompanyEmail("maria@", domains), false);
  assert.equal(isAllowedCompanyEmail("not-an-email", domains), false);
  assert.equal(isAllowedCompanyEmail(null, domains), false);
  assert.equal(isAllowedCompanyEmail("maria@humana.ai", []), false);
});

test("an explicit env list does not keep the default domains", () => {
  const domains = parseAllowedDomains("partner.example");
  assert.equal(isAllowedCompanyEmail("ana@partner.example", domains), true);
  assert.equal(isAllowedCompanyEmail("ana@humana.ai", domains), false);
});

test("Google sign-in requires a verified company email", () => {
  const domains = parseAllowedDomains(undefined);
  assert.equal(
    googleProfileMaySignIn(
      { email: "maria@humana.ai", email_verified: true },
      domains
    ),
    true
  );
  assert.equal(
    googleProfileMaySignIn(
      { email: "maria@humana-ai.com", email_verified: "true" },
      domains
    ),
    true
  );
  assert.equal(
    googleProfileMaySignIn(
      { email: "maria@humana.ai", email_verified: false },
      domains
    ),
    false
  );
  assert.equal(
    googleProfileMaySignIn({ email: "maria@humana.ai" }, domains),
    false
  );
  assert.equal(
    googleProfileMaySignIn(
      { email: "maria@gmail.com", email_verified: true },
      domains
    ),
    false
  );
  assert.equal(googleProfileMaySignIn(null, domains), false);
});
