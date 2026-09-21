import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSyncAuthorized } from "./sync-auth";

describe("isSyncAuthorized", () => {
  it("allows every request when no secret is configured", () => {
    const request = new Request("http://localhost/api/sync/ga4", {
      method: "POST",
    });
    assert.equal(isSyncAuthorized(request, undefined), true);
  });

  it("accepts the x-sync-secret header", () => {
    const request = new Request("http://localhost/api/sync/ga4", {
      method: "POST",
      headers: { "x-sync-secret": "local-secret" },
    });
    assert.equal(isSyncAuthorized(request, "local-secret"), true);
  });

  it("accepts a bearer token", () => {
    const request = new Request("http://localhost/api/sync/ga4", {
      method: "POST",
      headers: { authorization: "Bearer local-secret" },
    });
    assert.equal(isSyncAuthorized(request, "local-secret"), true);
  });

  it("rejects a missing or wrong secret", () => {
    const request = new Request("http://localhost/api/sync/ga4", {
      method: "POST",
    });
    assert.equal(isSyncAuthorized(request, "local-secret"), false);
  });
});
