import { GradientText } from "@portfolio/shared-ui";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      {eyebrow && (
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          {eyebrow}
        </div>
      )}
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 max-w-2xl text-slate-400 leading-relaxed ${
            align === "center" ? "mx-auto" : ""
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function SectionHeadingGradient({
  eyebrow,
  title,
  subtitle,
  highlight,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  highlight: string;
  subtitle?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <SectionHeading
      eyebrow={eyebrow}
      align={align}
      title={
        <>
          {title} <GradientText>{highlight}</GradientText>
        </>
      }
      subtitle={subtitle}
    />
  );
}
