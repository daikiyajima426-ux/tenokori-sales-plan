import { APP_NAME, APP_VERSION, STORAGE_KEYS } from "@/lib/constants";
import type { ExportData, Plan, SalesMethod, SalesPlanItem, Settings } from "@/types/domain";

type StoredState = {
  plan: Plan;
  methods: SalesMethod[];
  items: SalesPlanItem[];
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
  localStorage.setItem(STORAGE_KEYS.methods, JSON.stringify(state.methods));
  localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(state.items));
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

export function buildExportData(
  plan: Plan,
  salesMethods: SalesMethod[],
  salesPlanItems: SalesPlanItem[]
): ExportData {
  return {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    plan,
    salesMethods,
    salesPlanItems
  };
}

export function validateExportData(value: unknown): value is ExportData {
  if (!isObject(value)) return false;
  if (value.appName !== APP_NAME) return false;
  if (![APP_VERSION, "0.1.0"].includes(String(value.appVersion))) return false;
  if (!isObject(value.plan)) return false;
  if (!Array.isArray(value.salesMethods)) return false;
  if (!Array.isArray(value.salesPlanItems)) return false;
  return typeof value.plan.id === "string" && typeof value.plan.cropName === "string";
}
