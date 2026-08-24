import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument } from "pdf-lib";

import { getPublicEvaluationById } from "@/lib/fixtures/evaluation-fixtures";
import {
  buildEvaluationPdfFilename,
  createEvaluationReportPdf,
} from "@/lib/server/pdf/evaluation-report-pdf";

test("creates a compact, multi-page PDF for a completed evaluation", async () => {
  const evaluation = getPublicEvaluationById("kickoff-elite");
  assert.ok(evaluation);

  const bytes = await createEvaluationReportPdf(evaluation);
  const document = await PDFDocument.load(bytes);

  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-");
  assert.ok(document.getPageCount() >= 3);
  assert.equal(document.getTitle(), "David's Kick-off Review");
  assert.ok(bytes.byteLength < 250_000, `Expected a compact PDF, received ${bytes.byteLength} bytes`);
  assert.equal(buildEvaluationPdfFilename(evaluation), "David-s-Kick-off-Review.pdf");
});

test("rejects PDF creation before an evaluation is completed", async () => {
  const evaluation = getPublicEvaluationById("processing-coaching");
  assert.ok(evaluation);

  await assert.rejects(
    createEvaluationReportPdf(evaluation),
    /completed evaluation result is required/
  );
});
