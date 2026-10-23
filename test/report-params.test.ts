import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isReportName, parseRange, parseTransactionFilter } from "../src/lib/report-params.ts";

describe("parseTransactionFilter", () => {
  it("keeps valid values and normalises case", () => {
    assert.deepEqual(parseTransactionFilter({ kind: "store", status: "paid", from: "2026-10-01", to: "2026-10-23", q: " a@b.com " }), {
      kind: "STORE", status: "PAID", from: "2026-10-01", to: "2026-10-23", q: "a@b.com",
    });
  });

  it("drops anything the backend should never see", () => {
    const f = parseTransactionFilter({ kind: "ADMIN", status: "paid; drop", from: "yesterday", to: "2026-13-45" });
    assert.deepEqual(f, { kind: undefined, status: undefined, from: undefined, to: undefined, q: undefined });
  });

  it("takes the first of repeated parameters and caps the search length", () => {
    assert.equal(parseTransactionFilter({ kind: ["BOOKING", "STORE"] }).kind, "BOOKING");
    assert.equal(parseTransactionFilter({ q: "x".repeat(500) }).q?.length, 100);
  });
});

describe("parseRange and isReportName", () => {
  it("returns only the dates", () => {
    assert.deepEqual(parseRange({ from: "2026-01-01", kind: "STORE" }), { from: "2026-01-01", to: undefined });
  });

  it("accepts only known report names", () => {
    assert.ok(isReportName("revenue"));
    assert.ok(isReportName("money-by-creator"));
    assert.ok(!isReportName("../etc/passwd"));
  });
});
