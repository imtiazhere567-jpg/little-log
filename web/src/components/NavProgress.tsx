"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Instant feedback on every tap: a thin brand-colored bar starts the moment a link is clicked
 * and finishes when the new screen arrives. Without it, a 0.5 s server render feels like a dead tap.
 */
export default function NavProgress() {
  const path = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  // the new screen is here → finish the bar
  useEffect(() => {
    const t1 = setTimeout(() => setState((s) => (s === "loading" ? "done" : s)), 0);
    const t2 = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [path, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same screen (or #hash)
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // never hang: give up quietly after 10 s
  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => setState("idle"), 10000);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "idle") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]">
      <div className={`h-full bg-gradient-to-r from-accent to-primary shadow-[0_0_8px_rgba(47,111,98,.5)] ${state === "loading" ? "nav-progress-run" : "nav-progress-done"}`} />
    </div>
  );
}
