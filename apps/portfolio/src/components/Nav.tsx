"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Github, Linkedin, Command } from "lucide-react";
import { Kbd } from "@portfolio/shared-ui";
import { profile } from "@/data/profile";
import { useCommandPalette } from "./CommandPalette";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/demos", label: "Demos" },
  { href: "/experience", label: "Experience" },
  { href: "/skills", label: "Skills" },
  { href: "/architecture", label: "Architecture" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const palette = useCommandPalette();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-md bg-ink-950/70 border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="container-wide flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 text-slate-950 text-sm font-bold shadow-glow-cyan">
            NN
          </span>
          <span className="hidden text-sm font-medium tracking-tight text-slate-200 sm:inline">
            {profile.handle}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "text-white"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-0.5 h-px bg-gradient-to-r from-cyan-400 to-violet-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => palette.open()}
            className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 sm:inline-flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <span className="ml-2 flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <a
            href={profile.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-100"
          >
            <Github className="h-4 w-4" />
          </a>
          <a
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-100"
          >
            <Linkedin className="h-4 w-4" />
          </a>
          <button
            onClick={() => palette.open()}
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-100 sm:hidden"
            aria-label="Command palette"
          >
            <Command className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
