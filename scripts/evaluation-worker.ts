import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ getOpenRouterEnvironment }, worker] = await Promise.all([
      import("@/lib/server/evaluation/environment"),
      import("@/lib/server/evaluation/processor"),
    ]);

  const environment = getOpenRouterEnvironment();
  const abortController = new AbortController();
  process.once("SIGINT", () => abortController.abort());
  process.once("SIGTERM", () => abortController.abort());

  console.log("Evaluation worker started with database-managed model selection");
  await worker.runEvaluationWorker({
    pollIntervalMs: environment.EVALUATION_WORKER_POLL_MS,
    signal: abortController.signal,
    onProcessed: (run) => {
      console.log(`Evaluation ${run.id} finished with status ${run.status}`);
    },
    onError: (error) => {
      console.error(
        error instanceof Error
          ? `Evaluation worker cycle failed: ${error.message}`
          : "Evaluation worker cycle failed"
      );
    },
  });
  console.log("Evaluation worker stopped");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation worker failed");
  process.exitCode = 1;
});
