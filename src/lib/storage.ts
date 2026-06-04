import { APP_NAME, APP_VERSION, STORAGE_KEYS } from "@/lib/constants";
import type { ExportData, Harvest, Plan, Product, Settings, Trial, Unit } from "@/types/domain";

type StoredState = {
  plan: Plan;
  units: Unit[];
  harvests: Harvest[];
  products: Product[];
  trials: Trial[];
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
    return {
      error:
        "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。"
    };
  }
}

export function saveState(state: StoredState) {
  localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(state.plan));
  localStorage.setItem(STORAGE_KEYS.units, JSON.stringify(state.units));
  localStorage.setItem(STORAGE_KEYS.harvests, JSON.stringify(state.harvests));
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products));
  localStorage.setItem(STORAGE_KEYS.trials, JSON.stringify(state.trials));
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

export function buildExportData(
  plan: Plan,
  units: Unit[],
  harvests: Harvest[],
  products: Product[],
  trials: Trial[]
): ExportData {
  return {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    plan,
    units,
    harvests,
    products,
    trials
  };
}

export function getImportValidationError(value: unknown) {
  if (!isObject(value)) {
    return "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。";
  }
  if (value.appName !== APP_NAME) return "別アプリのJSONです。";
  if (value.appVersion !== APP_VERSION) return "このデータは旧形式です。";
  if (!isObject(value.plan)) {
    return "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。";
  }
  if (!Array.isArray(value.units)) {
    return "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。";
  }
  if (!Array.isArray(value.harvests)) {
    return "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。";
  }
  if (!Array.isArray(value.products)) {
    return "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。";
  }
  if (!Array.isArray(value.trials)) {
    return "このデータは読み込めません。保存形式が違うか、内容が壊れている可能性があります。";
  }
  return "";
}
