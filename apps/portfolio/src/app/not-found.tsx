import Link from "next/link";
import { Button } from "@portfolio/shared-ui";

export default function NotFound() {
  return (
    <section className="section pt-40">
      <div className="container-tight text-center">
        <div className="font-mono text-7xl text-cyan-300/80">404</div>
        <h1 className="mt-4 text-2xl font-semibold text-white">
          That page does not exist.
        </h1>
        <p className="mt-2 text-slate-400">
          Probably a stale link or a typo. Let&apos;s go home.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
