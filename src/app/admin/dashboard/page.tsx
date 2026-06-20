import Link from "next/link";
import {
  Users,
  ClipboardList,
  UserCheck,
  UserX,
  TrendingUp,
  ArrowRight,
  Clock,
  UserPlus,
  Activity,
  ShieldCheck,
  Sparkles,
  BarChart3
} from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getDashboardStats, getRecentActivity } from "@/lib/db/queries";
import { getActiveDbContext } from "@/lib/db";
import { formatRelativeTime } from "@/lib/utils";

export const revalidate = 60;

export default async function DashboardPage() {
  const admin = await requireAdmin();

  const dbContext = getActiveDbContext();
  const [stats, activity] = await Promise.all([
    getDashboardStats(dbContext),
    getRecentActivity(8, dbContext),
  ]);

  const statCards = [
    {
      label: "Total Users",
      value: stats.total_users.toLocaleString(),
      icon: Users,
    },
    {
      label: "Approved Access",
      value: stats.approved_users.toLocaleString(),
      icon: UserCheck,
    },
    {
      label: "Pending Review",
      value: stats.pending_requests.toLocaleString(),
      icon: ClipboardList,
      trend: stats.pending_requests > 0 ? "action_needed" : null,
    },
    {
      label: "Rejected",
      value: stats.rejected_users.toLocaleString(),
      icon: UserX,
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6 lg:space-y-8">
      
      {/* ── Premium Welcome Banner (Platform Branded) ── */}
      <div className="relative overflow-hidden rounded-xl p-8 sm:p-10 shadow-sm border border-orange-200/50"
           style={{
             background: "linear-gradient(135deg, #FF6719 0%, #EA580C 100%)",
           }}>
        {/* Abstract background shapes matching landing page glows */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-white/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-48 h-48 bg-black/10 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/20 text-white text-[11px] font-bold uppercase tracking-widest shadow-sm backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              System Overview
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Welcome back, {admin.user?.name?.split(' ')[0] ?? "Admin"} <Sparkles className="w-6 h-6 text-orange-200" />
            </h1>
            <p className="text-orange-50 text-lg max-w-xl leading-relaxed font-medium">
              Your platform is running smoothly. You currently have{" "}
              <span className="font-bold text-white underline decoration-orange-300 underline-offset-4">
                {stats.pending_requests} pending requests
              </span>{" "}
              that require review.
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-xl shadow-inner">
              <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg text-white">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mb-0.5">Total Users</p>
                <p className="text-white text-2xl font-black leading-none">{stats.total_users.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-xl shadow-inner">
              <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg text-white">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mb-0.5">New (7 Days)</p>
                <p className="text-white text-2xl font-black leading-none">+{stats.new_last_7_days.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        
        {/* ── Left Column (Stats & Activity) ── */}
        <div className="xl:col-span-2 space-y-6 lg:space-y-8">
          
          {/* ── Stats Grid ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="relative bg-white rounded-xl p-4 border border-neutral-200 shadow-sm hover:border-orange-200 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-100 group-hover:bg-[#FF6719] group-hover:border-[#EA580C] transition-colors duration-200">
                      <Icon className="w-4 h-4 text-[#FF6719] group-hover:text-white transition-colors duration-200" strokeWidth={2} />
                    </div>
                    {card.trend === "action_needed" && card.value !== "0" && (
                      <span className="flex items-center gap-1.5 text-[9px] font-bold text-[#FF6719] bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full uppercase shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF6719] animate-pulse" />
                        Action
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-[#09090B] group-hover:text-[#FF6719] transition-colors duration-200">
                    {card.value}
                  </p>
                  <p className="text-neutral-500 text-[10px] font-bold mt-1 uppercase tracking-wider">
                    {card.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ── Recent Activity Feed ── */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm flex flex-col h-[500px]">
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50 rounded-t-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center shadow-sm">
                  <Clock className="w-4 h-4 text-neutral-500" />
                </div>
                <h2 className="font-bold text-[#09090B] text-base">Real-time Activity</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Live</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              {activity.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-4">
                    <Activity className="w-6 h-6 text-neutral-400" />
                  </div>
                  <p className="text-[#09090B] font-bold">No recent activity</p>
                  <p className="text-neutral-500 text-sm mt-1">Actions will appear here as users engage.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activity.map((item, i) => (
                    <div
                      key={`${item.id}-${item.action}-${String(item.occurred_at)}`}
                      className="group flex items-center gap-4 p-3.5 rounded-xl hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all"
                    >
                      {item.picture ? (
                      <div className="w-10 h-10 relative flex-shrink-0">
                        <div className="w-full h-full rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.picture} alt={item.name ?? item.email} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${
                          item.action === "registered" ? "bg-blue-500" :
                          item.action === "applied" ? "bg-orange-500" :
                          item.action === "approved" ? "bg-emerald-500" :
                          "bg-red-500"
                        }`}>
                          {item.action === "registered" && <UserPlus className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          {item.action === "applied" && <ClipboardList className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          {item.action === "approved" && <UserCheck className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          {item.action === "rejected" && <UserX className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </div>
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border shadow-sm transition-colors ${
                        item.action === "registered" ? "bg-blue-50 border-blue-100 text-blue-600 group-hover:bg-blue-100" :
                        item.action === "applied" ? "bg-orange-50 border-orange-100 text-orange-600 group-hover:bg-orange-100" :
                        item.action === "approved" ? "bg-emerald-50 border-emerald-100 text-emerald-600 group-hover:bg-emerald-100" :
                        "bg-red-50 border-red-100 text-red-600 group-hover:bg-red-100"
                      }`}>
                        {item.action === "registered" && <UserPlus className="w-4 h-4" strokeWidth={2.5} />}
                        {item.action === "applied" && <ClipboardList className="w-4 h-4" strokeWidth={2.5} />}
                        {item.action === "approved" && <UserCheck className="w-4 h-4" strokeWidth={2.5} />}
                        {item.action === "rejected" && <UserX className="w-4 h-4" strokeWidth={2.5} />}
                      </div>
                    )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#09090B] truncate">
                          {item.name ?? item.email}
                        </p>
                        <p className="text-xs text-neutral-500 font-medium mt-0.5">
                          {item.action === "registered" && "Created a new account"}
                          {item.action === "applied" && "Submitted beta request"}
                          {item.action === "approved" && "Granted beta access"}
                          {item.action === "rejected" && "Beta request declined"}
                        </p>
                      </div>

                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider flex-shrink-0">
                        {formatRelativeTime(item.occurred_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Actions & Funnel ── */}
        <div className="space-y-6 lg:space-y-8">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <h2 className="font-bold text-[#09090B] text-base mb-5">
              Quick Links
            </h2>
            <div className="space-y-3">
              <Link
                href="/admin/beta?status=PENDING"
                className="flex items-center justify-between w-full p-4 rounded-xl bg-white border border-neutral-200 shadow-sm hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-100 group-hover:bg-[#FF6719] transition-colors duration-200">
                    <ClipboardList className="w-5 h-5 text-[#FF6719] group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#09090B]">
                      Review Beta Requests
                    </p>
                    <p className="text-xs text-neutral-500 font-medium mt-0.5">
                      {stats.pending_requests} pending approval
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#FF6719] transition-colors" />
              </Link>

              <Link
                href="/admin/users"
                className="flex items-center justify-between w-full p-4 rounded-xl bg-white border border-neutral-200 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-neutral-50 flex items-center justify-center border border-neutral-100 group-hover:bg-neutral-800 transition-colors duration-200">
                    <Users className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#09090B]">
                      User Directory
                    </p>
                    <p className="text-xs text-neutral-500 font-medium mt-0.5">
                      Manage {stats.total_users.toLocaleString()} users
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-800 transition-colors" />
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
            <h2 className="font-bold text-[#09090B] text-base mb-6">
              Conversion Funnel
            </h2>
            <div className="space-y-5">
              {[
                {
                  label: "Total Registered",
                  value: stats.total_users,
                  color: "bg-neutral-800",
                  bgLight: "bg-neutral-100",
                  max: stats.total_users,
                },
                {
                  label: "Applied for Beta",
                  value: stats.approved_users + stats.pending_requests + stats.rejected_users,
                  color: "bg-[#FF6719]",
                  bgLight: "bg-orange-100",
                  max: stats.total_users,
                },
                {
                  label: "Approved Access",
                  value: stats.approved_users,
                  color: "bg-emerald-500",
                  bgLight: "bg-emerald-100",
                  max: stats.total_users,
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-neutral-500 font-bold uppercase tracking-widest">{item.label}</span>
                    <span className="text-[#09090B] font-black text-sm">{item.value.toLocaleString()}</span>
                  </div>
                  <div className={`h-2 ${item.bgLight} rounded-full overflow-hidden shadow-inner`}>
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{
                        width: item.max > 0 ? `${Math.round((item.value / item.max) * 100)}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
