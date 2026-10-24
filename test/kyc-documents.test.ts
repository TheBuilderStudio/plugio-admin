import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatFileSize, isSafeDocumentUrl, kycKindLabel } from "../src/lib/kyc-documents.ts";

describe("kycKindLabel", () => {
  it("names the two document kinds and passes anything else through", () => {
    assert.equal(kycKindLabel("PAN_CARD"), "PAN card");
    assert.equal(kycKindLabel("BANK_PROOF"), "Account proof");
    assert.equal(kycKindLabel("OTHER"), "OTHER");
  });
});

describe("formatFileSize", () => {
  it("shows bytes, KB and MB", () => {
    assert.equal(formatFileSize(512), "512 B");
    assert.equal(formatFileSize(1536), "1.5 KB");
    assert.equal(formatFileSize(1_200_000), "1.1 MB");
  });

  it("does not show nonsense for bad input", () => {
    assert.equal(formatFileSize(-1), "—");
    assert.equal(formatFileSize(Number.NaN), "—");
  });
});

describe("isSafeDocumentUrl", () => {
  it("accepts https links only", () => {
    assert.equal(isSafeDocumentUrl("https://files.example.com/kyc/a.pdf?sig=1"), true);
    assert.equal(isSafeDocumentUrl("http://files.example.com/a.pdf"), false);
    assert.equal(isSafeDocumentUrl("javascript:alert(1)"), false);
    assert.equal(isSafeDocumentUrl("data:text/html,<script>1</script>"), false);
    assert.equal(isSafeDocumentUrl("not a url"), false);
  });
});
