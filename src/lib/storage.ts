import { APP_NAME, APP_VERSION, STORAGE_KEYS } from "@/lib/constants";
import type {
  AllocationItem,
  ExportData,
  HarvestInput,
  Plan,
  ProductSpec,
  Settings,
  UnitDefinition
} from "@/types/domain";

type StoredState = {
  plan: Plan;
  units: UnitDefinition[];
  harvests: HarvestInput[];
  specs: ProductSpec[];
  allocations: AllocationItem[];
  settings: Settings;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function loadJson<T>(key: string): { value?: T; error?: string } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return { value: JSON.parse(raw) as T };
  } catch {
    return { error: `${key} の読み込みに失敗しました` };
  }
}

export function saveState(state: StoredState) {
  localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(state.plan));
  localStorage.setItem(STORAGE_KEYS.units, JSON.stringify(state.units));
  localStorage.setItem(STORAGE_KEYS.harvests, JSON.stringify(state.harvests));
  localStorage.setItem(STORAGE_KEYS.specs, JSON.stringify(state.specs));
  localStorage.setItem(
    STORAGE_KEYS.allocations,
    JSON.stringify(state.allocations)
  );
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

export function buildExportData(
  plan: Plan,
  unitDefinitions: UnitDefinition[],
  harvestInputs: HarvestInput[],
  productSpecs: ProductSpec[],
  allocationItems: AllocationItem[]
): ExportData {
  return {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    plan,
    unitDefinitions,
    harvestInputs,
    productSpecs,
    allocationItems
  };
}

export function getImportValidationError(value: unknown) {
  if (!isObject(value)) return "JSONの形式が正しくありません。";
  if (value.appName !== APP_NAME) return "別アプリのJSONです。";
  if (value.appVersion !== APP_VERSION) {
    return "このデータは旧形式です。v0.2.0では自動変換しません。";
  }
  if (!isObject(value.plan)) return "planが見つかりません。";
  if (!Array.isArray(value.unitDefinitions)) return "unitDefinitionsが見つかりません。";
  if (!Array.isArray(value.harvestInputs)) return "harvestInputsが見つかりません。";
  if (!Array.isArray(value.productSpecs)) return "productSpecsが見つかりません。";
  if (!Array.isArray(value.allocationItems)) return "allocationItemsが見つかりません。";
  return "";
}
