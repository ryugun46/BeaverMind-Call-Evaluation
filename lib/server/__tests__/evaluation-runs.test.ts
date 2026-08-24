import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_TRANSCRIPT_BYTES,
  TranscriptTooLargeError,
  createEvaluationRunsRepository,
} from "@/lib/server/repositories/evaluation-runs";
import {
  createEvaluationRuntimeConfigRepository,
} from "@/lib/server/repositories/evaluation-runtime-config";
import {
  EvaluationModelSlugSchema,
  OpenRouterModelSlugSchema,
} from "@/lib/evaluation-models";

const RUN_ID = "22222222-2222-4222-8222-222222222222";
const PUBLIC_TOKEN = "11111111-1111-4111-8111-111111111111";
const TIMESTAMP = "2026-08-24T08:00:00.000Z";

const queuedRow = {
  id: RUN_ID,
  public_token: PUBLIC_TOKEN,
  call_type: "kickoff",
  transcript: "A persisted transcript.",
  status: "queued",
  rubric_version: "kickoff-v1",
  model_provider: "openrouter",
  model_name: "openai/gpt-4.1-mini",
  structured_result: null,
  error_code: null,
  error_message: null,
  error_details: null,
  processing_started_at: null,
  completed_at: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

type QueryResult = { data: unknown; error: unknown };
type Request = {
  table: string;
  action?: "insert" | "select" | "update" | "rpc";
  values?: unknown;
  filter?: [string, unknown];
  inFilter?: [string, unknown[]];
  order?: [string, { ascending: boolean }];
  limit?: number;
};

class FakeQuery {
  constructor(
    private readonly request: Request,
    private readonly result: QueryResult
  ) {}

  insert(values: unknown) {
    this.request.action = "insert";
    this.request.values = values;
    return this;
  }

  update(values: unknown) {
    this.request.action = "update";
    this.request.values = values;
    return this;
  }

  select() {
    this.request.action ??= "select";
    return this;
  }

  eq(column: string, value: unknown) {
    this.request.filter = [column, value];
    return this;
  }

  in(column: string, values: unknown[]) {
    this.request.inFilter = [column, values];
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.request.order = [column, options];
    return this;
  }

  async limit(value: number) {
    this.request.limit = value;
    return this.result;
  }

  async single() {
    return this.result;
  }

  async maybeSingle() {
    return this.result;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

class FakeClient {
  readonly requests: Request[] = [];

  constructor(private readonly results: QueryResult[]) {}

  from(table: string) {
    const request: Request = { table };
    this.requests.push(request);
    const result = this.results.shift();
    if (!result) throw new Error("Fake client has no result for query");
    return new FakeQuery(request, result);
  }

  rpc(functionName: string, values: unknown) {
    const request: Request = {
      table: functionName,
      action: "rpc",
      values,
    };
    this.requests.push(request);
    const result = this.results.shift();
    if (!result) throw new Error("Fake client has no result for query");
    return new FakeQuery(request, result);
  }
}

function repositoryWith(results: QueryResult[]) {
  const fake = new FakeClient(results);
  const repository = createEvaluationRunsRepository(
    fake as unknown as SupabaseClient
  );
  return { fake, repository };
}

test("repository creates a queued run with the authoritative rubric version", async () => {
  const { fake, repository } = repositoryWith([{ data: queuedRow, error: null }]);

  const created = await repository.create({
    callType: "kickoff",
    modelSlug: "anthropic/claude-sonnet-4.6",
    transcript: "  A persisted transcript.  ",
  });

  assert.equal(created.publicToken, PUBLIC_TOKEN);
  assert.equal(created.run.id, RUN_ID);
  assert.equal(created.run.status, "queued");
  assert.deepEqual(fake.requests[0], {
    table: "evaluation_runs",
    action: "insert",
    values: {
      call_type: "kickoff",
      transcript: "A persisted transcript.",
      rubric_version: "kickoff-v1",
      model_provider: "openrouter",
      model_name: "anthropic/claude-sonnet-4.6",
    },
  });
});

test("repository retrieves and validates a persisted run by id", async () => {
  const { fake, repository } = repositoryWith([{ data: queuedRow, error: null }]);

  const run = await repository.getById(RUN_ID);

  assert.equal(run?.transcript, "A persisted transcript.");
  assert.deepEqual(fake.requests[0]?.filter, ["id", RUN_ID]);
});

test("repository retrieves a persisted run by permanent public token", async () => {
  const { fake, repository } = repositoryWith([{ data: queuedRow, error: null }]);

  const run = await repository.getByPublicToken(PUBLIC_TOKEN);

  assert.equal(run?.id, RUN_ID);
  assert.deepEqual(fake.requests[0]?.filter, ["public_token", PUBLIC_TOKEN]);
});

test("repository lists finalized runs newest first without loading transcripts", async () => {
  const completedRow = {
    ...queuedRow,
    transcript: undefined,
    status: "completed",
    processing_started_at: TIMESTAMP,
    completed_at: TIMESTAMP,
  };
  const failedRow = {
    ...queuedRow,
    transcript: undefined,
    status: "failed",
    processing_started_at: TIMESTAMP,
    completed_at: TIMESTAMP,
    error_code: "MODEL_ERROR",
    error_message: "The model could not complete the evaluation.",
  };
  const { fake, repository } = repositoryWith([
    { data: [completedRow, failedRow], error: null },
  ]);

  const history = await repository.listFinalized(50);

  assert.equal(history.length, 2);
  assert.equal(history[0]?.publicToken, PUBLIC_TOKEN);
  assert.equal(history[0]?.evaluation.status, "completed");
  assert.equal(history[1]?.evaluation.status, "failed");
  assert.deepEqual(fake.requests[0], {
    table: "evaluation_runs",
    action: "select",
    inFilter: ["status", ["completed", "failed"]],
    order: ["created_at", { ascending: false }],
    limit: 50,
  });
});

test("repository returns null when an evaluation run is not found", async () => {
  const { repository } = repositoryWith([{ data: null, error: null }]);
  assert.equal(await repository.getById(RUN_ID), null);
});

test("repository rejects an oversized UTF-8 transcript before querying", async () => {
  const { fake, repository } = repositoryWith([]);
  const transcript = `${"a".repeat(MAX_TRANSCRIPT_BYTES)}é`;

  await assert.rejects(
    repository.create({
      callType: "coaching",
      modelSlug: "google/gemini-3.7-flash",
      transcript,
    }),
    TranscriptTooLargeError
  );
  assert.equal(fake.requests.length, 0);
});

test("repository atomically claims the next queued run through the server RPC", async () => {
  const processingRow = {
    ...queuedRow,
    status: "processing",
    processing_started_at: TIMESTAMP,
  };
  const { fake, repository } = repositoryWith([
    { data: processingRow, error: null },
  ]);

  const claimed = await repository.claimNextQueued();

  assert.equal(claimed?.status, "processing");
  assert.deepEqual(fake.requests[0], {
    table: "claim_next_evaluation_run",
    action: "rpc",
    values: undefined,
  });
});

test("repository fails abandoned processing runs through the server RPC", async () => {
  const failedRow = {
    ...queuedRow,
    status: "failed",
    processing_started_at: TIMESTAMP,
    completed_at: TIMESTAMP,
    error_code: "PROCESSING_TIMEOUT",
    error_message: "The evaluation worker stopped before this run could finish.",
    error_details: { timeoutSeconds: 360, retryable: true },
  };
  const { fake, repository } = repositoryWith([
    { data: [failedRow], error: null },
  ]);

  const failed = await repository.failStaleProcessing();

  assert.equal(failed[0]?.status, "failed");
  assert.deepEqual(fake.requests[0], {
    table: "fail_stale_evaluation_runs",
    action: "rpc",
    values: undefined,
  });
});

test("runtime configuration repository retrieves a validated model slug", async () => {
  const fake = new FakeClient([
    { data: { model_slug: "anthropic/claude-sonnet-4" }, error: null },
  ]);
  const repository = createEvaluationRuntimeConfigRepository(
    fake as unknown as SupabaseClient
  );

  assert.equal(
    await repository.getModelSlug(),
    "anthropic/claude-sonnet-4"
  );
  assert.deepEqual(fake.requests[0], {
    table: "evaluation_runtime_config",
    action: "select",
    filter: ["id", 1],
  });
});

test("runtime model selection requires an OpenRouter provider/model slug", () => {
  assert.equal(
    EvaluationModelSlugSchema.parse("openai/gpt-4.1-mini"),
    "openai/gpt-4.1-mini"
  );
  assert.throws(() => EvaluationModelSlugSchema.parse("gpt-4.1-mini"));
  assert.equal(
    OpenRouterModelSlugSchema.parse("provider/retired-model"),
    "provider/retired-model"
  );
  assert.throws(() =>
    EvaluationModelSlugSchema.parse("provider/retired-model")
  );
});
