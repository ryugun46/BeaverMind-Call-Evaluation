import "server-only";

import { z } from "zod";

const ServerEnvironmentSchema = z.object({
  SUPABASE_URL: z.string().trim().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SECRET_KEY: z
    .string()
    .trim()
    .min(1, "SUPABASE_SECRET_KEY is required"),
});

export type ServerEnvironment = z.infer<typeof ServerEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

function firstConfiguredValue(
  source: Readonly<Record<string, string | undefined>>,
  names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = source[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getServerEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env
): ServerEnvironment {
  if (source === process.env && cachedEnvironment) return cachedEnvironment;

  const parsed = ServerEnvironmentSchema.safeParse({
    SUPABASE_URL: firstConfiguredValue(source, [
      "SUPABASE_URL",
      "beaver_SUPABASE_URL",
      "BEAVER_SUPABASE_URL",
    ]),
    SUPABASE_SECRET_KEY: firstConfiguredValue(source, [
      "SUPABASE_SECRET_KEY",
      "beaver_SUPABASE_SECRET_KEY",
      "BEAVER_SUPABASE_SECRET_KEY",
    ]),
  });
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }

  if (source === process.env) cachedEnvironment = parsed.data;
  return parsed.data;
}
