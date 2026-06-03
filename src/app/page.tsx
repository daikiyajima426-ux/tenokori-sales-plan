"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS, TABS } from "@/lib/constants";
import {
  calculateAllocation,
  calculateHarvest,
  calculateSpec,
  calculateSummary
} from "@/lib/calculations";
import {
  createAllocation,
  createEmptyPlan,
  createHarvest,
  createKgUnit,
  createSampleData,
  createSpec,
  createUnit,
  nowIso
} from "@/lib/factories";
import {
  buildExportData,
  getImportValidationError,
  loadJson,
  saveState
} from "@/lib/storage";
import { kg, perKg, round, yen } from "@/lib/format";
import type {
  AllocationItem,
  ExportData,
  HarvestInput,
  Plan,
  ProductSpec,
  ProductSpecType,
  Settings,
  UnitDefinition
} from "@/types/domain";

type TabId = (typeof TABS)[number]["id"];

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/20";
const labelClass = "mb-1 block text-sm font-semibold text-stone-700";
const panelClass = "rounded-lg border border-stone-200 bg-white p-4 shadow-soft";
const primaryButton =
  "inline-flex items-center justify-center rounded-md bg-leaf px-4 py-2 text-sm font-bold text-white transition hover:bg-leaf/90 disabled:cursor-not-allowed disabled:bg-stone-300";
const secondaryButton =
  "inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 transition hover:bg-stone-50";
const dangerButton =
  "inline-flex items-center justify-center rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 transition hover:bg-red-100";

function NumberInput({
  label,
  unit,
  value,
  onChange,
  disabled
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <span className="flex min-w-0 flex-col gap-1 rounded-md border border-stone-300 bg-white p-2 focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/20 sm:flex-row sm:items-center sm:gap-0 sm:p-0">
        <input
          className="w-full min-w-0 rounded-sm px-2 py-2 text-base outline-none disabled:bg-stone-100 sm:flex-1 sm:px-3"
          disabled={disabled}
          inputMode="decimal"
          type="number"
          min="0"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value || 0))}
        />
        <span className="shrink-0 rounded-sm bg-stone-50 px-2 py-1 text-sm font-semibold text-stone-600 sm:flex sm:min-w-16 sm:items-center sm:justify-center sm:self-stretch sm:border-l sm:border-stone-200 sm:px-3">
          単位：{unit}
        </span>
      </span>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({
  label,
  value,
  strong
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        strong ? "border-leaf bg-green-50" : "border-stone-200 bg-stone-50"
      }`}
    >
      <p className="text-xs font-semibold text-stone-600">{label}</p>
      <p className={`${strong ? "text-2xl" : "text-lg"} mt-1 font-black text-stone-950`}>
        {value}
      </p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
      {children}
    </p>
  );
}

export default function Home() {
  const [plan, setPlan] = useState<Plan>(() => createEmptyPlan());
  const [units, setUnits] = useState<UnitDefinition[]>(() => [createKgUnit()]);
  const [harvests, setHarvests] = useState<HarvestInput[]>([]);
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [settings, setSettings] = useState<Settings>({ activeTab: "basic" });
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const loadedRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  const activeTab = settings.activeTab as TabId;
  const summary = useMemo(
    () => calculateSummary(plan, units, harvests, specs, allocations),
    [plan, units, harvests, specs, allocations]
  );
  const textOutput = useMemo(
    () => buildTextOutput(plan, units, harvests, specs, allocations),
    [plan, units, harvests, specs, allocations]
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const errors: string[] = [];
    const loadedPlan = loadJson<Plan>(STORAGE_KEYS.plan);
    const loadedUnits = loadJson<UnitDefinition[]>(STORAGE_KEYS.units);
    const loadedHarvests = loadJson<HarvestInput[]>(STORAGE_KEYS.harvests);
    const loadedSpecs = loadJson<ProductSpec[]>(STORAGE_KEYS.specs);
    const loadedAllocations = loadJson<AllocationItem[]>(
      STORAGE_KEYS.allocations
    );
    const loadedSettings = loadJson<Settings>(STORAGE_KEYS.settings);

    if (loadedPlan.error) errors.push(loadedPlan.error);
    if (loadedUnits.error) errors.push(loadedUnits.error);
    if (loadedHarvests.error) errors.push(loadedHarvests.error);
    if (loadedSpecs.error) errors.push(loadedSpecs.error);
    if (loadedAllocations.error) errors.push(loadedAllocations.error);
    if (loadedSettings.error) errors.push(loadedSettings.error);

    if (loadedPlan.value) setPlan(loadedPlan.value);
    if (loadedUnits.value) setUnits(ensureKgUnit(loadedUnits.value));
    if (loadedHarvests.value) setHarvests(loadedHarvests.value);
    if (loadedSpecs.value) setSpecs(loadedSpecs.value);
    if (loadedAllocations.value) setAllocations(loadedAllocations.value);
    if (loadedSettings.value) setSettings(loadedSettings.value);
    if (errors.length > 0) skipNextSaveRef.current = true;
    setLoadErrors(errors);
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      saveState({ plan, units, harvests, specs, allocations, settings });
      setSaveError("");
    } catch {
      setSaveError("保存に失敗しました。ブラウザの保存容量や設定を確認してください。");
    }
  }, [plan, units, harvests, specs, allocations, settings]);

  const updatePlan = (patch: Partial<Plan>) =>
    setPlan((current) => ({ ...current, ...patch, updatedAt: nowIso() }));

  const exportJson = () => {
    const data = buildExportData(plan, units, harvests, specs, allocations);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tenokori-sales-plan-v020-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file?: File) => {
    setImportMessage("");
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const error = getImportValidationError(parsed);
      if (error) {
        setImportMessage(error);
        return;
      }
      const ok = window.confirm("現在の保存データを、読み込んだJSONで上書きします。よろしいですか。");
      if (!ok) return;
      const data = parsed as ExportData;
      setPlan(data.plan);
      setUnits(ensureKgUnit(data.unitDefinitions));
      setHarvests(data.harvestInputs);
      setSpecs(data.productSpecs);
      setAllocations(data.allocationItems);
      setImportMessage("JSONを読み込みました。");
    } catch {
      setImportMessage("JSONの読み込みに失敗しました。");
    }
  };

  const loadSample = () => {
    const hasData =
      plan.cropName || harvests.length > 0 || specs.length > 0 || allocations.length > 0;
    const ok = hasData
      ? window.confirm("現在の保存データをサンプルデータで上書きします。よろしいですか。")
      : true;
    if (!ok) return;
    const sample = createSampleData();
    setPlan(sample.plan);
    setUnits(sample.units);
    setHarvests(sample.harvests);
    setSpecs(sample.specs);
    setAllocations(sample.allocations);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <header className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-leaf">
              入力は現場単位。単位間は自由に換算。判断は手残り。
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-stone-950">
              手残り販売計画
            </h1>
          </div>
          <button className={`${secondaryButton} no-print`} onClick={loadSample}>
            サンプル投入
          </button>
        </div>
      </header>

      <nav className="no-print sticky top-0 z-10 -mx-4 mb-4 border-y border-stone-200 bg-paper/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`rounded-md px-4 py-2 text-sm font-black ${
                activeTab === tab.id
                  ? "bg-leaf text-white"
                  : "bg-white text-stone-700 ring-1 ring-stone-200"
              }`}
              onClick={() => setSettings({ activeTab: tab.id })}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="space-y-3">
        {loadErrors.map((error) => (
          <Warning key={error}>{error}</Warning>
        ))}
        {saveError ? <Warning>{saveError}</Warning> : null}
        {summary.hasOverProductized ? <Warning>収穫量を超えて商品化しています</Warning> : null}
        {!summary.isCashEnough ? <Warning>必要現金に届いていません</Warning> : null}
        {summary.hasNegativeSpec ? <Warning>費用が販売価格を上回る規格があります</Warning> : null}
        {summary.hasRemainder ? <Warning>規格品に入りきらない余りがあります</Warning> : null}
      </div>

      <section className="mt-4">
        {activeTab === "basic" ? <BasicTab plan={plan} updatePlan={updatePlan} /> : null}
        {activeTab === "units" ? (
          <UnitsTab units={units} setUnits={setUnits} />
        ) : null}
        {activeTab === "harvests" ? (
          <HarvestsTab
            planId={plan.id}
            units={units}
            harvests={harvests}
            setHarvests={setHarvests}
            summary={summary}
          />
        ) : null}
        {activeTab === "specs" ? (
          <SpecsTab planId={plan.id} units={units} specs={specs} setSpecs={setSpecs} />
        ) : null}
        {activeTab === "allocations" ? (
          <AllocationsTab
            planId={plan.id}
            units={units}
            specs={specs}
            allocations={allocations}
            setAllocations={setAllocations}
          />
        ) : null}
        {activeTab === "result" ? (
          <ResultTab plan={plan} summary={summary} />
        ) : null}
        {activeTab === "export" ? (
          <ExportTab
            textOutput={textOutput}
            exportJson={exportJson}
            importJson={importJson}
            importMessage={importMessage}
          />
        ) : null}
      </section>
    </main>
  );
}

function BasicTab({
  plan,
  updatePlan
}: {
  plan: Plan;
  updatePlan: (patch: Partial<Plan>) => void;
}) {
  return (
    <div className={panelClass}>
      <h2 className="text-xl font-black">基本</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextInput
          label="作物名"
          value={plan.cropName}
          onChange={(cropName) => updatePlan({ cropName })}
          placeholder="例：ぶどう"
        />
        <TextInput
          label="品種名"
          value={plan.varietyName ?? ""}
          onChange={(varietyName) => updatePlan({ varietyName })}
          placeholder="例：シャインマスカット"
        />
        <NumberInput
          label="必要現金"
          unit="円"
          value={plan.requiredCashYen}
          onChange={(requiredCashYen) => updatePlan({ requiredCashYen })}
        />
      </div>
      <label className="mt-4 block">
        <span className={labelClass}>メモ</span>
        <textarea
          className={`${inputClass} min-h-24`}
          value={plan.memo ?? ""}
          onChange={(event) => updatePlan({ memo: event.target.value })}
        />
      </label>
    </div>
  );
}

function UnitsTab({
  units,
  setUnits
}: {
  units: UnitDefinition[];
  setUnits: React.Dispatch<React.SetStateAction<UnitDefinition[]>>;
}) {
  const updateUnit = (id: string, patch: Partial<UnitDefinition>) =>
    setUnits((current) =>
      current.map((unit) =>
        unit.id === id ? { ...unit, ...patch, updatedAt: nowIso() } : unit
      )
    );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">単位設定</h2>
        <button className={primaryButton} onClick={() => setUnits((current) => [...current, createUnit()])}>
          単位を追加
        </button>
      </div>
      {units.map((unit) => (
        <article key={unit.id} className={panelClass}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-black">{unit.name || "名称未入力の単位"}</h3>
            {unit.id !== "unit-kg" ? (
              <button className={dangerButton} onClick={() => setUnits((current) => current.filter((row) => row.id !== unit.id))}>
                削除
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput label="単位名" value={unit.name} onChange={(name) => updateUnit(unit.id, { name })} />
            <TextInput label="表示名" value={unit.label} onChange={(label) => updateUnit(unit.id, { label })} />
            <NumberInput
              label="1単位あたり重量"
              unit="kg"
              value={unit.weightKg}
              disabled={unit.id === "unit-kg"}
              onChange={(weightKg) => updateUnit(unit.id, { weightKg })}
            />
          </div>
          <label className="mt-4 block">
            <span className={labelClass}>メモ</span>
            <textarea className={`${inputClass} min-h-20`} value={unit.memo ?? ""} onChange={(event) => updateUnit(unit.id, { memo: event.target.value })} />
          </label>
          {unit.weightKg <= 0 ? <div className="mt-3"><Warning>1単位あたりの重量を入力してください</Warning></div> : null}
        </article>
      ))}
    </div>
  );
}

function HarvestsTab({
  planId,
  units,
  harvests,
  setHarvests,
  summary
}: {
  planId: string;
  units: UnitDefinition[];
  harvests: HarvestInput[];
  setHarvests: React.Dispatch<React.SetStateAction<HarvestInput[]>>;
  summary: ReturnType<typeof calculateSummary>;
}) {
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const updateHarvest = (id: string, patch: Partial<HarvestInput>) =>
    setHarvests((current) =>
      current.map((harvest) =>
        harvest.id === id ? { ...harvest, ...patch, updatedAt: nowIso() } : harvest
      )
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="収穫合計kg" value={kg(summary.harvestTotalKg)} strong />
        <Metric label="商品化済みkg" value={kg(summary.productizedKg)} />
        <Metric label="未商品化kg" value={kg(summary.unproductizedKg)} strong />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">収穫入力</h2>
        <button className={primaryButton} onClick={() => setHarvests((current) => [...current, createHarvest(planId, units[0]?.id ?? "unit-kg")])}>
          収穫を追加
        </button>
      </div>
      {harvests.map((harvest) => {
        const unit = unitMap.get(harvest.unitId);
        const result = calculateHarvest(harvest, unit);
        return (
          <article key={harvest.id} className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{harvest.name || "名称未入力の収穫"}</h3>
              <button className={dangerButton} onClick={() => setHarvests((current) => current.filter((row) => row.id !== harvest.id))}>削除</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextInput label="収穫名" value={harvest.name} onChange={(name) => updateHarvest(harvest.id, { name })} />
              <label>
                <span className={labelClass}>単位</span>
                <select className={inputClass} value={harvest.unitId} onChange={(event) => updateHarvest(harvest.id, { unitId: event.target.value })}>
                  {units.map((row) => <option key={row.id} value={row.id}>{row.name || row.label || "単位未入力"}</option>)}
                </select>
              </label>
              <NumberInput label="数量" unit={unit?.name || "単位"} value={harvest.quantity} onChange={(quantity) => updateHarvest(harvest.id, { quantity })} />
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={harvest.memo ?? ""} onChange={(event) => updateHarvest(harvest.id, { memo: event.target.value })} />
            </label>
            <div className="mt-4">
              <Metric
                label="収穫kg換算量"
                value={`${round(harvest.quantity).toLocaleString("ja-JP")}${unit?.name || ""} = 約${kg(result.convertedKg)}`}
                strong
              />
            </div>
            {result.missingUnitWeight ? <div className="mt-3"><Warning>1単位あたりの重量を入力してください</Warning></div> : null}
          </article>
        );
      })}
    </div>
  );
}

function SpecsTab({
  planId,
  units,
  specs,
  setSpecs
}: {
  planId: string;
  units: UnitDefinition[];
  specs: ProductSpec[];
  setSpecs: React.Dispatch<React.SetStateAction<ProductSpec[]>>;
}) {
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const updateSpec = (id: string, patch: Partial<ProductSpec>) =>
    setSpecs((current) =>
      current.map((spec) =>
        spec.id === id ? { ...spec, ...patch, updatedAt: nowIso() } : spec
      )
    );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">規格品登録</h2>
        <button className={primaryButton} onClick={() => setSpecs((current) => [...current, createSpec(planId, units[0]?.id ?? "unit-kg")])}>
          規格品を追加
        </button>
      </div>
      {specs.map((spec) => {
        const unit = unitMap.get(spec.unitId);
        const result = calculateSpec(spec, unit);
        return (
          <article key={spec.id} className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{spec.name || "名称未入力の規格品"}</h3>
              <button className={dangerButton} onClick={() => setSpecs((current) => current.filter((row) => row.id !== spec.id))}>削除</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput label="規格名" value={spec.name} onChange={(name) => updateSpec(spec.id, { name })} />
              <label>
                <span className={labelClass}>規格タイプ</span>
                <select className={inputClass} value={spec.type} onChange={(event) => updateSpec(spec.id, { type: event.target.value as ProductSpecType })}>
                  <option value="weight">重量指定</option>
                  <option value="unit">単位指定</option>
                </select>
              </label>
              <label>
                <span className={labelClass}>使用単位</span>
                <select className={inputClass} value={spec.unitId} onChange={(event) => updateSpec(spec.id, { unitId: event.target.value })}>
                  {units.map((row) => <option key={row.id} value={row.id}>{row.name || row.label || "単位未入力"}</option>)}
                </select>
              </label>
              <NumberInput label={spec.type === "weight" ? "1規格あたり使用量" : "1規格あたり数量"} unit={spec.type === "weight" ? "kg" : unit?.name || "単位"} value={spec.quantityPerSpec} onChange={(quantityPerSpec) => updateSpec(spec.id, { quantityPerSpec })} />
              <TextInput label="販売単位名" value={spec.salesUnitLabel} onChange={(salesUnitLabel) => updateSpec(spec.id, { salesUnitLabel })} placeholder="例：箱、袋" />
              <NumberInput label="販売価格" unit="円" value={spec.pricePerSpecYen} onChange={(pricePerSpecYen) => updateSpec(spec.id, { pricePerSpecYen })} />
              <NumberInput label="包装費" unit="円" value={spec.packagingCostPerSpecYen} onChange={(packagingCostPerSpecYen) => updateSpec(spec.id, { packagingCostPerSpecYen })} />
              <NumberInput label="送料" unit="円" value={spec.shippingCostPerSpecYen} onChange={(shippingCostPerSpecYen) => updateSpec(spec.id, { shippingCostPerSpecYen })} />
              <NumberInput label="手数料" unit="円" value={spec.feePerSpecYen} onChange={(feePerSpecYen) => updateSpec(spec.id, { feePerSpecYen })} />
              <NumberInput label="その他費用" unit="円" value={spec.otherCostPerSpecYen} onChange={(otherCostPerSpecYen) => updateSpec(spec.id, { otherCostPerSpecYen })} />
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={spec.memo ?? ""} onChange={(event) => updateSpec(spec.id, { memo: event.target.value })} />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Metric label="1規格あたり使用量" value={kg(result.usageKg)} strong />
              <Metric label="1規格あたり費用" value={yen(result.costPerSpecYen)} />
              <Metric label="1規格あたり手残り" value={yen(result.netPerSpecYen)} strong />
              <Metric label="kg換算手残り" value={perKg(result.kgNetYen)} strong />
            </div>
            <div className="mt-3 space-y-2">
              {result.warnings.missingUsage ? <Warning>規格品の使用量を入力してください</Warning> : null}
              {result.warnings.missingPrice ? <Warning>販売価格を入力してください</Warning> : null}
              {result.warnings.negativeNet ? <Warning>この規格は費用が販売価格を上回っています</Warning> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AllocationsTab({
  planId,
  units,
  specs,
  allocations,
  setAllocations
}: {
  planId: string;
  units: UnitDefinition[];
  specs: ProductSpec[];
  allocations: AllocationItem[];
  setAllocations: React.Dispatch<React.SetStateAction<AllocationItem[]>>;
}) {
  const specMap = new Map(specs.map((spec) => [spec.id, spec]));
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const updateAllocation = (id: string, patch: Partial<AllocationItem>) =>
    setAllocations((current) =>
      current.map((allocation) =>
        allocation.id === id ? { ...allocation, ...patch, updatedAt: nowIso() } : allocation
      )
    );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">配分入力</h2>
        <button className={primaryButton} disabled={specs.length === 0} onClick={() => setAllocations((current) => [...current, createAllocation(planId, specs[0]?.id ?? "")])}>
          配分を追加
        </button>
      </div>
      {specs.length === 0 ? <Warning>先に規格品を登録してください。</Warning> : null}
      {allocations.map((allocation) => {
        const spec = specMap.get(allocation.productSpecId);
        const unit = spec ? unitMap.get(spec.unitId) : undefined;
        const specResult = spec ? calculateSpec(spec, unit) : undefined;
        const result = calculateAllocation(allocation, spec, unit);
        return (
          <article key={allocation.id} className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{spec?.name || "規格品未選択"}</h3>
              <button className={dangerButton} onClick={() => setAllocations((current) => current.filter((row) => row.id !== allocation.id))}>削除</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>規格品</span>
                <select className={inputClass} value={allocation.productSpecId} onChange={(event) => updateAllocation(allocation.id, { productSpecId: event.target.value })}>
                  <option value="">選択してください</option>
                  {specs.map((row) => <option key={row.id} value={row.id}>{row.name || "名称未入力"}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>入力方式</span>
                <select className={inputClass} value={allocation.inputMode} onChange={(event) => updateAllocation(allocation.id, { inputMode: event.target.value as AllocationItem["inputMode"] })}>
                  <option value="count">作る数で入力</option>
                  <option value="weight">使用量kgで入力</option>
                </select>
              </label>
              {allocation.inputMode === "count" ? (
                <NumberInput label="作る数" unit={spec?.salesUnitLabel || "個"} value={allocation.count ?? 0} onChange={(count) => updateAllocation(allocation.id, { count })} />
              ) : (
                <NumberInput label="使用量" unit="kg" value={allocation.inputWeightKg ?? 0} onChange={(inputWeightKg) => updateAllocation(allocation.id, { inputWeightKg })} />
              )}
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={allocation.memo ?? ""} onChange={(event) => updateAllocation(allocation.id, { memo: event.target.value })} />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Metric label="作れる数" value={`${result.count.toLocaleString("ja-JP")}${spec?.salesUnitLabel || "個"}`} strong />
              <Metric label="実使用kg" value={kg(result.usedKg)} strong />
              <Metric label="余りkg" value={kg(result.remainderKg)} />
              <Metric label="手残り合計" value={yen(result.netTotalYen)} strong />
            </div>
            <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
              {allocation.inputMode === "weight"
                ? `${kg(result.inputWeightKg)} → ${spec?.name || "規格品"}なら${result.count.toLocaleString("ja-JP")}${spec?.salesUnitLabel || "個"}、余り${kg(result.remainderKg)}`
                : `${spec?.name || "規格品"} × ${result.count.toLocaleString("ja-JP")}${spec?.salesUnitLabel || "個"} = ${kg(result.usedKg)}使用`}
            </p>
            {specResult?.warnings.missingUsage ? <div className="mt-3"><Warning>規格品の使用量を入力してください</Warning></div> : null}
            {result.hasRemainder ? <div className="mt-3"><Warning>規格品に入りきらない余りがあります</Warning></div> : null}
          </article>
        );
      })}
    </div>
  );
}

function ResultTab({
  plan,
  summary
}: {
  plan: Plan;
  summary: ReturnType<typeof calculateSummary>;
}) {
  return (
    <div className="space-y-4">
      <div className={panelClass}>
        <h2 className="text-xl font-black">結果</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="収穫合計kg" value={kg(summary.harvestTotalKg)} strong />
          <Metric label="商品化済みkg" value={kg(summary.productizedKg)} strong />
          <Metric label="未商品化kg" value={kg(summary.unproductizedKg)} strong />
          <Metric label="総手残り" value={yen(summary.totalNetYen)} strong />
          <Metric label="必要現金との差分" value={yen(summary.requiredCashGapYen)} strong />
          <Metric label="平均kg手残り" value={perKg(summary.averageKgNetYen)} />
          <Metric label="総売上" value={yen(summary.totalSalesYen)} />
          <Metric label="必要現金" value={yen(plan.requiredCashYen)} />
        </div>
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">判定</h3>
        <div className="mt-3 space-y-2">
          {summary.hasOverProductized ? <Warning>収穫量を超えて商品化しています</Warning> : null}
          {summary.hasUnproductized ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900">まだ商品化していない量があります</p> : null}
          <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 font-semibold">
            {summary.isCashEnough ? "必要現金に届いています" : "必要現金に不足しています"}
          </p>
          {summary.hasNegativeSpec ? <Warning>費用が販売価格を上回る規格があります</Warning> : null}
          {summary.hasRemainder ? <Warning>規格品に入りきらない余りがあります</Warning> : null}
        </div>
      </div>
    </div>
  );
}

function ExportTab({
  textOutput,
  exportJson,
  importJson,
  importMessage
}: {
  textOutput: string;
  exportJson: () => void;
  importJson: (file?: File) => void;
  importMessage: string;
}) {
  return (
    <div className="space-y-4">
      <div className={panelClass}>
        <h2 className="text-xl font-black">保存・出力</h2>
        <p className="mt-2 text-sm text-stone-600">入力内容はこのブラウザのlocalStorageに自動保存されます。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={primaryButton} onClick={exportJson}>JSONエクスポート</button>
          <label className={secondaryButton}>
            JSONインポート
            <input className="sr-only" type="file" accept="application/json" onChange={(event) => importJson(event.target.files?.[0])} />
          </label>
          <button className={secondaryButton} onClick={() => navigator.clipboard.writeText(textOutput)}>印刷用コピー</button>
          <button className={secondaryButton} onClick={() => window.print()}>印刷</button>
        </div>
        {importMessage ? <p className="mt-3 text-sm font-semibold text-leaf">{importMessage}</p> : null}
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">テキスト出力</h3>
        <textarea className={`${inputClass} mt-3 min-h-96 font-mono text-sm`} value={textOutput} readOnly />
      </div>
    </div>
  );
}

function ensureKgUnit(units: UnitDefinition[]) {
  const withoutDuplicateKg = units.filter((unit) => unit.id !== "unit-kg");
  return [createKgUnit(), ...withoutDuplicateKg];
}

function buildTextOutput(
  plan: Plan,
  units: UnitDefinition[],
  harvests: HarvestInput[],
  specs: ProductSpec[],
  allocations: AllocationItem[]
) {
  const summary = calculateSummary(plan, units, harvests, specs, allocations);
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const specMap = new Map(specs.map((spec) => [spec.id, spec]));
  const lines = [
    "手残り販売計画 v0.2.0",
    "",
    `作物名: ${plan.cropName || "未入力"}`,
    `品種名: ${plan.varietyName || "未入力"}`,
    `必要現金: ${yen(plan.requiredCashYen)}`,
    "",
    "収穫入力一覧"
  ];

  harvests.forEach((harvest) => {
    const unit = unitMap.get(harvest.unitId);
    const result = calculateHarvest(harvest, unit);
    lines.push(`- ${harvest.name || "収穫未入力"}: ${harvest.quantity}${unit?.name || ""} / ${kg(result.convertedKg)}`);
  });

  lines.push("", `収穫合計kg: ${kg(summary.harvestTotalKg)}`, "", "規格品一覧");
  specs.forEach((spec) => {
    const unit = unitMap.get(spec.unitId);
    const result = calculateSpec(spec, unit);
    lines.push(`- ${spec.name || "規格未入力"}: 使用量 ${kg(result.usageKg)} / 手残り ${yen(result.netPerSpecYen)} / ${perKg(result.kgNetYen)}`);
  });

  lines.push("", "配分一覧");
  allocations.forEach((allocation) => {
    const spec = specMap.get(allocation.productSpecId);
    const unit = spec ? unitMap.get(spec.unitId) : undefined;
    const result = calculateAllocation(allocation, spec, unit);
    lines.push(`- ${spec?.name || "規格品未選択"}: ${result.count}${spec?.salesUnitLabel || "個"} / 使用 ${kg(result.usedKg)} / 余り ${kg(result.remainderKg)} / 手残り ${yen(result.netTotalYen)}`);
  });

  lines.push(
    "",
    `商品化済みkg: ${kg(summary.productizedKg)}`,
    `未商品化kg: ${kg(summary.unproductizedKg)}`,
    `総売上: ${yen(summary.totalSalesYen)}`,
    `総手残り: ${yen(summary.totalNetYen)}`,
    `必要現金との差分: ${yen(summary.requiredCashGapYen)}`
  );
  return lines.join("\n");
}
