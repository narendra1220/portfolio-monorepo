export interface Config {
  proxyPort: number;
  controlPort: number;
  redisHost: string;
  redisPort: number;
  jwtSecret: string;
  upstreamTimeoutMs: number;
  upstreamMaxRetries: number;
  circuitOpenMs: number;
  circuitErrorRate: number;
  circuitMinRequests: number;
  shutdownGraceMs: number;
}

export function loadConfig(): Config {
  return {
    proxyPort: Number(process.env.PROXY_PORT ?? 4700),
    controlPort: Number(process.env.CONTROL_PORT ?? 4701),
    redisHost: process.env.REDIS_HOST ?? "127.0.0.1",
    redisPort: Number(process.env.REDIS_PORT ?? 6379),
    jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 5000),
    upstreamMaxRetries: Number(process.env.UPSTREAM_MAX_RETRIES ?? 2),
    circuitOpenMs: Number(process.env.CIRCUIT_OPEN_MS ?? 5000),
    circuitErrorRate: Number(process.env.CIRCUIT_ERROR_RATE ?? 0.5),
    circuitMinRequests: Number(process.env.CIRCUIT_MIN_REQUESTS ?? 5),
    shutdownGraceMs: Number(process.env.SHUTDOWN_GRACE_MS ?? 5000),
  };
}

export const KEY_ROUTES = "gw:routes";
export const KEY_RL = (consumer: string, route: string) =>
  `gw:rl:${consumer}:${route}`;
export const CHANNEL_ROUTES = "gw:routes:bump";
