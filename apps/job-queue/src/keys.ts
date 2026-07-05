export const k = {
  stream: (q: string) => `jq:stream:${q}`,
  dlq: (q: string) => `jq:dlq:${q}`,
  delayed: (q: string) => `jq:delayed:${q}`,
  job: (id: string) => `jq:job:${id}`,
  group: (q: string) => `jq:group:${q}`,
  idem: (q: string, key: string) => `jq:idem:${q}:${key}`,
  metrics: (q: string) => `jq:metrics:${q}`,
};

export const DEFAULT_GROUP = "workers";
