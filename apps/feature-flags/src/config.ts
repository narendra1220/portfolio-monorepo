export interface Config {
  port: number;
  mongoUri: string;
  mongoDb: string;
  redisHost: string;
  redisPort: number;
  jwtSecret: string;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 4500),
    mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017",
    mongoDb: process.env.MONGO_DB ?? "feature_flags",
    redisHost: process.env.REDIS_HOST ?? "127.0.0.1",
    redisPort: Number(process.env.REDIS_PORT ?? 6379),
    jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  };
}

export const RULESET_CHANNEL = "ff:ruleset:version";
export const RULESET_REDIS_KEY = (env: string, version: number) =>
  `ff:ruleset:${env}:${version}`;
export const RULESET_LATEST_KEY = (env: string) => `ff:ruleset:${env}:latest`;
