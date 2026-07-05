import type { Metadata } from "next";
import { SectionHeadingGradient } from "@/components/SectionHeading";
import { MermaidBlock } from "@/components/Mermaid";

export const metadata: Metadata = {
  title: "Architecture",
  description: "How the projects in this monorepo plug together.",
};

const monorepoDiagram = `flowchart LR
  subgraph clients
    BR[Browser / SDKs]
  end
  BR --> NGX[NGINX edge]
  NGX --> GW[API Gateway]
  GW --> SVC1[Workflow Builder]
  GW --> SVC2[Feature Flags]
  GW --> SVC3[Developer Portal]
  GW --> JQ[Job Queue producer]
  JQ --> RDS[(Redis Streams)]
  WORKER[Job Queue workers] -- consume --> RDS
  SVC1 -- emits --> OTEL[OTel collector]
  SVC2 -- emits --> OTEL
  SVC3 -- emits --> OTEL
  GW -- emits --> OTEL
  WORKER -- emits --> OTEL
  OTEL --> CH[(ClickHouse: spans/metrics)]
  CH --> OBS[Observability UI]
  OBS --> ALERT[Alert engine]`;

const requestLifeOfMessage = `sequenceDiagram
  autonumber
  participant U as User
  participant E as NGINX
  participant G as API Gateway
  participant S as Feature Flags
  participant R as Redis (cache + ruleset)
  participant O as OTel collector
  U->>E: HTTPS request
  E->>G: HTTP/2 forward
  G->>R: rate-limit + cache check (Lua)
  G->>S: GET /eval (signed)
  S->>R: ruleset fetch (immutable)
  S-->>G: variant
  G-->>U: 200 OK
  par async
    G->>O: span batch
    S->>O: span batch
  end`;

const failureModes = `flowchart TB
  classDef bad fill:#3f1d2c,stroke:#fb7185,color:#fecdd3
  classDef ok fill:#16302a,stroke:#34d399,color:#a7f3d0
  IN[Incident: upstream returns 500s]:::bad
  IN --> CB[Circuit breaker opens]
  CB --> CACHE[Stale-while-revalidate cache]:::ok
  CB --> RETRY[Retry budget capped at 10%]:::ok
  CB --> FAIL[Graceful 503 + Retry-After]:::ok
  RETRY -- alerts --> SLO[SLO burn-rate page]:::ok
  CACHE -- serves --> USR[Most users see no impact]:::ok`;

export default function ArchitecturePage() {
  return (
    <section className="section pt-24">
      <div className="container-tight">
        <SectionHeadingGradient
          eyebrow="Architecture"
          title="How it all"
          highlight="plugs together"
          subtitle="The six projects are designed to compose: the gateway fronts the others, the queue runs their async work, the observability stack instruments everything."
        />

        <div className="mt-12 space-y-12">
          <Block
            title="Monorepo composition"
            body="Each project is independently deployable, but they share interfaces. NGINX → Gateway → backend services → Job Queue (Redis Streams) → workers. Every node emits OTel."
            diagram={monorepoDiagram}
          />
          <Block
            title="Life of a request"
            body="A typical request: rate-limited at the gateway, evaluated against feature flags, instrumented end-to-end. Notice the async span emission — never blocks the response."
            diagram={requestLifeOfMessage}
          />
          <Block
            title="Failure mode walkthrough"
            body="The hard part isn't the happy path. Here is what the system does when an upstream service degrades."
            diagram={failureModes}
          />
        </div>
      </div>
    </section>
  );
}

function Block({
  title,
  body,
  diagram,
}: {
  title: string;
  body: string;
  diagram: string;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-3xl text-sm text-slate-400 leading-relaxed">
        {body}
      </p>
      <div className="mt-5">
        <MermaidBlock source={diagram} />
      </div>
    </div>
  );
}
