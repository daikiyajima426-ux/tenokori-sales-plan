"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PRODUCT_CATEGORY_LABELS,
  STORAGE_KEYS,
  TABS
} from "@/lib/constants";
import {
  calculateHarvest,
  calculateProduct,
  calculateSummary,
  calculateTrial
} from "@/lib/calculations";
import {
  createEmptyPlan,
  createHarvest,
  createKgUnit,
  createProduct,
  createSampleData,
  createTrial,
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
  ExportData,
  Harvest,
  Plan,
  Product,
  ProductCategory,
  Settings,
  Trial,
  Unit
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
  placeholder,
  disabled
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      <span className="flex min-w-0 flex-col gap-1 rounded-md border border-stone-300 bg-white p-2 focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/20 sm:flex-row sm:items-center sm:gap-0 sm:p-0">
        <input
          className="w-full min-w-0 rounded-sm px-2 py-2 text-base outline-none disabled:bg-stone-100 sm:flex-1 sm:px-3"
          disabled={disabled}
          inputMode="decimal"
          type="number"
          min="0"
          value={Number.isFinite(value) ? value : 0}
          placeholder={placeholder}
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
  placeholder: string;
}) {
  return (
    <label className="block min-w-0">
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
      {children}
    </p>
  );
}

const percent = (value: number | null) =>
  value === null ? "未設定" : `${Math.round(value * 100).toLocaleString("ja-JP")}%`;

export default function Home() {
  const [plan, setPlan] = useState<Plan>(() => createEmptyPlan());
  const [units, setUnits] = useState<Unit[]>(() => [createKgUnit()]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [settings, setSettings] = useState<Settings>({
    activeTab: "intro",
    hasSeenIntro: false
  });
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const loadedRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  const activeTab = settings.activeTab as TabId;
  const summary = useMemo(
    () => calculateSummary(plan, units, harvests, products, trials),
    [plan, units, harvests, products, trials]
  );
  const textOutput = useMemo(
    () => buildTextOutput(plan, units, harvests, products, trials),
    [plan, units, harvests, products, trials]
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const errors: string[] = [];
    const loadedPlan = loadJson<Plan>(STORAGE_KEYS.plan);
    const loadedUnits = loadJson<Unit[]>(STORAGE_KEYS.units);
    const loadedHarvests = loadJson<Harvest[]>(STORAGE_KEYS.harvests);
    const loadedProducts = loadJson<Product[]>(STORAGE_KEYS.products);
    const loadedTrials = loadJson<Trial[]>(STORAGE_KEYS.trials);
    const loadedSettings = loadJson<Settings>(STORAGE_KEYS.settings);

    if (loadedPlan.error) errors.push(loadedPlan.error);
    if (loadedUnits.error) errors.push(loadedUnits.error);
    if (loadedHarvests.error) errors.push(loadedHarvests.error);
    if (loadedProducts.error) errors.push(loadedProducts.error);
    if (loadedTrials.error) errors.push(loadedTrials.error);
    if (loadedSettings.error) errors.push(loadedSettings.error);

    if (loadedPlan.value) setPlan(loadedPlan.value);
    if (loadedUnits.value) setUnits(ensureKgUnit(loadedUnits.value));
    if (loadedHarvests.value) setHarvests(loadedHarvests.value);
    if (loadedProducts.value) setProducts(loadedProducts.value);
    if (loadedTrials.value) setTrials(loadedTrials.value);
    if (loadedSettings.value) {
      setSettings({
        activeTab: loadedSettings.value.activeTab || "intro",
        hasSeenIntro: Boolean(loadedSettings.value.hasSeenIntro)
      });
    }
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
      saveState({ plan, units, harvests, products, trials, settings });
      setSaveError("");
    } catch {
      setSaveError("このデータは保存できません。ブラウザの保存容量や設定を確認してください。");
    }
  }, [plan, units, harvests, products, trials, settings]);

  const setActiveTab = (activeTab: TabId) =>
    setSettings((current) => ({ ...current, activeTab }));

  const updatePlan = (patch: Partial<Plan>) =>
    setPlan((current) => ({ ...current, ...patch, updatedAt: nowIso() }));

  const exportJson = () => {
    const data = buildExportData(plan, units, harvests, products, trials);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tenokori-sales-plan-v110-${new Date()
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
      setUnits(ensureKgUnit(data.units));
      setHarvests(data.harvests);
      setProducts(data.products);
      setTrials(data.trials);
      setImportMessage("JSONを読み込みました。");
    } catch {
      setImportMessage("このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。");
    }
  };

  const loadSample = () => {
    const hasData =
      plan.cropName || harvests.length > 0 || products.length > 0 || trials.length > 0;
    const ok = hasData
      ? window.confirm("現在の保存データをサンプルデータで上書きします。よろしいですか。")
      : true;
    if (!ok) return;
    const sample = createSampleData();
    setPlan(sample.plan);
    setUnits(sample.units);
    setHarvests(sample.harvests);
    setProducts(sample.products);
    setTrials(sample.trials);
    setSettings({ activeTab: "result", hasSeenIntro: true });
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <header className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-leaf">
              入力は現場単位。比較はkg換算。判断は手元に残るお金。
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

      <nav className="no-print sticky top-0 z-20 -mx-4 mb-4 border-y border-stone-200 bg-paper/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-black ${
                activeTab === tab.id
                  ? "bg-leaf text-white"
                  : "bg-white text-stone-700 ring-1 ring-stone-200"
              }`}
              onClick={() => setActiveTab(tab.id)}
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
        {summary.hasOverDecided ? <Notice>取れた量を超えています。売る量を少し下げるか、取れそうな量を見直してください。</Notice> : null}
        {!summary.isTargetEnough && plan.targetCashYen > 0 ? (
          <Notice>今の条件では目標まであと{yen(summary.shortageYen)}足りません。</Notice>
        ) : null}
        {summary.hasNegativeProduct ? (
          <Notice>費用が売値を上回っている売り方があります。売るほど手元に残るお金が減る可能性があります。</Notice>
        ) : null}
      </div>

      <section className="mt-4">
        {activeTab === "intro" ? (
          <IntroTab
            start={() => {
              setSettings({ activeTab: "goal", hasSeenIntro: true });
            }}
          />
        ) : null}
        {activeTab === "goal" ? <GoalTab plan={plan} updatePlan={updatePlan} /> : null}
        {activeTab === "harvests" ? (
          <HarvestTab
            planId={plan.id}
            units={units}
            setUnits={setUnits}
            harvests={harvests}
            setHarvests={setHarvests}
            summary={summary}
          />
        ) : null}
        {activeTab === "products" ? (
          <ProductsTab
            planId={plan.id}
            units={units}
            products={products}
            setProducts={setProducts}
          />
        ) : null}
        {activeTab === "trials" ? (
          <TrialsTab
            planId={plan.id}
            units={units}
            products={products}
            setProducts={setProducts}
            trials={trials}
            setTrials={setTrials}
            summary={summary}
          />
        ) : null}
        {activeTab === "result" ? (
          <ResultTab
            plan={plan}
            summary={summary}
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

function IntroTab({ start }: { start: () => void }) {
  return (
    <div className={panelClass}>
      <h2 className="text-2xl font-black">はじめに</h2>
      <p className="mt-4 whitespace-pre-line text-lg font-semibold leading-8 text-stone-800">
        {`今年、いくら手元に残したいかを決めて、
取れた作物をどんな形で売れば近づけるかを試すアプリです。

会計ソフトではありません。
まずは、売り方を考えるための道具です。`}
      </p>
      <div className="mt-6">
        <button className={primaryButton} onClick={start}>
          はじめる
        </button>
      </div>
    </div>
  );
}

function GoalTab({
  plan,
  updatePlan
}: {
  plan: Plan;
  updatePlan: (patch: Partial<Plan>) => void;
}) {
  return (
    <div className={panelClass}>
      <h2 className="text-xl font-black">目標</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
        生活費、来年の準備、資材代などを考えて、今年いくら手元に残したいかを決めます。
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
          label="今年残したいお金"
          unit="円"
          value={plan.targetCashYen}
          placeholder="例：1200000"
          onChange={(targetCashYen) => updatePlan({ targetCashYen })}
        />
        <NumberInput
          label="来年の目標"
          unit="円"
          value={plan.nextYearTargetCashYen ?? 0}
          placeholder="例：3000000"
          onChange={(nextYearTargetCashYen) => updatePlan({ nextYearTargetCashYen })}
        />
      </div>
      <label className="mt-4 block">
        <span className={labelClass}>メモ</span>
        <textarea
          className={`${inputClass} min-h-24`}
          value={plan.memo ?? ""}
          placeholder="例：今年は固定客を増やしたい"
          onChange={(event) => updatePlan({ memo: event.target.value })}
        />
      </label>
    </div>
  );
}

function HarvestTab({
  planId,
  units,
  setUnits,
  harvests,
  setHarvests,
  summary
}: {
  planId: string;
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  harvests: Harvest[];
  setHarvests: React.Dispatch<React.SetStateAction<Harvest[]>>;
  summary: ReturnType<typeof calculateSummary>;
}) {
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const updateUnit = (id: string, patch: Partial<Unit>) =>
    setUnits((current) =>
      current.map((unit) =>
        unit.id === id ? { ...unit, ...patch, updatedAt: nowIso() } : unit
      )
    );
  const updateHarvest = (id: string, patch: Partial<Harvest>) =>
    setHarvests((current) =>
      current.map((harvest) =>
        harvest.id === id ? { ...harvest, ...patch, updatedAt: nowIso() } : harvest
      )
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="取れた量" value={kg(summary.harvestTotalKg)} strong />
        <Metric label="売る形が決まった量" value={kg(summary.decidedKg)} />
        <Metric label="まだ売り方が決まっていない量" value={kg(summary.undecidedKg)} strong />
      </div>

      <div className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">数え方</h2>
          <button className={primaryButton} onClick={() => setUnits((current) => [...current, createUnit()])}>
            数え方を追加
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {units.map((unit) => (
            <article key={unit.id} className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-black">{unit.name || "名前未入力"}</h3>
                {unit.id !== "unit-kg" ? (
                  <button className={dangerButton} onClick={() => setUnits((current) => current.filter((row) => row.id !== unit.id))}>
                    削除
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <TextInput label="名前" value={unit.name} onChange={(name) => updateUnit(unit.id, { name })} placeholder="例：箱、房、kg" />
                <TextInput label="表示" value={unit.label} onChange={(label) => updateUnit(unit.id, { label })} placeholder="例：1箱、1房" />
                <NumberInput
                  label="1つあたりの重さ"
                  unit="kg"
                  value={unit.weightKg}
                  disabled={unit.id === "unit-kg"}
                  placeholder="例：5"
                  onChange={(weightKg) => updateUnit(unit.id, { weightKg })}
                />
              </div>
              {unit.weightKg <= 0 ? <div className="mt-3"><Notice>1つあたりの重さを入れると、kgで比べられます。</Notice></div> : null}
            </article>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">取れた量</h2>
        <button className={primaryButton} onClick={() => setHarvests((current) => [...current, createHarvest(planId, units[0]?.id ?? "unit-kg")])}>
          取れた量を追加
        </button>
      </div>
      {harvests.map((harvest) => {
        const unit = unitMap.get(harvest.unitId);
        const result = calculateHarvest(harvest, unit);
        return (
          <article key={harvest.id} className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{harvest.name || "名前未入力"}</h3>
              <button className={dangerButton} onClick={() => setHarvests((current) => current.filter((row) => row.id !== harvest.id))}>
                削除
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextInput label="名前" value={harvest.name} onChange={(name) => updateHarvest(harvest.id, { name })} placeholder="例：第1収穫分" />
              <label>
                <span className={labelClass}>数え方</span>
                <select className={inputClass} value={harvest.unitId} onChange={(event) => updateHarvest(harvest.id, { unitId: event.target.value })}>
                  {units.map((row) => (
                    <option key={row.id} value={row.id}>{row.name || row.label || "名前未入力"}</option>
                  ))}
                </select>
              </label>
              <NumberInput label="数量" unit={unit?.name || "個"} value={harvest.quantity} placeholder="例：5" onChange={(quantity) => updateHarvest(harvest.id, { quantity })} />
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={harvest.memo ?? ""} placeholder="例：午前に取った分" onChange={(event) => updateHarvest(harvest.id, { memo: event.target.value })} />
            </label>
            <div className="mt-4">
              <Metric label="kgで見ると" value={`${round(harvest.quantity).toLocaleString("ja-JP")}${unit?.name || ""} = 約${kg(result.convertedKg)}`} strong />
            </div>
            {result.missingUnitWeight ? <div className="mt-3"><Notice>1つあたりの重さを入れると、kgで比べられます。</Notice></div> : null}
          </article>
        );
      })}
    </div>
  );
}

function ProductsTab({
  planId,
  units,
  products,
  setProducts
}: {
  planId: string;
  units: Unit[];
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}) {
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const updateProduct = (id: string, patch: Partial<Product>) =>
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, ...patch, updatedAt: nowIso() } : product
      )
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">売る形</h2>
        <button className={primaryButton} onClick={() => setProducts((current) => [...current, createProduct(planId, units[0]?.id ?? "unit-kg")])}>
          売る形を追加
        </button>
      </div>
      {products.map((product) => {
        const unit = unitMap.get(product.contentUnitId);
        const result = calculateProduct(product, unit);
        return (
          <article key={product.id} className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{product.name || "名前未入力"}</h3>
              <button className={dangerButton} onClick={() => setProducts((current) => current.filter((row) => row.id !== product.id))}>
                削除
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <TextInput label="売る形の名前" value={product.name} onChange={(name) => updateProduct(product.id, { name })} placeholder="例：2kg箱" />
              <label>
                <span className={labelClass}>売り方の作戦</span>
                <select className={inputClass} value={product.category} onChange={(event) => updateProduct(product.id, { category: event.target.value as ProductCategory })}>
                  {Object.entries(PRODUCT_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>中身の数え方</span>
                <select className={inputClass} value={product.contentUnitId} onChange={(event) => updateProduct(product.id, { contentUnitId: event.target.value })}>
                  {units.map((row) => (
                    <option key={row.id} value={row.id}>{row.name || row.label || "名前未入力"}</option>
                  ))}
                </select>
              </label>
              <NumberInput label="中身" unit={unit?.name || "個"} value={product.contentQuantity} placeholder="例：2" onChange={(contentQuantity) => updateProduct(product.id, { contentQuantity })} />
              <TextInput label="売る単位" value={product.salesUnitLabel} onChange={(salesUnitLabel) => updateProduct(product.id, { salesUnitLabel })} placeholder="例：箱、袋" />
              <NumberInput label="売値" unit="円" value={product.priceYen} placeholder="例：4200" onChange={(priceYen) => updateProduct(product.id, { priceYen })} />
              <NumberInput label="箱代・袋代" unit="円" value={product.packageCostYen} placeholder="例：250" onChange={(packageCostYen) => updateProduct(product.id, { packageCostYen })} />
              <NumberInput label="送料" unit="円" value={product.shippingCostYen} placeholder="例：900" onChange={(shippingCostYen) => updateProduct(product.id, { shippingCostYen })} />
              <NumberInput label="手数料" unit="円" value={product.feeYen} placeholder="例：150" onChange={(feeYen) => updateProduct(product.id, { feeYen })} />
              <NumberInput label="その他費用" unit="円" value={product.otherCostYen} placeholder="例：0" onChange={(otherCostYen) => updateProduct(product.id, { otherCostYen })} />
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={product.memo ?? ""} placeholder="例：贈答向け" onChange={(event) => updateProduct(product.id, { memo: event.target.value })} />
            </label>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="1つに入る量" value={kg(result.contentKg)} strong />
              <Metric label={`1${product.salesUnitLabel || "つ"}売ると`} value={`約${yen(result.moneyLeftYen)}残ります`} strong />
              <Metric label="1kgあたりでは" value={`約${perKg(result.kgMoneyLeftYen)}残ります`} strong />
            </div>
            <div className="mt-3 space-y-2">
              {result.warnings.missingContent ? <Notice>1つあたりの重さを入れると、kgで比べられます。</Notice> : null}
              {result.warnings.missingPrice ? <Notice>売値を入れると、目標との差が分かります。</Notice> : null}
              {result.warnings.negativeMoneyLeft ? <Notice>この売り方は、費用が売値を上回っています。</Notice> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TrialsTab({
  planId,
  units,
  products,
  setProducts,
  trials,
  setTrials,
  summary
}: {
  planId: string;
  units: Unit[];
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  trials: Trial[];
  setTrials: React.Dispatch<React.SetStateAction<Trial[]>>;
  summary: ReturnType<typeof calculateSummary>;
}) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const updateTrial = (id: string, patch: Partial<Trial>) =>
    setTrials((current) =>
      current.map((trial) =>
        trial.id === id ? { ...trial, ...patch, updatedAt: nowIso() } : trial
      )
    );
  const updateProduct = (id: string, patch: Partial<Product>) =>
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, ...patch, updatedAt: nowIso() } : product
      )
    );

  return (
    <div className="space-y-4">
      <div className="sticky top-[57px] z-10 -mx-4 grid grid-cols-2 gap-2 border-y border-stone-200 bg-paper/95 p-4 backdrop-blur sm:top-[65px] sm:mx-0 sm:rounded-lg sm:border lg:grid-cols-4">
        <Metric label="見込み手残り" value={yen(summary.totalMoneyLeftYen)} strong />
        <Metric label="目標との差" value={yen(summary.targetGapYen)} strong />
        <Metric label="達成率" value={percent(summary.achievementRate)} />
        <Metric
          label="必要単価の目安"
          value={
            summary.requiredPricePerKg === null
              ? "未設定"
              : perKg(summary.requiredPricePerKg)
          }
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">売り方を試す</h2>
        <button className={primaryButton} disabled={products.length === 0} onClick={() => setTrials((current) => [...current, createTrial(planId, products[0]?.id ?? "")])}>
          試す行を追加
        </button>
      </div>
      {products.length === 0 ? <Notice>1袋・1箱・1kgなど、売る単位を決めると値段を試せます。</Notice> : null}
      {trials.map((trial) => {
        const product = productMap.get(trial.productId);
        const unit = product ? unitMap.get(product.contentUnitId) : undefined;
        const productResult = product ? calculateProduct(product, unit) : undefined;
        const result = calculateTrial(trial, product, unit);
        return (
          <article key={trial.id} className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{product?.name || "売る形未選択"}</h3>
              <button className={dangerButton} onClick={() => setTrials((current) => current.filter((row) => row.id !== trial.id))}>
                削除
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                <span className={labelClass}>売る形</span>
                <select className={inputClass} value={trial.productId} onChange={(event) => updateTrial(trial.id, { productId: event.target.value })}>
                  <option value="">選択してください</option>
                  {products.map((row) => (
                    <option key={row.id} value={row.id}>{row.name || "名前未入力"}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>入力方法</span>
                <select className={inputClass} value={trial.inputMode} onChange={(event) => updateTrial(trial.id, { inputMode: event.target.value as Trial["inputMode"] })}>
                  <option value="count">作る数で入力</option>
                  <option value="weight">使う量kgで入力</option>
                </select>
              </label>
              {trial.inputMode === "count" ? (
                <div className="space-y-2">
                  <NumberInput label="作る数" unit={product?.salesUnitLabel || "個"} value={trial.count ?? 0} placeholder="例：10" onChange={(count) => updateTrial(trial.id, { count })} />
                  <input className="w-full accent-leaf" type="range" min="0" max="200" value={trial.count ?? 0} onChange={(event) => updateTrial(trial.id, { count: Number(event.target.value) })} />
                </div>
              ) : (
                <div className="space-y-2">
                  <NumberInput label="使う量" unit="kg" value={trial.inputWeightKg ?? 0} placeholder="例：25" onChange={(inputWeightKg) => updateTrial(trial.id, { inputWeightKg })} />
                  <input className="w-full accent-leaf" type="range" min="0" max="300" step="0.5" value={trial.inputWeightKg ?? 0} onChange={(event) => updateTrial(trial.id, { inputWeightKg: Number(event.target.value) })} />
                </div>
              )}
              {product ? (
                <ProductPriceEditor
                  product={product}
                  updateProduct={(patch) => updateProduct(product.id, patch)}
                />
              ) : null}
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={trial.memo ?? ""} placeholder="例：まずこの数で試す" onChange={(event) => updateTrial(trial.id, { memo: event.target.value })} />
            </label>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Metric label="作れる数" value={`${result.count.toLocaleString("ja-JP")}${product?.salesUnitLabel || "個"}`} strong />
              <Metric label="使う量kg" value={kg(result.usedKg)} strong />
              <Metric label="見込み手残り" value={yen(result.moneyLeftTotalYen)} strong />
              <Metric label="目標との差" value={yen(summary.targetGapYen)} strong />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="達成率" value={percent(summary.achievementRate)} />
              <Metric
                label="必要単価"
                value={
                  summary.requiredPricePerKg === null
                    ? "未設定"
                    : perKg(summary.requiredPricePerKg)
                }
              />
              <Metric label="余り" value={kg(result.remainderKg)} />
            </div>
            <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
              {trial.inputMode === "weight"
                ? `${kg(result.inputWeightKg)}を${product?.name || "選んだ形"}に回すと、${result.count.toLocaleString("ja-JP")}${product?.salesUnitLabel || "個"}作れて、${kg(result.remainderKg)}余ります。`
                : `${product?.name || "選んだ形"}を${result.count.toLocaleString("ja-JP")}${product?.salesUnitLabel || "個"}作ると、${kg(result.usedKg)}使います。`}
            </p>
            <div className="mt-3 space-y-2">
              {productResult?.warnings.missingContent ? <Notice>1つあたりの重さを入れると、使う量をkgで比べられます。</Notice> : null}
              {productResult?.warnings.missingPrice ? <Notice>売値を入れると、目標との差が分かります。</Notice> : null}
              {result.hasRemainder ? <Notice>{kg(result.remainderKg)}余ります</Notice> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ProductPriceEditor({
  product,
  updateProduct
}: {
  product: Product;
  updateProduct: (patch: Partial<Product>) => void;
}) {
  return (
    <div className="space-y-2">
      <NumberInput
        label="売値"
        unit="円"
        value={product.priceYen}
        placeholder="例：4200"
        onChange={(priceYen) => updateProduct({ priceYen })}
      />
      <input
        className="w-full accent-leaf"
        type="range"
        min="0"
        max="10000"
        step="100"
        value={product.priceYen}
        onChange={(event) => updateProduct({ priceYen: Number(event.target.value) })}
      />
    </div>
  );
}

function ResultTab({
  plan,
  summary,
  textOutput,
  exportJson,
  importJson,
  importMessage
}: {
  plan: Plan;
  summary: ReturnType<typeof calculateSummary>;
  textOutput: string;
  exportJson: () => void;
  importJson: (file?: File) => void;
  importMessage: string;
}) {
  const weakProducts = summary.productResults.filter(
    (row) => row.result.warnings.negativeMoneyLeft
  );
  const conclusion =
    summary.targetCashYen <= 0
      ? "今年いくら手元に残したいかを入れると、今の条件で届くかを試せます。"
      : summary.isTargetEnough
        ? "今の条件なら、目標を達成できそうです。"
        : `今の条件では、目標まであと${yen(summary.shortageYen)}足りません。`;

  return (
    <div className="space-y-4">
      <div className={panelClass}>
        <p className="text-sm font-bold text-leaf">結論</p>
        <h2 className="mt-1 text-2xl font-black text-stone-950">{conclusion}</h2>
        <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
          判定：{summary.judgmentLabel}
        </p>
      </div>

      <div className={panelClass}>
        <h3 className="text-lg font-black">主要数字</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="目標手残り" value={yen(summary.targetCashYen)} strong />
          <Metric label="現在見込み手残り" value={yen(summary.totalMoneyLeftYen)} strong />
          <Metric label="差額" value={yen(summary.targetGapYen)} strong />
          <Metric label="不足額" value={yen(summary.shortageYen)} />
          <Metric label="達成率" value={percent(summary.achievementRate)} strong />
          <Metric label="判定" value={summary.judgmentLabel} strong />
          <Metric label="売る形が決まった量" value={kg(summary.decidedKg)} />
          <Metric label="まだ売り方が決まっていない量" value={kg(summary.undecidedKg)} />
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="text-lg font-black">改善シナリオ</h3>
        <div className="mt-3 space-y-2 text-sm font-semibold leading-6 text-stone-800">
          {summary.canEstimateRequiredSalesKg && summary.requiredSalesKg !== null && summary.additionalRequiredKg !== null ? (
            <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
              今の売値のままなら、目標まで合計で{kg(summary.requiredSalesKg)}売る必要があります。今の予定から見ると、あと{kg(summary.additionalRequiredKg)}必要です。
            </p>
          ) : (
            <Notice>売値や費用がまだ決まっていないため、必要な販売量を逆算できません。</Notice>
          )}
          {summary.canEstimateRequiredPrice && summary.requiredPricePerKg !== null && summary.additionalRequiredPricePerKg !== null ? (
            <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
              今の販売量のままなら、単価は{perKg(summary.requiredPricePerKg)}が目安です。今の平均から見ると、あと約{perKg(summary.additionalRequiredPricePerKg)}上げる必要があります。
            </p>
          ) : (
            <Notice>売る量がまだ決まっていないため、必要な単価を逆算できません。</Notice>
          )}
          <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
            今の条件で現実的に残りそうなのは{yen(summary.realisticMoneyLeftYen)}です。
          </p>
          {summary.hasUndecided ? (
            <Notice>まだ{kg(summary.undecidedKg)}分の売り方が決まっていません。</Notice>
          ) : null}
          {weakProducts.length > 0 ? (
            <Notice>費用が売値を上回っている売り方があります。その売り方は、売るほど手元に残るお金が減る可能性があります。</Notice>
          ) : null}
          {summary.hasOverDecided ? (
            <Notice>取れた量を超えています。売る量を少し下げるか、取れそうな量を見直してください。</Notice>
          ) : null}
        </div>
      </div>

      {summary.nextSteps.length > 0 ? (
        <div className={panelClass}>
          <h3 className="text-lg font-black">次に決めること</h3>
          <p className="mt-2 text-sm font-semibold text-stone-600">
            まだ決めていない項目があります。次の項目を入れると、より正確に試せます。
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-semibold text-stone-700">
            {summary.nextSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={panelClass}>
        <h3 className="text-lg font-black">取れた量と売り方</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="取れた量" value={kg(summary.harvestTotalKg)} />
          <Metric label="総売上" value={yen(summary.totalSalesYen)} />
          <Metric label="平均で見る" value={perKg(summary.averageKgMoneyLeftYen)} />
          <Metric label="来年の目標" value={yen(plan.nextYearTargetCashYen ?? 0)} />
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="text-lg font-black">出力</h3>
        <p className="mt-2 text-sm text-stone-600">入力内容はこのブラウザに自動保存されます。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={primaryButton} onClick={exportJson}>JSON出力</button>
          <label className={secondaryButton}>
            JSON読み込み
            <input className="sr-only" type="file" accept="application/json" onChange={(event) => importJson(event.target.files?.[0])} />
          </label>
          <button className={secondaryButton} onClick={() => navigator.clipboard.writeText(textOutput)}>テキストをコピー</button>
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

function ensureKgUnit(units: Unit[]) {
  const withoutDuplicateKg = units.filter((unit) => unit.id !== "unit-kg");
  return [createKgUnit(), ...withoutDuplicateKg];
}

function buildTextOutput(
  plan: Plan,
  units: Unit[],
  harvests: Harvest[],
  products: Product[],
  trials: Trial[]
) {
  const summary = calculateSummary(plan, units, harvests, products, trials);
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lines = [
    "手残り販売計画 v1.1.0",
    "",
    `作物名: ${plan.cropName || "未入力"}`,
    `品種名: ${plan.varietyName || "未入力"}`,
    `今年残したいお金: ${yen(plan.targetCashYen)}`,
    `来年の目標: ${yen(plan.nextYearTargetCashYen ?? 0)}`,
    "",
    "取れた量"
  ];

  harvests.forEach((harvest) => {
    const unit = unitMap.get(harvest.unitId);
    const result = calculateHarvest(harvest, unit);
    lines.push(`- ${harvest.name || "名前未入力"}: ${harvest.quantity}${unit?.name || ""} / ${kg(result.convertedKg)}`);
  });

  lines.push("", `取れた量合計: ${kg(summary.harvestTotalKg)}`, "", "売る形");
  products.forEach((product) => {
    const unit = unitMap.get(product.contentUnitId);
    const result = calculateProduct(product, unit);
    lines.push(`- ${product.name || "名前未入力"}: 中身 ${kg(result.contentKg)} / 1つ売ると ${yen(result.moneyLeftYen)} / ${perKg(result.kgMoneyLeftYen)}`);
  });

  lines.push("", "試した売り方");
  trials.forEach((trial) => {
    const product = productMap.get(trial.productId);
    const unit = product ? unitMap.get(product.contentUnitId) : undefined;
    const result = calculateTrial(trial, product, unit);
    lines.push(`- ${product?.name || "売る形未選択"}: ${result.count}${product?.salesUnitLabel || "個"} / 使用 ${kg(result.usedKg)} / 余り ${kg(result.remainderKg)} / 手元に残るお金 ${yen(result.moneyLeftTotalYen)}`);
  });

  lines.push(
    "",
    `売る形が決まった量: ${kg(summary.decidedKg)}`,
    `まだ売り方が決まっていない量: ${kg(summary.undecidedKg)}`,
    `総売上: ${yen(summary.totalSalesYen)}`,
    `手元に残るお金: ${yen(summary.totalMoneyLeftYen)}`,
    `目標との差: ${yen(summary.targetGapYen)}`,
    `達成率: ${percent(summary.achievementRate)}`,
    `判定: ${summary.judgmentLabel}`
  );
  return lines.join("\n");
}
