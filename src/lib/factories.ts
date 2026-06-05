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
    productRole: "unset",
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
  return {
    activeTab: "intro",
    hasSeenIntro: false,
    showPolicyAllocation: false,
    selectedSalesPolicy: "balanced"
  };
}

export function createSampleData(): AppData {
  const plan = createEmptyPlan();
  plan.cropName = "ぶどう";
  plan.varietyName = "シャインマスカット";
  plan.targetCashYen = 1000000;
  plan.nextYearTargetCashYen = 3000000;
  plan.memo = "複数の役割の商品で目標に近づける";

  const harvestCards: HarvestCard[] = [
    { ...createHarvestCard(1), name: "通常品", amount: 210 },
    { ...createHarvestCard(2), name: "規格外", amount: 25 },
    { ...createHarvestCard(3), name: "加工向け", amount: 15 }
  ];

  const productCards: ProductCard[] = [
    {
      ...createProductCard(1),
      name: "少量お試し",
      unitName: "袋",
      quantityPerUnit: 250,
      quantityUnit: "g"
    },
    {
      ...createProductCard(2),
      name: "通常パック",
      unitName: "袋",
      quantityPerUnit: 350,
      quantityUnit: "g"
    },
    {
      ...createProductCard(3),
      name: "贈答用",
      unitName: "箱",
      quantityPerUnit: 2,
      quantityUnit: "kg"
    },
    {
      ...createProductCard(4),
      name: "規格外まとめ売り",
      unitName: "kg",
      quantityPerUnit: 1,
      quantityUnit: "kg"
    },
    {
      ...createProductCard(5),
      name: "高単価セット",
      unitName: "セット",
      quantityPerUnit: 3,
      quantityUnit: "kg"
    }
  ];

  const salesPlanCards: SalesPlanCard[] = [
    {
      ...createSalesPlanCard(1),
      name: "初回お試し袋",
      harvestId: harvestCards[0].id,
      productId: productCards[0].id,
      productRole: "entry",
      pricePerUnit: 900,
      plannedUnits: 100
    },
    {
      ...createSalesPlanCard(2),
      name: "直売所の通常パック",
      harvestId: harvestCards[0].id,
      productId: productCards[1].id,
      productRole: "daily",
      pricePerUnit: 1800,
      plannedUnits: 180
    },
    {
      ...createSalesPlanCard(3),
      name: "贈答向け箱売り",
      harvestId: harvestCards[0].id,
      productId: productCards[2].id,
      productRole: "brand",
      pricePerUnit: 11000,
      plannedUnits: 35
    },
    {
      ...createSalesPlanCard(4),
      name: "規格外まとめ売り",
      harvestId: harvestCards[1].id,
      productId: productCards[3].id,
      productRole: "lossReduction",
      pricePerUnit: 900,
      plannedUnits: 20
    },
    {
      ...createSalesPlanCard(5),
      name: "高単価セット販売",
      harvestId: harvestCards[0].id,
      productId: productCards[4].id,
      productRole: "profit",
      pricePerUnit: 18000,
      plannedUnits: 10
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

export function createWarningSampleData(): AppData {
  const sample = createSampleData();
  return {
    ...sample,
    salesPlanCards: sample.salesPlanCards.map((card, index) =>
      index === 0
        ? {
            ...card,
            name: "初回お試し袋（多め）",
            productRole: "entry",
            plannedUnits: 500
          }
        : index === 1 || index === 2 || index === 4
          ? {
              ...card,
              productRole: "entry"
            }
          : index === 3
            ? {
                ...card,
                productRole: "unset"
              }
            : card
    )
  };
}
