export type Plan = {
  id: string;
  cropName: string;
  varietyName?: string;
  targetCashYen: number;
  nextYearTargetCashYen?: number;
  memo?: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type Unit = {
  id: string;
  name: string;
  label: string;
  weightKg: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type Harvest = {
  id: string;
  planId: string;
  name: string;
  unitId: string;
  quantity: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductCategory =
  | "premium"
  | "standard"
  | "trial"
  | "b_grade"
  | "wholesale"
  | "other";

export type Product = {
  id: string;
  planId: string;
  name: string;
  category: ProductCategory;
  contentUnitId: string;
  contentQuantity: number;
  salesUnitLabel: string;
  priceYen: number;
  packageCostYen: number;
  shippingCostYen: number;
  feeYen: number;
  otherCostYen: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type TrialInputMode = "count" | "weight";

export type Trial = {
  id: string;
  planId: string;
  productId: string;
  inputMode: TrialInputMode;
  count?: number;
  inputWeightKg?: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  activeTab: string;
  hasSeenIntro: boolean;
};

export type ExportData = {
  appName: "手残り販売計画";
  appVersion: "1.2.0";
  exportedAt: string;
  plan: Plan;
  units: Unit[];
  harvests: Harvest[];
  products: Product[];
  trials: Trial[];
};
