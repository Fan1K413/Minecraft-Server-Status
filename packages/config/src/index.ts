import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

const endpointSchema = z.object({
  enabled: z.boolean().default(true),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  displayAddress: z.string().min(1).max(253),
});

const configSchema = z.object({
  server: z.object({ name: z.string().min(1).max(80), timezone: z.string().default("UTC") }),
  java: endpointSchema.optional(),
  bedrock: endpointSchema.optional(),
  monitor: z.object({
    intervalSeconds: z.number().int().min(10).max(3600).default(60),
    timeoutMs: z.number().int().min(500).max(30_000).default(5000),
    downAfterFailures: z.number().int().min(1).max(20).default(3),
    upAfterSuccesses: z.number().int().min(1).max(20).default(2),
    staleAfterIntervals: z.number().int().min(2).max(20).default(3),
    retentionDays: z.number().int().min(1).max(365).default(90),
  }),
  maintenance: z.object({
    enabled: z.boolean().default(false),
    startsAt: z.string().datetime().nullable().default(null),
    endsAt: z.string().datetime().nullable().default(null),
    message: z.string().max(500).nullable().default(null),
  }).default({ enabled: false, startsAt: null, endsAt: null, message: null }),
});

export type ServerConfig = z.infer<typeof configSchema>;

function interpolate(value: string): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => {
    const replacement = process.env[name];
    if (!replacement) throw new Error(`Missing environment variable: ${name}`);
    return replacement;
  });
}

function rejectUnsafeHost(host: string): void {
  const lower = host.toLowerCase();
  if (
    lower === "localhost" || lower === "::1" || lower.startsWith("127.") ||
    lower.startsWith("169.254.") || lower === "metadata.google.internal"
  ) {
    throw new Error(`Unsafe probe host is not allowed: ${host}`);
  }
}

export async function loadServerConfig(path = process.env.SERVER_CONFIG_PATH ?? "./config/server.yaml"): Promise<ServerConfig> {
  const input = parse(await readFile(path, "utf8"));
  const config = configSchema.parse(input);
  for (const endpoint of [config.java, config.bedrock]) {
    if (endpoint?.enabled) {
      endpoint.host = interpolate(endpoint.host);
      rejectUnsafeHost(endpoint.host);
    }
  }
  if (!config.java?.enabled && !config.bedrock?.enabled) throw new Error("At least one endpoint must be enabled");
  return config;
}
