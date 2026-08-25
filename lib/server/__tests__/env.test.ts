import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getServerEnvironment } from "@/lib/server/env";
import { createServerSupabaseClient } from "@/lib/server/supabase";
import {
  EvaluationEnvironmentError,
  getOpenRouterEnvironment,
} from "@/lib/server/evaluation/environment";

test("server environment accepts only the required backend credentials", () => {
  const environment = getServerEnvironment({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "server-secret",
  });

  assert.deepEqual(environment, {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "server-secret",
  });

  const client = createServerSupabaseClient(environment) as unknown as {
    supabaseKey: string;
  };
  assert.equal(client.supabaseKey, "server-secret");
});

test("server environment accepts lowercase Beaver-prefixed Vercel credentials", () => {
  const environment = getServerEnvironment({
    beaver_SUPABASE_URL: "https://project.supabase.co",
    beaver_SUPABASE_SECRET_KEY: "prefixed-server-secret",
  });

  assert.deepEqual(environment, {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "prefixed-server-secret",
  });
});

test("unprefixed server credentials take precedence over integration aliases", () => {
  const environment = getServerEnvironment({
    SUPABASE_URL: "https://primary.supabase.co",
    SUPABASE_SECRET_KEY: "primary-server-secret",
    beaver_SUPABASE_URL: "https://prefixed.supabase.co",
    beaver_SUPABASE_SECRET_KEY: "prefixed-server-secret",
  });

  assert.deepEqual(environment, {
    SUPABASE_URL: "https://primary.supabase.co",
    SUPABASE_SECRET_KEY: "primary-server-secret",
  });
});

test("browser-exposed variables cannot satisfy server credential validation", () => {
  assert.throws(
    () =>
      getServerEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: "public-secret",
      }),
    /SUPABASE_URL.*SUPABASE_SECRET_KEY/
  );
});

test("server client and environment modules are explicitly server-only", async () => {
  const sources = await Promise.all([
    readFile(new URL("../env.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase.ts", import.meta.url), "utf8"),
    readFile(new URL("../repositories/evaluation-runs.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../repositories/evaluation-runtime-config.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../evaluation/environment.ts", import.meta.url), "utf8"),
  ]);

  for (const source of sources) {
    assert.match(source, /^import "server-only";/);
  }
  assert.match(sources[1]!, /cache:\s*["']no-store["']/);
  assert.doesNotMatch(sources.join("\n"), /process\.env\.NEXT_PUBLIC_/);
});

test("evaluation environment validates OpenRouter worker configuration", () => {
  const environment = getOpenRouterEnvironment({
    OPENROUTER_API_KEY: "openrouter-secret",
  });

  assert.equal(environment.OPENROUTER_TIMEOUT_MS, 180_000);
  assert.equal(environment.OPENROUTER_REQUEST_RETRIES, 2);
  assert.equal(environment.EVALUATION_PIPELINE_TIMEOUT_MS, 270_000);
  assert.equal(environment.EVALUATION_WORKER_POLL_MS, 2_000);
  assert.throws(
    () => getOpenRouterEnvironment({ OPENROUTER_API_KEY: "" }),
    EvaluationEnvironmentError
  );
});

test("evaluation environment accepts the lowercase Beaver-prefixed OpenRouter key", () => {
  const environment = getOpenRouterEnvironment({
    beaver_OPENROUTER_API_KEY: "prefixed-openrouter-secret",
  });

  assert.equal(
    environment.OPENROUTER_API_KEY,
    "prefixed-openrouter-secret"
  );
});
