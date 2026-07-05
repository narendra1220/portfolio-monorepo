export type JobState =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "dead";

export type BackoffKind = "fixed" | "exponential" | "exponential-jitter";

export interface BackoffOptions {
  kind: BackoffKind;
  delayMs: number;
  maxDelayMs?: number;
  factor?: number;
}

export interface JobOptions {
  jobId?: string;
  delayMs?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  backoff?: BackoffOptions;
  idempotencyKey?: string;
  idempotencyTtlMs?: number;
}

export interface JobRecord<T = unknown> {
  id: string;
  name: string;
  queue: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  backoff: BackoffOptions;
  createdAt: number;
  updatedAt: number;
  state: JobState;
  lastError?: string;
  scheduledFor?: number;
}

export interface QueueOptions {
  name: string;
  defaultMaxAttempts?: number;
  defaultTimeoutMs?: number;
  defaultBackoff?: BackoffOptions;
}

export interface WorkerOptions {
  queue: string;
  concurrency?: number;
  blockMs?: number;
  batchSize?: number;
  consumerName?: string;
  groupName?: string;
  visibilityTimeoutMs?: number;
}

export type JobHandler<T = unknown, R = unknown> = (
  job: JobRecord<T>,
  signal: AbortSignal,
) => Promise<R>;

export interface QueueEvent {
  type:
    | "job:added"
    | "job:active"
    | "job:completed"
    | "job:failed"
    | "job:retry"
    | "job:dead";
  jobId: string;
  queue: string;
  at: number;
  error?: string;
  attempts?: number;
}
