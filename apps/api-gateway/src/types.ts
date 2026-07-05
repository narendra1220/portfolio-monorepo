export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "*";

export interface RateLimit {
  windowMs: number;
  max: number;
}

export interface BackendCfg {
  url: string;
  weight?: number;
}

export interface RouteCfg {
  id: string;
  pathPrefix: string;
  methods: HttpMethod[];
  backends: BackendCfg[];
  stripPrefix?: boolean;
  auth?: "none" | "jwt";
  rateLimit?: RateLimit;
  retryOnStatus?: number[];
  maxRetries?: number;
  timeoutMs?: number;
}

export interface RouteMatch {
  route: RouteCfg;
  upstreamPath: string;
}

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitStats {
  state: CircuitState;
  total: number;
  failures: number;
  openedAt?: number;
  lastError?: string;
}

export interface AccessLog {
  id: string;
  ts: number;
  durationMs: number;
  consumer: string;
  routeId: string;
  upstream: string;
  method: string;
  path: string;
  status: number;
  retries: number;
  rateLimited?: boolean;
  circuitOpen?: boolean;
  error?: string;
}
