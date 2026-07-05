import Link from "next/link";
import { profile } from "@/data/profile";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 border-t border-white/5 mt-32">
      <div className="container-wide py-12 grid gap-8 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div>
          <div className="text-white font-semibold">{profile.name}</div>
          <p className="mt-2 text-slate-400 leading-relaxed">
            {profile.role}. Open to distributed-systems and platform roles.
          </p>
        </div>
        <div>
          <div className="text-slate-200 font-medium">Navigate</div>
          <ul className="mt-3 space-y-2 text-slate-400">
            <li><Link className="hover:text-slate-100" href="/demos">Live demos</Link></li>
            <li><Link className="hover:text-slate-100" href="/projects">Projects</Link></li>
            <li><Link className="hover:text-slate-100" href="/architecture">Architecture</Link></li>
            <li><Link className="hover:text-slate-100" href="/blog">Blog</Link></li>
            <li><Link className="hover:text-slate-100" href="/contact">Contact</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-slate-200 font-medium">Reach me</div>
          <ul className="mt-3 space-y-2 text-slate-400">
            <li><a className="hover:text-slate-100" href={`mailto:${profile.email}`}>{profile.email}</a></li>
            <li><a className="hover:text-slate-100" href={profile.github} target="_blank" rel="noreferrer">GitHub</a></li>
            <li><a className="hover:text-slate-100" href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></li>
          </ul>
        </div>
        <div>
          <div className="text-slate-200 font-medium">Colophon</div>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Built with Next.js 15, Tailwind, and Framer Motion. Hosted statically. No trackers.
          </p>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="container-wide flex flex-col items-center justify-between gap-2 py-6 text-xs text-slate-500 sm:flex-row">
          <div>© {year} {profile.name}. Built in public.</div>
          <div className="font-mono">
            {profile.available ? "● available for work" : "○ heads-down on contract"}
          </div>
        </div>
      </div>
    </footer>
  );
}
