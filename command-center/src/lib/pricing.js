
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Fetches the active price book from Supabase.
 * @returns {Promise<Array>} Array of price book items
 */
export const fetchPriceBook = async () => {
  try {
    const { data, error } = await supabase
      .from('price_book')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('Error fetching price book:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching price book:', err);
    return [];
  }
};

/**
 * Helper to get a specific price from a loaded price book array.
 * Falls back to a provided default if the code isn't found.
 * @param {Array} priceBook - The array of price items
 * @param {string} code - The SKU/Code to look up
 * @param {number} defaultPrice - Fallback price
 * @returns {number} The active price
 */
export const getPriceFromBook = (priceBook, code, defaultPrice = 0) => {
  if (!priceBook || !Array.isArray(priceBook)) return defaultPrice;
  const item = priceBook.find(p => p.code === code);
  return item ? Number(item.base_price) : defaultPrice;
};

export const buildPriceBookMap = (priceBook = []) => {
  if (!Array.isArray(priceBook)) return new Map();
  return new Map(priceBook.map(row => [row.code, Number(row.base_price) || 0]));
};

export const repriceLineItems = (items = [], priceBook = [], options = {}) => {
  const { fallbackToItemPrice = false } = options;
  const priceMap = priceBook instanceof Map ? priceBook : buildPriceBookMap(priceBook);
  const missingSet = new Set();

  if (!Array.isArray(items)) return { items: [], subtotal: 0, missing: [] };

  const normalized = items.map((item) => {
    const code = item.code || item.sku;
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const hasCode = Boolean(code);
    const mapPrice = hasCode ? priceMap.get(code) : undefined;

    if (!hasCode) {
      missingSet.add('UNKNOWN');
    } else if (mapPrice == null) {
      missingSet.add(code);
    }

    let unitPrice = mapPrice;
    if (unitPrice == null && fallbackToItemPrice) {
      const legacy = item.price ?? item.unit_price ?? item.base_price ?? 0;
      unitPrice = Number(legacy) || 0;
    }

    const total = (unitPrice ?? 0) * qty;

    return {
      ...item,
      code,
      quantity: qty,
      unit_price: unitPrice ?? 0,
      total_price: total
    };
  });

  const subtotal = normalized.reduce((sum, item) => sum + (item.total_price || 0), 0);
  return { items: normalized, subtotal, missing: Array.from(missingSet) };
};

export const calculateEstimateTotalsFromBook = (estimate, priceBook, options = {}) => {
  const { items, subtotal, missing } = repriceLineItems(estimate?.services || [], priceBook, options);
  const discount = Number(estimate?.applied_discount_amount || 0);
  const total = Math.max(0, subtotal - (Number.isFinite(discount) ? discount : 0));
  return { items, subtotal, total, missing };
};

/**
 * Formats a price number into a currency string.
 * @param {number} amount 
 * @returns {string} e.g. "$149.00"
 */
export const formatPrice = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount || 0);
};
