import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, { box: string; dot: string }> = {
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  danger: { box: "border-red-200 bg-red-50 text-red-800", dot: "bg-red-500" },
  info: { box: "border-sky-200 bg-sky-50 text-sky-800", dot: "bg-sky-500" },
  neutral: { box: "border-(--line) bg-(--hover) text-(--ink-soft)", dot: "bg-(--ink-mute)" },
};

/** One status pill for the whole console: tone carries meaning, the label carries the words. */
export function Badge({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-px text-[12px] font-medium leading-5",
        t.box,
        className
      )}
    >
      {dot ? <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} /> : null}
      {children}
    </span>
  );
}
