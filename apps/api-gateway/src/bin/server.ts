import http from "node:http";
import { loadConfig } from "../config.js";
import { CircuitBreaker } from "../middleware/circuit.js";
import { RateLimiter } from "../middleware/rateLimit.js";
import { Counters } from "../metrics/counters.js";
import { makeProxyHandler } from "../proxy/handler.js";
import { makeRedis } from "../redis.js";
import { RouteRegistry } from "../routes/registry.js";
import { Router } from "../routes/router.js";
import { createControlServer } from "../control/rest.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const redis = makeRedis(cfg.redisHost, cfg.redisPort);

  const registry = new RouteRegistry(redis, () =>
    makeRedis(cfg.redisHost, cfg.redisPort),
  );
  await registry.loadAll();
  await registry.watch();

  const router = new Router(registry);
  const rateLimiter = new RateLimiter(redis);
  await rateLimiter.load();
  const circuit = new CircuitBreaker({
    errorRate: cfg.circuitErrorRate,
    minRequests: cfg.circuitMinRequests,
    openMs: cfg.circuitOpenMs,
    windowMs: 10_000,
  });
  const counters = new Counters();

  const proxyHandler = makeProxyHandler({
    router,
    rateLimiter,
    circuit,
    counters,
    cfg,
    onAccessLog: (log) => {
      process.stdout.write(JSON.stringify({ kind: "access", ...log }) + "\n");
    },
  });

  const proxyServer = http.createServer((req, res) => {
    void proxyHandler(req, res);
  });
  proxyServer.headersTimeout = 65_000;
  proxyServer.keepAliveTimeout = 60_000;

  const controlServer = createControlServer({ registry, circuit, counters });

  await Promise.all([
    new Promise<void>((r) => proxyServer.listen(cfg.proxyPort, r)),
    new Promise<void>((r) => controlServer.listen(cfg.controlPort, r)),
  ]);
  console.log(
    JSON.stringify({
      msg: "api-gateway up",
      proxyPort: cfg.proxyPort,
      controlPort: cfg.controlPort,
    }),
  );

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ msg: "shutting down", signal }));
    proxyServer.close();
    controlServer.close();
    await new Promise((r) => setTimeout(r, 500));
    registry.shutdown();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
