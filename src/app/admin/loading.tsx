import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm font-medium animate-pulse">Loading data…</p>
      </div>
    </div>
  );
}
