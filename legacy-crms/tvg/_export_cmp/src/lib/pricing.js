
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
