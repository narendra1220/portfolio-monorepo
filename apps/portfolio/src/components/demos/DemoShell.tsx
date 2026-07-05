"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutGrid, Flag, Server } from "lucide-react";
import { Badge } from "@portfolio/shared-ui";

const demos = [
  {
    href: "/demos/developer-portal",
    label: "Developer Portal",
    icon: Server,
    port: 4600,
  },
  {
    href: "/demos/feature-flags",
    label: "Feature Flags",
    icon: Flag,
    port: 4500,
  },
];

export function DemoShell({
  title,
  subtitle,
  backendOk,
  backendPort,
  children,
}: {
  title: string;
  subtitle?: string;
  backendOk: boolean | null;
  backendPort: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="section pt-20 pb-16">
      <div className="container-wide">
        <Link
          href="/demos"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All demos
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-cyan-400" />
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="mt-2 max-w-2xl text-sm text-slate-400">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={backendOk ? "green" : backendOk === false ? "rose" : "neutral"}>
              {backendOk === null
                ? "Checking backend…"
                : backendOk
                  ? `API :${backendPort} connected`
                  : `Start backend on :${backendPort}`}
            </Badge>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2 border-b border-white/5 pb-4">
          {demos.map((d) => {
            const active = pathname.startsWith(d.href);
            const Icon = d.icon;
            return (
              <Link
                key={d.href}
                href={d.href}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {d.label}
              </Link>
            );
          })}
        </nav>

        {backendOk === false && (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200/90">
            Backend not reachable. From repo root, compile and start the service:
            <code className="ml-2 font-mono text-xs text-amber-100">
              cd apps/{title.includes("Portal") ? "developer-portal" : "feature-flags"} && ../../node_modules/.bin/tsc && node dist/bin/server.js
            </code>
          </div>
        )}

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
