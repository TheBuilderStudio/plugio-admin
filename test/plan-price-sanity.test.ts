import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planPriceProblem } from "../src/lib/plan-price-sanity.ts";

const creator = { monthly: 15, twoMonths: 27, threeMonths: 39 };
const pro = { monthly: 20, twoMonths: 36, threeMonths: 51 };

describe("planPriceProblem", () => {
  it("accepts the default catalog", () => {
    assert.equal(planPriceProblem("USD", creator, pro), null);
  });
  it("rejects a longer term that is not dearer than the shorter one", () => {
    assert.match(planPriceProblem("USD", { ...creator, threeMonths: 27 }, pro) ?? "", /3 months must cost more than 2/);
  });
  it("rejects a term dearer than paying monthly repeatedly", () => {
    assert.match(planPriceProblem("INR", creator, { ...pro, twoMonths: 45 }) ?? "", /Pro: 2 months costs more/);
  });
  it("rejects Pro below Creator", () => {
    assert.match(planPriceProblem("USD", creator, { monthly: 14, twoMonths: 26.5, threeMonths: 38.5 }) ?? "", /below Creator/);
  });
});
