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

export type HarvestCard = {
  id: string;
  name: string;
  amount: number;
  unit: "kg";
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductCard = {
  id: string;
  name: string;
  unitName: string;
  quantityPerUnit: number;
  quantityUnit: "g" | "kg";
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductRole =
  | "entry"
  | "daily"
  | "profit"
  | "brand"
  | "lossReduction"
  | "unset";

export type SalesPlanCard = {
  id: string;
  name: string;
  harvestId?: string;
  productId?: string;
  productRole: ProductRole;
  pricePerUnit: number;
  plannedUnits: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  activeTab: string;
  hasSeenIntro: boolean;
};

export type AppData = {
  schemaVersion: 5;
  plan: Plan;
  harvestCards: HarvestCard[];
  productCards: ProductCard[];
  salesPlanCards: SalesPlanCard[];
  settings?: Settings;
};

export type ExportData = {
  appName: "手残り販売計画";
  appVersion: "1.2.0";
  exportedAt: string;
  data: AppData;
};

export type LegacyUnit = {
  id: string;
  name: string;
  label: string;
  weightKg: number;
};

export type LegacyHarvest = {
  id: string;
  name: string;
  unitId: string;
  quantity: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type LegacyProduct = {
  id: string;
  name: string;
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

export type LegacyTrial = {
  id: string;
  productId: string;
  inputMode: "count" | "weight";
  count?: number;
  inputWeightKg?: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};
