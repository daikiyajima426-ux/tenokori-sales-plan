import type { Plan, SalesMethod, SalesPlanItem } from "@/types/domain";

const safeNumber = (value: number | undefined | null) =>
  Number.isFinite(value) ? Number(value) : 0;

const safeDivide = (a: number, b: number) => (b > 0 ? a / b : 0);

export function calculateSaleableKg(expectedYieldKg: number, nonSaleKg: number) {
  return Math.max(0, safeNumber(expectedYieldKg) - safeNumber(nonSaleKg));
}

export function calculateMethod(method: SalesMethod) {
  const weightPerUnitKg = safeNumber(method.weightPerUnitKg);
  const pricePerUnitYen = safeNumber(method.pricePerUnitYen);
  const costPerUnitYen =
    safeNumber(method.packagingCostPerUnitYen) +
    safeNumber(method.shippingCostPerUnitYen) +
    safeNumber(method.feePerUnitYen) +
    safeNumber(method.otherCostPerUnitYen);
  const netPerUnitYen = pricePerUnitYen - costPerUnitYen;

  return {
    kgPriceYen: safeDivide(pricePerUnitYen, weightPerUnitKg),
    costPerUnitYen,
    netPerUnitYen,
    kgNetYen: safeDivide(netPerUnitYen, weightPerUnitKg),
    warnings: {
      missingWeight: weightPerUnitKg <= 0,
      missingPrice: pricePerUnitYen <= 0,
      negativeNet: netPerUnitYen < 0
    }
  };
}

export function calculateItem(item: SalesPlanItem, method?: SalesMethod) {
  if (!method) {
    return {
      convertedKg: 0,
      salesTotalYen: 0,
      netTotalYen: 0
    };
  }

  const methodResult = calculateMethod(method);
  const quantity = safeNumber(item.quantity);

  return {
    convertedKg: quantity * safeNumber(method.weightPerUnitKg),
    salesTotalYen: quantity * safeNumber(method.pricePerUnitYen),
    netTotalYen: quantity * methodResult.netPerUnitYen
  };
}

export function calculateSummary(
  plan: Plan,
  methods: SalesMethod[],
  items: SalesPlanItem[]
) {
  const methodMap = new Map(methods.map((method) => [method.id, method]));
  const itemResults = items.map((item) => ({
    item,
    method: methodMap.get(item.salesMethodId),
    result: calculateItem(item, methodMap.get(item.salesMethodId))
  }));

  const allocatedKg = itemResults.reduce(
    (sum, row) => sum + row.result.convertedKg,
    0
  );
  const totalSalesYen = itemResults.reduce(
    (sum, row) => sum + row.result.salesTotalYen,
    0
  );
  const totalNetYen = itemResults.reduce(
    (sum, row) => sum + row.result.netTotalYen,
    0
  );
  const saleableKg = safeNumber(plan.saleableKg);
  const requiredCashYen = safeNumber(plan.requiredCashYen);
  const unallocatedKg = saleableKg - allocatedKg;

  return {
    saleableKg,
    allocatedKg,
    unallocatedKg,
    totalSalesYen,
    totalNetYen,
    requiredCashYen,
    requiredCashGapYen: totalNetYen - requiredCashYen,
    averageKgPriceYen: safeDivide(totalSalesYen, allocatedKg),
    averageKgNetYen: safeDivide(totalNetYen, allocatedKg),
    hasOverAllocated: allocatedKg > saleableKg,
    hasUnallocated: unallocatedKg > 0,
    hasNegativeMethod: methods.some(
      (method) => calculateMethod(method).warnings.negativeNet
    ),
    isCashEnough: totalNetYen >= requiredCashYen,
    itemResults
  };
}

