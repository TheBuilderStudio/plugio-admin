"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { updatePlanCatalogAction } from "@/actions/plan.actions";
import { termSavePercent, PLAN_CATALOG_INR, type AdminPlanCatalog } from "@/constants";
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

  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const serialise = () => JSON.stringify([
    trialDays, trialPrice, trialPriceInr, trialChannels,
    creatorMonthly, creatorTwoMonths, creatorThreeMonths, creatorMonthlyInr, creatorTwoMonthsInr, creatorThreeMonthsInr, creatorChannels,
    proMonthly, proTwoMonths, proThreeMonths, proMonthlyInr, proTwoMonthsInr, proThreeMonthsInr, proChannels,
  ]);
  // What is saved, so the Save button only lights up when something actually changed.
  const [baseline, setBaseline] = useState(serialise);
  const dirty = serialise() !== baseline;

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
      if (res.success) {
        setBaseline(serialise());
        router.refresh();
      }
    });
  }

  const usd = currency === "USD";
  const rows = [
    {
      name: "Creator",
      monthly: usd ? creatorMonthly : creatorMonthlyInr, onMonthly: usd ? setCreatorMonthly : setCreatorMonthlyInr,
      two: usd ? creatorTwoMonths : creatorTwoMonthsInr, onTwo: usd ? setCreatorTwoMonths : setCreatorTwoMonthsInr,
      three: usd ? creatorThreeMonths : creatorThreeMonthsInr, onThree: usd ? setCreatorThreeMonths : setCreatorThreeMonthsInr,
      save2: usd ? creator2mSave : creator2mSaveInr, save3: usd ? creator3mSave : creator3mSaveInr,
      channels: creatorChannels, onChannels: setCreatorChannels,
    },
    {
      name: "Pro",
      monthly: usd ? proMonthly : proMonthlyInr, onMonthly: usd ? setProMonthly : setProMonthlyInr,
      two: usd ? proTwoMonths : proTwoMonthsInr, onTwo: usd ? setProTwoMonths : setProTwoMonthsInr,
      three: usd ? proThreeMonths : proThreeMonthsInr, onThree: usd ? setProThreeMonths : setProThreeMonthsInr,
      save2: usd ? pro2mSave : pro2mSaveInr, save3: usd ? pro3mSave : pro3mSaveInr,
      channels: proChannels, onChannels: setProChannels,
    },
  ];
  const step = usd ? "0.01" : "1";
  const min = usd ? 0.5 : 1;
  const symbol = usd ? "$" : "₹";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {result ? (
        <div
          role="status"
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
        <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Trial</h2>
        <p className="mb-4 text-[12.5px] text-(--ink-soft)">Coupons take their discount off this price.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumberField label="Days" value={trialDays} onChange={setTrialDays} min={1} max={30} step="1" disabled={isReadOnly} />
          <NumberField label="Price (USD)" value={trialPrice} onChange={setTrialPrice} min={0.5} step="0.01" disabled={isReadOnly} />
          <NumberField label="Price (INR)" value={trialPriceInr} onChange={setTrialPriceInr} min={1} step="1" disabled={isReadOnly} />
          <NumberField label="Channels" value={trialChannels} onChange={setTrialChannels} min={1} max={10} step="1" disabled={isReadOnly} />
        </div>
        {invitePreview ? <p className="mt-3 text-[12.5px] font-medium text-(--ink-soft)">With a 90% invite: {invitePreview}</p> : null}
      </section>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Paid plans</h2>
            <p className="text-[12.5px] text-(--ink-soft)">The “Save %” badge on the landing page comes from the longer terms.</p>
          </div>
          <div role="group" aria-label="Currency" className="flex gap-1 rounded-xl bg-[#F4F1EC] p-1">
            {([["USD", "International (USD)"], ["INR", "India (INR)"]] as const).map(([c, label]) => (
              <button
                key={c}
                type="button"
                aria-pressed={currency === c}
                onClick={() => setCurrency(c)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${currency === c ? "bg-white text-(--ink) shadow-xs" : "text-(--ink-soft) hover:text-(--ink)"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Monthly</th>
                <th>2 months</th>
                <th>3 months</th>
                <th>Channels</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="align-middle text-[14px] font-semibold">{r.name}</td>
                  <td><PriceCell label={`${r.name} monthly (${currency})`} symbol={symbol} value={r.monthly} onChange={r.onMonthly} min={min} step={step} disabled={isReadOnly} /></td>
                  <td>
                    <PriceCell label={`${r.name} 2 months (${currency})`} symbol={symbol} value={r.two} onChange={r.onTwo} min={min} step={step} disabled={isReadOnly} />
                    <SaveNote percent={r.save2} />
                  </td>
                  <td>
                    <PriceCell label={`${r.name} 3 months (${currency})`} symbol={symbol} value={r.three} onChange={r.onThree} min={min} step={step} disabled={isReadOnly} />
                    <SaveNote percent={r.save3} />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`${r.name} channels per platform`}
                      value={r.channels}
                      onChange={(e) => r.onChannels(e.target.value)}
                      min={1}
                      max={10}
                      step="1"
                      required
                      disabled={isReadOnly}
                      className="admin-input w-20"
                    />
                    <p className="mt-1 text-[11px] text-(--ink-mute)">per platform</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isReadOnly ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-[13px] font-medium text-sky-800">
          Read-only mode — plan writes are blocked.
        </div>
      ) : (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-(--line-strong) bg-(--paper) px-4 py-3 shadow-lg">
          <p className={`flex items-center gap-1.5 text-[12.5px] font-medium ${dirty ? "text-amber-800" : "text-(--ink-mute)"}`}>
            {dirty ? <span aria-hidden className="h-2 w-2 rounded-full bg-amber-500" /> : <Check className="h-3.5 w-3.5" />}
            {dirty ? "Unsaved changes" : "All changes saved"}
          </p>
          <button
            type="submit"
            disabled={isPending || !dirty}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-[13px] font-bold text-white transition disabled:opacity-40"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save catalog
          </button>
        </div>
      )}
    </form>
  );
}

function PriceCell({ label, symbol, value, onChange, min, step, disabled }: {
  label: string; symbol: string; value: string; onChange: (v: string) => void; min: number; step: string; disabled: boolean;
}) {
  return (
    <div className="relative w-32">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-(--ink-mute)">{symbol}</span>
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        step={step}
        required
        disabled={disabled}
        className="admin-input pl-7"
      />
    </div>
  );
}

function SaveNote({ percent }: { percent: number | null }) {
  return percent != null ? (
    <p className="mt-1 text-[11px] font-semibold text-emerald-700">Save {percent}%</p>
  ) : (
    <p className="mt-1 text-[11px] text-(--ink-mute)">No save badge</p>
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
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-(--ink-mute)">
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
      {hint ? <p className="mt-1 text-[11px] font-medium text-(--ink-soft)">{hint}</p> : null}
    </div>
  );
}
