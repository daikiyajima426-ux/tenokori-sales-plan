import { APP_NAME, APP_VERSION, SCHEMA_VERSION, STORAGE_KEYS } from "@/lib/constants";
import { createDefaultSettings } from "@/lib/factories";
import type {
  AppData,
  ExportData,
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

type StoredState = {
  plan: Plan;
  harvestCards: HarvestCard[];
  productCards: ProductCard[];
  salesPlanCards: SalesPlanCard[];
  settings: Settings;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const safeNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export function loadJson<T>(key: string): { value?: T; error?: string } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return { value: JSON.parse(raw) as T };
  } catch {
    return {
      error:
        "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。"
    };
  }
}

export function saveState(state: StoredState) {
  localStorage.setItem(
    STORAGE_KEYS.plan,
    JSON.stringify({ ...state.plan, schemaVersion: SCHEMA_VERSION })
  );
  localStorage.setItem(STORAGE_KEYS.harvests, JSON.stringify(state.harvestCards));
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.productCards));
  localStorage.setItem(STORAGE_KEYS.trials, JSON.stringify(state.salesPlanCards));
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

export function buildExportData(data: AppData): ExportData {
  return {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { ...data, schemaVersion: 5 }
  };
}

function legacyUnitWeight(unitId: string, units: LegacyUnit[]) {
  return units.find((unit) => unit.id === unitId)?.weightKg ?? 1;
}

function legacyUnitName(unitId: string, units: LegacyUnit[]) {
  return units.find((unit) => unit.id === unitId)?.name || "kg";
}

export function migrateLegacyState(input: {
  plan?: Plan;
  units?: LegacyUnit[];
  harvests?: LegacyHarvest[] | HarvestCard[];
  products?: LegacyProduct[] | ProductCard[];
  trials?: LegacyTrial[] | SalesPlanCard[];
  settings?: Settings;
}): AppData | null {
  if (!input.plan) return null;
  if (input.plan.schemaVersion === 5) {
    return {
      schemaVersion: 5,
      plan: input.plan,
      harvestCards: (input.harvests ?? []) as HarvestCard[],
      productCards: (input.products ?? []) as ProductCard[],
      salesPlanCards: (input.trials ?? []) as SalesPlanCard[],
      settings: input.settings ?? createDefaultSettings()
    };
  }

  const units = input.units ?? [];
  const legacyHarvests = (input.harvests ?? []) as LegacyHarvest[];
  const legacyProducts = (input.products ?? []) as LegacyProduct[];
  const legacyTrials = (input.trials ?? []) as LegacyTrial[];
  const harvestCards: HarvestCard[] = legacyHarvests.map((harvest, index) => ({
    id: harvest.id,
    name: harvest.name || `取れた量${index + 1}`,
    amount: safeNumber(harvest.quantity) * legacyUnitWeight(harvest.unitId, units),
    unit: "kg",
    memo: harvest.memo ?? "",
    createdAt: harvest.createdAt,
    updatedAt: harvest.updatedAt
  }));

  const productCards: ProductCard[] = legacyProducts.map((product, index) => {
    const unitName = product.salesUnitLabel || legacyUnitName(product.contentUnitId, units);
    const unitWeight = legacyUnitWeight(product.contentUnitId, units);
    const kgValue = safeNumber(product.contentQuantity) * unitWeight;
    return {
      id: product.id,
      name: product.name || `売る形${index + 1}`,
      unitName: unitName || "個",
      quantityPerUnit: kgValue >= 1 ? kgValue : kgValue * 1000,
      quantityUnit: kgValue >= 1 ? "kg" : "g",
      memo: product.memo ?? "",
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  });

  const salesPlanCards: SalesPlanCard[] = legacyTrials.map((trial, index) => {
    const product = legacyProducts.find((row) => row.id === trial.productId);
    const count =
      trial.inputMode === "weight" && product
        ? Math.floor(
            safeNumber(trial.inputWeightKg) /
              (safeNumber(product.contentQuantity) *
                legacyUnitWeight(product.contentUnitId, units))
          )
        : safeNumber(trial.count);
    return {
      id: trial.id,
      name: `販売計画${index + 1}`,
      harvestId: harvestCards[0]?.id,
      productId: trial.productId || undefined,
      pricePerUnit: safeNumber(product?.priceYen),
      plannedUnits: count,
      memo: trial.memo ?? "",
      createdAt: trial.createdAt,
      updatedAt: trial.updatedAt
    };
  });

  return {
    schemaVersion: 5,
    plan: { ...input.plan, schemaVersion: SCHEMA_VERSION },
    harvestCards,
    productCards,
    salesPlanCards,
    settings: input.settings ?? createDefaultSettings()
  };
}

export function getImportValidationError(value: unknown) {
  if (!isObject(value)) {
    return "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。";
  }
  if (value.appName !== APP_NAME) return "別アプリのJSONです。";
  if (value.appVersion !== APP_VERSION && !isObject(value.plan)) {
    return "このデータは旧形式です。";
  }
  if (value.appVersion === APP_VERSION && !isObject(value.data)) {
    return "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。";
  }
  return "";
}

export function readExportData(value: unknown): AppData | null {
  if (!isObject(value)) return null;
  if (isObject(value.data)) return value.data as AppData;
  return migrateLegacyState({
    plan: isObject(value.plan) ? (value.plan as Plan) : undefined,
    units: Array.isArray(value.units) ? (value.units as LegacyUnit[]) : [],
    harvests: Array.isArray(value.harvests) ? (value.harvests as LegacyHarvest[]) : [],
    products: Array.isArray(value.products) ? (value.products as LegacyProduct[]) : [],
    trials: Array.isArray(value.trials) ? (value.trials as LegacyTrial[]) : [],
    settings: isObject(value.settings) ? (value.settings as Settings) : undefined
  });
}
