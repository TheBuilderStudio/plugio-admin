import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  couponRuntimeStatus,
  datetimeLocalToIso,
  parseMysqlUtcDate,
  parseRequiredExpiry,
  toMysqlUtcDateTime,
} from "../src/lib/coupon-expiry.ts";

describe("coupon expiry (stored as UTC DATETIME)", () => {
  it("reads a naive MySQL DATETIME as UTC", () => {
    assert.equal(parseMysqlUtcDate("2026-10-23 12:30:00")?.toISOString(), "2026-10-23T12:30:00.000Z");
  });

  it("round-trips through the MySQL literal without shifting", () => {
    const d = new Date("2026-10-23T12:30:45.000Z");
    assert.equal(toMysqlUtcDateTime(d), "2026-10-23 12:30:45");
    assert.equal(parseMysqlUtcDate(toMysqlUtcDateTime(d))?.getTime(), d.getTime());
  });

  it("returns null for empty or invalid input", () => {
    assert.equal(parseMysqlUtcDate(null), null);
    assert.equal(parseMysqlUtcDate("  "), null);
    assert.equal(parseMysqlUtcDate("not a date"), null);
    assert.equal(datetimeLocalToIso("garbage"), "");
    assert.throws(() => toMysqlUtcDateTime(new Date("nope")));
  });

  it("rejects an expiry in the past", () => {
    assert.equal(parseRequiredExpiry("2000-01-01T00:00:00Z"), null);
    assert.ok(parseRequiredExpiry(new Date(Date.now() + 86_400_000).toISOString()));
  });

  it("derives runtime status", () => {
    const future = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    assert.equal(couponRuntimeStatus(false, future), "Inactive");
    assert.equal(couponRuntimeStatus(true, future), "Active");
    assert.equal(couponRuntimeStatus(true, past), "Expired");
    assert.equal(couponRuntimeStatus(true, null), "Expired");
  });
});
