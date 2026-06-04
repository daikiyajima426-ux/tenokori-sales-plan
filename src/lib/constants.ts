import type { ProductCategory } from "@/types/domain";

export const APP_NAME = "手残り販売計画";
export const APP_VERSION = "1.0.0";
export const SCHEMA_VERSION = 4;

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
  { id: "trials", label: "試す" },
  { id: "result", label: "結果" }
] as const;

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  premium: "良いものを高めに売る",
  standard: "買いやすい値段で売る",
  trial: "少量でまず食べてもらう",
  b_grade: "余り・傷ありを無駄にしない",
  wholesale: "まとめて売る",
  other: "その他"
};
