import type { ReactNode } from "react";
import Link from "next/link";
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
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {kicker ? <p className="admin-kicker">{kicker}</p> : null}
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--ink)] sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--ink-soft)]">
            {description}
          </p>
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
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">{subtitle}</p>
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
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition",
            item.active
              ? "bg-[var(--ink)] text-white"
              : "text-[var(--ink-soft)] hover:bg-[#F7F4EE] hover:text-[var(--ink)]"
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
        "admin-card h-full p-4 transition",
        href && "hover:border-[#FF6719]/35",
        tone === "alert" && "border-amber-300/80 bg-gradient-to-br from-amber-50 to-[var(--paper)]",
        tone === "brand" && "border-orange-200 bg-gradient-to-br from-orange-50 to-[var(--paper)]"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
        {label}
      </p>
      <p className="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--ink)] sm:text-[24px]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
