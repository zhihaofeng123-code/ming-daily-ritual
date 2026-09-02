import assert from "node:assert/strict";
import test from "node:test";
import { buildUrlStateHref, readUrlState } from "./url-state";

test("buildUrlStateHref updates URL state without dropping unrelated query or hash state", () => {
  assert.equal(
    buildUrlStateHref(
      { pathname: "/examples/orders/order%2F42", search: "?tab=activity&owner=me", hash: "#latest" },
      { tab: "details", compact: true },
    ),
    "/examples/orders/order%2F42?tab=details&owner=me&compact=true#latest",
  );
});

test("buildUrlStateHref deletes only nullish values and preserves empty, zero, and false", () => {
  assert.equal(
    buildUrlStateHref(
      { pathname: "/present/examples/order_1", search: "view=full&stale=1" },
      { view: "", stale: null, page: 0, selected: false, missing: undefined },
    ),
    "/present/examples/order_1?view=&page=0&selected=false",
  );
});

test("buildUrlStateHref clones URLSearchParams and rejects non-App-relative paths", () => {
  const search = new URLSearchParams("view=summary");
  assert.equal(
    buildUrlStateHref({ pathname: "/detail", search }, { view: "full" }),
    "/detail?view=full",
  );
  assert.equal(search.toString(), "view=summary");
  assert.throws(
    () => buildUrlStateHref({ pathname: "https://example.com/detail" }, { view: "full" }),
    /must be App-relative/,
  );
  assert.throws(
    () => buildUrlStateHref({ pathname: "//example.com/detail" }, { view: "full" }),
    /must be App-relative/,
  );
  for (const pathname of ["/\\example.com", "/\t/example.com", "/\n//example.com"]) {
    assert.throws(
      () => buildUrlStateHref({ pathname }, { view: "full" }),
      /must be App-relative/,
    );
  }
  assert.throws(
    () => buildUrlStateHref({ pathname: "/detail" }, { "": "full" }),
    /keys must be non-empty/,
  );
});

test("readUrlState accepts only declared route states", () => {
  const allowed = ["summary", "full"] as const;
  assert.equal(readUrlState("?view=full", "view", allowed, "summary"), "full");
  assert.equal(readUrlState("?view=unknown", "view", allowed, "summary"), "summary");
  assert.equal(readUrlState(new URLSearchParams(), "view", allowed, "summary"), "summary");
});
