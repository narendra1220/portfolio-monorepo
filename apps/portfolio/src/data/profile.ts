import type { ExperienceItem, SkillGroup } from "@portfolio/shared-types";

export const profile = {
  name: "Narendra Nalam",
  handle: "narendra.nalam",
  role: "Backend Software Engineer",
  tagline:
    "Scalable, secure, distributed systems — with the frontend to prove the backend works.",
  location: "Hyderabad, India",
  phone: "+91-9390799428",
  email: "narendranalam12@gmail.com",
  github: "https://github.com/narendranalam",
  linkedin: "https://www.linkedin.com/in/narendranalam",
  resumeUrl: "/resume.pdf",
  available: true,
  summary:
    "Backend software engineer with 3+ years building scalable, secure, distributed systems on Node.js. Experienced in high-performance APIs, authentication and secure communication (mTLS, encryption), Redis-backed caching, and observability with OpenTelemetry. Strong foundation in web fundamentals, distributed systems, and cloud-native architectures — with a focus on performance, reliability, and engineering excellence.",
  metrics: [
    { label: "Years in backend", value: "3+" },
    { label: "Current company", value: "Kore.AI" },
    { label: "Shipped portfolio systems", value: "6" },
    { label: "Education", value: "BTech ECE" },
  ],
};

export const education = {
  school: "ACE Engineering College",
  degree: "BTech in Electronics & Communication",
  location: "Hyderabad",
  period: "2019 — 2023",
  gpa: "7.3",
};

export const experience: ExperienceItem[] = [
  {
    company: "Kore.AI",
    role: "Software Engineer",
    period: "Jan 2024 — present",
    location: "Hyderabad",
    highlights: [
      "Design and develop scalable backend services and microservices for enterprise SaaS platforms.",
      "Build secure API communication using mutual TLS and encryption; optimize performance with Redis caching and architectural improvements.",
      "Work on distributed systems handling high-volume API traffic with low latency and resilience.",
      "Implement observability with OpenTelemetry; resolve production incidents and improve monitoring and system stability.",
      "Own end-to-end development from design to deployment, including CI/CD pipelines and release management.",
      "Collaborate with cross-functional teams, participate in code reviews, and optimize memory and performance in Node-RED-based systems.",
    ],
    stack: [
      "TypeScript",
      "Node.js",
      "Express",
      "Redis",
      "MongoDB",
      "Docker",
      "OpenTelemetry",
    ],
  },
  {
    company: "Kore.AI",
    role: "Associate Engineer",
    period: "Sep 2022 — Dec 2023",
    location: "Hyderabad",
    highlights: [
      "Developed backend modules for a third-party API integration platform.",
      "Worked on request mapping engines and REST API execution layers.",
      "Resolved production incidents and improved system reliability.",
      "Collaborated in code reviews and contributed to engineering best practices.",
    ],
    stack: ["Node.js", "Express", "Redis", "MongoDB"],
  },
];

export const skills: SkillGroup[] = [
  {
    category: "Languages",
    items: [
      { name: "TypeScript", level: "core" },
      { name: "JavaScript", level: "core" },
      { name: "Python", level: "working" },
    ],
  },
  {
    category: "Backend & APIs",
    items: [
      { name: "Node.js", level: "core" },
      { name: "Express", level: "core" },
      { name: "REST APIs", level: "core" },
      { name: "SOAP", level: "working" },
      { name: "Microservices", level: "strong" },
    ],
  },
  {
    category: "Datastores",
    items: [
      { name: "PostgreSQL", level: "strong" },
      { name: "MongoDB", level: "strong" },
      { name: "Redis", level: "core" },
    ],
  },
  {
    category: "DevOps & cloud",
    items: [
      { name: "Docker", level: "strong" },
      { name: "CI/CD", level: "strong" },
      { name: "AWS", level: "working" },
      { name: "Azure", level: "working" },
      { name: "Linux", level: "strong" },
    ],
  },
  {
    category: "Observability & debugging",
    items: [
      { name: "OpenTelemetry", level: "core" },
      { name: "Production debugging", level: "core" },
      { name: "Logging", level: "core" },
      { name: "Prometheus", level: "working" },
      { name: "Grafana", level: "working" },
    ],
  },
  {
    category: "Systems & practices",
    items: [
      { name: "Distributed systems", level: "strong" },
      { name: "TCP/IP & HTTP", level: "strong" },
      { name: "Release management", level: "strong" },
      { name: "Agile", level: "strong" },
      { name: "mTLS & encryption", level: "strong" },
    ],
  },
];

export const techRadar = [
  { ring: "Adopt", items: ["OpenTelemetry", "Redis", "TypeScript", "Docker"] },
  { ring: "Trial", items: ["Next.js", "Socket.IO", "ClickHouse", "Tailwind"] },
  { ring: "Assess", items: ["Kubernetes", "Kafka", "Temporal", "Bun"] },
  { ring: "Hold", items: ["Bare cron for jobs", "Unobserved microservices", "Manual releases"] },
];
