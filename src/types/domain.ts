export type Plan = {
  id: string;
  cropName: string;
  varietyName?: string;
  expectedYieldKg: number;
  nonSaleKg: number;
  saleableKg: number;
  requiredCashYen: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};

export type SalesUnit =
  | "kg"
  | "box"
  | "bag"
  | "bunch"
  | "pack"
  | "case"
  | "other";

export type SalesChannel =
  | "direct"
  | "ec"
  | "gift"
  | "restaurant"
  | "retail"
  | "wholesale"
  | "b_grade"
  | "other";

export type SalesMethod = {
  id: string;
  planId: string;
  name: string;
  channel: SalesChannel;
  unit: SalesUnit;
  unitLabel: string;
  weightPerUnitKg: number;
  pricePerUnitYen: number;
  packagingCostPerUnitYen: number;
  shippingCostPerUnitYen: number;
  feePerUnitYen: number;
  otherCostPerUnitYen: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type SalesPlanItem = {
  id: string;
  planId: string;
  salesMethodId: string;
  quantity: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  activeTab: string;
};

export type ExportData = {
  appName: "手残り販売計画";
  appVersion: "0.1.1";
  exportedAt: string;
  plan: Plan;
  salesMethods: SalesMethod[];
  salesPlanItems: SalesPlanItem[];
};
