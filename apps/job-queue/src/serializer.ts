import type { JobRecord } from "./types.js";

const SCHEMA_VERSION = 1;

interface Envelope {
  v: number;
  job: JobRecord;
}

export function encodeJob(job: JobRecord): string {
  const env: Envelope = { v: SCHEMA_VERSION, job };
  return JSON.stringify(env);
}

export function decodeJob<T = unknown>(raw: string): JobRecord<T> {
  const env = JSON.parse(raw) as Envelope;
  if (typeof env.v !== "number") {
    throw new Error("invalid envelope: missing schema version");
  }
  if (env.v !== SCHEMA_VERSION) {
    throw new Error(
      `unsupported schema version ${env.v}, expected ${SCHEMA_VERSION}`,
    );
  }
  return env.job as JobRecord<T>;
}

export function encodePayload(payload: unknown): string {
  return JSON.stringify(payload);
}

export function decodePayload<T = unknown>(raw: string): T {
  return JSON.parse(raw) as T;
}
