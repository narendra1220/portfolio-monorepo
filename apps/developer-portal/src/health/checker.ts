import type { HealthResult, Service } from "../types.js";

export interface HealthChecker {
  check: (svc: Service) => Promise<HealthResult>;
  checkAll: (svcs: Service[]) => Promise<HealthResult[]>;
}

export function makeHealthChecker(
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): HealthChecker {
  async function checkOne(svc: Service): Promise<HealthResult> {
    const start = performance.now();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(svc.healthUrl, {
        signal: controller.signal,
        method: "GET",
      });
      const latencyMs = performance.now() - start;
      const status = mapStatus(res.status);
      return {
        serviceId: svc.id,
        name: svc.name,
        url: svc.healthUrl,
        status,
        latencyMs: Math.round(latencyMs * 100) / 100,
        statusCode: res.status,
        checkedAt: Date.now(),
      };
    } catch (e) {
      return {
        serviceId: svc.id,
        name: svc.name,
        url: svc.healthUrl,
        status: "down",
        error: (e as Error).message,
        checkedAt: Date.now(),
      };
    } finally {
      clearTimeout(t);
    }
  }

  return {
    check: checkOne,
    async checkAll(svcs) {
      return Promise.all(svcs.map(checkOne));
    },
  };
}

function mapStatus(code: number): HealthResult["status"] {
  if (code >= 200 && code < 300) return "up";
  if (code >= 500) return "down";
  if (code === 503) return "down";
  if (code >= 400) return "degraded";
  return "unknown";
}
