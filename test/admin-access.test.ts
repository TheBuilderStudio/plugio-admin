import { test } from "node:test";
import assert from "node:assert/strict";
import { accessForRole } from "../src/lib/admin-roles.ts";

test("support can review access requests but not change prices or coupons", () => {
  const a = accessForRole("SUPPORT");
  assert.equal(a.can("REVIEW_BETA"), true);
  assert.equal(a.can("EDIT_PLANS"), false);
  assert.equal(a.can("MANAGE_COUPONS"), false);
  assert.equal(a.can("VIEW_MONEY"), false);
});

test("finance sees money but cannot approve access or edit prices", () => {
  const a = accessForRole("FINANCE");
  assert.equal(a.can("VIEW_MONEY"), true);
  assert.equal(a.can("REVIEW_BETA"), false);
  assert.equal(a.can("EDIT_PLANS"), false);
});

test("super admin can do everything", () => {
  const a = accessForRole("SUPER_ADMIN");
  for (const c of ["VIEW", "REVIEW_BETA", "MANAGE_COUPONS", "EDIT_PLANS", "VIEW_MONEY", "VIEW_LOGS", "MANAGE_ADMINS"] as const) {
    assert.equal(a.can(c), true, c);
  }
});
