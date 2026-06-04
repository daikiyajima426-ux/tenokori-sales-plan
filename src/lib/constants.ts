export const APP_NAME = "手残り販売計画";
export const APP_VERSION = "1.2.0";
export const SCHEMA_VERSION = 5;

export const STORAGE_KEYS = {
  plan: "tenokori-sales-plan:v1.0:plan",
  units: "tenokori-sales-plan:v1.0:units",
  harvests: "tenokori-sales-plan:v1.0:harvests",
  products: "tenokori-sales-plan:v1.0:products",
  trials: "tenokori-sales-plan:v1.0:trials",
  settings: "tenokori-sales-plan:v1.0:settings"
} as const;

export const TABS = [
  { id: "intro", label: "はじめに" },
  { id: "goal", label: "目標" },
  { id: "harvests", label: "取れた量" },
  { id: "products", label: "売る形" },
  { id: "trials", label: "販売計画" },
  { id: "result", label: "結果" }
] as const;
