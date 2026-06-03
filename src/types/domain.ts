export type Plan = {
  id: string;
  cropName: string;
  varietyName?: string;
  requiredCashYen: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};

export type UnitDefinition = {
  id: string;
  name: string;
  label: string;
  weightKg: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type HarvestInput = {
  id: string;
  planId: string;
  name: string;
  unitId: string;
  quantity: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductSpecType = "weight" | "unit";

export type ProductSpec = {
  id: string;
  planId: string;
  name: string;
  type: ProductSpecType;
  unitId: string;
  quantityPerSpec: number;
  salesUnitLabel: string;
  pricePerSpecYen: number;
  packagingCostPerSpecYen: number;
  shippingCostPerSpecYen: number;
  feePerSpecYen: number;
  otherCostPerSpecYen: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type AllocationInputMode = "count" | "weight";

export type AllocationItem = {
  id: string;
  planId: string;
  productSpecId: string;
  inputMode: AllocationInputMode;
  count?: number;
  inputWeightKg?: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  activeTab: string;
};

export type ExportData = {
  appName: "手残り販売計画";
  appVersion: "0.2.0";
  exportedAt: string;
  plan: Plan;
  unitDefinitions: UnitDefinition[];
  harvestInputs: HarvestInput[];
  productSpecs: ProductSpec[];
  allocationItems: AllocationItem[];
};
