export const APP_NAME = "農産物販売プランナー";
export const APP_VERSION = "1.2.1";
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

export const PRODUCT_ROLE_OPTIONS = [
  { value: "unset", label: "未設定" },
  { value: "entry", label: "入口商品" },
  { value: "daily", label: "日常商品" },
  { value: "profit", label: "利益商品" },
  { value: "brand", label: "ブランド商品" },
  { value: "lossReduction", label: "ロス削減商品" }
] as const;

export const PRODUCT_ROLE_LABELS = {
  unset: "役割未設定",
  entry: "入口商品",
  daily: "日常商品",
  profit: "利益商品",
  brand: "ブランド商品",
  lossReduction: "ロス削減商品"
} as const;

export const PRODUCT_ROLE_ORDER = [
  "entry",
  "daily",
  "profit",
  "brand",
  "lossReduction",
  "unset"
] as const;
