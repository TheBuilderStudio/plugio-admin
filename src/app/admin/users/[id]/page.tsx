import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Instagram,
  Youtube,
  Facebook,
  FileVideo,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { validateUserId } from "@/lib/validation";
import { getUserDetail, getPaymentAuditEventsForUser } from "@/lib/db/queries";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BetaActions } from "@/components/beta/BetaActions";
import { BillingActions } from "@/components/billing/BillingActions";
import {
  formatDate,
  formatDateTime,
  formatFollowers,
  getInitials,
  truncate,
} from "@/lib/utils";

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: UserDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `User ${id.slice(0, 8)}… — Plugio Admin`,
  };
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  await requireAdmin();

  const { id } = await params;

  let userId: string;
  try {
    userId = validateUserId(id);
  } catch {
    notFound();
  }

  const user = await getUserDetail(userId);
  if (!user) notFound();

  const paymentEvents = await getPaymentAuditEventsForUser(userId);

  const hasBetaApplication = !!user.beta_application_submitted_at;
  const isPending =
    user.access_status === "PENDING" ||
    (hasBetaApplication && !user.access_status);

  return (
    <div className="p-8 max-w-5xl">
      {/* Back link */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Users
      </Link>

      {/* User header */}
      <div className="bg-white rounded-2xl card-shadow border border-zinc-100 p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {user.picture ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-neutral-200 shadow-lg shadow-orange-200/50 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.picture} alt={user.name ?? user.email} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-200">
              <span className="text-white text-xl font-bold">
                {getInitials(user.name)}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
                  {user.name ?? "Unnamed User"}
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-500 text-sm">{user.email}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-500 text-sm">
                    Registered {formatDate(user.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={user.access_status} />
                <StatusBadge status={user.subscription_status ?? "NONE"} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Beta Application */}
        {hasBetaApplication && (
          <div className="bg-white rounded-2xl card-shadow border border-zinc-100 p-6">
            <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              Beta Application
            </h2>

            <div className="space-y-3 mb-5">
              <InfoRow
                label="Applied"
                value={formatDateTime(user.beta_application_submitted_at)}
              />
              <InfoRow label="Status" value={user.access_status ?? "Pending"} />

              {user.instagram_username && (
                <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    <span className="text-sm text-zinc-500">Instagram</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-700">
                      @{user.instagram_username}
                    </p>
                    {user.instagram_followers !== null && (
                      <p className="text-xs text-zinc-400">
                        {formatFollowers(user.instagram_followers)} followers
                      </p>
                    )}
                  </div>
                </div>
              )}

              {user.youtube_channel && (
                <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                  <div className="flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-zinc-500">YouTube</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-700 truncate max-w-[180px]">
                      {user.youtube_channel}
                    </p>
                    {user.youtube_followers !== null && (
                      <p className="text-xs text-zinc-400">
                        {formatFollowers(user.youtube_followers)} subscribers
                      </p>
                    )}
                  </div>
                </div>
              )}

              {user.facebook_page && (
                <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                  <div className="flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-zinc-500">Facebook</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-700 truncate max-w-[180px]">
                      {user.facebook_page}
                    </p>
                    {user.facebook_followers !== null && (
                      <p className="text-xs text-zinc-400">
                        {formatFollowers(user.facebook_followers)} followers
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Application message */}
            {user.application_message && (
              <div className="bg-zinc-50 rounded-xl p-4 mb-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Message
                </p>
                <p className="text-sm text-zinc-700 leading-relaxed">
                  {user.application_message}
                </p>
              </div>
            )}

            {/* Actions */}
            {(isPending || user.access_status === "PENDING") && (
              <BetaActions
                userId={user.id}
                currentStatus={user.access_status}
              />
            )}
          </div>
        )}

        {/* Subscription */}
        <div className="bg-white rounded-2xl card-shadow border border-zinc-100 p-6">
          <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-500" />
            Subscription
          </h2>
          <div className="space-y-3">
            <InfoRow
              label="Status"
              value={
                <StatusBadge status={user.subscription_status ?? "NONE"} />
              }
            />
            {user.billing_interval && (
              <InfoRow label="Billing" value={user.billing_interval} />
            )}
            {user.plan_started_at && (
              <InfoRow
                label="Plan started"
                value={formatDate(user.plan_started_at)}
              />
            )}
            {user.trial_ends_at && (
              <InfoRow
                label="Trial ends"
                value={formatDate(user.trial_ends_at)}
              />
            )}
            {user.pro_period_end_at && (
              <InfoRow
                label="Pro Ends (Lifetime)"
                value={formatDate(user.pro_period_end_at)}
              />
            )}
          </div>
          
          <BillingActions userId={user.id} />

          {/* Payment History */}
          {paymentEvents.length > 0 && (
            <div className="mt-6 border-t border-zinc-100 pt-5">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                Payment History
              </h3>
              <div className="space-y-3">
                {paymentEvents.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-zinc-700">{evt.event_type}</p>
                      <p className="text-xs text-zinc-400">{formatDateTime(evt.created_at)}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      evt.status === "SUCCESS" ? "bg-emerald-50 text-emerald-600" :
                      evt.status === "FAILED" ? "bg-red-50 text-red-600" :
                      "bg-zinc-100 text-zinc-500"
                    }`}>
                      {evt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Connected Accounts */}
        <div className="bg-white rounded-2xl card-shadow border border-zinc-100 p-6">
          <h2 className="font-bold text-zinc-800 text-sm mb-4">
            Connected Accounts
          </h2>
          {user.social_accounts.length === 0 ? (
            <p className="text-zinc-400 text-sm">No accounts connected</p>
          ) : (
            <div className="space-y-3">
              {user.social_accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 py-2.5 border-b border-zinc-50 last:border-0"
                >
                  {account.provider === "YOUTUBE" && (
                    <Youtube className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  {account.provider === "INSTAGRAM" && (
                    <Instagram className="w-5 h-5 text-pink-500 flex-shrink-0" />
                  )}
                  {account.provider === "FACEBOOK" && (
                    <Facebook className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-700 truncate">
                      {account.account_name ?? account.provider}
                    </p>
                    <p className="text-xs text-zinc-400">{account.account_type}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      account.is_active
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {account.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl card-shadow border border-zinc-100 p-6">
          <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
            <FileVideo className="w-4 h-4 text-purple-500" />
            Content
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-4xl font-black text-zinc-900">
                {user.content_count}
              </p>
              <p className="text-xs text-zinc-400 font-medium mt-1">
                Total posts
              </p>
            </div>
          </div>
        </div>

        {/* Profile info */}
        <div className="bg-white rounded-2xl card-shadow border border-zinc-100 p-6 lg:col-span-2">
          <h2 className="font-bold text-zinc-800 text-sm mb-4">
            Profile Details
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <InfoRow label="Username" value={user.username ?? "Not set"} />
            <InfoRow label="Niche" value={user.niche ?? "Not set"} />
            <InfoRow label="Location" value={user.location ?? "Not set"} />

            {user.bio && (
              <div className="col-span-2 py-2 border-b border-zinc-50">
                <p className="text-xs text-zinc-400 mb-1">Bio</p>
                <p className="text-sm text-zinc-700">{truncate(user.bio, 300)}</p>
              </div>
            )}
            <InfoRow label="User ID" value={user.id} mono />
            <InfoRow label="Last updated" value={formatDateTime(user.updated_at)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
      <span className="text-xs text-zinc-400 font-medium">{label}</span>
      <span
        className={`text-sm text-zinc-700 font-medium text-right ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
