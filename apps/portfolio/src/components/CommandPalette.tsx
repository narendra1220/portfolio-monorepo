"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { projects } from "@/data/projects";
import { posts } from "@/data/blog";

interface PaletteCtx {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<PaletteCtx | null>(null);

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
}

export function useCommandPalette(): PaletteCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCommandPalette outside provider");
  return v;
}

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const items = useMemo<Item[]>(
    () => [
      { id: "go-home", group: "Pages", label: "Home", href: "/" },
      { id: "go-about", group: "Pages", label: "About", href: "/about" },
      { id: "go-proj", group: "Pages", label: "Projects", href: "/projects" },
      { id: "go-demos", group: "Pages", label: "Live demos", href: "/demos" },
      { id: "go-dp", group: "Demos", label: "Developer Portal UI", href: "/demos/developer-portal" },
      { id: "go-ff", group: "Demos", label: "Feature Flags UI", href: "/demos/feature-flags" },
      { id: "go-exp", group: "Pages", label: "Experience", href: "/experience" },
      { id: "go-skills", group: "Pages", label: "Skills", href: "/skills" },
      { id: "go-arch", group: "Pages", label: "Architecture", href: "/architecture" },
      { id: "go-blog", group: "Pages", label: "Blog", href: "/blog" },
      { id: "go-contact", group: "Pages", label: "Contact", href: "/contact" },
      ...projects.map((p) => ({
        id: `p-${p.slug}`,
        group: "Projects",
        label: p.title,
        hint: p.tagline,
        href: `/projects/${p.slug}`,
      })),
      ...posts.map((p) => ({
        id: `b-${p.slug}`,
        group: "Blog",
        label: p.title,
        hint: `${p.readingMinutes} min · ${p.date}`,
        href: `/blog/${p.slug}`,
      })),
    ],
    [],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(needle) ||
        i.hint?.toLowerCase().includes(needle) ||
        i.group.toLowerCase().includes(needle),
    );
  }, [items, q]);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (isOpen) {
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  return (
    <Ctx.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
        >
          <button
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-ink-900/95 shadow-2xl shadow-black/60">
            <div className="flex items-center gap-2 border-b border-white/5 px-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                placeholder="Search pages, projects, posts..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    const sel = filtered[active];
                    if (sel) go(sel.href);
                  }
                }}
              />
              <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
                Esc
              </kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto py-2 text-sm">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500">
                  No matches for &ldquo;{q}&rdquo;
                </div>
              )}
              {filtered.map((item, idx) => (
                <button
                  key={item.id}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(item.href)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                    idx === active
                      ? "bg-cyan-400/10 text-white"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        {item.group}
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </div>
                    {item.hint && (
                      <div className="truncate text-xs text-slate-500">
                        {item.hint}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-white/5 px-3 py-2 text-[10px] text-slate-500">
              <div className="flex items-center gap-3">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
              <div>Search</div>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
