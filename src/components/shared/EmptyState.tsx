import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-zinc-400" strokeWidth={1.5} />
      </div>
      <p className="text-zinc-700 font-semibold text-base">{title}</p>
      {description && (
        <p className="text-zinc-400 text-sm mt-1 max-w-xs">{description}</p>
      )}
    </div>
  );
}
