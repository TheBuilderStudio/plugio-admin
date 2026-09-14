import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-[#F7F4EE]">
        <Icon className="h-6 w-6 text-[var(--ink-mute)]" strokeWidth={1.6} />
      </div>
      <p className="text-[15px] font-semibold text-[var(--ink)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] text-[var(--ink-soft)]">{description}</p>
      ) : null}
    </div>
  );
}
