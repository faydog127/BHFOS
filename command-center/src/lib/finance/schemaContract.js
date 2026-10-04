/**
 * Governed Finance plan schemas.
 * Version 1 stores no monthly basis. Version 2 stores monthly_basis.
 * Callers use these helpers instead of a scattered literal 2.
 */
export const FINANCE_SUPPORTED_PLAN_SCHEMAS = Object.freeze([1, 2]);
export const FINANCE_PLAN_SCHEMA_WITHOUT_MONTHLY_BASIS = 1;
export const FINANCE_MONTHLY_BASIS_SCHEMA = 2;

export function isSupportedPlanSchema(schemaVersion) {
  return FINANCE_SUPPORTED_PLAN_SCHEMAS.includes(schemaVersion);
}

export function planHasMonthlyBasis(schemaVersion) {
  return schemaVersion === FINANCE_MONTHLY_BASIS_SCHEMA;
}
