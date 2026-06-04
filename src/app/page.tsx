"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SCHEMA_VERSION, STORAGE_KEYS, TABS } from "@/lib/constants";
import {
  calculateSalesPlan,
  calculateSummary,
  formatProductAmount,
  productUnitKg,
  requiredPricePerUnit,
  round
} from "@/lib/calculations";
import {
  createDefaultSettings,
  createEmptyPlan,
  createHarvestCard,
  createProductCard,
  createSampleData,
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

  const loadSample = () => {
    const ok =
      harvestCards.length > 0 || productCards.length > 0 || salesPlanCards.length > 0
        ? window.confirm("現在の保存データをサンプルデータで上書きします。よろしいですか。")
        : true;
    if (!ok) return;
    const sample = createSampleData();
    setPlan(sample.plan);
    setHarvestCards(sample.harvestCards);
    setProductCards(sample.productCards);
    setSalesPlanCards(sample.salesPlanCards);
    setSettings({ activeTab: "result", hasSeenIntro: true });
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
    link.download = `tenokori-sales-plan-v120-${new Date().toISOString().slice(0, 10)}.json`;
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
            <p className="text-sm font-bold text-leaf">複数カードを合算して、目標に届くかを見る。</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-stone-950">手残り販売計画</h1>
          </div>
          <button className={`${secondaryButton} no-print`} onClick={loadSample}>サンプル投入</button>
        </div>
      </header>

      <nav className="no-print sticky top-0 z-20 -mx-4 mb-4 border-y border-stone-200 bg-paper/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-black ${activeTab === tab.id ? "bg-leaf text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}
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
            cards={salesPlanCards}
            setCards={setSalesPlanCards}
            harvestCards={harvestCards}
            productCards={productCards}
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
      <p className="mt-4 text-lg font-semibold leading-8 text-stone-800">
        今年いくら手元に残したいかを決めて、取れた量・売る形・売り方を組み合わせて試すアプリです。
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
  cards,
  setCards,
  harvestCards,
  productCards,
  stockWarnings,
  openCards,
  toggleCard,
  closeCard,
  setActiveTab
}: {
  cards: SalesPlanCard[];
  setCards: React.Dispatch<React.SetStateAction<SalesPlanCard[]>>;
  harvestCards: HarvestCard[];
  productCards: ProductCard[];
  stockWarnings: string[];
  openCards: Record<string, boolean>;
  toggleCard: (id: string) => void;
  closeCard: (id: string) => void;
  setActiveTab: (tab: TabId) => void;
}) {
  const updateCard = (id: string, patch: Partial<SalesPlanCard>) =>
    setCards((current) => current.map((card) => card.id === id ? { ...card, ...patch, updatedAt: nowIso() } : card));
  const harvestMap = new Map(harvestCards.map((card) => [card.id, card]));
  const productMap = new Map(productCards.map((card) => [card.id, card]));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">販売計画カード一覧</h2>
          <p className="mt-1 text-sm font-semibold text-stone-600">どの取れた量を、どの売る形で、何個・いくらで売るかを試します。</p>
        </div>
        <button className={primaryButton} onClick={() => setCards((current) => [...current, createSalesPlanCard(current.length + 1)])}>販売計画を追加</button>
      </div>
      {cards.length === 0 ? <Notice>販売計画：未入力。売り方をカードで追加してください。</Notice> : null}
      {stockWarnings.map((message) => <Notice key={message}>{message}</Notice>)}
      {cards.map((card, index) => {
        const product = productMap.get(card.productId ?? "");
        const harvest = harvestMap.get(card.harvestId ?? "");
        const result = calculateSalesPlan(card, harvest, product);
        const missing = result.missing.length > 0;
        return (
          <CardShell
            key={card.id}
            title={`${card.name || `販売計画${index + 1}`}：${missing ? "売る形・売値・販売数が未入力" : `${product?.name || "売る形"} ${yen(card.pricePerUnit)} × ${card.plannedUnits}${product?.unitName || "個"}`}`}
            summary={missing ? result.missing.join(" / ") : `使用量 ${kg(result.usedKg)}、見込み ${yen(result.takeHomeYen)}`}
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
              <NumberInput label="売値" unit="円" value={card.pricePerUnit} onChange={(pricePerUnit) => updateCard(card.id, { pricePerUnit })} placeholder="例：500" />
              <NumberInput label="販売予定数" unit={product?.unitName || "個"} value={card.plannedUnits} onChange={(plannedUnits) => updateCard(card.id, { plannedUnits })} placeholder="例：200" />
            </div>
            <label className="block">
              <span className={labelClass}>メモ</span>
              <textarea className={`${inputClass} min-h-20`} value={card.memo ?? ""} onChange={(event) => updateCard(card.id, { memo: event.target.value })} placeholder="例：週末の直売所分" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="使用量" value={kg(result.usedKg)} />
              <Metric label="売上" value={yen(result.salesYen)} />
              <Metric label="手残り見込み" value={yen(result.takeHomeYen)} strong />
            </div>
          </CardShell>
        );
      })}
      <button className={secondaryButton} onClick={() => setActiveTab("result")}>結果へ進む</button>
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
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Metric label="目標手残り" value={yen(summary.targetCashYen)} strong />
        <Metric label="全体見込み手残り" value={yen(summary.totalTakeHomeYen)} strong />
        <Metric label="差額" value={yen(summary.targetGapYen)} strong />
        <Metric label="達成率" value={percent(summary.achievementRate)} />
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">注意・警告</h3>
        <div className="mt-3 space-y-2">
          {summary.stockWarnings.length === 0 && !summary.hasMissingItems ? (
            <p className="text-sm font-semibold text-stone-700">大きな注意はありません。</p>
          ) : null}
          {summary.stockWarnings.map((message) => <Notice key={message}>{message}</Notice>)}
          {summary.hasMissingItems ? <Notice>まだ決めていない項目があります。下の「次に決めること」で確認できます。</Notice> : null}
        </div>
      </div>
      <div className={panelClass}>
        <h3 className="text-lg font-black">カード別結果</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {summary.salesResults.map((row) => (
            <div key={row.card.id} className="rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="font-black text-stone-950">{row.card.name}</p>
              <p className="mt-1 text-sm font-semibold text-stone-600">{row.product?.name || "売る形未選択"} / {yen(row.card.pricePerUnit)} × {row.card.plannedUnits.toLocaleString("ja-JP")}{row.product?.unitName || "個"}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Metric label="使用量" value={kg(row.usedKg)} />
                <Metric label="売上" value={yen(row.salesYen)} />
                <Metric label="手残り見込み" value={yen(row.takeHomeYen)} strong />
              </div>
              {row.missing.length > 0 ? <p className="mt-2 text-sm font-semibold text-amber-900">{row.missing.join(" / ")}</p> : null}
            </div>
          ))}
        </div>
      </div>
      <CardShell title="詳しい数字を見る" summary={detailsOpen ? "表示中" : "閉じています"} isOpen={detailsOpen} onToggle={() => setDetailsOpen(!detailsOpen)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="全体売上" value={yen(summary.totalSalesYen)} />
          <Metric label="全体手残り" value={yen(summary.totalTakeHomeYen)} strong />
          <Metric label="合計使用量" value={kg(summary.totalUsedKg)} />
          <Metric label="未使用量" value={kg(summary.totalUnusedKg)} />
          <Metric label="必要単価の目安" value={priceGuide === null ? "未設定" : yen(priceGuide)} />
        </div>
        <div className="space-y-2">
          {summary.harvestUsage.map((row) => (
            <p key={row.harvest.id} className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
              {row.harvest.name}: 取れた量 {kg(row.harvest.amount)} / 使用 {kg(row.usedKg)} / 超過 {kg(row.overKg)}
            </p>
          ))}
        </div>
      </CardShell>
      {summary.hasMissingItems ? (
        <div className={panelClass}>
          <h3 className="text-lg font-black">次に決めること</h3>
          <p className="mt-2 text-sm font-semibold text-stone-600">まだ決めていない項目があります。</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-semibold text-stone-700">
            {summary.missingItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      <CardShell title="データ管理" summary="JSON出力・読み込み、バージョン情報はこちら" isOpen={dataOpen} onToggle={() => setDataOpen(!dataOpen)}>
        <p className="text-sm text-stone-600">入力内容はこのブラウザに自動保存されます。schemaVersionは5です。</p>
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
    "手残り販売計画 v1.2.0",
    "",
    `作物名: ${plan.cropName || "未入力"}`,
    `目標手残り: ${yen(plan.targetCashYen)}`,
    `全体見込み手残り: ${yen(summary.totalTakeHomeYen)}`,
    `差額: ${yen(summary.targetGapYen)}`,
    `達成率: ${percent(summary.achievementRate)}`,
    "",
    "販売計画"
  ];
  salesPlanCards.forEach((card) => {
    const product = productMap.get(card.productId ?? "");
    const row = calculateSalesPlan(card, undefined, product);
    lines.push(`- ${card.name}: ${product?.name || "売る形未選択"} / ${yen(card.pricePerUnit)} x ${card.plannedUnits}${product?.unitName || "個"} / 使用 ${kg(row.usedKg)} / 見込み ${yen(row.takeHomeYen)}`);
  });
  return lines.join("\n");
}
