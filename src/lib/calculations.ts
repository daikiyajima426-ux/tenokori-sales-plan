import type {
  HarvestCard,
  Plan,
  ProductCard,
  SalesPlanCard
} from "@/types/domain";

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
  const totalUsedKg = validResults.reduce((sum, row) => sum + row.usedKg, 0);
  const totalSalesYen = validResults.reduce((sum, row) => sum + row.salesYen, 0);
  const totalTakeHomeYen = validResults.reduce(
    (sum, row) => sum + row.takeHomeYen,
    0
  );
  const targetCashYen = safeNumber(plan.targetCashYen);
  const targetGapYen = totalTakeHomeYen - targetCashYen;
  const shortageYen = Math.max(0, targetCashYen - totalTakeHomeYen);
  const achievementRate = targetCashYen > 0 ? totalTakeHomeYen / targetCashYen : null;

  const harvestUsage = harvestCards.map((harvest) => {
    const usedKg = validResults
      .filter((row) => row.card.harvestId === harvest.id)
      .reduce((sum, row) => sum + row.usedKg, 0);
    const overKg = Math.max(0, usedKg - safeNumber(harvest.amount));
    return { harvest, usedKg, overKg, hasOver: overKg > 0 };
  });

  const unlinkedUsedKg = validResults
    .filter((row) => !row.card.harvestId)
    .reduce((sum, row) => sum + row.usedKg, 0);
  const stockWarnings = harvestUsage
    .filter((row) => row.hasOver)
    .map(
      (row) =>
        `${row.harvest.name || "取れた量"}の販売予定量が、取れた量を${round(row.overKg)}kg上回っています。売る量を減らすか、取れた量を見直してください。`
    );

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
    stockWarnings,
    missingItems,
    hasMissingItems: missingItems.length > 0,
    hasStockWarnings: stockWarnings.length > 0
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
