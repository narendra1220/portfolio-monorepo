export interface Config {
  port: number;
  mongoUri: string;
  mongoDb: string;
  redisHost: string;
  redisPort: number;
  jwtSecret: string;
  openapiTtlSeconds: number;
  healthTimeoutMs: number;
  playgroundTimeoutMs: number;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 4600),
    mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017",
    mongoDb: process.env.MONGO_DB ?? "developer_portal",
    redisHost: process.env.REDIS_HOST ?? "127.0.0.1",
    redisPort: Number(process.env.REDIS_PORT ?? 6379),
    jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    openapiTtlSeconds: Number(process.env.OPENAPI_TTL_S ?? 300),
    healthTimeoutMs: Number(process.env.HEALTH_TIMEOUT_MS ?? 1500),
    playgroundTimeoutMs: Number(process.env.PLAYGROUND_TIMEOUT_MS ?? 8000),
  };
}

export const OPENAPI_CACHE_KEY = (svcId: string) =>
  `devportal:openapi:${svcId}`;
