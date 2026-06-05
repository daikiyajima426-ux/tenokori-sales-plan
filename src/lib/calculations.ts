import type {
  HarvestCard,
  Plan,
  ProductRole,
  ProductCard,
  SalesPlanCard
} from "@/types/domain";
import { PRODUCT_ROLE_LABELS, PRODUCT_ROLE_ORDER } from "@/lib/constants";

const safeNumber = (value: number | undefined | null) =>
  Number.isFinite(value) ? Number(value) : 0;

const safeDivide = (a: number, b: number) => (b > 0 ? a / b : null);

export function productUnitKg(product?: ProductCard) {
  if (!product) return 0;
  const quantity = safeNumber(product.quantityPerUnit);
  if (quantity <= 0) return 0;
  return product.quantityUnit === "g" ? quantity / 1000 : quantity;
}

export function calculateSalesPlan(
  card: SalesPlanCard,
  harvest?: HarvestCard,
  product?: ProductCard
) {
  const unitKg = productUnitKg(product);
  const plannedUnits = safeNumber(card.plannedUnits);
  const pricePerUnit = safeNumber(card.pricePerUnit);
  const usedKg = unitKg * plannedUnits;
  const salesYen = pricePerUnit * plannedUnits;
  const missing: string[] = [];

  if (!harvest) missing.push(`${card.name}：取れた量が未選択です`);
  if (!product) missing.push(`${card.name}：売る形が未選択です`);
  if (unitKg <= 0) missing.push(`${card.name}：売る形の中身が未入力です`);
  if (pricePerUnit <= 0) missing.push(`${card.name}：売値が未入力です`);
  if (plannedUnits <= 0) missing.push(`${card.name}：販売予定数が未入力です`);

  return {
    card,
    harvest,
    product,
    unitKg,
    usedKg,
    salesYen,
    takeHomeYen: salesYen,
    isValid: missing.length === 0,
    canCheckStock: Boolean(harvest && product && unitKg > 0 && plannedUnits > 0),
    missing
  };
}

function judgmentLabel(totalTakeHomeYen: number, targetCashYen: number) {
  if (targetCashYen <= 0) return "目標を入れると届き具合が見えます";
  if (totalTakeHomeYen >= targetCashYen) return "目標を達成できそうです";
  const rate = totalTakeHomeYen / targetCashYen;
  if (rate >= 0.8) return "あと少しで届きそうです";
  if (rate >= 0.5) return "まだ不足があります";
  return "大きく見直しが必要です";
}

export function calculateSummary(
  plan: Plan,
  harvestCards: HarvestCard[],
  productCards: ProductCard[],
  salesPlanCards: SalesPlanCard[]
) {
  const harvestMap = new Map(harvestCards.map((card) => [card.id, card]));
  const productMap = new Map(productCards.map((card) => [card.id, card]));
  const salesResults = salesPlanCards.map((card) =>
    calculateSalesPlan(
      card,
      card.harvestId ? harvestMap.get(card.harvestId) : undefined,
      card.productId ? productMap.get(card.productId) : undefined
    )
  );
  const validResults = salesResults.filter((row) => row.isValid);
  const totalHarvestKg = harvestCards.reduce(
    (sum, card) => sum + safeNumber(card.amount),
    0
  );
  const totalSalesYen = validResults.reduce((sum, row) => sum + row.salesYen, 0);
  const totalTakeHomeYen = validResults.reduce(
    (sum, row) => sum + row.takeHomeYen,
    0
  );
  const targetCashYen = safeNumber(plan.targetCashYen);
  const targetGapYen = totalTakeHomeYen - targetCashYen;
  const shortageYen = Math.max(0, targetCashYen - totalTakeHomeYen);
  const achievementRate = targetCashYen > 0 ? totalTakeHomeYen / targetCashYen : null;
  const stockCheckResults = salesResults.filter((row) => row.canCheckStock);
  const totalUsedKg = stockCheckResults.reduce((sum, row) => sum + row.usedKg, 0);
  const totalOverKg = Math.max(0, totalUsedKg - totalHarvestKg);

  const harvestUsage = harvestCards.map((harvest) => {
    const usedKg = stockCheckResults
      .filter((row) => row.card.harvestId === harvest.id)
      .reduce((sum, row) => sum + row.usedKg, 0);
    const overKg = Math.max(0, usedKg - safeNumber(harvest.amount));
    return { harvest, usedKg, overKg, hasOver: overKg > 0 };
  });

  const unlinkedUsedKg = stockCheckResults
    .filter((row) => !row.card.harvestId || !row.harvest)
    .reduce((sum, row) => sum + row.usedKg, 0);
  const stockWarnings = harvestUsage
    .filter((row) => row.hasOver)
    .map(
      (row) =>
        `${row.harvest.name || "取れた量"}の販売予定量が、取れた量を${round(row.overKg)}kg上回っています。売る量を減らすか、取れた量を見直してください。`
    );
  const globalStockWarnings =
    totalOverKg > 0
      ? [`販売予定量の合計が、取れた量の合計を${round(totalOverKg)}kg上回っています。売る量を減らすか、取れた量を見直してください。`]
      : [];
  const allStockWarnings = [...stockWarnings, ...globalStockWarnings];
  const targetWarnings =
    targetCashYen > 0 && shortageYen > 0
      ? [`今の販売計画では、目標まで${shortageYen.toLocaleString("ja-JP")}円足りません。`]
      : [];
  const dataWarnings =
    validResults.length > 0
      ? ["現時点では費用を引く前の金額です。包装費・送料・手数料などはまだ反映していません。"]
      : [];
  const roleOf = (card: SalesPlanCard): ProductRole => card.productRole ?? "unset";
  const compositionRows = PRODUCT_ROLE_ORDER.map((role) => {
    const roleResults = salesResults.filter((row) => roleOf(row.card) === role);
    const roleValidResults = validResults.filter((row) => roleOf(row.card) === role);
    const salesYen = roleValidResults.reduce((sum, row) => sum + row.salesYen, 0);
    return {
      role,
      label: PRODUCT_ROLE_LABELS[role],
      count: roleResults.length,
      validCount: roleValidResults.length,
      salesYen,
      plannedUnits: roleResults.reduce((sum, row) => sum + safeNumber(row.card.plannedUnits), 0),
      usedKg: roleResults.reduce((sum, row) => sum + row.usedKg, 0),
      salesShare: safeDivide(salesYen, totalSalesYen)
    };
  });
  const roleCounts = new Map<ProductRole, number>(
    PRODUCT_ROLE_ORDER.map((role) => [
      role,
      salesResults.filter((row) => roleOf(row.card) === role).length
    ])
  );
  const validRoleCounts = new Map<ProductRole, number>(
    PRODUCT_ROLE_ORDER.map((role) => [
      role,
      validResults.filter((row) => roleOf(row.card) === role).length
    ])
  );
  const hasSalesPlans = salesResults.length > 0;
  const entryValidCount = validRoleCounts.get("entry") ?? 0;
  const profitValidCount = validRoleCounts.get("profit") ?? 0;
  const compositionWarnings = [
    hasSalesPlans && (roleCounts.get("entry") ?? 0) === 0
      ? "初めて買う人向けの商品がありません。少量・低価格のお試し商品があると、買う不安を下げやすくなります。"
      : "",
    hasSalesPlans && (roleCounts.get("profit") ?? 0) === 0
      ? "利益を作る商品がありません。買いやすい商品だけだと、販売数が増えても手元に残りにくい可能性があります。"
      : "",
    hasSalesPlans && (roleCounts.get("brand") ?? 0) === 0
      ? "品質や印象を作る商品がありません。高品質品・贈答品・見せたい商品を用意すると、ブランドの入口を作りやすくなります。"
      : "",
    hasSalesPlans && (roleCounts.get("lossReduction") ?? 0) === 0
      ? "規格外や余りの出口になる商品がありません。訳あり品や加工向けの商品があると、ロスを減らせる可能性があります。"
      : "",
    hasSalesPlans && (roleCounts.get("unset") ?? 0) > 0
      ? "役割が未設定の販売計画があります。この商品が入口・日常・利益・ブランド・ロス削減のどれに近いかを決めると、販売計画を見直しやすくなります。"
      : "",
    validResults.length > 0 &&
    entryValidCount >= Math.ceil(validResults.length / 2) &&
    profitValidCount === 0
      ? "入口商品に偏っています。買いやすさはありますが、利益を作る商品も用意しないと手元に残りにくい可能性があります。"
      : ""
  ].filter(Boolean);

  const missingItems = [
    targetCashYen <= 0 ? "目標：今年いくら手元に残したいかを入れてください。" : "",
    harvestCards.length === 0 ? "取れた量：売れそうな量を入れてください。" : "",
    productCards.length === 0
      ? "売る形：1袋・1箱・1kgなどの売る単位を決めてください。"
      : "",
    salesPlanCards.length === 0 ? "販売計画：売り方をカードで追加してください。" : "",
    ...salesResults.flatMap((row) => row.missing),
    unlinkedUsedKg > 0
      ? "取れた量未選択の販売計画があります。必要なら取れた量カードとつないでください。"
      : ""
  ].filter(Boolean);

  return {
    totalHarvestKg,
    totalUsedKg,
    totalUnusedKg: totalHarvestKg - totalUsedKg,
    totalSalesYen,
    totalTakeHomeYen,
    targetCashYen,
    targetGapYen,
    shortageYen,
    achievementRate,
    achievementPercent:
      achievementRate === null ? null : Math.round(achievementRate * 100),
    judgmentLabel: judgmentLabel(totalTakeHomeYen, targetCashYen),
    isTargetEnough: targetCashYen > 0 && totalTakeHomeYen >= targetCashYen,
    salesResults,
    validResults,
    harvestUsage,
    stockWarnings: allStockWarnings,
    harvestStockWarnings: stockWarnings,
    globalStockWarnings,
    targetWarnings,
    compositionRows,
    compositionWarnings,
    hypothesisWarnings: missingItems,
    dataWarnings,
    missingItems,
    hasMissingItems: missingItems.length > 0,
    hasStockWarnings: allStockWarnings.length > 0,
    hasOverDecided: totalOverKg > 0
  };
}

export const round = (value: number) => Math.round(value * 10) / 10;

export function formatProductAmount(product?: ProductCard) {
  if (!product) return "未入力";
  const quantity = safeNumber(product.quantityPerUnit);
  if (quantity <= 0) return "未入力";
  return `${quantity.toLocaleString("ja-JP")}${product.quantityUnit}`;
}

export function requiredPricePerUnit(
  targetCashYen: number,
  plannedUnits: number
) {
  const result = safeDivide(targetCashYen, plannedUnits);
  return result === null ? null : Math.ceil(result);
}

export function referencePriceForSalesPlan(
  targetCashYen: number,
  plannedUnits: number,
  otherCardsSalesYen: number
) {
  const target = safeNumber(targetCashYen);
  const units = safeNumber(plannedUnits);
  if (target <= 0 || units <= 0) return null;
  const neededSales = Math.max(0, target - safeNumber(otherCardsSalesYen));
  return Math.ceil(neededSales / units);
}

export function priceSliderMax() {
  return 1000;
}

export function priceSliderPriceMax() {
  return 100000;
}

export function sliderValueToPrice(sliderValue: number) {
  const value = Math.min(1000, Math.max(0, Math.round(safeNumber(sliderValue))));
  if (value <= 500) {
    return Math.round(((value / 500) * 1000) / 10) * 10;
  }
  if (value <= 750) {
    return 1000 + Math.round((((value - 500) / 250) * 9000) / 100) * 100;
  }
  if (value <= 900) {
    return 10000 + Math.round((((value - 750) / 150) * 20000) / 1000) * 1000;
  }
  return 30000 + Math.round((((value - 900) / 100) * 70000) / 10000) * 10000;
}

export function priceToSliderValue(pricePerUnit: number) {
  const price = Math.min(100000, Math.max(0, safeNumber(pricePerUnit)));
  if (price <= 1000) {
    return Math.round((price / 1000) * 500);
  }
  if (price <= 10000) {
    return Math.round(500 + ((price - 1000) / 9000) * 250);
  }
  if (price <= 30000) {
    return Math.round(750 + ((price - 10000) / 20000) * 150);
  }
  return Math.round(900 + ((price - 30000) / 70000) * 100);
}
