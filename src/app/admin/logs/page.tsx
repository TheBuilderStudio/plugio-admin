"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Terminal as TerminalIcon,
  Search,
  ArrowDown,
  Play,
  Pause,
  Trash2,
  Loader2,
  ShieldAlert,
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

export default function LogsPage() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "live" | "paused" | "disconnected">("connecting");
  const [eventCount, setEventCount] = useState(0);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lineIdCounter = useRef(0);

  // Initialize EventSource stream
  useEffect(() => {
    if (isPaused) {
      setConnectionStatus("paused");
      return;
    }

    setConnectionStatus("connecting");
    const eventSource = new EventSource("/api/admin/logs/stream");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus("live");
    };

    eventSource.onmessage = (event) => {
      const rawLine = event.data;
      if (!rawLine) return;

      setLogs((prev) => {
        // Limit total lines in memory to prevent browser performance bottlenecks
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

  // Handle auto scroll
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Parse log line structure
  const parseLogLine = (raw: string): LogLine => {
    lineIdCounter.current += 1;
    let level: LogLine["level"] = "UNKNOWN";
    let timestamp = "";
    let message = raw;

    // Standard pattern: 2026-06-20 12:46:44.530 [thread] LEVEL
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

  // Filter logs in memory
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = levelFilter === "ALL" || log.level === levelFilter;
      const matchesSearch =
        !search ||
        log.raw.toLowerCase().includes(search.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [logs, levelFilter, search]);

  const clearLogs = () => {
    setLogs([]);
    setEventCount(0);
  };

  // Helper to highlight matching search term
  const renderLogMessage = (text: string) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(search)})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-orange-500/30 text-orange-200 rounded px-0.5">
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
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6 lg:space-y-8 flex flex-col h-screen overflow-hidden">
      
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-xl p-8 bg-white border border-neutral-200 shadow-sm flex-shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-[#09090B] tracking-tight flex items-center gap-3">
              <TerminalIcon className="w-8 h-8 text-[#FF6719]" />
              System Server Logs
            </h1>
            <p className="text-neutral-500 font-medium">
              View, stream, and filter Spring Boot backend logs in real-time.
            </p>
          </div>

          {/* Quick Connection Status Info */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="bg-[#FAFAFA] border border-neutral-200 px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-inner">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Live Events:</span>
              <span className="text-sm font-black text-[#09090B]">{eventCount.toLocaleString()}</span>
            </div>
            
            {/* Status Indicator Badge */}
            <div className="bg-white border border-neutral-200 px-4 py-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
              {connectionStatus === "connecting" && (
                <>
                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                  <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest">Connecting</span>
                </>
              )}
              {connectionStatus === "live" && (
                <>
                  <Wifi className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest">Live</span>
                </>
              )}
              {connectionStatus === "paused" && (
                <>
                  <Pause className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">Paused</span>
                </>
              )}
              {connectionStatus === "disconnected" && (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-widest">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Console Interface ── */}
      <div className="bg-[#0D0C0B] rounded-xl border border-neutral-800 shadow-2xl flex-1 flex flex-col overflow-hidden min-h-0">
        
        {/* Terminal Header & Control Panel */}
        <div className="bg-[#141312] border-b border-neutral-800 px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-shrink-0">
          
          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-lg w-fit border border-neutral-800/60">
            {[
              { value: "ALL", label: "All" },
              { value: "INFO", label: "Info", color: "text-emerald-400" },
              { value: "WARN", label: "Warn", color: "text-amber-400" },
              { value: "ERROR", label: "Error", color: "text-red-400" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setLevelFilter(tab.value as any)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-widest transition-all duration-200 ${
                  levelFilter === tab.value
                    ? "bg-neutral-800 text-white shadow-sm border border-neutral-700/50"
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40 border border-transparent"
                }`}
              >
                <span className={tab.color}>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Interactive Tools Panel */}
          <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
            {/* Search Input */}
            <div className="relative flex items-center min-w-[240px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-neutral-500" />
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search console logs…"
                className="block w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors shadow-inner"
              />
            </div>

            <div className="h-6 w-[1px] bg-neutral-800 hidden lg:block" />

            {/* Auto-Scroll Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-neutral-400 select-none hover:text-neutral-200 transition-colors">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-neutral-800 text-[#FF6719] focus:ring-0 bg-neutral-950 cursor-pointer"
              />
              Auto-Scroll
            </label>

            <div className="h-6 w-[1px] bg-neutral-800" />

            {/* Stream Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border transition-all shadow-sm ${
                  isPaused
                    ? "bg-emerald-950 border-emerald-800/50 hover:bg-emerald-900 text-emerald-300"
                    : "bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-neutral-300"
                }`}
                title={isPaused ? "Resume Live Stream" : "Pause Live Stream"}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {isPaused ? "Resume" : "Pause"}
              </button>

              <button
                onClick={clearLogs}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-red-950/20 border border-neutral-800 hover:border-red-900/30 text-neutral-400 hover:text-red-400 text-xs font-bold uppercase tracking-widest rounded-lg transition-all shadow-sm"
                title="Clear Logs Console"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

        </div>

        {/* Live Terminal Log Display Console */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed custom-scrollbar flex flex-col space-y-2 select-text selection:bg-neutral-700 selection:text-white">
          {filteredLogs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-600">
              <TerminalIcon className="w-10 h-10 mb-3 text-neutral-700" />
              <p className="font-bold text-neutral-500">Terminal console empty</p>
              <p className="text-[10px] mt-1 uppercase tracking-wider text-neutral-600">
                {connectionStatus === "live" ? "Waiting for new backend log events..." : "Connect the server stream to view logs."}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              // Level specific coloring
              let levelColor = "text-neutral-500";
              let msgColor = "text-neutral-300";
              if (log.level === "INFO") levelColor = "text-emerald-400";
              if (log.level === "WARN") {
                levelColor = "text-amber-400";
                msgColor = "text-amber-100/90";
              }
              if (log.level === "ERROR") {
                levelColor = "text-red-400 font-extrabold";
                msgColor = "text-red-100/90 bg-red-950/10 rounded px-1 border border-red-950/20";
              }

              return (
                <div key={log.id} className="flex items-start gap-3 hover:bg-neutral-900/40 py-0.5 px-1 rounded transition-colors group">
                  {/* Timestamp */}
                  {log.timestamp && (
                    <span className="text-neutral-600 select-none flex-shrink-0 group-hover:text-neutral-500 transition-colors">
                      {log.timestamp}
                    </span>
                  )}
                  {/* Log Level */}
                  {log.level !== "UNKNOWN" && (
                    <span className={`w-12 text-left font-black uppercase flex-shrink-0 select-none ${levelColor}`}>
                      [{log.level}]
                    </span>
                  )}
                  {/* Log message */}
                  <span className={`flex-1 break-all whitespace-pre-wrap ${msgColor}`}>
                    {renderLogMessage(log.message)}
                  </span>
                </div>
              );
            })
          )}
          {/* Scroll Target */}
          <div ref={consoleEndRef} />
        </div>

      </div>
    </div>
  );
}
