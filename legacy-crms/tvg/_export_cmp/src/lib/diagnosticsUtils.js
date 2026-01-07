/**
 * Resilience & Scoring Utilities for System Diagnostics
 */

export const STATUS_ENUM = {
  OK: 'ok',
  BLOCKED: 'blocked',
  MISSING: 'missing',
  ERROR: 'error',
  WARNING: 'warning'
};

/**
 * Standardizes status strings to a strict enum
 */
export const normalizeStatus = (status) => {
  if (!status) return STATUS_ENUM.ERROR;
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'active' || s === 'healthy' || s === 'success' || s === 'connected' || s === 200) return STATUS_ENUM.OK;
  if (s === 'blocked' || s === 'timeout') return STATUS_ENUM.BLOCKED;
  if (s === 'missing' || s === '404' || s === 'not_found') return STATUS_ENUM.MISSING;
  if (s === 'warning' || s === 'warn') return STATUS_ENUM.WARNING;
  return STATUS_ENUM.ERROR;
};

/**
 * Standardized result object factory
 */
export const formatProbeResult = (name, rawStatus, latency = 0, message = '') => ({
  name,
  status: normalizeStatus(rawStatus),
  latency: Math.max(0, latency),
  message: message || rawStatus,
  timestamp: Date.now()
});

/**
 * Weighted Health Score Algorithm
 * Starts at 100, subtracts points for failures based on criticality.
 */
export const calculateHealthScore = (results = []) => {
  let score = 100;
  
  // Flatten results if they are grouped
  const flatResults = Array.isArray(results) ? results : Object.values(results).flat();

  // Weights configuration
  const CRITICAL_WEIGHT = 30; // Business stopping
  const HIGH_WEIGHT = 10;     // System degradation
  const MEDIUM_WEIGHT = 5;    // Feature loss
  const DEFAULT_WEIGHT = 10;

  const weights = {
    'leads': CRITICAL_WEIGHT,
    'invoices': CRITICAL_WEIGHT,
    'customers': CRITICAL_WEIGHT,
    'system_settings': HIGH_WEIGHT,
    'app_user_roles': HIGH_WEIGHT,
    'calls': MEDIUM_WEIGHT,
    'proposals': MEDIUM_WEIGHT,
    'estimates': MEDIUM_WEIGHT
  };

  flatResults.forEach(probe => {
    if (probe.status !== STATUS_ENUM.OK && probe.status !== STATUS_ENUM.WARNING) {
      // Find matching weight key (partial match allowed, e.g., 'leads' matches 'leads' table check)
      const key = Object.keys(weights).find(k => probe.name.toLowerCase().includes(k));
      const deduction = key ? weights[key] : DEFAULT_WEIGHT;
      
      score -= deduction;
    }
  });

  return Math.max(0, Math.floor(score));
};

export const timeoutPromise = (promise, ms, name = 'Operation') => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${name} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([
    promise.then(res => {
      clearTimeout(timer);
      return res;
    }),
    timeout
  ]);
};