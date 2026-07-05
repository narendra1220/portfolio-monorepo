export function BackgroundFx() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-radial-fade" />
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      <div className="absolute inset-0 grid-bg opacity-[0.35]" />
      <div className="absolute inset-0 bg-noise mix-blend-overlay opacity-30" />
      <div
        className="absolute -top-40 left-1/2 h-[480px] w-[800px] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(56,189,248,0.18), transparent)",
        }}
      />
      <div
        className="absolute -bottom-40 right-0 h-[420px] w-[620px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(139,92,246,0.16), transparent)",
        }}
      />
    </div>
  );
}
