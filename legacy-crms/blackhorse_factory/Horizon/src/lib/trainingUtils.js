/**
 * Applies the standard training mode filter to a Supabase query.
 * 
 * @param {object} queryBuilder - The Supabase query builder instance (e.g., supabase.from('leads').select('*'))
 * @param {boolean} isTrainingMode - The current training mode state
 * @returns {object} - The modified query builder
 */
export function applyTrainingFilter(queryBuilder, isTrainingMode) {
  // If Training Mode is ON -> Show ONLY test data (is_test_data = true)
  // If Training Mode is OFF -> Show ONLY real data (is_test_data = false or null)
  
  if (isTrainingMode) {
    return queryBuilder.eq('is_test_data', true);
  } else {
    // Handle both false and null as "real data" for backward compatibility
    return queryBuilder.or('is_test_data.eq.false,is_test_data.is.null');
  }
}