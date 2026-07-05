export type ProjectStatus = "shipped" | "in-progress" | "case-study";

export type StackItem =
  | "TypeScript"
  | "Node.js"
  | "React"
  | "Next.js"
  | "Express"
  | "MongoDB"
  | "Redis"
  | "ClickHouse"
  | "Docker"
  | "NGINX"
  | "BullMQ"
  | "Redis Streams"
  | "OpenTelemetry"
  | "Prometheus"
  | "Grafana"
  | "Socket.IO"
  | "JWT"
  | "OAuth"
  | "Tailwind"
  | "Framer Motion"
  | "Mermaid";

export interface ProjectMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface ProjectLink {
  label: string;
  href: string;
  kind: "github" | "demo" | "docs" | "blog";
}

export interface ProjectCaseStudy {
  slug: string;
  title: string;
  tagline: string;
  status: ProjectStatus;
  inspiredBy: string[];
  stack: StackItem[];
  metrics: ProjectMetric[];
  links: ProjectLink[];
  overview: string;
  problem: string;
  architecture: {
    summary: string;
    mermaid: string;
    components: Array<{ name: string; purpose: string }>;
  };
  tradeoffs: Array<{ decision: string; rationale: string; alternative: string }>;
  lessons: string[];
  api: Array<{ method: string; path: string; description: string }>;
  schema: Array<{ collection: string; fields: Array<{ name: string; type: string; note?: string }> }>;
  deployment: string;
  scalability: string[];
  security: string[];
  future: string[];
  performance?: ProjectMetric[];
  folderStructure?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  readingMinutes: number;
  excerpt: string;
  tags: string[];
  body: string;
}

export interface ExperienceItem {
  company: string;
  role: string;
  period: string;
  location: string;
  highlights: string[];
  stack: StackItem[];
}

export interface SkillGroup {
  category: string;
  items: Array<{ name: string; level: "core" | "strong" | "working" }>;
}
