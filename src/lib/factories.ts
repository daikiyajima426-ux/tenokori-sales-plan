import { SCHEMA_VERSION } from "@/lib/constants";
import type { Plan, SalesMethod, SalesPlanItem } from "@/types/domain";

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
    expectedYieldKg: 0,
    nonSaleKg: 0,
    saleableKg: 0,
    requiredCashYen: 0,
    memo: "",
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION
  };
}

export function createMethod(planId: string): SalesMethod {
  const now = nowIso();
  return {
    id: createId(),
    planId,
    name: "",
    channel: "direct",
    unit: "kg",
    unitLabel: "kg",
    weightPerUnitKg: 1,
    pricePerUnitYen: 0,
    packagingCostPerUnitYen: 0,
    shippingCostPerUnitYen: 0,
    feePerUnitYen: 0,
    otherCostPerUnitYen: 0,
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createItem(planId: string, salesMethodId = ""): SalesPlanItem {
  const now = nowIso();
  return {
    id: createId(),
    planId,
    salesMethodId,
    quantity: 0,
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createSampleData() {
  const plan = createEmptyPlan();
  plan.cropName = "ぶどう";
  plan.varietyName = "シャインマスカット";
  plan.expectedYieldKg = 1000;
  plan.nonSaleKg = 100;
  plan.saleableKg = 900;
  plan.requiredCashYen = 1200000;
  plan.memo = "v0.1 サンプルデータ";

  const methodInputs = [
    ["直売袋売り", "direct", "bag", "袋", 0.5, 800, 30, 0, 0, 0],
    ["贈答2kg箱", "gift", "box", "箱", 2, 4200, 250, 900, 150, 0],
    ["業務用kg売り", "wholesale", "kg", "kg", 1, 1200, 20, 0, 0, 0],
    ["訳あり袋売り", "b_grade", "bag", "袋", 0.7, 700, 30, 0, 0, 0]
  ] as const;

  const methods: SalesMethod[] = methodInputs.map((row) => {
    const method = createMethod(plan.id);
    method.name = row[0];
    method.channel = row[1];
    method.unit = row[2];
    method.unitLabel = row[3];
    method.weightPerUnitKg = row[4];
    method.pricePerUnitYen = row[5];
    method.packagingCostPerUnitYen = row[6];
    method.shippingCostPerUnitYen = row[7];
    method.feePerUnitYen = row[8];
    method.otherCostPerUnitYen = row[9];
    return method;
  });

  const quantities = [300, 100, 200, 100];
  const items: SalesPlanItem[] = methods.map((method, index) => {
    const item = createItem(plan.id, method.id);
    item.quantity = quantities[index];
    return item;
  });

  return { plan, methods, items };
}

