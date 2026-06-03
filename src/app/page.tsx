"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNEL_OPTIONS,
  STORAGE_KEYS,
  TABS,
  UNIT_OPTIONS
} from "@/lib/constants";
import {
  calculateMethod,
  calculateSaleableKg,
  calculateSummary
} from "@/lib/calculations";
import { createEmptyPlan, createItem, createMethod, createSampleData, nowIso } from "@/lib/factories";
import { buildExportData, loadJson, saveState, validateExportData } from "@/lib/storage";
import { kg, perKg, yen } from "@/lib/format";
import type { ExportData, Plan, SalesMethod, SalesPlanItem, Settings } from "@/types/domain";

type TabId = (typeof TABS)[number]["id"];

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none transition focus:border-leaf focus:ring-2 focus:ring-leaf/20";
const labelClass = "mb-1 block text-sm font-semibold text-stone-700";
const panelClass = "rounded-lg border border-stone-200 bg-white p-4 shadow-soft";
const primaryButton =
  "inline-flex items-center justify-center rounded-md bg-leaf px-4 py-2 text-sm font-bold text-white transition hover:bg-leaf/90";
const secondaryButton =
  "inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 transition hover:bg-stone-50";
const dangerButton =
  "inline-flex items-center justify-center rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 transition hover:bg-red-100";

function NumberInput({
  label,
  unit,
  value,
  onChange
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <span className="flex min-w-0 flex-col gap-1 rounded-md border border-stone-300 bg-white p-2 focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/20 sm:flex-row sm:items-center sm:gap-0 sm:p-0">
        <input
          className="w-full min-w-0 rounded-sm px-2 py-2 text-base outline-none sm:flex-1 sm:px-3"
          inputMode="decimal"
          type="number"
          min="0"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value || 0))}
        />
        <span className="shrink-0 rounded-sm bg-stone-50 px-2 py-1 text-sm font-semibold text-stone-600 sm:flex sm:min-w-12 sm:items-center sm:justify-center sm:self-stretch sm:border-l sm:border-stone-200 sm:px-3">
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
    <div className={`rounded-md border p-3 ${strong ? "border-leaf bg-green-50" : "border-stone-200 bg-stone-50"}`}>
      <p className="text-xs font-semibold text-stone-600">{label}</p>
      <p className={`${strong ? "text-2xl" : "text-lg"} mt-1 font-black text-stone-950`}>{value}</p>
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
  const [methods, setMethods] = useState<SalesMethod[]>([]);
  const [items, setItems] = useState<SalesPlanItem[]>([]);
  const [settings, setSettings] = useState<Settings>({ activeTab: "basic" });
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [manualSaleable, setManualSaleable] = useState(false);
  const loadedRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  const activeTab = settings.activeTab as TabId;
  const summary = useMemo(
    () => calculateSummary(plan, methods, items),
    [plan, methods, items]
  );
  const textOutput = useMemo(() => buildTextOutput(plan, methods, items), [plan, methods, items]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const errors: string[] = [];
    const loadedPlan = loadJson<Plan>(STORAGE_KEYS.plan);
    const loadedMethods = loadJson<SalesMethod[]>(STORAGE_KEYS.methods);
    const loadedItems = loadJson<SalesPlanItem[]>(STORAGE_KEYS.items);
    const loadedSettings = loadJson<Settings>(STORAGE_KEYS.settings);

    if (loadedPlan.error) errors.push(loadedPlan.error);
    if (loadedMethods.error) errors.push(loadedMethods.error);
    if (loadedItems.error) errors.push(loadedItems.error);
    if (loadedSettings.error) errors.push(loadedSettings.error);

    if (loadedPlan.value) setPlan(loadedPlan.value);
    if (loadedMethods.value) setMethods(loadedMethods.value);
    if (loadedItems.value) setItems(loadedItems.value);
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
      saveState({ plan, methods, items, settings });
      setSaveError("");
    } catch {
      setSaveError("保存に失敗しました。ブラウザの保存容量や設定を確認してください。");
    }
  }, [plan, methods, items, settings]);

  const updatePlan = (patch: Partial<Plan>) => {
    setPlan((current) => ({ ...current, ...patch, updatedAt: nowIso() }));
  };

  const updatePlanYield = (expectedYieldKg: number, nonSaleKg = plan.nonSaleKg) => {
    const nextSaleable = manualSaleable
      ? plan.saleableKg
      : calculateSaleableKg(expectedYieldKg, nonSaleKg);
    updatePlan({ expectedYieldKg, nonSaleKg, saleableKg: nextSaleable });
  };

  const updateMethod = (id: string, patch: Partial<SalesMethod>) => {
    setMethods((current) =>
      current.map((method) =>
        method.id === id ? { ...method, ...patch, updatedAt: nowIso() } : method
      )
    );
  };

  const updateItem = (id: string, patch: Partial<SalesPlanItem>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item
      )
    );
  };

  const addMethod = () => setMethods((current) => [...current, createMethod(plan.id)]);
  const addItem = () =>
    setItems((current) => [...current, createItem(plan.id, methods[0]?.id ?? "")]);

  const removeMethod = (methodId: string) => {
    setMethods((current) => current.filter((method) => method.id !== methodId));
    setItems((current) => current.filter((item) => item.salesMethodId !== methodId));
  };

  const exportJson = () => {
    const data = buildExportData(plan, methods, items);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tenokori-sales-plan-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file?: File) => {
    setImportMessage("");
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!validateExportData(parsed)) {
        setImportMessage("JSONの形式が正しくありません。");
        return;
      }
      const ok = window.confirm("現在の保存データを、読み込んだJSONで上書きします。よろしいですか。");
      if (!ok) return;
      const data = parsed as ExportData;
      setPlan(data.plan);
      setMethods(data.salesMethods);
      setItems(data.salesPlanItems);
      setImportMessage("JSONを読み込みました。");
    } catch {
      setImportMessage("JSONの読み込みに失敗しました。");
    }
  };

  const loadSample = () => {
    const ok = methods.length || items.length || plan.cropName
      ? window.confirm("現在の保存データをサンプルデータで上書きします。よろしいですか。")
      : true;
    if (!ok) return;
    const sample = createSampleData();
    setPlan(sample.plan);
    setMethods(sample.methods);
    setItems(sample.items);
    setManualSaleable(true);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <header className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-leaf">入力は現場単位。比較はkg換算。判断は手残り。</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-stone-950">手残り販売計画</h1>
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
        {loadErrors.map((error) => <Warning key={error}>{error}</Warning>)}
        {saveError ? <Warning>{saveError}</Warning> : null}
        {summary.hasOverAllocated ? <Warning>販売可能量を超えています</Warning> : null}
        {!summary.isCashEnough ? <Warning>必要現金に届いていません</Warning> : null}
        {summary.hasNegativeMethod ? <Warning>費用が販売価格を上回る売り方があります</Warning> : null}
      </div>

      <section className="mt-4">
        {activeTab === "basic" ? (
          <BasicTab
            plan={plan}
            manualSaleable={manualSaleable}
            setManualSaleable={setManualSaleable}
            updatePlan={updatePlan}
            updatePlanYield={updatePlanYield}
          />
        ) : null}
        {activeTab === "methods" ? (
          <MethodsTab
            methods={methods}
            addMethod={addMethod}
            removeMethod={removeMethod}
            updateMethod={updateMethod}
          />
        ) : null}
        {activeTab === "items" ? (
          <ItemsTab
            methods={methods}
            items={items}
            addItem={addItem}
            removeItem={(id) => setItems((current) => current.filter((item) => item.id !== id))}
            updateItem={updateItem}
          />
        ) : null}
        {activeTab === "result" ? (
          <ResultTab plan={plan} methods={methods} items={items} />
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
  manualSaleable,
  setManualSaleable,
  updatePlan,
  updatePlanYield
}: {
  plan: Plan;
  manualSaleable: boolean;
  setManualSaleable: (value: boolean) => void;
  updatePlan: (patch: Partial<Plan>) => void;
  updatePlanYield: (expectedYieldKg: number, nonSaleKg?: number) => void;
}) {
  return (
    <div className={panelClass}>
      <h2 className="text-xl font-black">基本設定</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextInput label="作物名" value={plan.cropName} onChange={(cropName) => updatePlan({ cropName })} placeholder="例：ぶどう" />
        <TextInput label="品種名" value={plan.varietyName ?? ""} onChange={(varietyName) => updatePlan({ varietyName })} placeholder="例：シャインマスカット" />
        <NumberInput label="見込み収量" unit="kg" value={plan.expectedYieldKg} onChange={(expectedYieldKg) => updatePlanYield(expectedYieldKg)} />
        <NumberInput label="自家用・贈答・ロス見込み" unit="kg" value={plan.nonSaleKg} onChange={(nonSaleKg) => updatePlanYield(plan.expectedYieldKg, nonSaleKg)} />
        <label className="block">
          <span className={labelClass}>販売可能量</span>
          <span className="flex min-w-0 flex-col gap-1 rounded-md border border-stone-300 bg-white p-2 sm:flex-row sm:items-center sm:gap-0 sm:p-0">
            <input
              className="w-full min-w-0 rounded-sm px-2 py-2 text-base outline-none sm:flex-1 sm:px-3"
              inputMode="decimal"
              type="number"
              min="0"
              value={plan.saleableKg}
              onChange={(event) => {
                setManualSaleable(true);
                updatePlan({ saleableKg: Number(event.target.value || 0) });
              }}
            />
            <span className="shrink-0 rounded-sm bg-stone-50 px-2 py-1 text-sm font-semibold text-stone-600 sm:flex sm:min-w-12 sm:items-center sm:justify-center sm:self-stretch sm:border-l sm:border-stone-200 sm:px-3">
              単位：kg
            </span>
          </span>
          <span className="mt-2 flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={!manualSaleable}
              onChange={(event) => {
                setManualSaleable(!event.target.checked);
                if (event.target.checked) {
                  updatePlan({ saleableKg: calculateSaleableKg(plan.expectedYieldKg, plan.nonSaleKg) });
                }
              }}
            />
            見込み収量から自動計算
          </span>
        </label>
        <NumberInput label="必要現金" unit="円" value={plan.requiredCashYen} onChange={(requiredCashYen) => updatePlan({ requiredCashYen })} />
      </div>
      <label className="mt-4 block">
        <span className={labelClass}>メモ</span>
        <textarea className={`${inputClass} min-h-24`} value={plan.memo ?? ""} onChange={(event) => updatePlan({ memo: event.target.value })} />
      </label>
    </div>
  );
}

function MethodsTab({
  methods,
  addMethod,
  removeMethod,
  updateMethod
}: {
  methods: SalesMethod[];
  addMethod: () => void;
  removeMethod: (id: string) => void;
  updateMethod: (id: string, patch: Partial<SalesMethod>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">売り方登録</h2>
        <button className={primaryButton} onClick={addMethod}>売り方を追加</button>
      </div>
      {methods.length === 0 ? (
        <div className={panelClass}>売り方を追加してください。</div>
      ) : null}
      {methods.map((method) => {
        const result = calculateMethod(method);
        return (
          <article key={method.id} className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{method.name || "名称未入力の売り方"}</h3>
              <button className={dangerButton} onClick={() => removeMethod(method.id)}>削除</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput label="売り方名" value={method.name} onChange={(name) => updateMethod(method.id, { name })} />
              <label>
                <span className={labelClass}>販路</span>
                <select className={inputClass} value={method.channel} onChange={(event) => updateMethod(method.id, { channel: event.target.value as SalesMethod["channel"] })}>
                  {CHANNEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>販売単位</span>
                <select
                  className={inputClass}
                  value={method.unit}
                  onChange={(event) => {
                    const unit = event.target.value as SalesMethod["unit"];
                    const unitLabel = UNIT_OPTIONS.find((option) => option.value === unit)?.label ?? method.unitLabel;
                    updateMethod(method.id, { unit, unitLabel });
                  }}
                >
                  {UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <TextInput label="単位名" value={method.unitLabel} onChange={(unitLabel) => updateMethod(method.id, { unitLabel })} />
              <NumberInput label="1単位あたりの量" unit="kg" value={method.weightPerUnitKg} onChange={(weightPerUnitKg) => updateMethod(method.id, { weightPerUnitKg })} />
              <NumberInput label="販売価格" unit="円" value={method.pricePerUnitYen} onChange={(pricePerUnitYen) => updateMethod(method.id, { pricePerUnitYen })} />
              <NumberInput label="包装費" unit="円" value={method.packagingCostPerUnitYen} onChange={(packagingCostPerUnitYen) => updateMethod(method.id, { packagingCostPerUnitYen })} />
              <NumberInput label="送料" unit="円" value={method.shippingCostPerUnitYen} onChange={(shippingCostPerUnitYen) => updateMethod(method.id, { shippingCostPerUnitYen })} />
              <NumberInput label="手数料" unit="円" value={method.feePerUnitYen} onChange={(feePerUnitYen) => updateMethod(method.id, { feePerUnitYen })} />
              <NumberInput label="その他費用" unit="円" value={method.otherCostPerUnitYen} onChange={(otherCostPerUnitYen) => updateMethod(method.id, { otherCostPerUnitYen })} />
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={method.memo ?? ""} onChange={(event) => updateMethod(method.id, { memo: event.target.value })} />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="kg換算売価" value={perKg(result.kgPriceYen)} />
              <Metric label="1単位あたり手残り" value={yen(result.netPerUnitYen)} strong />
              <Metric label="kg換算手残り" value={perKg(result.kgNetYen)} strong />
            </div>
            <div className="mt-3 space-y-2">
              {result.warnings.missingWeight ? <Warning>1単位あたりの量を入力してください</Warning> : null}
              {result.warnings.missingPrice ? <Warning>販売価格を入力してください</Warning> : null}
              {result.warnings.negativeNet ? <Warning>この売り方は費用が販売価格を上回っています</Warning> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ItemsTab({
  methods,
  items,
  addItem,
  removeItem,
  updateItem
}: {
  methods: SalesMethod[];
  items: SalesPlanItem[];
  addItem: () => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<SalesPlanItem>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">販売配分</h2>
        <button className={primaryButton} onClick={addItem} disabled={methods.length === 0}>配分を追加</button>
      </div>
      {methods.length === 0 ? <Warning>先に売り方を登録してください。</Warning> : null}
      {items.map((item) => {
        const method = methods.find((row) => row.id === item.salesMethodId);
        const methodResult = method ? calculateMethod(method) : undefined;
        const convertedKg = method ? item.quantity * method.weightPerUnitKg : 0;
        const salesTotal = method ? item.quantity * method.pricePerUnitYen : 0;
        const netTotal = methodResult ? item.quantity * methodResult.netPerUnitYen : 0;
        return (
          <article key={item.id} className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{method?.name || "売り方未選択"}</h3>
              <button className={dangerButton} onClick={() => removeItem(item.id)}>削除</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>売り方選択</span>
                <select className={inputClass} value={item.salesMethodId} onChange={(event) => updateItem(item.id, { salesMethodId: event.target.value })}>
                  <option value="">選択してください</option>
                  {methods.map((row) => <option key={row.id} value={row.id}>{row.name || "名称未入力"}</option>)}
                </select>
              </label>
              <NumberInput label="売る数" unit={method?.unitLabel || "単位"} value={item.quantity} onChange={(quantity) => updateItem(item.id, { quantity })} />
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={item.memo ?? ""} onChange={(event) => updateItem(item.id, { memo: event.target.value })} />
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="kg換算量" value={kg(convertedKg)} />
              <Metric label="売上合計" value={yen(salesTotal)} />
              <Metric label="手残り合計" value={yen(netTotal)} strong />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ResultTab({
  plan,
  methods,
  items
}: {
  plan: Plan;
  methods: SalesMethod[];
  items: SalesPlanItem[];
}) {
  const summary = calculateSummary(plan, methods, items);
  return (
    <div className="space-y-4">
      <div className={panelClass}>
        <h2 className="text-xl font-black">結果・判断</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="総手残り" value={yen(summary.totalNetYen)} strong />
          <Metric label="必要現金との差分" value={yen(summary.requiredCashGapYen)} strong />
          <Metric label="販売可能量との差分" value={kg(summary.unallocatedKg)} />
          <Metric label="平均kg手残り" value={perKg(summary.averageKgNetYen)} strong />
          <Metric label="総売上" value={yen(summary.totalSalesYen)} />
          <Metric label="販売可能量" value={kg(summary.saleableKg)} />
          <Metric label="配分済み量" value={kg(summary.allocatedKg)} />
          <Metric label="平均kg売価" value={perKg(summary.averageKgPriceYen)} />
        </div>
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">判定</h3>
        <div className="mt-3 space-y-2">
          <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 font-semibold">
            {summary.isCashEnough ? "必要現金に届いています" : "必要現金に不足しています"}
          </p>
          {summary.hasOverAllocated ? <Warning>販売可能量を超えています</Warning> : null}
          {summary.hasUnallocated ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900">まだ販売先が決まっていない量があります</p> : null}
          {summary.hasNegativeMethod ? <Warning>費用が販売価格を上回る売り方があります</Warning> : null}
        </div>
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">売り方別</h3>
        <div className="mt-3 space-y-3">
          {summary.itemResults.map(({ item, method, result }) => (
            <div key={item.id} className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="font-black">{method?.name || "売り方未選択"}</p>
              <p className="mt-1 text-sm text-stone-600">
                {item.quantity.toLocaleString("ja-JP")}{method?.unitLabel || "単位"} / {kg(result.convertedKg)}
              </p>
              <p className="mt-2 text-lg font-black text-leaf">手残り {yen(result.netTotalYen)}</p>
            </div>
          ))}
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
            <input
              className="sr-only"
              type="file"
              accept="application/json"
              onChange={(event) => importJson(event.target.files?.[0])}
            />
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

function buildTextOutput(plan: Plan, methods: SalesMethod[], items: SalesPlanItem[]) {
  const summary = calculateSummary(plan, methods, items);
  const methodMap = new Map(methods.map((method) => [method.id, method]));
  const lines = [
    "手残り販売計画",
    "",
    `作物名: ${plan.cropName || "未入力"}`,
    `品種名: ${plan.varietyName || "未入力"}`,
    `販売可能量: ${kg(plan.saleableKg)}`,
    `必要現金: ${yen(plan.requiredCashYen)}`,
    `総売上: ${yen(summary.totalSalesYen)}`,
    `総手残り: ${yen(summary.totalNetYen)}`,
    `必要現金との差分: ${yen(summary.requiredCashGapYen)}`,
    "",
    "売り方別"
  ];

  items.forEach((item) => {
    const method = methodMap.get(item.salesMethodId);
    const row = summary.itemResults.find((result) => result.item.id === item.id);
    lines.push(
      `- ${method?.name || "売り方未選択"}: 手残り ${yen(row?.result.netTotalYen ?? 0)} / kg換算量 ${kg(row?.result.convertedKg ?? 0)}`
    );
  });

  return lines.join("\n");
}
