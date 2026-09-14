"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updatePlanCatalogAction } from "@/actions/plan.actions";
import { formatUsd, termSavePercent, type AdminPlanCatalog } from "@/constants";
import { useAdminReadOnly } from "@/components/shared/AdminReadOnlyContext";
import { trialPricePreviewLine } from "@/lib/plan-coupon-preview";

type Props = {
  catalog: AdminPlanCatalog;
};

function usdField(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function PlanCatalogEditor({ catalog }: Props) {
  const isReadOnly = useAdminReadOnly();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [trialDays, setTrialDays] = useState(String(catalog.trialDays));
  const [trialPrice, setTrialPrice] = useState(usdField(catalog.trialPrice));
  const [creatorMonthly, setCreatorMonthly] = useState(usdField(catalog.CREATOR.monthly));
  const [creatorTwoMonths, setCreatorTwoMonths] = useState(usdField(catalog.CREATOR.twoMonths));
  const [creatorThreeMonths, setCreatorThreeMonths] = useState(
    usdField(catalog.CREATOR.threeMonths)
  );
  const [proMonthly, setProMonthly] = useState(usdField(catalog.PRO.monthly));
  const [proTwoMonths, setProTwoMonths] = useState(usdField(catalog.PRO.twoMonths));
  const [proThreeMonths, setProThreeMonths] = useState(usdField(catalog.PRO.threeMonths));
  const [trialChannels, setTrialChannels] = useState(String(catalog.channelsPerPlatform.TRIAL));
  const [creatorChannels, setCreatorChannels] = useState(
    String(catalog.channelsPerPlatform.CREATOR)
  );
  const [proChannels, setProChannels] = useState(String(catalog.channelsPerPlatform.PRO));

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);

  const creator2mSave = termSavePercent(Number(creatorMonthly), Number(creatorTwoMonths), 2);
  const creator3mSave = termSavePercent(Number(creatorMonthly), Number(creatorThreeMonths), 3);
  const pro2mSave = termSavePercent(Number(proMonthly), Number(proTwoMonths), 2);
  const pro3mSave = termSavePercent(Number(proMonthly), Number(proThreeMonths), 3);

  const invitePreview = useMemo(() => {
    const price = Number(trialPrice);
    const days = Number(trialDays);
    if (!Number.isFinite(price) || !Number.isInteger(days)) return "";
    return trialPricePreviewLine(90, {
      ...catalog,
      trialDays: days,
      trialPrice: price,
    });
  }, [catalog, trialDays, trialPrice]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updatePlanCatalogAction({
        trialDays: Number(trialDays),
        trialPrice: Number(trialPrice),
        creatorMonthly: Number(creatorMonthly),
        creatorTwoMonths: Number(creatorTwoMonths),
        creatorThreeMonths: Number(creatorThreeMonths),
        proMonthly: Number(proMonthly),
        proTwoMonths: Number(proTwoMonths),
        proThreeMonths: Number(proThreeMonths),
        trialChannels: Number(trialChannels),
        creatorChannels: Number(creatorChannels),
        proChannels: Number(proChannels),
      });
      setResult({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      if (res.success) router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {result ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-[13px] font-medium ${
            result.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.message}
        </div>
      ) : null}

      <section className="admin-card p-5 sm:p-6">
        <h2 className="mb-1 text-[15px] font-semibold tracking-tight text-[var(--ink)]">
          Trial
        </h2>
        <p className="mb-4 text-[12.5px] text-[var(--ink-soft)]">
          List price and days. Invite coupons (Coupons desk, max 90%) compute off this list — not a
          hardcoded $0.70.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <NumberField
            label="Days"
            value={trialDays}
            onChange={setTrialDays}
            min={1}
            max={30}
            step="1"
            disabled={isReadOnly}
          />
          <NumberField
            label="List price (USD)"
            value={trialPrice}
            onChange={setTrialPrice}
            min={0.5}
            step="0.01"
            disabled={isReadOnly}
          />
          <NumberField
            label="Channels per platform"
            value={trialChannels}
            onChange={setTrialChannels}
            min={1}
            max={10}
            step="1"
            disabled={isReadOnly}
          />
        </div>
        {invitePreview ? (
          <p className="mt-3 text-[12.5px] font-medium text-[var(--ink-soft)]">
            Typical 90% invite: {invitePreview}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PlanPriceCard
          title="Creator"
          monthly={creatorMonthly}
          twoMonths={creatorTwoMonths}
          threeMonths={creatorThreeMonths}
          channels={creatorChannels}
          save2m={creator2mSave}
          save3m={creator3mSave}
          disabled={isReadOnly}
          onMonthly={setCreatorMonthly}
          onTwoMonths={setCreatorTwoMonths}
          onThreeMonths={setCreatorThreeMonths}
          onChannels={setCreatorChannels}
        />
        <PlanPriceCard
          title="Pro"
          monthly={proMonthly}
          twoMonths={proTwoMonths}
          threeMonths={proThreeMonths}
          channels={proChannels}
          save2m={pro2mSave}
          save3m={pro3mSave}
          disabled={isReadOnly}
          onMonthly={setProMonthly}
          onTwoMonths={setProTwoMonths}
          onThreeMonths={setProThreeMonths}
          onChannels={setProChannels}
        />
      </div>

      {isReadOnly ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-[13px] font-medium text-sky-800">
          Read-only mode — plan writes are blocked.
        </div>
      ) : (
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#FF6719] px-5 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save catalog
        </button>
      )}
    </form>
  );
}

function PlanPriceCard({
  title,
  monthly,
  twoMonths,
  threeMonths,
  channels,
  save2m,
  save3m,
  disabled,
  onMonthly,
  onTwoMonths,
  onThreeMonths,
  onChannels,
}: {
  title: string;
  monthly: string;
  twoMonths: string;
  threeMonths: string;
  channels: string;
  save2m: number | null;
  save3m: number | null;
  disabled: boolean;
  onMonthly: (v: string) => void;
  onTwoMonths: (v: string) => void;
  onThreeMonths: (v: string) => void;
  onChannels: (v: string) => void;
}) {
  const monthlyN = Number(monthly);
  const was2 = Number.isFinite(monthlyN) ? monthlyN * 2 : null;
  const was3 = Number.isFinite(monthlyN) ? monthlyN * 3 : null;

  return (
    <section className="admin-card p-5 sm:p-6">
      <h2 className="mb-1 text-[15px] font-semibold tracking-tight text-[var(--ink)]">{title}</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-soft)]">
        Landing “Save X%” is {was2 != null ? `2 months vs ${formatUsd(was2)}` : "2 months vs monthly × 2"}{" "}
        and {was3 != null ? `3 months vs ${formatUsd(was3)}` : "3 months vs monthly × 3"}. It is not a
        fixed dollar amount.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          label="Monthly (USD)"
          value={monthly}
          onChange={onMonthly}
          min={0.5}
          step="0.01"
          disabled={disabled}
        />
        <NumberField
          label="Channels per platform"
          value={channels}
          onChange={onChannels}
          min={1}
          max={10}
          step="1"
          disabled={disabled}
        />
        <NumberField
          label="2 months (USD)"
          value={twoMonths}
          onChange={onTwoMonths}
          min={0.5}
          step="0.01"
          disabled={disabled}
          hint={save2m != null ? `Landing shows Save ${save2m}%` : "No save badge (not cheaper than monthly × 2)"}
        />
        <NumberField
          label="3 months (USD)"
          value={threeMonths}
          onChange={onThreeMonths}
          min={0.5}
          step="0.01"
          disabled={disabled}
          hint={save3m != null ? `Landing shows Save ${save3m}%` : "No save badge (not cheaper than monthly × 3)"}
        />
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        required
        disabled={disabled}
        className="admin-input"
      />
      {hint ? <p className="mt-1 text-[11px] font-medium text-[var(--ink-soft)]">{hint}</p> : null}
    </div>
  );
}
