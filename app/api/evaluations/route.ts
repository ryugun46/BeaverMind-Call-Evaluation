import { waitUntil } from "@vercel/functions";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  CreateEvaluationInputSchema,
  CreateEvaluationResponseSchema,
} from "@/lib/contracts/evaluation";
import {
  EvaluationRunRepositoryError,
  TranscriptTooLargeError,
  createEvaluationRun,
} from "@/lib/server/repositories/evaluation-runs";
import { createEvaluationProcessor } from "@/lib/server/evaluation/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function processQueuedEvaluation() {
  return Promise.resolve()
    .then(() => createEvaluationProcessor().processNext())
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "Unknown background processing error";
      console.error(`Evaluation background processing failed: ${message}`);
    });
}

export async function POST(request: NextRequest) {
  try {
    const input = CreateEvaluationInputSchema.parse(await request.json());
    const created = await createEvaluationRun(input);
    const evaluationUrl = new URL(
      `/evaluation/${created.publicToken}`,
      request.nextUrl.origin
    ).toString();

    waitUntil(processQueuedEvaluation());

    return NextResponse.json(
      CreateEvaluationResponseSchema.parse({
        id: created.run.id,
        status: created.run.status,
        evaluationUrl,
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TranscriptTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid evaluation submission",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    if (error instanceof EvaluationRunRepositoryError) {
      return NextResponse.json(
        { error: "Evaluation persistence is temporarily unavailable" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Could not create evaluation" },
      { status: 500 }
    );
  }
}
