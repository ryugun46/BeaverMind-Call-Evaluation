import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getPublicEvaluationById } from "@/lib/fixtures/evaluation-fixtures";
import { toPublicEvaluationResponse } from "@/lib/server/evaluation/public-response";
import {
  EvaluationRunRepositoryError,
  getEvaluationRunByPublicToken,
} from "@/lib/server/repositories/evaluation-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PublicTokenSchema = z.string().uuid();

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const fixture = getPublicEvaluationById(params.token);
    const token = PublicTokenSchema.safeParse(params.token);
    const persistedRun = !fixture && token.success
      ? await getEvaluationRunByPublicToken(token.data)
      : null;
    const evaluation = fixture ??
      (persistedRun ? toPublicEvaluationResponse(persistedRun) : null);

    if (!evaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }
    if (evaluation.status !== "completed" || !evaluation.result) {
      return NextResponse.json(
        { error: "The PDF is available after the evaluation completes" },
        { status: 409 }
      );
    }

    // Keep the PDF implementation out of the report's normal server/client bundle.
    // It is loaded only when this download endpoint is requested.
    const { buildEvaluationPdfFilename, createEvaluationReportPdf } = await import(
      "@/lib/server/pdf/evaluation-report-pdf"
    );
    const bytes = await createEvaluationReportPdf(evaluation);
    const filename = buildEvaluationPdfFilename(evaluation);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof EvaluationRunRepositoryError) {
      return NextResponse.json(
        { error: "Evaluation lookup is temporarily unavailable" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Could not create the PDF" }, { status: 500 });
  }
}
