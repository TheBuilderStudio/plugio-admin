import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { csvCell, toCsv } from "../src/lib/csv.ts";

describe("csvCell", () => {
  it("quotes every cell and doubles embedded quotes", () => {
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell("a,b\nc"), '"a,b\nc"');
  });

  it("renders null and undefined as an empty quoted cell", () => {
    assert.equal(csvCell(null), '""');
    assert.equal(csvCell(undefined), '""');
  });

  it("neutralises spreadsheet formulas typed by users", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      assert.ok(csvCell(evil).startsWith(`"'`), `${JSON.stringify(evil)} must be prefixed`);
    }
  });

  it("leaves ordinary text and numbers alone, including a minus inside text", () => {
    assert.equal(csvCell("Alok Kumar"), '"Alok Kumar"');
    assert.equal(csvCell(1200), '"1200"');
    assert.equal(csvCell("a-b"), '"a-b"');
  });
});

describe("toCsv", () => {
  it("writes the header then each row", () => {
    assert.equal(toCsv(["a", "b"], [[1, "=x"]]), `"a","b"\n"1","'=x"`);
  });
});
