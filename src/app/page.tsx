"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PRODUCT_ROLE_LABELS,
  PRODUCT_ROLE_OPTIONS,
  SALES_POLICY_LABELS,
  SALES_POLICY_OPTIONS,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  TABS
} from "@/lib/constants";
import {
  calculateSalesPlan,
  calculateSummary,
  formatProductAmount,
  priceSliderPriceMax,
  priceSliderMax,
  priceToSliderValue,
  policyRoleLabels,
  productUnitKg,
  productRolePolicyRank,
  referencePriceForSalesPlan,
  requiredPricePerUnit,
  round,
  sliderValueToPrice
} from "@/lib/calculations";
import {
  createDefaultSettings,
  createEmptyPlan,
  createHarvestCard,
  createProductCard,
  createSampleData,
  createWarningSampleData,
  createSalesPlanCard,
  duplicateHarvestCard,
  duplicateProductCard,
  duplicateSalesPlanCard,
  nowIso
} from "@/lib/factories";
import {
  buildExportData,
  getImportValidationError,
  loadJson,
  migrateLegacyState,
  readExportData,
  saveState
} from "@/lib/storage";
import { kg, yen } from "@/lib/format";
import type {
  AppData,
  HarvestCard,
  LegacyHarvest,
  LegacyProduct,
  LegacyTrial,
  LegacyUnit,
  Plan,
  ProductCard,
  ProductRole,
  SalesPolicy,
  SalesPlanCard,
  Settings
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

const percent = (value: number | null) =>
  value === null ? "未設定" : `${Math.round(value * 100).toLocaleString("ja-JP")}%`;
const clampPercent = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? 0
    : Math.min(100, Math.max(0, Math.round(value * 100)));

function barColorClass(kind: "ok" | "warn" | "danger" | "info" | "muted") {
  if (kind === "ok") return "bg-leaf";
  if (kind === "warn") return "bg-amber-500";
  if (kind === "danger") return "bg-red-600";
  if (kind === "info") return "bg-sky-600";
  return "bg-stone-400";
}

function progressKind(value: number | null, dangerAtOver = false) {
  if (value === null) return "muted";
  if (dangerAtOver && value > 1) return "danger";
  if (value >= 1) return "ok";
  if (value >= 0.8) return "warn";
  return "danger";
}

function ProgressBar({
  value,
  label,
  kind
}: {
  value: number | null;
  label: string;
  kind: "ok" | "warn" | "danger" | "info" | "muted";
}) {
  if (value === null) return null;
  return (
    <div className="mt-2">
      <div className="h-3 overflow-hidden rounded-full bg-stone-200" aria-label={label}>
        <div
          className={`h-full rounded-full ${barColorClass(kind)}`}
          style={{ width: `${clampPercent(value)}%` }}
        />
      </div>
    </div>
  );
}

function NumberInput({
  label,
  unit,
  value,
  onChange,
  placeholder
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      <span className="flex min-w-0 flex-col gap-1 rounded-md border border-stone-300 bg-white p-2 focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/20 sm:flex-row sm:items-center sm:gap-0 sm:p-0">
        <input
          className="w-full min-w-0 rounded-sm px-2 py-2 text-base outline-none sm:flex-1 sm:px-3"
          inputMode="decimal"
          min="0"
          type="number"
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

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${strong ? "border-leaf bg-green-50" : "border-stone-200 bg-stone-50"}`}>
      <p className="text-xs font-semibold text-stone-600">{label}</p>
      <p className={`${strong ? "text-2xl" : "text-lg"} mt-1 font-black text-stone-950`}>{value}</p>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
      {children}
    </p>
  );
}

function AttentionGroup({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-black text-stone-800">{title}</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => <Notice key={`${title}-${item}`}>{item}</Notice>)}
      </div>
    </div>
  );
}

function TargetProgress({
  summary
}: {
  summary: ReturnType<typeof calculateSummary>;
}) {
  if (summary.targetCashYen <= 0) {
    return (
      <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
        目標を入れると達成率が表示されます。
      </p>
    );
  }
  const kind = progressKind(summary.achievementRate);
  const gapText = summary.isTargetEnough
    ? `目標を${yen(Math.max(0, summary.targetGapYen))}上回っています`
    : `目標まであと${yen(summary.shortageYen)}`;
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black text-stone-950">目標達成率：{percent(summary.achievementRate)}</p>
        <p className="text-sm font-semibold text-stone-700">{gapText}</p>
      </div>
      <p className="mt-1 text-xs font-semibold text-stone-600">
        目標 {yen(summary.targetCashYen)} / 販売見込み額 {yen(summary.totalTakeHomeYen)}
      </p>
      <ProgressBar value={summary.achievementRate} label="目標達成率" kind={kind} />
    </div>
  );
}

function InventoryUsageList({
  summary,
  compact = false
}: {
  summary: ReturnType<typeof calculateSummary>;
  compact?: boolean;
}) {
  if (summary.harvestUsage.length === 0) {
    return (
      <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
        取れた量を入れると在庫使用状況が表示されます。
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {summary.harvestUsage.map((row) => {
        const harvestKg = row.harvest.amount;
        const usageRate = harvestKg > 0 ? row.usedKg / harvestKg : null;
        const kind = progressKind(usageRate, true);
        return (
          <div
            key={row.harvest.id}
            className={`rounded-md border px-3 py-2 ${row.hasOver ? "border-red-200 bg-red-50" : "border-stone-200 bg-stone-50"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black text-stone-950">
                {row.harvest.name || "取れた量"}：{kg(row.usedKg)} / {kg(harvestKg)}
              </p>
              <p className={`text-sm font-semibold ${row.hasOver ? "text-red-800" : "text-stone-700"}`}>
                使用率：{percent(usageRate)}{row.hasOver ? ` / ${kg(row.overKg)}超過` : ""}
              </p>
            </div>
            {!compact ? (
              <ProgressBar value={usageRate} label={`${row.harvest.name}の在庫使用率`} kind={kind} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RoleCompositionBars({
  summary
}: {
  summary: ReturnType<typeof calculateSummary>;
}) {
  if (summary.salesResults.length === 0) {
    return (
      <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
        販売計画を入れると結果が表示されます。
      </p>
    );
  }
  if (summary.validResults.length === 0) {
    return (
      <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
        売る形・売値・販売予定数を入れると集計できます。
      </p>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {summary.compositionRows.map((row) => {
        const kind = row.role === "unset" ? "muted" : "info";
        return (
          <div key={row.role} className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="font-black text-stone-950">
              {row.label}：{row.count}件 / {yen(row.salesYen)} / {percent(row.salesShare)}
            </p>
            <p className="mt-1 text-xs font-semibold text-stone-600">使用 {kg(row.usedKg)}</p>
            <ProgressBar value={row.salesShare} label={`${row.label}の販売見込み割合`} kind={kind} />
          </div>
        );
      })}
    </div>
  );
}

function SalesContributionBar({
  row,
  totalSalesYen
}: {
  row: ReturnType<typeof calculateSummary>["salesResults"][number];
  totalSalesYen: number;
}) {
  const share = totalSalesYen > 0 ? row.takeHomeYen / totalSalesYen : null;
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-stone-600">
        全体に対する割合：{percent(share)}
      </p>
      <ProgressBar value={share} label={`${row.card.name}の寄与度`} kind="info" />
    </div>
  );
}

function CardShell({
  title,
  summary,
  isOpen,
  onToggle,
  children,
  actions
}: {
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <article className={panelClass}>
      <button
        type="button"
        className="flex h-auto w-full items-start justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-3 text-left text-stone-950 transition hover:bg-stone-100"
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className="block text-base font-black">{isOpen ? "▾" : "▸"} {title}</span>
          <span className="mt-1 block text-sm font-semibold leading-6 text-stone-600">{summary}</span>
        </span>
      </button>
      {isOpen ? (
        <div className="mt-4 space-y-4">
          {children}
          {actions ? <div className="flex flex-wrap gap-2 pt-2">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

export default function Home() {
  const [plan, setPlan] = useState<Plan>(() => createEmptyPlan());
  const [harvestCards, setHarvestCards] = useState<HarvestCard[]>([]);
  const [productCards, setProductCards] = useState<ProductCard[]>([]);
  const [salesPlanCards, setSalesPlanCards] = useState<SalesPlanCard[]>([]);
  const [settings, setSettings] = useState<Settings>(() => createDefaultSettings());
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const loadedRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  const summary = useMemo(
    () => calculateSummary(plan, harvestCards, productCards, salesPlanCards),
    [plan, harvestCards, productCards, salesPlanCards]
  );
  const textOutput = useMemo(
    () => buildTextOutput(plan, harvestCards, productCards, salesPlanCards),
    [plan, harvestCards, productCards, salesPlanCards]
  );
  const activeTab = settings.activeTab as TabId;

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const loadMessages: string[] = [];
    const loadedPlan = loadJson<Plan>(STORAGE_KEYS.plan);
    const loadedUnits = loadJson<LegacyUnit[]>(STORAGE_KEYS.units);
    const loadedHarvests = loadJson<HarvestCard[] | LegacyHarvest[]>(STORAGE_KEYS.harvests);
    const loadedProducts = loadJson<ProductCard[] | LegacyProduct[]>(STORAGE_KEYS.products);
    const loadedTrials = loadJson<SalesPlanCard[] | LegacyTrial[]>(STORAGE_KEYS.trials);
    const loadedSettings = loadJson<Settings>(STORAGE_KEYS.settings);

    [loadedPlan, loadedUnits, loadedHarvests, loadedProducts, loadedTrials, loadedSettings].forEach((row) => {
      if (row.error) loadMessages.push(row.error);
    });

    const migrated = migrateLegacyState({
      plan: loadedPlan.value,
      units: loadedUnits.value,
      harvests: loadedHarvests.value,
      products: loadedProducts.value,
      trials: loadedTrials.value,
      settings: loadedSettings.value
    });

    if (migrated) {
      setPlan(migrated.plan);
      setHarvestCards(migrated.harvestCards);
      setProductCards(migrated.productCards);
      setSalesPlanCards(migrated.salesPlanCards);
      setSettings(migrated.settings ?? createDefaultSettings());
      if (loadedPlan.value?.schemaVersion !== SCHEMA_VERSION) {
        loadMessages.push("旧形式の保存データをカード形式へ変換しました。");
      }
    }
    if (loadMessages.length > 0) skipNextSaveRef.current = true;
    setMessages(loadMessages);
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      saveState({ plan, harvestCards, productCards, salesPlanCards, settings });
    } catch {
      setSaveMessage("このデータは保存できません。ブラウザの保存容量や設定を確認してください。");
    }
  }, [plan, harvestCards, productCards, salesPlanCards, settings]);

  const setActiveTab = (activeTab: TabId) =>
    setSettings((current) => ({ ...current, activeTab }));
  const toggleCard = (id: string) =>
    setOpenCards((current) => ({ ...current, [id]: !current[id] }));
  const closeCard = (id: string) =>
    setOpenCards((current) => ({ ...current, [id]: false }));
  const updatePlan = (patch: Partial<Plan>) =>
    setPlan((current) => ({ ...current, ...patch, updatedAt: nowIso(), schemaVersion: SCHEMA_VERSION }));

  const loadSample = (withWarnings = false) => {
    const ok =
      harvestCards.length > 0 || productCards.length > 0 || salesPlanCards.length > 0
        ? window.confirm("現在の保存データをサンプルデータで上書きします。よろしいですか。")
        : true;
    if (!ok) return;
    const sample = withWarnings ? createWarningSampleData() : createSampleData();
    setPlan(sample.plan);
    setHarvestCards(sample.harvestCards);
    setProductCards(sample.productCards);
    setSalesPlanCards(sample.salesPlanCards);
    setSettings((current) => ({ ...current, activeTab: "result", hasSeenIntro: true }));
  };

  const exportJson = () => {
    const data = buildExportData({
      schemaVersion: 5,
      plan,
      harvestCards,
      productCards,
      salesPlanCards,
      settings
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tenokori-sales-plan-v130-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file?: File) => {
    setImportMessage("");
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const validation = getImportValidationError(parsed);
      if (validation) {
        setImportMessage(validation);
        return;
      }
      const data = readExportData(parsed);
      if (!data) {
        setImportMessage("このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。");
        return;
      }
      const ok = window.confirm("現在の保存データを、読み込んだJSONで上書きします。よろしいですか。");
      if (!ok) return;
      setPlan(data.plan);
      setHarvestCards(data.harvestCards);
      setProductCards(data.productCards);
      setSalesPlanCards(data.salesPlanCards);
      setImportMessage("JSONを読み込みました。");
    } catch {
      setImportMessage("このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。");
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <header className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-leaf">複数の商品構成を組み合わせて、目標に届くかを見る。</p>
            <h1 className="mt-1 text-2xl font-black tracking-normal text-stone-950 sm:text-3xl">農産物販売プランナー</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`${secondaryButton} no-print`} onClick={() => loadSample(false)}>基本サンプル</button>
            <button className={`${secondaryButton} no-print`} onClick={() => loadSample(true)}>警告サンプル</button>
          </div>
        </div>
      </header>

      <nav className="no-print sticky top-0 z-20 -mx-4 mb-4 border-y border-stone-200 bg-paper/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`rounded-md px-2 py-2 text-xs font-black sm:shrink-0 sm:px-4 sm:text-sm ${activeTab === tab.id ? "bg-leaf text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="space-y-3">
        {messages.map((message) => <Notice key={message}>{message}</Notice>)}
        {saveMessage ? <Notice>{saveMessage}</Notice> : null}
        {summary.stockWarnings.map((message) => <Notice key={`global-${message}`}>{message}</Notice>)}
      </div>

      <section className="mt-4">
        {activeTab === "intro" ? <IntroTab start={() => setActiveTab("goal")} /> : null}
        {activeTab === "goal" ? <GoalTab plan={plan} updatePlan={updatePlan} /> : null}
        {activeTab === "harvests" ? (
          <HarvestCardsTab
            cards={harvestCards}
            setCards={setHarvestCards}
            openCards={openCards}
            toggleCard={toggleCard}
            closeCard={closeCard}
            setActiveTab={setActiveTab}
            salesPlanCards={salesPlanCards}
            setSalesPlanCards={setSalesPlanCards}
          />
        ) : null}
        {activeTab === "products" ? (
          <ProductCardsTab
            cards={productCards}
            setCards={setProductCards}
            openCards={openCards}
            toggleCard={toggleCard}
            closeCard={closeCard}
            setActiveTab={setActiveTab}
            salesPlanCards={salesPlanCards}
            setSalesPlanCards={setSalesPlanCards}
          />
        ) : null}
        {activeTab === "trials" ? (
          <SalesPlanCardsTab
            plan={plan}
            cards={salesPlanCards}
            setCards={setSalesPlanCards}
            harvestCards={harvestCards}
            productCards={productCards}
            summary={summary}
            settings={settings}
            setSettings={setSettings}
            stockWarnings={summary.stockWarnings}
            openCards={openCards}
            toggleCard={toggleCard}
            closeCard={closeCard}
            setActiveTab={setActiveTab}
          />
        ) : null}
        {activeTab === "result" ? (
          <ResultTab
            plan={plan}
            summary={summary}
            textOutput={textOutput}
            detailsOpen={detailsOpen}
            setDetailsOpen={setDetailsOpen}
            dataOpen={dataOpen}
            setDataOpen={setDataOpen}
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
      <p className="mt-4 break-words text-base font-semibold leading-7 text-stone-800 sm:text-lg sm:leading-8">
        今年いくら手元に残したいかを決めて、取れた量・売る形・販売計画を組み合わせて試すアプリです。
      </p>
      <div className="mt-6">
        <button className={primaryButton} onClick={start}>はじめる</button>
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
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">今年手元に残したい金額を入力します。</p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="作物名" value={plan.cropName} onChange={(cropName) => updatePlan({ cropName })} placeholder="例：ぶどう" />
        <TextInput label="品種名" value={plan.varietyName ?? ""} onChange={(varietyName) => updatePlan({ varietyName })} placeholder="例：シャインマスカット" />
        <NumberInput label="目標手残り" unit="円" value={plan.targetCashYen} onChange={(targetCashYen) => updatePlan({ targetCashYen })} placeholder="例：1200000" />
        <NumberInput label="来年の目標" unit="円" value={plan.nextYearTargetCashYen ?? 0} onChange={(nextYearTargetCashYen) => updatePlan({ nextYearTargetCashYen })} placeholder="例：3000000" />
      </div>
      <label className="mt-4 block">
        <span className={labelClass}>メモ</span>
        <textarea className={`${inputClass} min-h-24`} value={plan.memo ?? ""} placeholder="例：今年は固定客を増やしたい" onChange={(event) => updatePlan({ memo: event.target.value })} />
      </label>
      <p className="mt-4 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
        目標：{plan.targetCashYen > 0 ? yen(plan.targetCashYen) : "未入力"}
      </p>
    </div>
  );
}

function HarvestCardsTab({
  cards,
  setCards,
  openCards,
  toggleCard,
  closeCard,
  setActiveTab,
  salesPlanCards,
  setSalesPlanCards
}: {
  cards: HarvestCard[];
  setCards: React.Dispatch<React.SetStateAction<HarvestCard[]>>;
  openCards: Record<string, boolean>;
  toggleCard: (id: string) => void;
  closeCard: (id: string) => void;
  setActiveTab: (tab: TabId) => void;
  salesPlanCards: SalesPlanCard[];
  setSalesPlanCards: React.Dispatch<React.SetStateAction<SalesPlanCard[]>>;
}) {
  const updateCard = (id: string, patch: Partial<HarvestCard>) =>
    setCards((current) => current.map((card) => card.id === id ? { ...card, ...patch, updatedAt: nowIso() } : card));
  const deleteCard = (id: string) => {
    const used = salesPlanCards.some((card) => card.harvestId === id);
    const ok = used
      ? window.confirm("この取れた量を使っている販売計画があります。削除すると、その販売計画は「取れた量未選択」になります。削除しますか？")
      : window.confirm("この取れた量カードを削除しますか？");
    if (!ok) return;
    setCards((current) => current.filter((card) => card.id !== id));
    setSalesPlanCards((current) => current.map((card) => card.harvestId === id ? { ...card, harvestId: undefined, updatedAt: nowIso() } : card));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">取れた量カード一覧</h2>
          <p className="mt-1 text-sm font-semibold text-stone-600">販売できる量を複数登録します。</p>
        </div>
        <button className={primaryButton} onClick={() => setCards((current) => [...current, createHarvestCard(current.length + 1)])}>取れた量を追加</button>
      </div>
      {cards.length === 0 ? <Notice>取れた量：未入力。売れそうな量を入れてください。</Notice> : null}
      {cards.map((card, index) => (
        <CardShell
          key={card.id}
          title={`${card.name || `取れた量${index + 1}`}：${card.amount > 0 ? `${round(card.amount)}kg` : "未入力"}`}
          summary={card.memo || "販売できる量・在庫・収穫見込みのまとまりです。"}
          isOpen={openCards[card.id] ?? true}
          onToggle={() => toggleCard(card.id)}
          actions={
            <>
              <button className={primaryButton} onClick={() => closeCard(card.id)}>保存する</button>
              <button className={secondaryButton} onClick={() => setCards((current) => [...current, duplicateHarvestCard(card, current.length + 1)])}>複製</button>
              <button className={dangerButton} onClick={() => deleteCard(card.id)}>削除</button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput label="名前" value={card.name} onChange={(name) => updateCard(card.id, { name })} placeholder="例：通常品" />
            <NumberInput label="量" unit="kg" value={card.amount} onChange={(amount) => updateCard(card.id, { amount })} placeholder="例：120" />
          </div>
          <label className="block">
            <span className={labelClass}>メモ</span>
            <textarea className={`${inputClass} min-h-20`} value={card.memo ?? ""} onChange={(event) => updateCard(card.id, { memo: event.target.value })} placeholder="例：直売向けに使う" />
          </label>
        </CardShell>
      ))}
      <button className={secondaryButton} onClick={() => setActiveTab("products")}>売る形へ進む</button>
    </div>
  );
}

function ProductCardsTab({
  cards,
  setCards,
  openCards,
  toggleCard,
  closeCard,
  setActiveTab,
  salesPlanCards,
  setSalesPlanCards
}: {
  cards: ProductCard[];
  setCards: React.Dispatch<React.SetStateAction<ProductCard[]>>;
  openCards: Record<string, boolean>;
  toggleCard: (id: string) => void;
  closeCard: (id: string) => void;
  setActiveTab: (tab: TabId) => void;
  salesPlanCards: SalesPlanCard[];
  setSalesPlanCards: React.Dispatch<React.SetStateAction<SalesPlanCard[]>>;
}) {
  const updateCard = (id: string, patch: Partial<ProductCard>) =>
    setCards((current) => current.map((card) => card.id === id ? { ...card, ...patch, updatedAt: nowIso() } : card));
  const deleteCard = (id: string) => {
    const used = salesPlanCards.some((card) => card.productId === id);
    const ok = used
      ? window.confirm("この売る形を使っている販売計画があります。削除すると、その販売計画は「売る形未選択」になります。削除しますか？")
      : window.confirm("この売る形カードを削除しますか？");
    if (!ok) return;
    setCards((current) => current.filter((card) => card.id !== id));
    setSalesPlanCards((current) => current.map((card) => card.productId === id ? { ...card, productId: undefined, updatedAt: nowIso() } : card));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">売る形カード一覧</h2>
          <p className="mt-1 text-sm font-semibold text-stone-600">1袋・1箱・1kgなど、販売単位を登録します。</p>
        </div>
        <button className={primaryButton} onClick={() => setCards((current) => [...current, createProductCard(current.length + 1)])}>売る形を追加</button>
      </div>
      {cards.length === 0 ? <Notice>売る形：未入力。1袋・1箱・1kgなどの売る単位を決めてください。</Notice> : null}
      {cards.map((card, index) => (
        <CardShell
          key={card.id}
          title={`${card.name || `売る形${index + 1}`}：${card.quantityPerUnit > 0 ? `1${card.unitName || "個"} ${formatProductAmount(card)}` : "未入力"}`}
          summary={card.memo || "売る形カードは価格を持たず、値段は販売計画で決めます。"}
          isOpen={openCards[card.id] ?? true}
          onToggle={() => toggleCard(card.id)}
          actions={
            <>
              <button className={primaryButton} onClick={() => closeCard(card.id)}>保存する</button>
              <button className={secondaryButton} onClick={() => setCards((current) => [...current, duplicateProductCard(card, current.length + 1)])}>複製</button>
              <button className={dangerButton} onClick={() => deleteCard(card.id)}>削除</button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput label="名前" value={card.name} onChange={(name) => updateCard(card.id, { name })} placeholder="例：直売所用" />
            <TextInput label="売る単位名" value={card.unitName} onChange={(unitName) => updateCard(card.id, { unitName })} placeholder="例：袋、箱、kg" />
            <NumberInput label="1単位あたりの量" unit={card.quantityUnit} value={card.quantityPerUnit} onChange={(quantityPerUnit) => updateCard(card.id, { quantityPerUnit })} placeholder="例：300" />
            <label>
              <span className={labelClass}>量の単位</span>
              <select className={inputClass} value={card.quantityUnit} onChange={(event) => updateCard(card.id, { quantityUnit: event.target.value as ProductCard["quantityUnit"] })}>
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>メモ</span>
            <textarea className={`${inputClass} min-h-20`} value={card.memo ?? ""} onChange={(event) => updateCard(card.id, { memo: event.target.value })} placeholder="例：直売所に置く袋" />
          </label>
        </CardShell>
      ))}
      <button className={secondaryButton} onClick={() => setActiveTab("trials")}>販売計画へ進む</button>
    </div>
  );
}

function SalesPlanCardsTab({
  plan,
  cards,
  setCards,
  harvestCards,
  productCards,
  summary,
  settings,
  setSettings,
  stockWarnings,
  openCards,
  toggleCard,
  closeCard,
  setActiveTab
}: {
  plan: Plan;
  cards: SalesPlanCard[];
  setCards: React.Dispatch<React.SetStateAction<SalesPlanCard[]>>;
  harvestCards: HarvestCard[];
  productCards: ProductCard[];
  summary: ReturnType<typeof calculateSummary>;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  stockWarnings: string[];
  openCards: Record<string, boolean>;
  toggleCard: (id: string) => void;
  closeCard: (id: string) => void;
  setActiveTab: (tab: TabId) => void;
}) {
  const [currentCheckOpen, setCurrentCheckOpen] = useState(false);
  const updateCard = (id: string, patch: Partial<SalesPlanCard>) =>
    setCards((current) => current.map((card) => card.id === id ? { ...card, ...patch, updatedAt: nowIso() } : card));
  const harvestMap = new Map(harvestCards.map((card) => [card.id, card]));
  const productMap = new Map(productCards.map((card) => [card.id, card]));
  const targetStatus =
    plan.targetCashYen <= 0
      ? "目標未入力"
      : summary.isTargetEnough
        ? "目標達成見込み"
        : `目標まであと${yen(summary.shortageYen)}`;
  const stockStatus =
    summary.stockWarnings.length > 0
      ? "在庫注意あり"
      : "在庫面では大きな超過なし";
  const currentCheckSummary = `${targetStatus} / ${stockStatus} / 方針：${SALES_POLICY_LABELS[settings.selectedSalesPolicy]}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">販売計画カード一覧</h2>
          <p className="mt-1 text-sm font-semibold text-stone-600">どの取れた量を、どの売る形で、何個・いくらで売るかを試します。</p>
        </div>
      </div>
      <CardShell
        title="現在の確認"
        summary={currentCheckSummary}
        isOpen={currentCheckOpen}
        onToggle={() => setCurrentCheckOpen(!currentCheckOpen)}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className="mt-1 h-5 w-5 accent-leaf"
            type="checkbox"
            checked={settings.showPolicyAllocation}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                showPolicyAllocation: event.target.checked
              }))
            }
          />
          <span>
            <span className="block text-base font-black text-stone-950">
              売り方の方針に合わせて配分案を見る
            </span>
            <span className="mt-1 block text-sm font-semibold leading-6 text-stone-600">
              表示専用の確認候補です。販売計画カードの価格・数量・紐づけは自動では変わりません。
            </span>
          </span>
        </label>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-black text-stone-800">基本確認</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                {targetStatus}
              </p>
              <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                {stockStatus}
              </p>
              <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                方針：{SALES_POLICY_LABELS[settings.selectedSalesPolicy]}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-black text-stone-800">目標達成</p>
            <div className="mt-2">
              <TargetProgress summary={summary} />
            </div>
          </div>
          <div>
            <p className="text-sm font-black text-stone-800">在庫使用率</p>
            <div className="mt-2">
              <InventoryUsageList summary={summary} />
            </div>
          </div>
          <AttentionGroup title="在庫注意" items={summary.stockWarnings} />
          <AttentionGroup title="目標注意" items={summary.targetWarnings} />
          <AttentionGroup title="商品構成注意" items={summary.compositionWarnings} />
          <AttentionGroup title="仮説不足" items={summary.hypothesisWarnings} />
        </div>
        {settings.showPolicyAllocation ? (
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>売り方の方針</span>
              <select
                className={inputClass}
                value={settings.selectedSalesPolicy}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    selectedSalesPolicy: event.target.value as SalesPolicy
                  }))
                }
              >
                {SALES_POLICY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {cards.length === 0 ? (
              <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                販売計画カードを作ると、方針に合わせた確認候補が表示されます。
              </p>
            ) : (
              <PolicyAllocationPanel
                policy={settings.selectedSalesPolicy}
                summary={summary}
              />
            )}
          </div>
        ) : null}
      </CardShell>
      {cards.length === 0 ? <Notice>販売計画：未入力。売り方をカードで追加してください。</Notice> : null}
      {stockWarnings.map((message) => <Notice key={message}>{message}</Notice>)}
      {cards.map((card, index) => {
        const product = productMap.get(card.productId ?? "");
        const harvest = harvestMap.get(card.harvestId ?? "");
        const result = calculateSalesPlan(card, harvest, product);
        const missing = result.missing.length > 0;
        const roleLabel = PRODUCT_ROLE_LABELS[card.productRole ?? "unset"];
        const plannedUnits = Number.isFinite(card.plannedUnits) ? card.plannedUnits : 0;
        const currentPrice = Number.isFinite(card.pricePerUnit) ? card.pricePerUnit : 0;
        const sliderMax = priceSliderMax();
        const sliderPriceMax = priceSliderPriceMax();
        const sliderValue = priceToSliderValue(currentPrice);
        const isManualHighPrice = currentPrice > sliderPriceMax;
        const otherCardsSalesYen = summary.validResults
          .filter((row) => row.card.id !== card.id)
          .reduce((sum, row) => sum + row.salesYen, 0);
        const referencePrice = referencePriceForSalesPlan(
          plan.targetCashYen,
          plannedUnits,
          otherCardsSalesYen
        );
        const priceGap = referencePrice === null ? null : referencePrice - currentPrice;
        const targetMessage =
          plan.targetCashYen <= 0
            ? "目標金額を入れると、全体目標との差が見えます。"
            : summary.isTargetEnough
              ? "今の全体計画なら、目標を達成できそうです。"
              : `全体では目標まであと${yen(summary.shortageYen)}足りません。`;
        return (
          <CardShell
            key={card.id}
            title={`${card.name || `販売計画${index + 1}`}：${roleLabel}｜${missing ? "売る形・売値・販売数が未入力" : `${product?.name || "売る形"} ${yen(card.pricePerUnit)} × ${card.plannedUnits}${product?.unitName || "個"}`}`}
            summary={missing ? result.missing.join(" / ") : `使用量 ${kg(result.usedKg)}、販売見込み ${yen(result.takeHomeYen)}`}
            isOpen={openCards[card.id] ?? true}
            onToggle={() => toggleCard(card.id)}
            actions={
              <>
                <button className={primaryButton} onClick={() => closeCard(card.id)}>保存する</button>
                <button className={secondaryButton} onClick={() => setCards((current) => [...current, duplicateSalesPlanCard(card, current.length + 1)])}>複製</button>
                <button className={dangerButton} onClick={() => window.confirm("この販売計画カードを削除しますか？") && setCards((current) => current.filter((row) => row.id !== card.id))}>削除</button>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextInput label="名前" value={card.name} onChange={(name) => updateCard(card.id, { name })} placeholder="例：直売所で袋売り" />
              <label>
                <span className={labelClass}>取れた量カード</span>
                <select className={inputClass} value={card.harvestId ?? ""} onChange={(event) => updateCard(card.id, { harvestId: event.target.value || undefined })}>
                  <option value="">取れた量未選択</option>
                  {harvestCards.map((row) => <option key={row.id} value={row.id}>{row.name || "名前未入力"}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>売る形カード</span>
                <select className={inputClass} value={card.productId ?? ""} onChange={(event) => updateCard(card.id, { productId: event.target.value || undefined })}>
                  <option value="">売る形未選択</option>
                  {productCards.map((row) => <option key={row.id} value={row.id}>{row.name || "名前未入力"}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>商品役割</span>
                <select className={inputClass} value={card.productRole ?? "unset"} onChange={(event) => updateCard(card.id, { productRole: event.target.value as ProductRole })}>
                  {PRODUCT_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <span className="mt-1 block text-xs font-semibold text-stone-500">この販売計画が、買いやすさ・日常購入・利益・ブランド・ロス削減のどれに近いかを選びます。</span>
              </label>
              <NumberInput label="売値" unit="円" value={card.pricePerUnit} onChange={(pricePerUnit) => updateCard(card.id, { pricePerUnit })} placeholder="例：500" />
              <NumberInput label="販売予定数" unit={product?.unitName || "個"} value={card.plannedUnits} onChange={(plannedUnits) => updateCard(card.id, { plannedUnits })} placeholder="例：200" />
              <div className="rounded-md border border-stone-200 bg-stone-50 p-3 md:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className={labelClass}>価格を動かして試す</p>
                    <p className="text-xs font-semibold leading-5 text-stone-600">
                      {product
                        ? plannedUnits > 0
                          ? "スライダーを動かすと、この販売計画と全体の見込みがすぐ変わります。"
                          : "販売予定数を入れると、価格を動かしたときの目標差を確認できます。"
                        : "売る形を選ぶと、使用量と販売見込みを確認できます。"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-stone-900">現在価格：{yen(currentPrice)}</p>
                </div>
                <input
                  aria-label={`${card.name || `販売計画${index + 1}`}の価格スライダー`}
                  className="mt-3 w-full accent-leaf"
                  type="range"
                  min={0}
                  max={sliderMax}
                  step={1}
                  value={sliderValue}
                  onChange={(event) => updateCard(card.id, { pricePerUnit: sliderValueToPrice(Number(event.target.value)) })}
                />
                {isManualHighPrice ? (
                  <p className="mt-2 text-xs font-semibold text-amber-700">10万円を超える価格は手入力で扱っています。</p>
                ) : null}
                <div className="mt-1 flex items-center justify-between text-xs font-bold text-stone-500">
                  <span>0円</span>
                  <span>{yen(sliderPriceMax)}</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-stone-200 bg-white p-3">
                    <p className="text-xs font-bold text-stone-500">このカードの販売見込み額</p>
                    <p className="mt-1 text-lg font-black text-stone-950">
                      {plannedUnits > 0 ? yen(result.salesYen) : "販売予定数が未入力"}
                    </p>
                    {plannedUnits <= 0 ? (
                      <p className="mt-1 text-xs font-semibold text-stone-600">販売予定数を入れると、このカードの販売見込み額を確認できます。</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-leaf/30 bg-leaf/5 p-3">
                    <p className="text-xs font-bold text-leaf">全体の目標差</p>
                    <p className="mt-1 text-sm font-black leading-6 text-stone-900">{targetMessage}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-stone-800">
                  {plan.targetCashYen <= 0 ? (
                    <p>目標金額を入れると、目標到達の参考価格を確認できます。</p>
                  ) : plannedUnits <= 0 ? (
                    <p>販売予定数を入れると、目標到達の参考価格を確認できます。</p>
                  ) : referencePrice === null ? (
                    <p>目標金額と販売予定数を入れると、参考価格を確認できます。</p>
                  ) : (
                    <>
                      <p>このカードだけで目標に近づけるなら、1単位あたり約{yen(referencePrice)}が目安です。</p>
                      <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
                        <span>現在価格：{yen(currentPrice)}</span>
                        <span>目標到達の参考価格：約{yen(referencePrice)}</span>
                        <span>差：{priceGap !== null && priceGap > 0 ? `+${yen(priceGap)}` : yen(priceGap ?? 0)}</span>
                      </div>
                      <p className="mt-2 text-xs">
                        {summary.isTargetEnough
                          ? "今の価格でも目標に届く見込みです。"
                          : priceGap !== null && priceGap > 0
                            ? `あと${yen(priceGap)}上げると、全体目標に近づく目安です。`
                            : "このカードの価格は、目標到達の参考価格を上回っています。"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <label className="block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={card.memo ?? ""} onChange={(event) => updateCard(card.id, { memo: event.target.value })} placeholder="例：週末の直売所分" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="使用量" value={kg(result.usedKg)} />
              <Metric label="売上" value={yen(result.salesYen)} />
              <Metric label="販売見込み額" value={yen(result.takeHomeYen)} strong />
            </div>
          </CardShell>
        );
      })}
      <button className={primaryButton} onClick={() => setCards((current) => [...current, createSalesPlanCard(current.length + 1)])}>販売計画を追加</button>
      <button className={secondaryButton} onClick={() => setActiveTab("result")}>結果へ進む</button>
    </div>
  );
}

function policyTargetMessage(policy: SalesPolicy, shortageYen: number) {
  const base = `今の販売計画では、目標まで${yen(shortageYen)}足りません。`;
  const sliderNote =
    "価格を動かす場合は、販売計画カード内の価格スライダーで確認できます。";
  if (policy === "awareness") {
    return `${base} 入口商品の量を確認しながら、日常商品やブランド商品の価格も見直す候補になります。${sliderNote}`;
  }
  if (policy === "stable") {
    return `${base} 日常商品を中心に、販売予定数と価格の両方を確認する候補になります。${sliderNote}`;
  }
  if (policy === "profit") {
    return `${base} 利益商品や日常商品の販売予定数・価格を確認する候補になります。${sliderNote}`;
  }
  if (policy === "brand") {
    return `${base} ブランド商品の見せ方と価格、日常商品の土台を確認する候補になります。${sliderNote}`;
  }
  if (policy === "lossReduction") {
    return `${base} ロス削減商品の出口を確認しつつ、日常商品や入口商品の配分も見る候補になります。${sliderNote}`;
  }
  return `${base} 入口・日常・利益・ブランド・ロス削減のバランスを見ながら確認する候補になります。${sliderNote}`;
}

function PolicyAllocationPanel({
  policy,
  summary
}: {
  policy: SalesPolicy;
  summary: ReturnType<typeof calculateSummary>;
}) {
  const highRoleLabels = policyRoleLabels(policy, "high");
  const mediumRoleLabels = policyRoleLabels(policy, "medium");
  const overageRows = summary.harvestUsage.filter((row) => row.overKg > 0);
  const surplusRows = summary.harvestUsage
    .map((row) => ({
      ...row,
      surplusKg: Math.max(0, row.harvest.amount - row.usedKg)
    }))
    .filter((row) => row.surplusKg > 0);
  const hasAnyGuidance =
    overageRows.length > 0 ||
    surplusRows.length > 0 ||
    summary.shortageYen > 0 ||
    summary.compositionWarnings.length > 0;

  return (
    <div className="space-y-4 rounded-md border border-leaf/20 bg-green-50/50 p-3">
      <div>
        <p className="text-sm font-black text-leaf">
          {SALES_POLICY_LABELS[policy]}の確認候補
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-stone-700">
          優先して見たい役割は {highRoleLabels}、次に見たい役割は {mediumRoleLabels} です。
          ここに出る内容は配分を考えるためのメモで、販売計画を自動変更しません。
        </p>
      </div>

      {overageRows.length > 0 ? (
        <div>
          <p className="text-sm font-black text-stone-800">在庫超過の調整候補</p>
          <div className="mt-2 space-y-2">
            {overageRows.map((usage) => {
              const candidates = summary.salesResults
                .filter(
                  (row) =>
                    row.canCheckStock &&
                    row.card.harvestId === usage.harvest.id
                )
                .sort((a, b) => {
                  const roleRank =
                    productRolePolicyRank(policy, a.card.productRole ?? "unset") -
                    productRolePolicyRank(policy, b.card.productRole ?? "unset");
                  if (roleRank !== 0) return roleRank;
                  const usedGap = b.usedKg - a.usedKg;
                  if (usedGap !== 0) return usedGap;
                  return a.salesYen - b.salesYen;
                })
                .slice(0, 3);
              return (
                <div key={usage.harvest.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-stone-800">
                  <p className="font-black text-amber-900">
                    {usage.harvest.name || "取れた量"}は{kg(usage.overKg)}超過しています。
                  </p>
                  {candidates.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {candidates.map((row) => (
                        <li key={row.card.id}>
                          {row.card.name}：{PRODUCT_ROLE_LABELS[row.card.productRole ?? "unset"]} / 使用 {kg(row.usedKg)} / 販売見込み {yen(row.takeHomeYen)} を確認候補にできます。
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {surplusRows.length > 0 ? (
        <div>
          <p className="text-sm font-black text-stone-800">追加配分の余地</p>
          <div className="mt-2 space-y-2">
            {surplusRows.map((usage) => (
              <p key={usage.harvest.id} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700">
                {usage.harvest.name || "取れた量"}に{kg(usage.surplusKg)}の余地があります。{highRoleLabels}や{mediumRoleLabels}に近い販売計画へ追加配分できるかを確認できます。
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {summary.shortageYen > 0 ? (
        <div>
          <p className="text-sm font-black text-stone-800">目標差の確認候補</p>
          <p className="mt-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-stone-700">
            {policyTargetMessage(policy, summary.shortageYen)}
          </p>
        </div>
      ) : null}

      {summary.compositionWarnings.length > 0 ? (
        <div>
          <p className="text-sm font-black text-stone-800">商品構成の確認候補</p>
          <div className="mt-2 space-y-2">
            {summary.compositionWarnings.map((message) => (
              <p key={message} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-stone-700">
                {message} {SALES_POLICY_LABELS[policy]}では、{highRoleLabels}を先に確認すると判断しやすくなります。
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {!hasAnyGuidance ? (
        <p className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700">
          現在の入力では、大きな調整候補は多くありません。方針を変えると別の見方で確認できます。
        </p>
      ) : null}
    </div>
  );
}

function ResultTab({
  plan,
  summary,
  textOutput,
  detailsOpen,
  setDetailsOpen,
  dataOpen,
  setDataOpen,
  exportJson,
  importJson,
  importMessage
}: {
  plan: Plan;
  summary: ReturnType<typeof calculateSummary>;
  textOutput: string;
  detailsOpen: boolean;
  setDetailsOpen: (value: boolean) => void;
  dataOpen: boolean;
  setDataOpen: (value: boolean) => void;
  exportJson: () => void;
  importJson: (file?: File) => void;
  importMessage: string;
}) {
  const conclusion =
    plan.targetCashYen <= 0
      ? "全体では、目標を入れると届き具合が見えます。"
      : summary.isTargetEnough
        ? "全体では、目標を達成できそうです。"
        : `全体では、目標まであと${yen(summary.shortageYen)}足りません。`;
  const totalUnits = summary.validResults.reduce((sum, row) => sum + row.card.plannedUnits, 0);
  const priceGuide = requiredPricePerUnit(summary.targetCashYen, totalUnits);

  return (
    <div className="space-y-4">
      <div className={panelClass}>
        <p className="text-sm font-bold text-leaf">全体結論</p>
        <h2 className="mt-1 text-2xl font-black text-stone-950">{conclusion}</h2>
        <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold leading-6 text-stone-700">
          売り方の方針に合わせた配分案は、販売計画ページで確認できます。配分案は表示専用です。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="目標手残り" value={yen(summary.targetCashYen)} strong />
          <Metric label="販売見込み額" value={yen(summary.totalTakeHomeYen)} strong />
          <Metric label="差額" value={yen(summary.targetGapYen)} strong />
          <Metric label="達成率" value={percent(summary.achievementRate)} />
        </div>
        <div className="mt-4">
          <TargetProgress summary={summary} />
        </div>
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">確認しておきたいこと</h3>
        <div className="mt-3 space-y-4">
          <AttentionGroup title="データ注意" items={summary.dataWarnings} />
          <AttentionGroup title="在庫注意" items={summary.stockWarnings} />
          <AttentionGroup title="目標注意" items={summary.targetWarnings} />
          <AttentionGroup title="商品構成注意" items={summary.compositionWarnings} />
          <AttentionGroup title="仮説不足" items={summary.hypothesisWarnings} />
          {summary.compositionWarnings.length === 0 && summary.salesResults.length > 0 ? (
            <div>
              <p className="text-sm font-black text-stone-800">商品構成</p>
              <p className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">入口商品・日常商品・利益商品・ブランド商品・ロス削減商品が揃っています。</p>
            </div>
          ) : null}
          {summary.stockWarnings.length === 0 ? (
            <div>
              <p className="text-sm font-black text-stone-800">在庫面</p>
              <p className="mt-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">在庫面では大きな超過はありません。</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">商品構成チェック</h3>
        <p className="mt-1 text-sm font-semibold text-stone-600">販売計画を、入口・日常・利益・ブランド・ロス削減の役割ごとに見ます。</p>
        <RoleCompositionBars summary={summary} />
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">在庫使用状況</h3>
        <div className="mt-3">
          <InventoryUsageList summary={summary} />
        </div>
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">カード別結果</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {summary.salesResults.map((row) => (
            <div key={row.card.id} className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="font-black text-stone-950">{row.card.name}</p>
              <p className="mt-1 text-sm font-black text-leaf">{PRODUCT_ROLE_LABELS[row.card.productRole ?? "unset"]} / 使用量 {kg(row.usedKg)} / 販売見込み {yen(row.takeHomeYen)}</p>
              <SalesContributionBar row={row} totalSalesYen={summary.totalTakeHomeYen} />
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-stone-600">詳細を見る</summary>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Metric label="売る形" value={row.product?.name || "未選択"} />
                  <Metric label="売値" value={yen(row.card.pricePerUnit)} />
                  <Metric label="販売予定数" value={`${row.card.plannedUnits.toLocaleString("ja-JP")}${row.product?.unitName || "個"}`} />
                </div>
              </details>
              {row.missing.length > 0 ? <p className="mt-2 text-sm font-semibold text-amber-900">{row.missing.join(" / ")}</p> : null}
            </div>
          ))}
        </div>
      </div>
      <CardShell title="詳しい数字を見る" summary={detailsOpen ? "表示中" : "閉じています"} isOpen={detailsOpen} onToggle={() => setDetailsOpen(!detailsOpen)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="全体売上" value={yen(summary.totalSalesYen)} />
          <Metric label="販売見込み額" value={yen(summary.totalTakeHomeYen)} strong />
          <Metric label="合計使用量" value={kg(summary.totalUsedKg)} />
          <Metric label="未使用量" value={kg(summary.totalUnusedKg)} />
          <Metric label="全体平均で見た必要単価の目安" value={priceGuide === null ? "未設定" : yen(priceGuide)} />
        </div>
        <div className="space-y-2">
          {summary.harvestUsage.map((row) => (
            <p key={row.harvest.id} className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
              {row.harvest.name}: 取れた量 {kg(row.harvest.amount)} / 使用 {kg(row.usedKg)} / 超過 {kg(row.overKg)}
            </p>
          ))}
        </div>
      </CardShell>
      <CardShell title="データ管理" summary="JSON出力・読み込み、バージョン情報はこちら" isOpen={dataOpen} onToggle={() => setDataOpen(!dataOpen)}>
        <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-3 text-sm font-semibold leading-6 text-stone-700">
          <p>入力内容は基本的にこのブラウザ内に保存されます。ブラウザのデータを削除すると、アプリの保存データも消える場合があります。</p>
          <p>必要なデータは、JSON出力でバックアップしてください。初期化や大きな変更の前にも、必要なデータをJSON出力しておくと安心です。</p>
          <p>このアプリは販売計画を考えるための補助です。実際の価格・販売数・販売先の判断は、利用者自身で確認してください。</p>
          <p>現時点の販売見込み額には、費用がすべて反映されていない場合があります。schemaVersionは5です。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={primaryButton} onClick={exportJson}>JSON出力</button>
          <label className={secondaryButton}>
            JSON読み込み
            <input className="sr-only" type="file" accept="application/json" onChange={(event) => importJson(event.target.files?.[0])} />
          </label>
          <button className={secondaryButton} onClick={() => navigator.clipboard.writeText(textOutput)}>テキストをコピー</button>
          <button className={secondaryButton} onClick={() => window.print()}>印刷</button>
        </div>
        {importMessage ? <p className="text-sm font-semibold text-leaf">{importMessage}</p> : null}
        <textarea className={`${inputClass} min-h-80 font-mono text-sm`} value={textOutput} readOnly />
      </CardShell>
    </div>
  );
}

function buildTextOutput(
  plan: Plan,
  harvestCards: HarvestCard[],
  productCards: ProductCard[],
  salesPlanCards: SalesPlanCard[]
) {
  const summary = calculateSummary(plan, harvestCards, productCards, salesPlanCards);
  const productMap = new Map(productCards.map((card) => [card.id, card]));
  const lines = [
    "農産物販売プランナー v1.3.1",
    "",
    `作物名: ${plan.cropName || "未入力"}`,
    `目標手残り: ${yen(plan.targetCashYen)}`,
    `販売見込み額（費用未反映）: ${yen(summary.totalTakeHomeYen)}`,
    `差額: ${yen(summary.targetGapYen)}`,
    `達成率: ${percent(summary.achievementRate)}`,
    "",
    "商品構成",
    ...summary.compositionRows.map((row) => `- ${row.label}: ${row.count}件 / 販売見込み ${yen(row.salesYen)} / 使用 ${kg(row.usedKg)} / 売上比率 ${percent(row.salesShare)}`),
    "",
    "販売計画"
  ];
  salesPlanCards.forEach((card) => {
    const product = productMap.get(card.productId ?? "");
    const row = calculateSalesPlan(card, undefined, product);
    const roleLabel = PRODUCT_ROLE_LABELS[card.productRole ?? "unset"];
    lines.push(`- ${card.name}: ${roleLabel} / ${product?.name || "売る形未選択"} / ${yen(card.pricePerUnit)} x ${card.plannedUnits}${product?.unitName || "個"} / 使用 ${kg(row.usedKg)} / 見込み ${yen(row.takeHomeYen)}`);
  });
  return lines.join("\n");
}
