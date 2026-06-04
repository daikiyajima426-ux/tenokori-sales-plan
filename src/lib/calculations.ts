import type { Harvest, Plan, Product, Trial, Unit } from "@/types/domain";

const safeNumber = (value: number | undefined | null) =>
  Number.isFinite(value) ? Number(value) : 0;

const safeDivide = (a: number, b: number) => (b > 0 ? a / b : 0);

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

  return {
    harvestTotalKg,
    decidedKg,
    undecidedKg,
    totalSalesYen,
    totalMoneyLeftYen,
    targetCashYen,
    targetGapYen: totalMoneyLeftYen - targetCashYen,
    averageKgMoneyLeftYen: safeDivide(totalMoneyLeftYen, decidedKg),
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
