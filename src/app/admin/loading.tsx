export default function AdminLoading() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--line-strong) border-t-brand-500" />
        <p className="text-[13px] font-medium text-(--ink-mute)">Loading console…</p>
      </div>
    </div>
  );
}
