import { supabase } from '@/lib/customSupabaseClient';
import { addYears, format } from 'date-fns';

/**
 * Generates a unique loyalty code for a customer
 * Format: [First3OfLastName][Year][Random4] -> DOE2024XY9Z
 */
export const generateLoyaltyCode = async (leadId, lastName = 'VIP') => {
  const prefix = lastName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase().padEnd(3, 'X');
  const year = new Date().getFullYear();
  
  let isUnique = false;
  let code = '';
  
  // Simple retry logic for uniqueness
  while (!isUnique) {
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    code = `${prefix}${year}${suffix}`;
    
    const { data } = await supabase
      .from('customer_discounts')
      .select('id')
      .eq('code', code)
      .single();
      
    if (!data) isUnique = true;
  }
  
  // Randomly assign 10% or 15% discount
  const discountPercentage = Math.random() < 0.5 ? 10 : 15;

  // Create the discount record
  const { data: newDiscount, error } = await supabase
    .from('customer_discounts')
    .insert({
      lead_id: leadId,
      code: code,
      discount_percentage: discountPercentage,
      status: 'active',
      expiration_date: addYears(new Date(), 1).toISOString(), // Valid for 1 year
      campaign_source: 'post_job_loyalty'
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error creating discount code:', error);
    return null;
  }
  
  return newDiscount;
};

/**
 * Validates a discount code
 */
export const validateDiscountCode = async (code) => {
  const { data, error } = await supabase
    .from('customer_discounts')
    .select('*, leads(first_name, last_name)')
    .eq('code', code)
    .single();

  if (error || !data) return { valid: false, message: 'Invalid code' };
  
  if (data.status === 'redeemed') return { valid: false, message: 'Code already redeemed' };
  
  if (new Date(data.expiration_date) < new Date()) {
    return { valid: false, message: 'Code expired' };
  }

  return { valid: true, discount: data };
};