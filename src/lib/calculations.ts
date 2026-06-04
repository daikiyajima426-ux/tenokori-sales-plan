import type { Harvest, Plan, Product, Trial, Unit } from "@/types/domain";

const safeNumber = (value: number | undefined | null) =>
  Number.isFinite(value) ? Number(value) : 0;

const safeDivide = (a: number, b: number) => (b > 0 ? a / b : 0);

const roundUpOneDecimal = (value: number) => Math.ceil(value * 10) / 10;

type Judgment =
  | "target_missing"
  | "enough"
  | "almost"
  | "short"
  | "very_short"
  | "negative";

function getJudgment(totalMoneyLeftYen: number, targetCashYen: number): {
  judgment: Judgment;
  judgmentLabel: string;
} {
  if (totalMoneyLeftYen < 0) {
    return {
      judgment: "negative",
      judgmentLabel: "赤字の可能性があります"
    };
  }
  if (targetCashYen <= 0) {
    return {
      judgment: "target_missing",
      judgmentLabel: "今年残したいお金を入れると届き具合が見えます"
    };
  }

  const achievementRate = totalMoneyLeftYen / targetCashYen;
  if (achievementRate >= 1) {
    return { judgment: "enough", judgmentLabel: "目標達成できそうです" };
  }
  if (achievementRate >= 0.8) {
    return { judgment: "almost", judgmentLabel: "あと少しで届きそうです" };
  }
  if (achievementRate >= 0.5) {
    return { judgment: "short", judgmentLabel: "まだ不足があります" };
  }
  return { judgment: "very_short", judgmentLabel: "大きく見直しが必要です" };
}

export function calculateUnitQuantityKg(quantity: number, unit?: Unit) {
  return safeNumber(quantity) * safeNumber(unit?.weightKg);
}

export function calculateHarvest(harvest: Harvest, unit?: Unit) {
  return {
    convertedKg: calculateUnitQuantityKg(harvest.quantity, unit),
    missingUnitWeight: !unit || safeNumber(unit.weightKg) <= 0
  };
}

export function calculateProduct(product: Product, unit?: Unit) {
  const contentQuantity = safeNumber(product.contentQuantity);
  const contentKg = contentQuantity * safeNumber(unit?.weightKg);
  const costYen =
    safeNumber(product.packageCostYen) +
    safeNumber(product.shippingCostYen) +
    safeNumber(product.feeYen) +
    safeNumber(product.otherCostYen);
  const moneyLeftYen = safeNumber(product.priceYen) - costYen;

  return {
    contentKg,
    costYen,
    moneyLeftYen,
    kgMoneyLeftYen: safeDivide(moneyLeftYen, contentKg),
    warnings: {
      missingContent: contentKg <= 0,
      missingPrice: safeNumber(product.priceYen) <= 0,
      negativeMoneyLeft: moneyLeftYen < 0
    }
  };
}

export function calculateTrial(trial: Trial, product?: Product, unit?: Unit) {
  if (!product) {
    return {
      count: 0,
      inputWeightKg: safeNumber(trial.inputWeightKg),
      usedKg: 0,
      remainderKg: 0,
      salesTotalYen: 0,
      moneyLeftTotalYen: 0,
      hasRemainder: false
    };
  }

  const productResult = calculateProduct(product, unit);
  const contentKg = productResult.contentKg;
  const count =
    trial.inputMode === "weight"
      ? Math.floor(safeDivide(safeNumber(trial.inputWeightKg), contentKg))
      : safeNumber(trial.count);
  const usedKg = count * contentKg;
  const inputWeightKg =
    trial.inputMode === "weight" ? safeNumber(trial.inputWeightKg) : usedKg;
  const remainderKg =
    trial.inputMode === "weight" ? Math.max(0, inputWeightKg - usedKg) : 0;

  return {
    count,
    inputWeightKg,
    usedKg,
    remainderKg,
    salesTotalYen: count * safeNumber(product.priceYen),
    moneyLeftTotalYen: count * productResult.moneyLeftYen,
    hasRemainder: remainderKg > 0
  };
}

export function calculateSummary(
  plan: Plan,
  units: Unit[],
  harvests: Harvest[],
  products: Product[],
  trials: Trial[]
) {
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const harvestResults = harvests.map((harvest) => ({
    harvest,
    unit: unitMap.get(harvest.unitId),
    result: calculateHarvest(harvest, unitMap.get(harvest.unitId))
  }));
  const productResults = products.map((product) => ({
    product,
    unit: unitMap.get(product.contentUnitId),
    result: calculateProduct(product, unitMap.get(product.contentUnitId))
  }));
  const trialResults = trials.map((trial) => {
    const product = productMap.get(trial.productId);
    return {
      trial,
      product,
      unit: product ? unitMap.get(product.contentUnitId) : undefined,
      result: calculateTrial(
        trial,
        product,
        product ? unitMap.get(product.contentUnitId) : undefined
      )
    };
  });

  const harvestTotalKg = harvestResults.reduce(
    (sum, row) => sum + row.result.convertedKg,
    0
  );
  const decidedKg = trialResults.reduce((sum, row) => sum + row.result.usedKg, 0);
  const undecidedKg = harvestTotalKg - decidedKg;
  const totalSalesYen = trialResults.reduce(
    (sum, row) => sum + row.result.salesTotalYen,
    0
  );
  const totalMoneyLeftYen = trialResults.reduce(
    (sum, row) => sum + row.result.moneyLeftTotalYen,
    0
  );
  const targetCashYen = safeNumber(plan.targetCashYen);
  const totalCostYen = totalSalesYen - totalMoneyLeftYen;
  const currentAveragePricePerKg = safeDivide(totalSalesYen, decidedKg);
  const currentAverageCostPerKg = safeDivide(totalCostYen, decidedKg);
  const currentAverageMoneyLeftPerKg = safeDivide(totalMoneyLeftYen, decidedKg);
  const achievementRate =
    targetCashYen > 0 ? safeDivide(totalMoneyLeftYen, targetCashYen) : null;
  const shortageYen = Math.max(0, targetCashYen - totalMoneyLeftYen);
  const requiredSalesKg =
    targetCashYen > 0 && currentAverageMoneyLeftPerKg > 0
      ? roundUpOneDecimal(targetCashYen / currentAverageMoneyLeftPerKg)
      : null;
  const additionalRequiredKg =
    requiredSalesKg !== null ? Math.max(0, requiredSalesKg - decidedKg) : null;
  const requiredPricePerKg =
    targetCashYen > 0 && decidedKg > 0
      ? Math.ceil(targetCashYen / decidedKg + currentAverageCostPerKg)
      : null;
  const additionalRequiredPricePerKg =
    requiredPricePerKg !== null
      ? Math.max(0, requiredPricePerKg - currentAveragePricePerKg)
      : null;
  const { judgment, judgmentLabel } = getJudgment(
    totalMoneyLeftYen,
    targetCashYen
  );

  const nextSteps = [
    targetCashYen <= 0
      ? "まず、今年いくら手元に残したいかを入れてください"
      : "",
    harvestTotalKg <= 0
      ? "どれくらい取れそうかを入れると、使える量が見えます"
      : "",
    products.length === 0
      ? "1袋・1箱・1kgなど、売る単位を決めると値段を試せます"
      : "",
    decidedKg <= 0
      ? "売れる量の見込みがないため、必要な量を逆算できません"
      : "",
    products.some((product) => safeNumber(product.priceYen) <= 0)
      ? "売値を入れると、目標との差が分かります"
      : "",
    products.length > 0 &&
    products.every(
      (product) =>
        safeNumber(product.packageCostYen) +
          safeNumber(product.shippingCostYen) +
          safeNumber(product.feeYen) +
          safeNumber(product.otherCostYen) <=
        0
    )
      ? "費用を入れると、手元に残る金額がより正確になります"
      : "",
    harvestResults.some((row) => row.result.missingUnitWeight) ||
    productResults.some((row) => row.result.warnings.missingContent)
      ? "1つあたりの重さを入れると、kgで比べられます"
      : ""
  ].filter(Boolean);

  return {
    harvestTotalKg,
    decidedKg,
    undecidedKg,
    totalSalesYen,
    totalMoneyLeftYen,
    targetCashYen,
    targetGapYen: totalMoneyLeftYen - targetCashYen,
    shortageYen,
    achievementRate,
    achievementPercent:
      achievementRate === null ? null : Math.round(achievementRate * 100),
    averageKgMoneyLeftYen: safeDivide(totalMoneyLeftYen, decidedKg),
    currentAveragePricePerKg,
    currentAverageCostPerKg,
    currentAverageMoneyLeftPerKg,
    requiredSalesKg,
    additionalRequiredKg,
    requiredPricePerKg,
    additionalRequiredPricePerKg,
    realisticMoneyLeftYen: totalMoneyLeftYen,
    judgment,
    judgmentLabel,
    nextSteps,
    canEstimateRequiredSalesKg:
      targetCashYen > 0 && currentAverageMoneyLeftPerKg > 0,
    canEstimateRequiredPrice: targetCashYen > 0 && decidedKg > 0,
    hasOverDecided: decidedKg > harvestTotalKg,
    hasUndecided: undecidedKg > 0,
    isTargetEnough: totalMoneyLeftYen >= targetCashYen,
    hasNegativeProduct: productResults.some(
      (row) => row.result.warnings.negativeMoneyLeft
    ),
    hasRemainder: trialResults.some((row) => row.result.hasRemainder),
    harvestResults,
    productResults,
    trialResults
  };
}
