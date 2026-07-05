import type { Metadata } from "next";
import { Mail, Github, Linkedin, MapPin, Phone } from "lucide-react";
import { profile } from "@/data/profile";
import { SectionHeadingGradient } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch.",
};

export default function ContactPage() {
  return (
    <section className="section pt-24">
      <div className="container-tight max-w-3xl">
        <SectionHeadingGradient
          eyebrow="Contact"
          title="The fastest way to"
          highlight="reach me"
          subtitle="Email is best. Replies within 24 hours on weekdays."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <ContactLink href={`mailto:${profile.email}`} icon={Mail} label="Email" value={profile.email} />
          <ContactLink href={`tel:${profile.phone.replace(/\s/g, "")}`} icon={Phone} label="Phone" value={profile.phone} />
          <ContactLink href={profile.github} icon={Github} label="GitHub" value={profile.github.replace("https://", "")} external />
          <ContactLink href={profile.linkedin} icon={Linkedin} label="LinkedIn" value={profile.linkedin.replace("https://www.", "")} external />
          <ContactLink href="#" icon={MapPin} label="Location" value={profile.location} />
        </div>

        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="text-lg font-semibold text-white">Working with me</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300 list-disc pl-5">
            <li>I respond fastest when the email leads with the problem, not the company.</li>
            <li>I&apos;m most useful on distributed backends, platform, and reliability work.</li>
            <li>I&apos;ll send back questions before saying yes. That&apos;s the work, not a delay.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function ContactLink({
  href,
  icon: Icon,
  label,
  value,
  external,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-cyan-400/30 hover:bg-cyan-400/[0.04]"
    >
      <span className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-cyan-300">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="font-mono text-sm text-slate-200 group-hover:text-white">
          {value}
        </div>
      </div>
    </a>
  );
}
