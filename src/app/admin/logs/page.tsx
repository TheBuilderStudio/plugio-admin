"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Terminal as TerminalIcon,
  Search,
  Play,
  Pause,
  Trash2,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";

interface LogLine {
  id: number;
  raw: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "UNKNOWN";
  timestamp: string;
  message: string;
}

type LevelFilter = "ALL" | "INFO" | "WARN" | "ERROR";

export default function LogsPage() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "live" | "paused" | "disconnected"
  >("connecting");
  const [eventCount, setEventCount] = useState(0);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lineIdCounter = useRef(0);

  useEffect(() => {
    if (isPaused) {
      setConnectionStatus("paused");
      return;
    }

    setConnectionStatus("connecting");
    const eventSource = new EventSource("/api/admin/logs/stream", {
      withCredentials: true,
    });
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus("live");
    };

    eventSource.onmessage = (event) => {
      const rawLine = event.data;
      if (!rawLine) return;

      setLogs((prev) => {
        const trimmed = prev.length > 2000 ? prev.slice(prev.length - 1500) : prev;
        const parsed = parseLogLine(rawLine);
        return [...trimmed, parsed];
      });
      setEventCount((c) => c + 1);
    };

    eventSource.onerror = () => {
      setConnectionStatus("disconnected");
      eventSource.close();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [isPaused]);

  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const parseLogLine = (raw: string): LogLine => {
    lineIdCounter.current += 1;
    let level: LogLine["level"] = "UNKNOWN";
    let timestamp = "";
    let message = raw;

    const match = raw.match(/^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+\[.*?\]\s+(\w+)/);
    if (match) {
      timestamp = match[1];
      const parsedLevel = match[2].toUpperCase();
      if (["INFO", "WARN", "ERROR", "DEBUG"].includes(parsedLevel)) {
        level = parsedLevel as LogLine["level"];
      }
      message = raw.substring(match[0].length).trim();
      if (message.startsWith("-")) {
        message = message.substring(1).trim();
      }
    }

    return {
      id: lineIdCounter.current,
      raw,
      level,
      timestamp,
      message,
    };
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = levelFilter === "ALL" || log.level === levelFilter;
      const matchesSearch = !search || log.raw.toLowerCase().includes(search.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [logs, levelFilter, search]);

  const clearLogs = () => {
    setLogs([]);
    setEventCount(0);
  };

  const renderLogMessage = (text: string) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(search)})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="rounded bg-orange-500/30 px-0.5 text-orange-200">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-5 py-4 sm:px-6 lg:px-8">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[12px] font-semibold text-[var(--ink)]">
            {eventCount.toLocaleString()} events
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
            {connectionStatus === "connecting" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                <span className="text-[12px] font-semibold text-amber-800">Connecting</span>
              </>
            )}
            {connectionStatus === "live" && (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[12px] font-semibold text-emerald-800">Live</span>
              </>
            )}
            {connectionStatus === "paused" && (
              <>
                <Pause className="h-3.5 w-3.5 text-[var(--ink-soft)]" />
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Paused</span>
              </>
            )}
            {connectionStatus === "disconnected" && (
              <>
                <WifiOff className="h-3.5 w-3.5 text-red-600" />
                <span className="text-[12px] font-semibold text-red-800">Disconnected</span>
              </>
            )}
          </div>
        </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[#2A2622] bg-[#0D0C0B] shadow-[var(--shadow-paper)]">
        <div className="flex shrink-0 flex-col gap-3 border-b border-white/[0.06] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-fit items-center gap-1 rounded-xl bg-white/[0.04] p-1">
            {(
              [
                { value: "ALL", label: "All" },
                { value: "INFO", label: "Info" },
                { value: "WARN", label: "Warn" },
                { value: "ERROR", label: "Error" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setLevelFilter(tab.value)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                  levelFilter === tab.value
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs"
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-[12px] text-white placeholder:text-white/30 outline-none focus:border-[#FF6719]"
              />
            </div>
            <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] font-medium text-white/50">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-white/20 bg-black text-[#FF6719] focus:ring-0"
              />
              Follow
            </label>
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/[0.08]"
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={clearLogs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/50 hover:border-red-500/30 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        <div className="logs-scroll flex min-h-0 flex-1 flex-col space-y-1 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed text-white/80">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-white/30">
              <TerminalIcon className="mb-3 h-8 w-8" />
              <p className="font-sans text-[13px] font-medium text-white/50">Console empty</p>
              <p className="mt-1 font-sans text-[12px]">
                {connectionStatus === "live"
                  ? "Waiting for backend events…"
                  : "Connect the server stream to view logs."}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              let levelColor = "text-white/35";
              let msgColor = "text-white/75";
              if (log.level === "INFO") levelColor = "text-emerald-400";
              if (log.level === "WARN") {
                levelColor = "text-amber-400";
                msgColor = "text-amber-100/90";
              }
              if (log.level === "ERROR") {
                levelColor = "text-red-400";
                msgColor = "text-red-100";
              }

              return (
                <div key={log.id} className="flex items-start gap-3 rounded-lg px-1 py-0.5 hover:bg-white/[0.03]">
                  {log.timestamp ? (
                    <span className="shrink-0 select-none text-white/25">{log.timestamp}</span>
                  ) : null}
                  {log.level !== "UNKNOWN" ? (
                    <span className={`w-12 shrink-0 select-none font-semibold uppercase ${levelColor}`}>
                      {log.level}
                    </span>
                  ) : null}
                  <span className={`flex-1 whitespace-pre-wrap break-all ${msgColor}`}>
                    {renderLogMessage(log.message)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );
}
