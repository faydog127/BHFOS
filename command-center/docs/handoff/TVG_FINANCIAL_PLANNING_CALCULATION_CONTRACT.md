# TVG Financial Planning App — Calculation Contract

This is the compact math contract for the TVG Financial Planning App handoff.

## Stage calculations

```text
monthlyPayroll =
  headcount * hourlyWage * weeklyHours * 52 / 12 * (1 + burdenPct)

ownerFieldReplacement =
  ownerShadowHours * ownerReplacementWage * (1 + ownerFieldBurdenPct)

cashOperatingCost =
    hiredFieldPayroll
  + directProductionNonLabor
  + indirectNonLaborOperatingCosts
  + supportPayroll
  + ownerManagementComp

economicOperatingCost =
  cashOperatingCost + ownerFieldReplacement

retentionHurdle =
    trueOperatingProfitPct
  + growthReservePct
  + badDebtWarrantyPct
  + unidentifiedCostContingencyPct

requiredMonthlyRevenue =
  economicOperatingCost / (1 - retentionHurdle)

availableUnitDays =
  revenueProducingUnits * workingDaysPerMonth

realizedProductionDays =
  availableUnitDays * utilizationPct

productiveUnitHours =
  realizedProductionDays * productiveSiteHoursPerRealizedDay

revenuePerAvailableUnitDay =
  requiredMonthlyRevenue / availableUnitDays

revenuePerRealizedProductionDay =
  requiredMonthlyRevenue / realizedProductionDays

revenuePerProductiveUnitHour =
  requiredMonthlyRevenue / productiveUnitHours
```

## Working capital

```text
weightedDSO = SUM(channelRevenueShare * channelDSO)

estimatedAR =
  requiredMonthlyRevenue * weightedDSO / 30

operatingCashFloat =
  cashOperatingCost * weightedDSO / 30

safetyReserve =
  cashOperatingCost * safetyMonths

liquidityPlanningTarget =
  MAX(operatingCashFloat, safetyReserve)
```

Bad-debt reserve and working-capital reserve are separate concepts and must remain separate in the UI.

## Route economics

```text
dailyRouteRevenue = stopsPerDay * averageTicket

routeGapVsStage =
  dailyRouteRevenue - requiredRevenuePerAvailableUnitDay

requiredAverageTicket =
  requiredRevenuePerAvailableUnitDay / stopsPerDay
```

## Service economics

```text
directJobCost =
  directLaborCost + materials + dispatchFuel

stage2IndirectPerProductiveUnitHour =
  (stage2IndirectNonLabor + stage2SupportPayroll + stage2OwnerManagementComp)
  / stage2ProductiveUnitHours

serviceIndirectAllocation =
  serviceProductionUnitHours * stage2IndirectPerProductiveUnitHour

fullySupportedCost =
  directJobCost + serviceIndirectAllocation

stage1CapacityPrice =
  serviceProductionUnitHours * stage1RequiredRevenuePerProductiveUnitHour

stage2CapacityPrice =
  serviceProductionUnitHours * stage2RequiredRevenuePerProductiveUnitHour

priceVarianceVsStage2 =
  plannedPrice - stage2CapacityPrice
```

## Service-specific direct labor

### Dryer vent

```text
directLabor =
  siteClockHours * burdenedRouteTechHourlyRate
```

### Three-person duct crew

```text
crewBurdenedHourly =
    burdenedLeadHourly
  + burdenedDuctTechHourly
  + burdenedHelperHourly

directLabor =
  siteClockHours * crewBurdenedHourly
```

### AHU future licensed service

```text
directLabor =
  siteClockHours * burdenedHVACTechHourlyRate
```

### Duct + AHU parallel package

```text
directLabor =
    ductClockHours * ductCrewBurdenedHourly
  + ahuClockHours * burdenedHVACTechHourlyRate

productionUnitHoursConsumed =
  ductClockHours + ahuClockHours

customerSiteWindow =
  MAX(ductClockHours, ahuClockHours)
```

## Seed regression outputs

Approximate expected values:

```text
Stage 0 required monthly revenue:  5,083
Stage 1 required monthly revenue: 43,644
Stage 2 required monthly revenue: 63,063
Stage 3 required monthly revenue: 97,987

Stage 1 revenue / available unit-day: 1,091
Stage 2 revenue / available unit-day: 1,577

Stage 1 revenue / productive unit-hour: 291
Stage 2 revenue / productive unit-hour: 394

12-drop working duct price @ 145/drop: 1,740
12-drop duct + AHU @ 795: 2,535
Stage 2 duct target-cycle diagnostic: ~115/drop
Stage 2 duct stress-cycle diagnostic: ~148/drop
Rounded stress-test diagnostic: 150/drop
```

All outputs are planning diagnostics. The application must not silently turn them into final customer pricing policy.

## Guardrails

- Derived values come from pure, testable functions.
- No duplicated authoritative calculation path by view.
- Guided, Executive, and Advanced Analytics must all consume the same results.
- Division-by-zero returns a neutral display, never NaN or Infinity.
- Total retention hurdle must be less than 100%.
- Channel shares should warn when they do not total 100%.
