"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
};

// ---------------------------------------------------------------------------
// Column chart: one series over time (reports sent per school day).
// ---------------------------------------------------------------------------
export type Column = { key: string; label: string; short: string; value: number; target: number; href: string; dim?: boolean; current?: boolean };

export function ColumnChart({ data, height = 220, color = "#2F6F62", unit = "sent", targetLabel = "All children" }: {
  data: Column[]; height?: number; color?: string; unit?: string; targetLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 30, padR = 8, padT = 14, padB = 26;
  const plotW = Math.max(0, width - padL - padR), plotH = height - padT - padB;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.value, d.target)), 1));
  const ticks = [0, max / 2, max];
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const target = data[0]?.target ?? 0;
  const last = data.length - 1;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Reports ${unit} per school day`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="#EFE8DD" strokeWidth="1" />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9A9088" className="tabular">{t}</text>
            </g>
          ))}
          {/* reference: every child gets a report */}
          {target > 0 && (
            <g>
              <line x1={padL} x2={width - padR} y1={y(target)} y2={y(target)} stroke="#C9BFAF" strokeWidth="1" />
              <text x={width - padR} y={y(target) - 5} textAnchor="end" fontSize="10.5" fontWeight="600" fill="#9A9088">{targetLabel} · {target}</text>
            </g>
          )}
          {data.map((d, i) => {
            const cx = padL + band * i + band / 2;
            const h = Math.max(0, y(0) - y(d.value));
            const r = Math.min(4, h);
            const x = cx - barW / 2, top = y(d.value);
            const path = h > 0
              ? `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`
              : "";
            return (
              <Link key={d.key} href={d.href} scroll={false}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${d.label}: ${d.value} ${unit} of ${d.target}`}>
                <rect x={padL + band * i} y={padT} width={band} height={plotH + padB} fill="transparent" />
                {hover === i && <rect x={padL + band * i + 2} y={padT} width={band - 4} height={plotH} rx="8" fill="#F4EEE4" />}
                {path && <path d={path} fill={color} opacity={d.dim ? 0.35 : hover === null || hover === i ? 1 : 0.75} />}
                <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill={d.current ? "#2A2522" : "#9A9088"} fontWeight={d.current ? 700 : 500}>{d.short}</text>
                {i === last && d.value > 0 && hover === null && (
                  <text x={cx} y={top - 6} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#2A2522">{d.value}</text>
                )}
              </Link>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && width > 0 && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-2)]"
          style={{ left: Math.min(Math.max(padL + band * hover + band / 2, 70), width - 70), top: Math.max(0, y(data[hover].value) - 64) }}>
          <div className="tabular text-[15px] font-bold">{data[hover].value} <span className="text-[12px] font-semibold text-ink-2">of {data[hover].target} {unit}</span></div>
          <div className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <span className="h-0.5 w-3 rounded" style={{ background: color }} />{data[hover].label}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bars: one value per category (entries by type).
// ---------------------------------------------------------------------------
export type HBar = { key: string; label: string; icon: string; value: number; color: string; href: string };

export function HBarChart({ data, unit = "entries" }: { data: HBar[]; unit?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <div className="grid gap-1.5" role="list" aria-label={`Log ${unit} by type`}>
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <Link key={d.key} href={d.href} scroll={false} role="listitem"
            className="group grid grid-cols-[112px_1fr] items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2/70 focus-visible:bg-surface-2/70"
            title={`${d.label}: ${d.value} ${unit} (${total ? Math.round((d.value / total) * 100) : 0}%)`}>
            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
              <span aria-hidden>{d.icon}</span>{d.label}
            </span>
            <span className="flex items-center gap-2.5">
              <span className="relative h-3.5 flex-1">
                <span className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                  style={{ width: `max(${pct}%, ${d.value ? 4 : 0}px)`, background: d.color }} />
              </span>
              <span className="tabular w-10 text-right text-[13px] font-bold">{d.value}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thin segmented bar: one whole split into parts (8px, rounded ends, 2px gaps).
// ---------------------------------------------------------------------------
export function SegmentBar({ parts, height = 8 }: { parts: { label: string; value: number; color: string }[]; height?: number }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="flex w-full gap-[2px]" style={{ height }} role="img"
      aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
      {total === 0 && <span className="h-full w-full rounded-full bg-surface-2" />}
      {shown.map((p, i) => (
        <span key={p.label} title={`${p.label}: ${p.value} of ${total}`}
          className={`h-full ${i === 0 ? "rounded-l-full" : ""} ${i === shown.length - 1 ? "rounded-r-full" : ""}`}
          style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
      ))}
    </div>
  );
}
