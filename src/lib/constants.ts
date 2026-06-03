export const APP_NAME = "手残り販売計画";
export const APP_VERSION = "0.2.0";
export const SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  plan: "tenokori-sales-plan:v0.2:plan",
  units: "tenokori-sales-plan:v0.2:units",
  harvests: "tenokori-sales-plan:v0.2:harvests",
  specs: "tenokori-sales-plan:v0.2:specs",
  allocations: "tenokori-sales-plan:v0.2:allocations",
  settings: "tenokori-sales-plan:v0.2:settings"
} as const;

export const TABS = [
  { id: "basic", label: "基本" },
  { id: "units", label: "単位" },
  { id: "harvests", label: "収穫" },
  { id: "specs", label: "規格品" },
  { id: "allocations", label: "配分" },
  { id: "result", label: "結果" },
  { id: "export", label: "出力" }
] as const;
