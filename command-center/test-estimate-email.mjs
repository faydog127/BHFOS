#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = process.env.TENANT_ID || 'tvg';
const EMAIL = process.env.TEST_EMAIL || 'test@example.com';

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL).');
}
if (!SERVICE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
}

// Initialize admin client
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  try {
    console.log('📧 Creating test estimate for:', EMAIL);

    // 1. Find or create lead
    console.log('Step 1: Finding/creating lead...');
    let { data: leads, error: findError } = await supabase
      .from('leads')
      .select('id')
      .eq('email', EMAIL)
      .eq('tenant_id', TENANT_ID)
      .limit(1);

    if (findError) throw new Error(`Query error: ${findError.message}`);

    let leadId;
    if (leads && leads.length > 0) {
      leadId = leads[0].id;
      console.log('  ✓ Found existing lead:', leadId);
    } else {
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          tenant_id: TENANT_ID,
          first_name: 'Test',
          last_name: 'User',
          email: EMAIL,
          phone: '(555) 123-4567',
          company: 'Test Company',
          service: 'Dryer Vent Cleaning',
          status: 'qualified',
          stage: 'proposal'
        })
        .select('id')
        .single();

      if (insertError) throw new Error(`Lead insert error: ${insertError.message}`);
      leadId = newLead.id;
      console.log('  ✓ Created new lead:', leadId);
    }

    // 2. Create estimate
    console.log('Step 2: Creating estimate...');
    const estNum = `EST-${Date.now().toString().slice(-6)}`;
    const lineItems = [
      { name: 'Dryer Vent Safety Clean', code: 'DV-STD', quantity: 1, price: 199 },
      { name: 'Metal Transition Upgrade', code: 'DV-TRANS-HD', quantity: 1, price: 89 }
    ];
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const taxAmount = subtotal * 0.07;
    const totalPrice = subtotal + taxAmount;

    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .insert({
        tenant_id: TENANT_ID,
        lead_id: leadId,
        estimate_number: estNum,
        status: 'draft',
        services: lineItems,
        subtotal,
        tax_amount: taxAmount,
        tax_rate: 0.07,
        total_price: totalPrice
      })
      .select('id')
      .single();

    if (estError) throw new Error(`Estimate insert error: ${estError.message}`);
    console.log('  ✓ Created estimate:', estimate.id, '(' + estNum + ')');

    // 3. Create quote
    console.log('Step 3: Creating quote...');
    const quoteNum = Math.floor(Math.random() * 9000) + 1000;
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        tenant_id: TENANT_ID,
        lead_id: leadId,
        estimate_id: estimate.id,
        quote_number: quoteNum.toString(),
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalPrice,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select('id, public_token')
      .single();

    if (quoteError) throw new Error(`Quote insert error: ${quoteError.message}`);
    console.log('  ✓ Created quote:', quote.id, '(#' + quoteNum + ')');
    console.log('  ✓ Public token:', quote.public_token);

    // 4. Create quote items
    console.log('Step 4: Adding line items to quote...');
    for (const item of lineItems) {
      const { error: itemError } = await supabase
        .from('quote_items')
        .insert({
          tenant_id: TENANT_ID,
          quote_id: quote.id,
          item_code: item.code,
          item_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: item.quantity * item.price
        });

      if (itemError) throw new Error(`QuoteItem insert error: ${itemError.message}`);
    }
    console.log('  ✓ Added', lineItems.length, 'line items');

    console.log('\n✅ Test estimate created successfully!');
    console.log('\n📋 Summary:');
    console.log('   Email:', EMAIL);
    console.log('   Estimate:', estNum);
    console.log('   Quote #:', quoteNum);
    console.log('   Total: $' + totalPrice.toFixed(2));
    console.log('   Public URL: https://bhfos.com/quotes/' + quote.public_token);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
