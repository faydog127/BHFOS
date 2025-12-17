import { MODULES } from '../modules';

/**
 * BlackHorse Manifest
 * 
 * This manifest represents the "BlackHorse" configuration of the platform.
 * It composes specific modules to create a tailored system architecture.
 * 
 * Includes:
 * - Standard CRM & Ops (Leads, Sales, Jobs)
 * - Financial tools (Invoicing, Payments)
 * - Specialized Partner Growth module
 * - Brand Brain AI for content generation
 * - End-to-end Flight Check simulation
 * - Schema Integrity Guard
 */
export const blackhorseManifest = {
  core: MODULES.coreFoundation,
  leads: MODULES.crmEngine,
  contacts: MODULES.contactCenter,
  sales: MODULES.salesEngine,
  finance: MODULES.finance,
  operations: MODULES.opsJobs,
  technician: MODULES.fieldApp,
  marketing: MODULES.marketingAuto,
  partners: MODULES.partnerPortal,
  reputation: MODULES.reputation,
  brand_brain: MODULES.brandBrain,
  flight_check: MODULES.flightCheck,
  schema_guard: MODULES.schemaGuard // Added Schema Integrity Guard
};