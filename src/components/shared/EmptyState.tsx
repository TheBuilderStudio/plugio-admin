import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Empty states answer two questions: why is this empty, and what can I do now.
 * `action` is the one next step (clear a filter, go set something up).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-(--line) bg-[#F7F4EE]">
        <Icon className="h-5 w-5 text-(--ink-mute)" strokeWidth={1.7} />
      </div>
      <p className="text-[14.5px] font-semibold text-(--ink)">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-(--ink-soft)">{description}</p> : null}
      {action ? (
        <Link href={action.href} className="admin-btn-ghost mt-4 py-1.5 text-[12.5px]">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
