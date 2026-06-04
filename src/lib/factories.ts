import { SCHEMA_VERSION } from "@/lib/constants";
import type { Harvest, Plan, Product, Trial, Unit } from "@/types/domain";

export const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const nowIso = () => new Date().toISOString();

export function createEmptyPlan(): Plan {
  const now = nowIso();
  return {
    id: createId(),
    cropName: "",
    varietyName: "",
    targetCashYen: 0,
    nextYearTargetCashYen: 0,
    memo: "",
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };
}

export function createKgUnit(): Unit {
  const now = nowIso();
  return {
    id: "unit-kg",
    name: "kg",
    label: "1kg",
    weightKg: 1,
    memo: "標準の重さ",
    createdAt: now,
    updatedAt: now
  };
}

export function createUnit(): Unit {
  const now = nowIso();
  return {
    id: createId(),
    name: "",
    label: "",
    weightKg: 0,
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createHarvest(planId: string, unitId = "unit-kg"): Harvest {
  const now = nowIso();
  return {
    id: createId(),
    planId,
    name: "",
    unitId,
    quantity: 0,
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createProduct(planId: string, unitId = "unit-kg"): Product {
  const now = nowIso();
  return {
    id: createId(),
    planId,
    name: "",
    category: "standard",
    contentUnitId: unitId,
    contentQuantity: 1,
    salesUnitLabel: "",
    priceYen: 0,
    packageCostYen: 0,
    shippingCostYen: 0,
    feeYen: 0,
    otherCostYen: 0,
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createTrial(planId: string, productId = ""): Trial {
  const now = nowIso();
  return {
    id: createId(),
    planId,
    productId,
    inputMode: "count",
    count: 0,
    inputWeightKg: 0,
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createSampleData() {
  const plan = createEmptyPlan();
  plan.cropName = "ぶどう";
  plan.varietyName = "シャインマスカット";
  plan.targetCashYen = 1200000;
  plan.nextYearTargetCashYen = 3000000;
  plan.memo = "今年は固定客を増やしたい";

  const kgUnit = createKgUnit();
  const boxUnit = { ...createUnit(), name: "箱", label: "1箱", weightKg: 5 };
  const bunchUnit = { ...createUnit(), name: "房", label: "1房", weightKg: 0.55 };
  const units = [kgUnit, boxUnit, bunchUnit];

  const harvests: Harvest[] = [
    { ...createHarvest(plan.id, boxUnit.id), name: "第1収穫分", quantity: 5 },
    { ...createHarvest(plan.id, bunchUnit.id), name: "第2収穫分", quantity: 120 },
    { ...createHarvest(plan.id, kgUnit.id), name: "業務用分", quantity: 80 }
  ];

  const products: Product[] = [
    {
      ...createProduct(plan.id, kgUnit.id),
      name: "2kg箱",
      category: "premium",
      contentQuantity: 2,
      salesUnitLabel: "箱",
      priceYen: 4200,
      packageCostYen: 250,
      shippingCostYen: 900,
      feeYen: 150
    },
    {
      ...createProduct(plan.id, kgUnit.id),
      name: "500g袋",
      category: "trial",
      contentQuantity: 0.5,
      salesUnitLabel: "袋",
      priceYen: 800,
      packageCostYen: 30
    },
    {
      ...createProduct(plan.id, bunchUnit.id),
      name: "3房入り箱",
      category: "standard",
      contentQuantity: 3,
      salesUnitLabel: "箱",
      priceYen: 3600,
      packageCostYen: 250,
      shippingCostYen: 900,
      feeYen: 150
    },
    {
      ...createProduct(plan.id, kgUnit.id),
      name: "訳あり1kg袋",
      category: "b_grade",
      contentQuantity: 1,
      salesUnitLabel: "袋",
      priceYen: 1000,
      packageCostYen: 30
    }
  ];

  const trials: Trial[] = [
    { ...createTrial(plan.id, products[0].id), inputMode: "count", count: 20 },
    {
      ...createTrial(plan.id, products[1].id),
      inputMode: "weight",
      inputWeightKg: 30
    },
    { ...createTrial(plan.id, products[2].id), inputMode: "count", count: 10 }
  ];

  return { plan, units, harvests, products, trials };
}
