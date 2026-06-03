import { SCHEMA_VERSION } from "@/lib/constants";
import type {
  AllocationItem,
  HarvestInput,
  Plan,
  ProductSpec,
  UnitDefinition
} from "@/types/domain";

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
    requiredCashYen: 0,
    memo: "",
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION
  };
}

export function createKgUnit(): UnitDefinition {
  const now = nowIso();
  return {
    id: "unit-kg",
    name: "kg",
    label: "1kg",
    weightKg: 1,
    memo: "標準単位",
    createdAt: now,
    updatedAt: now
  };
}

export function createUnit(): UnitDefinition {
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

export function createHarvest(planId: string, unitId = "unit-kg"): HarvestInput {
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

export function createSpec(planId: string, unitId = "unit-kg"): ProductSpec {
  const now = nowIso();
  return {
    id: createId(),
    planId,
    name: "",
    type: "weight",
    unitId,
    quantityPerSpec: 1,
    salesUnitLabel: "",
    pricePerSpecYen: 0,
    packagingCostPerSpecYen: 0,
    shippingCostPerSpecYen: 0,
    feePerSpecYen: 0,
    otherCostPerSpecYen: 0,
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createAllocation(
  planId: string,
  productSpecId = ""
): AllocationItem {
  const now = nowIso();
  return {
    id: createId(),
    planId,
    productSpecId,
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
  plan.requiredCashYen = 1200000;
  plan.memo = "v0.2.0 サンプルデータ";

  const kgUnit = createKgUnit();
  const boxUnit = { ...createUnit(), name: "箱", label: "1箱", weightKg: 5 };
  const bunchUnit = { ...createUnit(), name: "房", label: "1房", weightKg: 0.55 };
  const caseUnit = {
    ...createUnit(),
    name: "ケース",
    label: "1ケース",
    weightKg: 10
  };
  const units = [kgUnit, boxUnit, bunchUnit, caseUnit];

  const harvests: HarvestInput[] = [
    { ...createHarvest(plan.id, boxUnit.id), name: "第1収穫分", quantity: 5 },
    { ...createHarvest(plan.id, bunchUnit.id), name: "第2収穫分", quantity: 120 },
    { ...createHarvest(plan.id, kgUnit.id), name: "業務用分", quantity: 80 }
  ];

  const specs: ProductSpec[] = [
    {
      ...createSpec(plan.id, kgUnit.id),
      name: "2kg箱",
      type: "weight",
      quantityPerSpec: 2,
      salesUnitLabel: "箱",
      pricePerSpecYen: 4200,
      packagingCostPerSpecYen: 250,
      shippingCostPerSpecYen: 900,
      feePerSpecYen: 150
    },
    {
      ...createSpec(plan.id, kgUnit.id),
      name: "500g袋",
      type: "weight",
      quantityPerSpec: 0.5,
      salesUnitLabel: "袋",
      pricePerSpecYen: 800,
      packagingCostPerSpecYen: 30
    },
    {
      ...createSpec(plan.id, bunchUnit.id),
      name: "3房入り箱",
      type: "unit",
      quantityPerSpec: 3,
      salesUnitLabel: "箱",
      pricePerSpecYen: 3600,
      packagingCostPerSpecYen: 220,
      shippingCostPerSpecYen: 800,
      feePerSpecYen: 120
    },
    {
      ...createSpec(plan.id, kgUnit.id),
      name: "訳あり1kg袋",
      type: "weight",
      quantityPerSpec: 1,
      salesUnitLabel: "袋",
      pricePerSpecYen: 1000,
      packagingCostPerSpecYen: 30
    }
  ];

  const allocations: AllocationItem[] = [
    { ...createAllocation(plan.id, specs[0].id), inputMode: "count", count: 20 },
    {
      ...createAllocation(plan.id, specs[1].id),
      inputMode: "weight",
      inputWeightKg: 30
    },
    { ...createAllocation(plan.id, specs[2].id), inputMode: "count", count: 10 }
  ];

  return { plan, units, harvests, specs, allocations };
}
