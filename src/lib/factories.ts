import { SCHEMA_VERSION } from "@/lib/constants";
import type {
  AppData,
  HarvestCard,
  Plan,
  ProductCard,
  SalesPlanCard,
  Settings
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
    targetCashYen: 0,
    nextYearTargetCashYen: 0,
    memo: "",
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };
}

export function createHarvestCard(index: number): HarvestCard {
  const now = nowIso();
  return {
    id: createId(),
    name: `取れた量${index}`,
    amount: 0,
    unit: "kg",
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createProductCard(index: number): ProductCard {
  const now = nowIso();
  return {
    id: createId(),
    name: `売る形${index}`,
    unitName: "袋",
    quantityPerUnit: 0,
    quantityUnit: "g",
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function createSalesPlanCard(index: number): SalesPlanCard {
  const now = nowIso();
  return {
    id: createId(),
    name: `販売計画${index}`,
    harvestId: undefined,
    productId: undefined,
    pricePerUnit: 0,
    plannedUnits: 0,
    memo: "",
    createdAt: now,
    updatedAt: now
  };
}

export function duplicateHarvestCard(card: HarvestCard, index: number): HarvestCard {
  const now = nowIso();
  return {
    ...card,
    id: createId(),
    name: card.name ? `${card.name} コピー` : `取れた量${index}`,
    createdAt: now,
    updatedAt: now
  };
}

export function duplicateProductCard(card: ProductCard, index: number): ProductCard {
  const now = nowIso();
  return {
    ...card,
    id: createId(),
    name: card.name ? `${card.name} コピー` : `売る形${index}`,
    createdAt: now,
    updatedAt: now
  };
}

export function duplicateSalesPlanCard(
  card: SalesPlanCard,
  index: number
): SalesPlanCard {
  const now = nowIso();
  return {
    ...card,
    id: createId(),
    name: card.name ? `${card.name} コピー` : `販売計画${index}`,
    createdAt: now,
    updatedAt: now
  };
}

export function createDefaultSettings(): Settings {
  return { activeTab: "intro", hasSeenIntro: false };
}

export function createSampleData(): AppData {
  const plan = createEmptyPlan();
  plan.cropName = "ぶどう";
  plan.varietyName = "シャインマスカット";
  plan.targetCashYen = 1200000;
  plan.nextYearTargetCashYen = 3000000;
  plan.memo = "複数の売り方で目標に近づける";

  const harvestCards: HarvestCard[] = [
    { ...createHarvestCard(1), name: "通常品", amount: 120 },
    { ...createHarvestCard(2), name: "規格外", amount: 20 },
    { ...createHarvestCard(3), name: "加工向け", amount: 15 }
  ];

  const productCards: ProductCard[] = [
    {
      ...createProductCard(1),
      name: "直売所用",
      unitName: "袋",
      quantityPerUnit: 300,
      quantityUnit: "g"
    },
    {
      ...createProductCard(2),
      name: "飲食店用",
      unitName: "箱",
      quantityPerUnit: 2,
      quantityUnit: "kg"
    },
    {
      ...createProductCard(3),
      name: "規格外まとめ売り",
      unitName: "kg",
      quantityPerUnit: 1,
      quantityUnit: "kg"
    }
  ];

  const salesPlanCards: SalesPlanCard[] = [
    {
      ...createSalesPlanCard(1),
      name: "直売所で袋売り",
      harvestId: harvestCards[0].id,
      productId: productCards[0].id,
      pricePerUnit: 500,
      plannedUnits: 200
    },
    {
      ...createSalesPlanCard(2),
      name: "飲食店向け箱売り",
      harvestId: harvestCards[0].id,
      productId: productCards[1].id,
      pricePerUnit: 2000,
      plannedUnits: 30
    },
    {
      ...createSalesPlanCard(3),
      name: "規格外まとめ売り",
      harvestId: harvestCards[1].id,
      productId: productCards[2].id,
      pricePerUnit: 250,
      plannedUnits: 20
    }
  ];

  return {
    schemaVersion: 5,
    plan,
    harvestCards,
    productCards,
    salesPlanCards,
    settings: createDefaultSettings()
  };
}
