"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updatePlanCatalogAction } from "@/actions/plan.actions";
import { formatInr, formatUsd, termSavePercent, PLAN_CATALOG_INR, type AdminPlanCatalog } from "@/constants";
import { useAdminReadOnly } from "@/components/shared/AdminReadOnlyContext";
import { trialPricePreviewLine } from "@/lib/plan-coupon-preview";

type Props = {
  catalog: AdminPlanCatalog;
};

function moneyField(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function PlanCatalogEditor({ catalog }: Props) {
  const isReadOnly = useAdminReadOnly();
  const inrCatalog = catalog.inr ?? PLAN_CATALOG_INR;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [trialDays, setTrialDays] = useState(String(catalog.trialDays));
  const [trialPrice, setTrialPrice] = useState(moneyField(catalog.trialPrice));
  const [creatorMonthly, setCreatorMonthly] = useState(moneyField(catalog.CREATOR.monthly));
  const [creatorTwoMonths, setCreatorTwoMonths] = useState(moneyField(catalog.CREATOR.twoMonths));
  const [creatorThreeMonths, setCreatorThreeMonths] = useState(
    moneyField(catalog.CREATOR.threeMonths)
  );
  const [proMonthly, setProMonthly] = useState(moneyField(catalog.PRO.monthly));
  const [proTwoMonths, setProTwoMonths] = useState(moneyField(catalog.PRO.twoMonths));
  const [proThreeMonths, setProThreeMonths] = useState(moneyField(catalog.PRO.threeMonths));
  const [trialPriceInr, setTrialPriceInr] = useState(moneyField(inrCatalog.trialPrice));
  const [creatorMonthlyInr, setCreatorMonthlyInr] = useState(
    moneyField(inrCatalog.CREATOR.monthly)
  );
  const [creatorTwoMonthsInr, setCreatorTwoMonthsInr] = useState(
    moneyField(inrCatalog.CREATOR.twoMonths)
  );
  const [creatorThreeMonthsInr, setCreatorThreeMonthsInr] = useState(
    moneyField(inrCatalog.CREATOR.threeMonths)
  );
  const [proMonthlyInr, setProMonthlyInr] = useState(moneyField(inrCatalog.PRO.monthly));
  const [proTwoMonthsInr, setProTwoMonthsInr] = useState(moneyField(inrCatalog.PRO.twoMonths));
  const [proThreeMonthsInr, setProThreeMonthsInr] = useState(
    moneyField(inrCatalog.PRO.threeMonths)
  );
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
  const creator2mSaveInr = termSavePercent(
    Number(creatorMonthlyInr),
    Number(creatorTwoMonthsInr),
    2
  );
  const creator3mSaveInr = termSavePercent(
    Number(creatorMonthlyInr),
    Number(creatorThreeMonthsInr),
    3
  );
  const pro2mSaveInr = termSavePercent(Number(proMonthlyInr), Number(proTwoMonthsInr), 2);
  const pro3mSaveInr = termSavePercent(Number(proMonthlyInr), Number(proThreeMonthsInr), 3);

  const invitePreview = useMemo(() => {
    const price = Number(trialPrice);
    const priceInr = Number(trialPriceInr);
    const days = Number(trialDays);
    if (!Number.isFinite(price) || !Number.isFinite(priceInr) || !Number.isInteger(days)) {
      return "";
    }
    return trialPricePreviewLine(90, {
      ...catalog,
      trialDays: days,
      trialPrice: price,
      inr: { ...(catalog.inr ?? PLAN_CATALOG_INR), trialPrice: priceInr },
    });
  }, [catalog, trialDays, trialPrice, trialPriceInr]);

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
        trialPriceInr: Number(trialPriceInr),
        creatorMonthlyInr: Number(creatorMonthlyInr),
        creatorTwoMonthsInr: Number(creatorTwoMonthsInr),
        creatorThreeMonthsInr: Number(creatorThreeMonthsInr),
        proMonthlyInr: Number(proMonthlyInr),
        proTwoMonthsInr: Number(proTwoMonthsInr),
        proThreeMonthsInr: Number(proThreeMonthsInr),
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
          hardcoded $0.70 or ₹59.90. INR is an explicit catalog, not FX from USD.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
            label="List price (INR)"
            value={trialPriceInr}
            onChange={setTrialPriceInr}
            min={1}
            step="1"
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

      <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-mute)]">
        International (USD)
      </p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PlanPriceCard
          title="Creator"
          currency="USD"
          monthly={creatorMonthly}
          twoMonths={creatorTwoMonths}
          threeMonths={creatorThreeMonths}
          channels={creatorChannels}
          save2m={creator2mSave}
          save3m={creator3mSave}
          disabled={isReadOnly}
          formatMoney={formatUsd}
          onMonthly={setCreatorMonthly}
          onTwoMonths={setCreatorTwoMonths}
          onThreeMonths={setCreatorThreeMonths}
          onChannels={setCreatorChannels}
        />
        <PlanPriceCard
          title="Pro"
          currency="USD"
          monthly={proMonthly}
          twoMonths={proTwoMonths}
          threeMonths={proThreeMonths}
          channels={proChannels}
          save2m={pro2mSave}
          save3m={pro3mSave}
          disabled={isReadOnly}
          formatMoney={formatUsd}
          onMonthly={setProMonthly}
          onTwoMonths={setProTwoMonths}
          onThreeMonths={setProThreeMonths}
          onChannels={setProChannels}
        />
      </div>

      <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-mute)]">
        India (INR)
      </p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PlanPriceCard
          title="Creator"
          currency="INR"
          monthly={creatorMonthlyInr}
          twoMonths={creatorTwoMonthsInr}
          threeMonths={creatorThreeMonthsInr}
          save2m={creator2mSaveInr}
          save3m={creator3mSaveInr}
          disabled={isReadOnly}
          formatMoney={formatInr}
          min={1}
          step="1"
          onMonthly={setCreatorMonthlyInr}
          onTwoMonths={setCreatorTwoMonthsInr}
          onThreeMonths={setCreatorThreeMonthsInr}
        />
        <PlanPriceCard
          title="Pro"
          currency="INR"
          monthly={proMonthlyInr}
          twoMonths={proTwoMonthsInr}
          threeMonths={proThreeMonthsInr}
          save2m={pro2mSaveInr}
          save3m={pro3mSaveInr}
          disabled={isReadOnly}
          formatMoney={formatInr}
          min={1}
          step="1"
          onMonthly={setProMonthlyInr}
          onTwoMonths={setProTwoMonthsInr}
          onThreeMonths={setProThreeMonthsInr}
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
  currency,
  monthly,
  twoMonths,
  threeMonths,
  channels,
  save2m,
  save3m,
  disabled,
  formatMoney,
  min = 0.5,
  step = "0.01",
  onMonthly,
  onTwoMonths,
  onThreeMonths,
  onChannels,
}: {
  title: string;
  currency: "USD" | "INR";
  monthly: string;
  twoMonths: string;
  threeMonths: string;
  channels?: string;
  save2m: number | null;
  save3m: number | null;
  disabled: boolean;
  formatMoney: (amount: number) => string;
  min?: number;
  step?: string;
  onMonthly: (v: string) => void;
  onTwoMonths: (v: string) => void;
  onThreeMonths: (v: string) => void;
  onChannels?: (v: string) => void;
}) {
  const monthlyN = Number(monthly);
  const was2 = Number.isFinite(monthlyN) ? monthlyN * 2 : null;
  const was3 = Number.isFinite(monthlyN) ? monthlyN * 3 : null;

  return (
    <section className="admin-card p-5 sm:p-6">
      <h2 className="mb-1 text-[15px] font-semibold tracking-tight text-[var(--ink)]">{title}</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-soft)]">
        Landing “Save X%” is {was2 != null ? `2 months vs ${formatMoney(was2)}` : "2 months vs monthly × 2"}{" "}
        and {was3 != null ? `3 months vs ${formatMoney(was3)}` : "3 months vs monthly × 3"}. It is not a
        fixed amount.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          label={`Monthly (${currency})`}
          value={monthly}
          onChange={onMonthly}
          min={min}
          step={step}
          disabled={disabled}
        />
        {channels != null && onChannels ? (
          <NumberField
            label="Channels per platform"
            value={channels}
            onChange={onChannels}
            min={1}
            max={10}
            step="1"
            disabled={disabled}
          />
        ) : (
          <div />
        )}
        <NumberField
          label={`2 months (${currency})`}
          value={twoMonths}
          onChange={onTwoMonths}
          min={min}
          step={step}
          disabled={disabled}
          hint={save2m != null ? `Landing shows Save ${save2m}%` : "No save badge (not cheaper than monthly × 2)"}
        />
        <NumberField
          label={`3 months (${currency})`}
          value={threeMonths}
          onChange={onThreeMonths}
          min={min}
          step={step}
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
