import type { ProductRole, SalesPolicy } from "@/types/domain";

export const APP_NAME = "農産物販売プランナー";
export const APP_VERSION = "1.3.0";
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

export const SALES_POLICY_OPTIONS = [
  { value: "balanced", label: "バランス型" },
  { value: "awareness", label: "まず知ってもらう" },
  { value: "stable", label: "安定して売る" },
  { value: "profit", label: "手残りを増やす" },
  { value: "brand", label: "ブランドを作る" },
  { value: "lossReduction", label: "ロスを減らす" }
] as const;

export const SALES_POLICY_LABELS: Record<SalesPolicy, string> = {
  balanced: "バランス型",
  awareness: "まず知ってもらう",
  stable: "安定して売る",
  profit: "手残りを増やす",
  brand: "ブランドを作る",
  lossReduction: "ロスを減らす"
};

export const SALES_POLICY_ROLE_PRIORITY: Record<
  SalesPolicy,
  { high: ProductRole[]; medium: ProductRole[]; low: ProductRole[] }
> = {
  balanced: {
    high: ["daily", "profit"],
    medium: ["entry", "brand", "lossReduction"],
    low: []
  },
  awareness: {
    high: ["entry"],
    medium: ["daily", "brand"],
    low: ["profit", "lossReduction"]
  },
  stable: {
    high: ["daily"],
    medium: ["entry", "profit"],
    low: ["brand", "lossReduction"]
  },
  profit: {
    high: ["profit"],
    medium: ["daily", "brand"],
    low: ["entry", "lossReduction"]
  },
  brand: {
    high: ["brand"],
    medium: ["profit", "daily"],
    low: ["entry", "lossReduction"]
  },
  lossReduction: {
    high: ["lossReduction"],
    medium: ["daily", "entry"],
    low: ["profit", "brand"]
  }
};
