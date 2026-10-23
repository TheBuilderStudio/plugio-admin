import type { ReactNode } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminPage({
  children,
  className,
  fill = false,
}: {
  children: ReactNode;
  className?: string;
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "admin-page animate-fade-in",
        fill && "flex h-full min-h-0 max-w-none flex-col overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminPageHeader({
  title,
  entity = false,
  description,
  hint,
  actions,
}: {
  /** Page names live in the top bar (from the sidebar). Only a page about one record shows its own heading here. */
  title: string;
  entity?: boolean;
  /** One short line. Anything longer belongs in {@link hint}. */
  description?: string;
  /** The longer explanation, tucked behind an info icon so it never crowds the page. */
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className={entity ? "text-[24px] font-semibold tracking-tight text-(--ink) sm:text-[28px]" : "sr-only"}>{title}</h1>
        {description || hint ? (
          <div className="flex items-center gap-2">
            {description ? <p className="max-w-xl text-[13.5px] text-(--ink-soft)">{description}</p> : null}
            {hint ? (
              <details className="group">
                <summary
                  aria-label={`About ${title}`}
                  title="About this page"
                  className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full text-(--ink-mute) transition hover:bg-black/5 hover:text-(--ink) group-open:bg-black/5 [&::-webkit-details-marker]:hidden"
                >
                  <Info className="h-4 w-4" />
                </summary>
                <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl border border-(--line) bg-(--paper) p-3 text-[12.5px] leading-relaxed text-(--ink-soft) shadow-lg sm:right-auto sm:w-80">
                  {hint}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminCard({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("admin-card overflow-hidden", padded && "p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function AdminPanel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("admin-card overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-(--line) px-5 py-3.5">
        <div>
          <h2 className="text-[14px] font-semibold tracking-tight text-(--ink)">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12.5px] text-(--ink-soft)">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FilterPills({
  items,
}: {
  items: { href: string; label: string; active: boolean; count?: number }[];
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-(--radius-control) bg-(--hover) p-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-2.5 py-1 text-[12.5px] font-medium transition",
            item.active
              ? "bg-white text-(--ink) shadow-[0_1px_2px_rgba(16,24,40,0.1)]"
              : "text-(--ink-soft) hover:text-(--ink)"
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span className="ml-1.5 tabular-nums opacity-70">{item.count}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "alert" | "brand";
}) {
  const body = (
    <div
      className={cn(
        "admin-card h-full px-4 py-3.5 transition",
        href && "hover:border-(--line-strong) hover:shadow-[0_2px_6px_rgba(16,24,40,0.06)]",
        tone === "alert" && "border-amber-300/70 bg-amber-50/60",
        tone === "brand" && "border-orange-200 bg-orange-50/60"
      )}
    >
      <p className="text-[12px] font-medium text-(--ink-soft)">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] text-(--ink-mute)">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
