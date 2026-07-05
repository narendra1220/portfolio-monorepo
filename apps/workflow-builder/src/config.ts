export interface Config {
  port: number;
  mongoUri: string;
  mongoDb: string;
  redisHost: string;
  redisPort: number;
  jwtSecret: string;
  queueName: string;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 4400),
    mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017",
    mongoDb: process.env.MONGO_DB ?? "workflow_builder",
    redisHost: process.env.REDIS_HOST ?? "127.0.0.1",
    redisPort: Number(process.env.REDIS_PORT ?? 6379),
    jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    queueName: process.env.QUEUE_NAME ?? "workflow-runs",
  };
}
