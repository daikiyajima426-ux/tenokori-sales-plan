import type { SalesChannel, SalesUnit } from "@/types/domain";

export const APP_NAME = "手残り販売計画";
export const APP_VERSION = "0.1.1";
export const SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  plan: "tenokori-sales-plan:v0.1:plan",
  methods: "tenokori-sales-plan:v0.1:methods",
  items: "tenokori-sales-plan:v0.1:items",
  settings: "tenokori-sales-plan:v0.1:settings"
} as const;

export const UNIT_OPTIONS: { value: SalesUnit; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "box", label: "箱" },
  { value: "bag", label: "袋" },
  { value: "bunch", label: "房" },
  { value: "pack", label: "パック" },
  { value: "case", label: "ケース" },
  { value: "other", label: "その他" }
];

export const CHANNEL_OPTIONS: { value: SalesChannel; label: string }[] = [
  { value: "direct", label: "直売" },
  { value: "ec", label: "EC" },
  { value: "gift", label: "贈答" },
  { value: "restaurant", label: "飲食店" },
  { value: "retail", label: "小売" },
  { value: "wholesale", label: "業務用" },
  { value: "b_grade", label: "訳あり" },
  { value: "other", label: "その他" }
];

export const TABS = [
  { id: "basic", label: "基本" },
  { id: "methods", label: "売り方" },
  { id: "items", label: "配分" },
  { id: "result", label: "結果" },
  { id: "export", label: "出力" }
] as const;
