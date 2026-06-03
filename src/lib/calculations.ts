import type {
  AllocationItem,
  HarvestInput,
  Plan,
  ProductSpec,
  UnitDefinition
} from "@/types/domain";

const safeNumber = (value: number | undefined | null) =>
  Number.isFinite(value) ? Number(value) : 0;

const safeDivide = (a: number, b: number) => (b > 0 ? a / b : 0);

export function calculateUnitQuantityKg(
  quantity: number,
  unit?: UnitDefinition
) {
  return safeNumber(quantity) * safeNumber(unit?.weightKg);
}

export function calculateHarvest(harvest: HarvestInput, unit?: UnitDefinition) {
  return {
    convertedKg: calculateUnitQuantityKg(harvest.quantity, unit),
    missingUnitWeight: !unit || safeNumber(unit.weightKg) <= 0
  };
}

export function calculateSpec(spec: ProductSpec, unit?: UnitDefinition) {
  const quantityPerSpec = safeNumber(spec.quantityPerSpec);
  const usageKg =
    spec.type === "weight"
      ? quantityPerSpec
      : quantityPerSpec * safeNumber(unit?.weightKg);
  const costPerSpecYen =
    safeNumber(spec.packagingCostPerSpecYen) +
    safeNumber(spec.shippingCostPerSpecYen) +
    safeNumber(spec.feePerSpecYen) +
    safeNumber(spec.otherCostPerSpecYen);
  const netPerSpecYen = safeNumber(spec.pricePerSpecYen) - costPerSpecYen;

  return {
    usageKg,
    costPerSpecYen,
    netPerSpecYen,
    kgNetYen: safeDivide(netPerSpecYen, usageKg),
    warnings: {
      missingUsage: usageKg <= 0,
      missingPrice: safeNumber(spec.pricePerSpecYen) <= 0,
      negativeNet: netPerSpecYen < 0
    }
  };
}

export function calculateAllocation(
  allocation: AllocationItem,
  spec?: ProductSpec,
  unit?: UnitDefinition
) {
  if (!spec) {
    return {
      count: 0,
      inputWeightKg: safeNumber(allocation.inputWeightKg),
      usedKg: 0,
      remainderKg: 0,
      salesTotalYen: 0,
      netTotalYen: 0,
      hasRemainder: false
    };
  }

  const specResult = calculateSpec(spec, unit);
  const usageKg = specResult.usageKg;
  const count =
    allocation.inputMode === "weight"
      ? Math.floor(safeDivide(safeNumber(allocation.inputWeightKg), usageKg))
      : safeNumber(allocation.count);
  const usedKg = count * usageKg;
  const inputWeightKg =
    allocation.inputMode === "weight"
      ? safeNumber(allocation.inputWeightKg)
      : usedKg;
  const remainderKg =
    allocation.inputMode === "weight" ? Math.max(0, inputWeightKg - usedKg) : 0;

  return {
    count,
    inputWeightKg,
    usedKg,
    remainderKg,
    salesTotalYen: count * safeNumber(spec.pricePerSpecYen),
    netTotalYen: count * specResult.netPerSpecYen,
    hasRemainder: remainderKg > 0
  };
}

export function calculateSummary(
  plan: Plan,
  units: UnitDefinition[],
  harvests: HarvestInput[],
  specs: ProductSpec[],
  allocations: AllocationItem[]
) {
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const specMap = new Map(specs.map((spec) => [spec.id, spec]));
  const harvestResults = harvests.map((harvest) => ({
    harvest,
    unit: unitMap.get(harvest.unitId),
    result: calculateHarvest(harvest, unitMap.get(harvest.unitId))
  }));
  const specResults = specs.map((spec) => ({
    spec,
    unit: unitMap.get(spec.unitId),
    result: calculateSpec(spec, unitMap.get(spec.unitId))
  }));
  const allocationResults = allocations.map((allocation) => {
    const spec = specMap.get(allocation.productSpecId);
    return {
      allocation,
      spec,
      unit: spec ? unitMap.get(spec.unitId) : undefined,
      result: calculateAllocation(
        allocation,
        spec,
        spec ? unitMap.get(spec.unitId) : undefined
      )
    };
  });

  const harvestTotalKg = harvestResults.reduce(
    (sum, row) => sum + row.result.convertedKg,
    0
  );
  const productizedKg = allocationResults.reduce(
    (sum, row) => sum + row.result.usedKg,
    0
  );
  const unproductizedKg = harvestTotalKg - productizedKg;
  const totalSalesYen = allocationResults.reduce(
    (sum, row) => sum + row.result.salesTotalYen,
    0
  );
  const totalNetYen = allocationResults.reduce(
    (sum, row) => sum + row.result.netTotalYen,
    0
  );

  return {
    harvestTotalKg,
    productizedKg,
    unproductizedKg,
    totalSalesYen,
    totalNetYen,
    requiredCashYen: safeNumber(plan.requiredCashYen),
    requiredCashGapYen: totalNetYen - safeNumber(plan.requiredCashYen),
    averageKgNetYen: safeDivide(totalNetYen, productizedKg),
    hasOverProductized: productizedKg > harvestTotalKg,
    hasUnproductized: unproductizedKg > 0,
    isCashEnough: totalNetYen >= safeNumber(plan.requiredCashYen),
    hasNegativeSpec: specResults.some((row) => row.result.warnings.negativeNet),
    hasRemainder: allocationResults.some((row) => row.result.hasRemainder),
    harvestResults,
    specResults,
    allocationResults
  };
}
