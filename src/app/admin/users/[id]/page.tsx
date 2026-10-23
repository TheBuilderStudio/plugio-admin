import type { Metadata } from "next";
import type { ReactNode } from "react";
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
import { getUserDetail, getPaymentAuditEventsForUser, listTrialCoupons, getBillingPlanSettings } from "@/lib/db/queries";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BetaActions } from "@/components/beta/BetaActions";
import { CopyOutreachScript } from "@/components/beta/CopyOutreachScript";
import {
  buildCreatorOutreachScript,
  pickSuggestedTrialCoupon,
} from "@/lib/beta-outreach";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-tone";
import { CreatorNotes } from "@/components/users/CreatorNotes";
import { listCreatorNotes } from "@/lib/db/notes";
import { getAdminAccess } from "@/lib/admin-access";
import { getCreatorMarketplace } from "@/lib/db/marketplace";
import { formatMinor } from "@/lib/utils";
import { AdminPage, AdminCard } from "@/components/ui/page-shell";
import {
  formatDate,
  formatDateTime,
  formatFollowers,
  getInitials,
  daysUntil,
} from "@/lib/utils";

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: UserDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Creator ${id.slice(0, 8)}… — Plugio Console`,
  };
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const session = await requireAdmin();

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
  const market = await getCreatorMarketplace(userId).catch(() => null);
  const adminEmail = (session.user?.email ?? "").toLowerCase();
  const canDeleteAnyNote = (await getAdminAccess(session)).can("MANAGE_ADMINS");
  const rawNotes = await listCreatorNotes(userId).catch(() => null);
  const notes = rawNotes?.map((n) => ({
    id: n.id,
    author: n.author_email,
    body: n.body,
    at: n.created_at.toISOString(),
    mine: n.author_email.toLowerCase() === adminEmail,
    canDelete: canDeleteAnyNote || n.author_email.toLowerCase() === adminEmail,
  }));
  const readOnlyMode = process.env.READ_ONLY_MODE === "true" || process.env.NEXT_PUBLIC_READ_ONLY_MODE === "true";
  const coupons = await listTrialCoupons().catch(() => []);
  const suggestedCoupon = pickSuggestedTrialCoupon(coupons);
  const catalog = await getBillingPlanSettings().catch(() => undefined);
  const chaseScript = buildCreatorOutreachScript({
    name: user.name,
    couponCode: suggestedCoupon?.code ?? null,
    catalog,
  });

  const hasBetaApplication = !!user.beta_application_submitted_at;
  const isPending =
    user.access_status === "PENDING" ||
    (hasBetaApplication && !user.access_status);
  const connectedCount = user.social_accounts.filter((a) => a.is_active).length;
  const trialDaysLeft =
    user.trial_ends_at != null ? daysUntil(user.trial_ends_at) : null;
  const subStatus = user.subscription_status;
  const needsTrial = user.access_status === "APPROVED" && (!subStatus || subStatus === "NONE");
  const trialNoPublish = subStatus === "TRIALING" && user.published_count === 0;
  const trialEnding =
    subStatus === "TRIALING" && trialDaysLeft != null && trialDaysLeft <= 2;
  const chaseHint = needsTrial
    ? "Approved, no trial. Send the coupon and ask them to connect a channel."
    : trialNoPublish
      ? connectedCount === 0
        ? "Trialing, zero channels. Ask them to connect one account today."
        : "Connected but has not published yet. Ask them to upload once."
      : trialEnding
        ? `Trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"}. Ask them to keep their plan.`
        : null;

  return (
    <AdminPage>
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-[13px] font-medium text-(--ink-soft) transition hover:text-(--ink)"
      >
        <ArrowLeft className="h-4 w-4" />
        Creators
      </Link>

      <AdminCard>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {user.picture ? (
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-(--line)">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.picture}
                alt={user.name ?? user.email}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-xl font-bold text-white">
              {getInitials(user.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[22px] font-semibold tracking-tight text-(--ink)">
                  {user.name ?? "Unnamed user"}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-(--ink-soft)">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-(--ink-mute)" />
                    {user.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-(--ink-mute)" />
                    Joined {formatDate(user.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={user.access_status} />
                <StatusBadge status={user.subscription_status ?? "NONE"} />
                <Link href={`/admin/store/seller/${user.id}`} className="admin-btn-ghost py-1.5 text-[12px]">Money statement</Link>
              </div>
            </div>
          </div>
        </div>
      </AdminCard>

      {chaseHint ? (
        <section className="overflow-hidden rounded-[14px] border border-amber-200/90 bg-linear-to-br from-amber-50 to-(--paper) shadow-(--shadow-paper)">
          <div className="border-b border-amber-100 px-5 py-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-500">
              Chase this creator
            </p>
            <p className="mt-1 text-[14px] font-semibold text-amber-950">{chaseHint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 sm:px-6">
            <ChaseStat label="Connected" value={String(connectedCount)} />
            <ChaseStat label="Published" value={String(user.published_count)} />
            <ChaseStat label="Trial days left" value={trialDaysLeft == null ? "—" : String(trialDaysLeft)} />
            <ChaseStat label="Plan" value={user.plan_id ?? subStatus ?? "NONE"} />
          </div>
          {needsTrial ? (
            <div className="border-t border-amber-100 px-5 py-4 sm:px-6">
              <CopyOutreachScript
                script={chaseScript}
                couponCode={suggestedCoupon?.code ?? null}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {hasBetaApplication && (
          <AdminCard>
            <SectionTitle icon={MessageSquare} title="Beta application" />
            <div className="mt-4 space-y-1">
              <InfoRow label="Applied" value={formatDateTime(user.beta_application_submitted_at)} />
              <InfoRow label="Status" value={user.access_status ?? "Pending"} />
              {user.instagram_username && (
                <InfoRow
                  label="Instagram"
                  icon={<Instagram className="h-3.5 w-3.5 text-(--ink-mute)" />}
                  value={
                    <span>
                      @{user.instagram_username}
                      {user.instagram_followers !== null ? (
                        <span className="ml-1.5 text-[12px] font-medium text-(--ink-mute)">
                          {formatFollowers(user.instagram_followers)}
                        </span>
                      ) : null}
                    </span>
                  }
                />
              )}
              {user.youtube_channel && (
                <InfoRow
                  label="YouTube"
                  icon={<Youtube className="h-3.5 w-3.5 text-(--ink-mute)" />}
                  value={
                    <span>
                      {user.youtube_channel}
                      {user.youtube_followers !== null ? (
                        <span className="ml-1.5 text-[12px] font-medium text-(--ink-mute)">
                          {formatFollowers(user.youtube_followers)}
                        </span>
                      ) : null}
                    </span>
                  }
                />
              )}
              {user.facebook_page && (
                <InfoRow
                  label="Facebook"
                  icon={<Facebook className="h-3.5 w-3.5 text-(--ink-mute)" />}
                  value={
                    <span>
                      {user.facebook_page}
                      {user.facebook_followers !== null ? (
                        <span className="ml-1.5 text-[12px] font-medium text-(--ink-mute)">
                          {formatFollowers(user.facebook_followers)}
                        </span>
                      ) : null}
                    </span>
                  }
                />
              )}
            </div>
            {user.application_message ? (
              <div className="mt-4 rounded-xl border border-(--line) bg-[#F7F4EE] p-4">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-(--ink-mute)">
                  Message
                </p>
                <p className="text-[13.5px] leading-relaxed text-(--ink)">
                  {user.application_message}
                </p>
              </div>
            ) : null}
            {(isPending || user.access_status === "PENDING") && (
              <div className="mt-5 border-t border-(--line) pt-4">
                <BetaActions userId={user.id} currentStatus={user.access_status} />
              </div>
            )}
          </AdminCard>
        )}

        <AdminCard>
          <SectionTitle icon={CreditCard} title="Subscription" />
          <div className="mt-4 space-y-1">
            <InfoRow label="Status" value={<StatusBadge status={user.subscription_status ?? "NONE"} />} />
            <InfoRow label="Plan" value={user.plan_id ?? "—"} />
            <InfoRow
              label="Has used trial"
              value={
                user.has_used_trial === null ? "—" : user.has_used_trial ? "Yes" : "No"
              }
            />
            {user.billing_interval && <InfoRow label="Billing" value={user.billing_interval} />}
            {user.plan_started_at && (
              <InfoRow label="Plan started" value={formatDate(user.plan_started_at)} />
            )}
            {user.trial_ends_at && <InfoRow label="Trial ends" value={formatDate(user.trial_ends_at)} />}
            {user.pro_period_end_at && (
              <InfoRow label="Pro ends" value={formatDate(user.pro_period_end_at)} />
            )}
            {user.payment_last4 && <InfoRow label="Card" value={`•••• ${user.payment_last4}`} />}
          </div>
          {paymentEvents.length > 0 && (
            <div className="mt-5 border-t border-(--line) pt-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-(--ink-mute)">
                Payment history
              </p>
              <div className="space-y-2">
                {paymentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-(--line) bg-[#F7F4EE] px-3 py-2.5"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-(--ink)">{evt.event_type}</p>
                      <p className="text-[12px] text-(--ink-soft)">{formatDateTime(evt.created_at)}</p>
                    </div>
                    <Badge tone={statusTone(evt.status)}>{statusLabel(evt.status)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AdminCard>

        <AdminCard>
          <SectionTitle title="Connected accounts" />
          {user.social_accounts.length === 0 ? (
            <p className="mt-4 text-[13px] text-(--ink-mute)">No accounts connected</p>
          ) : (
            <div className="mt-4 space-y-2">
              {user.social_accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-xl border border-(--line) bg-[#F7F4EE] px-3 py-2.5"
                >
                  {account.provider === "YOUTUBE" && (
                    <Youtube className="h-4 w-4 shrink-0 text-(--ink-soft)" />
                  )}
                  {account.provider === "INSTAGRAM" && (
                    <Instagram className="h-4 w-4 shrink-0 text-(--ink-soft)" />
                  )}
                  {account.provider === "FACEBOOK" && (
                    <Facebook className="h-4 w-4 shrink-0 text-(--ink-soft)" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-(--ink)">
                      {account.account_name ?? account.provider}
                    </p>
                    <p className="text-[12px] text-(--ink-soft)">{account.account_type}</p>
                  </div>
                  <Badge tone={account.is_active ? "success" : "neutral"}>{account.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard>
          <SectionTitle icon={FileVideo} title="Content" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-(--line) bg-[#F7F4EE] px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-(--ink-mute)">
                Published / scheduled
              </p>
              <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-(--ink)">
                {user.published_count}
              </p>
            </div>
            <div className="rounded-xl border border-(--line) bg-[#F7F4EE] px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-(--ink-mute)">
                All content rows
              </p>
              <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-(--ink)">
                {user.content_count}
              </p>
            </div>
          </div>
        </AdminCard>

        {market && (
          <AdminCard className="lg:col-span-2">
            <SectionTitle icon={CreditCard} title="Marketplace" />
            <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <div>
                <InfoRow label="Store sales (30 days)" value={moneyLine(market.store)} />
                <InfoRow label="Store sales (all time)" value={moneyLine(market.storeTotal)} />
                <InfoRow label="Paid sessions (all time)" value={moneyLine(market.sessions)} />
                <InfoRow
                  label="Products"
                  value={`${market.products.live} live of ${market.products.total}${market.products.suspended ? `, ${market.products.suspended} suspended` : ""}`}
                />
              </div>
              <div>
                <InfoRow
                  label="Sessions"
                  value={`${market.bookings.upcoming} upcoming · ${market.bookings.completed} done · ${market.bookings.cancelled} cancelled`}
                />
                <InfoRow
                  label="Cancelled by creator (90 days)"
                  value={
                    <span className={market.bookings.cancelledByCreator90d >= 3 ? "font-semibold text-red-700" : ""}>
                      {market.bookings.cancelledByCreator90d}
                    </span>
                  }
                />
                <InfoRow label="Brand inquiries" value={`${market.inquiries.total} (${market.inquiries.unread} unread)`} />
                <InfoRow
                  label="Identity check"
                  value={
                    market.kyc ? (
                      <Link href={`/admin/store?tab=kyc&status=${market.kyc.status}`} className="font-semibold text-brand-500 hover:underline">
                        {market.kyc.status.toLowerCase()}
                      </Link>
                    ) : (
                      "Not submitted"
                    )
                  }
                />
                <InfoRow
                  label="Payouts"
                  value={
                    <Link href={`/admin/store/seller/${user.id}`} className="font-semibold text-brand-500 hover:underline">
                      {market.payouts.requestedCount > 0
                        ? `${market.payouts.requestedCount} waiting (${formatMinor(market.payouts.requestedMinor, "INR")})`
                        : `Paid out ${formatMinor(market.payouts.paidMinor, "INR")}`}
                    </Link>
                  }
                />
              </div>
            </div>
          </AdminCard>
        )}

        <AdminCard className="lg:col-span-2">
          <SectionTitle icon={MessageSquare} title="Admin notes" />
          {notes ? (
            <CreatorNotes userId={user.id} notes={notes} readOnly={readOnlyMode} />
          ) : (
            <p className="mt-4 text-[13px] text-(--ink-mute)">
              Notes are not set up yet. Apply migration V90.
            </p>
          )}
        </AdminCard>

        <AdminCard className="lg:col-span-2">
          <SectionTitle title="Profile" />
          <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <InfoRow label="Username" value={user.username ?? "Not set"} />
            <InfoRow label="Niche" value={user.niche ?? "Not set"} />
            <InfoRow label="Location" value={user.location ?? "Not set"} />
            <InfoRow label="Last updated" value={formatDateTime(user.updated_at)} />
            <InfoRow label="User ID" value={user.id} mono />
          </div>
        </AdminCard>
      </div>
    </AdminPage>
  );
}

function moneyLine(rows: { currency: string; count: number; grossMinor: number }[]) {
  if (rows.length === 0) return "None";
  return rows.map((r) => `${formatMinor(r.grossMinor, r.currency)} (${r.count})`).join(" · ");
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon?: typeof MessageSquare;
  title: string;
}) {
  return (
    <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-(--ink)">
      {Icon ? <Icon className="h-4 w-4 text-(--ink-mute)" /> : null}
      {title}
    </h2>
  );
}

function ChaseStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-800/80">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-amber-950">{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  icon,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-(--line) py-2.5 last:border-0">
      <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-(--ink-mute)">
        {icon}
        {label}
      </span>
      <span
        className={`text-right text-[13.5px] font-medium text-(--ink) ${
          mono ? "font-mono text-[12px] text-(--ink-soft)" : ""
        }`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
