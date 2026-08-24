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

export function getServerEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env
): ServerEnvironment {
  if (source === process.env && cachedEnvironment) return cachedEnvironment;

  const parsed = ServerEnvironmentSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }

  if (source === process.env) cachedEnvironment = parsed.data;
  return parsed.data;
}
