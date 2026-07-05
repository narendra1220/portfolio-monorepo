import type { BlogPost } from "@portfolio/shared-types";

export const posts: BlogPost[] = [
  {
    slug: "redis-streams-vs-lists-for-job-queues",
    title: "Redis Streams vs Lists for Job Queues",
    date: "2026-04-18",
    readingMinutes: 9,
    excerpt:
      "Why the right answer for production job queues on Redis is Streams, not Lists — and what you lose if you go the other way.",
    tags: ["redis", "queues", "distributed-systems"],
    body: `Lists give you LPUSH/BRPOP. That's it. Every other guarantee you want — visibility, acks, multi-consumer fairness, redelivery — you write yourself. Streams give you those primitives natively via XACK, XPENDING, and XCLAIM.

The cost: a slightly less familiar API and slightly more memory per message. The benefit: 1k LOC of carefully-considered Lua and bookkeeping you don't have to maintain.

Where lists still win: you have one consumer, one producer, low throughput, and you genuinely don't care about acks. That's almost no one.`,
  },
  {
    slug: "visibility-timeout-explained",
    title: "Visibility Timeout, Explained Twice",
    date: "2026-03-09",
    readingMinutes: 6,
    excerpt:
      "Visibility timeout is the simplest crash-recovery mechanism you will ever implement, and the most-misunderstood. A walkthrough with code.",
    tags: ["redis", "queues", "reliability"],
    body: `The mental model: 'I am about to do work; if I don't come back in T seconds, treat me as crashed and give the job to someone else.' That's it. In SQS it's a parameter. In Redis Streams it's an emergent property of XPENDING + XCLAIM, and you operate the timer yourself. The timer should be ~3× your p99 handler latency. Lower and you double-process; higher and your RTO is slow.`,
  },
  {
    slug: "tail-sampling-without-tears",
    title: "Tail Sampling Without Tears",
    date: "2026-02-21",
    readingMinutes: 11,
    excerpt:
      "Why tail-sampling is the correct default for trace ingestion and how to do it without OOMing your collector.",
    tags: ["observability", "opentelemetry", "clickhouse"],
    body: `Head sampling throws away signal you'd want — rare errors, slow tails. Tail sampling buffers a trace until it completes, then decides. The risk is unbounded memory if traces don't close. Solution: bounded ring buffer per traceId, evict to disk under pressure, sample on eviction with a 'kept-anyway' fallback for known-bad services.`,
  },
];
