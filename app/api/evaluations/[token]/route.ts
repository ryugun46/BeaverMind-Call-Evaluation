import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toPublicEvaluationResponse } from "@/lib/server/evaluation/public-response";
import {
  EvaluationRunRepositoryError,
  STALE_PROCESSING_TIMEOUT_MS,
  failStaleEvaluationRuns,
  getEvaluationRunByPublicToken,
} from "@/lib/server/repositories/evaluation-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PublicTokenSchema = z.string().uuid();

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = PublicTokenSchema.safeParse(params.token);
  if (!token.success) {
    return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
  }

  try {
    let run = await getEvaluationRunByPublicToken(token.data);
    if (!run) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const processingStartedAt = run.processingStartedAt
      ? Date.parse(run.processingStartedAt)
      : Number.NaN;
    if (
      run.status === "processing" &&
      Number.isFinite(processingStartedAt) &&
      Date.now() - processingStartedAt >= STALE_PROCESSING_TIMEOUT_MS
    ) {
      await failStaleEvaluationRuns();
      run = (await getEvaluationRunByPublicToken(token.data)) ?? run;
    }

    return NextResponse.json(toPublicEvaluationResponse(run), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof EvaluationRunRepositoryError) {
      return NextResponse.json(
        { error: "Evaluation lookup is temporarily unavailable" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Could not retrieve evaluation" }, { status: 500 });
  }
}
