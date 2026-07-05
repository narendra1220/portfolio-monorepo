import type { RouteRegistry } from "./registry.js";
import type { HttpMethod, RouteMatch } from "../types.js";

export class Router {
  constructor(private readonly registry: RouteRegistry) {}

  match(method: string, path: string): RouteMatch | null {
    const m = method.toUpperCase() as HttpMethod;
    const candidates = this.registry
      .list()
      .filter(
        (r) =>
          r.methods.includes("*" as HttpMethod) ||
          r.methods.includes(m as HttpMethod),
      )
      .filter((r) => pathStartsWith(path, r.pathPrefix))
      .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
    const route = candidates[0];
    if (!route) return null;
    let upstreamPath = path;
    if (route.stripPrefix) {
      upstreamPath = path.slice(route.pathPrefix.length) || "/";
      if (!upstreamPath.startsWith("/")) upstreamPath = "/" + upstreamPath;
    }
    return { route, upstreamPath };
  }
}

function pathStartsWith(path: string, prefix: string): boolean {
  if (path === prefix) return true;
  if (!path.startsWith(prefix)) return false;
  const next = path.charAt(prefix.length);
  return next === "/" || next === "" || prefix.endsWith("/");
}
