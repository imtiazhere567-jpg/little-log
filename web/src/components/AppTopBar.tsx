"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TAB_ROOTS = ["/app/parent", "/app/parent/history", "/app/parent/incidents", "/app/parent/settings", "/app/parent/chat"];

/**
 * Small navigation row at the top of the parent app: "Back" on detail screens
 * (returns to WhatsApp, Mail or the list you came from) and "Home" to the phone's home screen.
 */
export default function AppTopBar() {
  const path = usePathname();
  const router = useRouter();
  const isRoot = TAB_ROOTS.includes(path);

  return (
    <div className="flex h-10 items-center justify-between px-[14px]">
      {isRoot ? (
        <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-accent-ink">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-accent text-[11px] text-white">☀</span> Littlelog
        </span>
      ) : (
        <button type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/app/parent"))}
          className="flex h-8 items-center gap-1 rounded-full pl-1 pr-3 text-[15px] font-semibold text-primary active:bg-primary-soft">
          <span className="text-[22px] leading-none">‹</span> Back
        </button>
      )}
      <Link href="/app/phone" aria-label="Go to the phone's home screen"
        className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-bold text-ink-2 shadow-[var(--shadow-1)] active:scale-95">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />
        </svg>
        Home
      </Link>
    </div>
  );
}
