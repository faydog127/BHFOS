import { supabase } from '@/lib/customSupabaseClient';
import { getBrandPayload, getCredentialRowHtml } from '@/lib/brandConfig';

/**
 * Helper to get document data for templates
 */
const getDocumentData = async (type, id) => {
    if (!id) return null;
    let query = null;

    if (type === 'estimate') {
        query = supabase.from('estimates').select('*').eq('id', id).single();
    } else if (type === 'quote') {
        query = supabase.from('quotes').select('*, quote_items(*)').eq('id', id).single();
    } else if (type === 'invoice' || type === 'receipt') {
        // Fetch invoice with items and related job info for address/date
        query = supabase.from('invoices')
            .select('*, invoice_items(*), jobs(service_address, scheduled_start)')
            .eq('id', id)
            .single();
    } else if (type === 'job') {
        query = supabase.from('jobs').select('*').eq('id', id).single();
    }
    
    if (!query) return null;

    const { data, error } = await query;
    if (error) return null;
    
    // Flatten job data if present for easier access
    if (data.jobs) {
        data.service_address = data.jobs.service_address;
        data.service_date = data.jobs.scheduled_start; // Used for "Next Service Due" calc
    }

    return data;
};

/**
 * Generate HTML Content based on Type
 */
const generateEmailHtml = (type, data, recipientEmail) => {
    // 1. Get Brand Context & Payload
    const brandPayload = getBrandPayload(data);
    const { logo_url, company_name, primary_color, company_url } = brandPayload;
    
    // 2. Build Credentials Footer (SOP: Always show credentials)
    const credentialsHtml = getCredentialRowHtml(brandPayload);

    const date = new Date().toLocaleDateString();
    
    let title = 'Document from The Vent Guys';
    let message = 'Please find the attached document.';
    let details = '';
    let ctaLink = '';
    let ctaText = 'View Document';
    let preheaderText = '';

    // Pricing formatter
    const fmt = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

    // Helper to render line items table
    const renderLineItems = (items) => {
        if (!items || items.length === 0) return '';
        
        const rows = items.map(item => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #334155;">
                    <div style="font-weight: 600;">${item.description || 'Service'}</div>
                    ${item.note ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${item.note}</div>` : ''}
                </td>
                <td style="padding: 12px 0; text-align: right; color: #334155; font-weight: 600;">
                    ${fmt(item.total_price)}
                </td>
            </tr>
        `).join('');

        return `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
                ${rows}
                ${data.tax_amount > 0 ? `
                <tr>
                    <td style="padding: 12px 0; text-align: right; color: #64748b; font-size: 13px;">Tax</td>
                    <td style="padding: 12px 0; text-align: right; color: #64748b; font-size: 13px;">${fmt(data.tax_amount)}</td>
                </tr>` : ''}
                <tr>
                    <td style="padding: 12px 0; text-align: right; font-weight: 800; color: #1e293b;">Total</td>
                    <td style="padding: 12px 0; text-align: right; font-weight: 800; color: #1e293b;">${fmt(data.total_amount)}</td>
                </tr>
            </table>
        `;
    };

    if (type === 'estimate') {
        title = `Estimate #${data.estimate_number || 'PENDING'}`;
        message = 'Here is the estimate for the requested services. You can review and approve it online.';
        details = `
            <p style="margin: 5px 0;"><strong>Amount:</strong> ${fmt(data.total_price)}</p>
            <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${data.valid_until || '30 days from issue'}</p>
        `;
        ctaLink = `${company_url}/quotes/${data.id}`;
        ctaText = 'View Estimate';

    } else if (type === 'quote') {
        title = `Quote #${data.quote_number}`;
        message = 'Here is the formal quote for your review.';
        details = `
            <p style="margin: 5px 0;"><strong>Total:</strong> ${fmt(data.total_amount)}</p>
        `;
        ctaLink = `${company_url}/quotes/${data.id}`;
        ctaText = 'Accept Quote';

    } else if (type === 'invoice') {
        title = `Invoice #${data.invoice_number}`;
        message = 'Thank you for your business. Please find your invoice details below.';
        details = `
            <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${fmt(data.balance_due)}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> ${data.due_date || 'Upon Receipt'}</p>
            ${renderLineItems(data.invoice_items)}
        `;
        ctaLink = `${company_url}/pay/${data.public_token}`;
        ctaText = 'Pay Invoice';

    } else if (type === 'receipt') {
        // Calculate Next Service Due (12 months from service date or now)
        const serviceDate = data.service_date ? new Date(data.service_date) : new Date();
        const nextServiceDue = new Date(serviceDate);
        nextServiceDue.setFullYear(nextServiceDue.getFullYear() + 1);
        const nextServiceDueStr = nextServiceDue.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Hidden Preheader
        preheaderText = `Receipt #${data.invoice_number} for ${data.service_address || 'your property'} — Status: ✅ PAID. Download your System Hygiene Report inside.`;

        title = 'Payment Receipt';
        message = 'We have received your payment. Thank you for choosing The Vent Guys!';
        details = `
            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ${fmt(data.amount_paid)}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 5px 0;"><strong>Reference:</strong> Invoice #${data.invoice_number}</p>
            <p style="margin: 5px 0; color: #2563eb;"><strong>Next Service Due:</strong> ${nextServiceDueStr} (Annual Maintenance)</p>
            ${renderLineItems(data.invoice_items)}
        `;
        ctaLink = `${company_url}`; 
        ctaText = 'Visit Dashboard';

    } else if (type === 'discount') {
        title = 'Exclusive Partner Discount Code';
        message = `Hello ${data.name || 'Partner'},<br><br>As a valued partner, we are excited to share an exclusive discount code for you to share with your network.`;
        details = `
            <div style="text-align: center; margin: 25px 0;">
                <div style="background: #f0fdf4; border: 2px dashed #16a34a; padding: 25px; display: inline-block; border-radius: 8px;">
                    <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 5px; font-weight: 600;">Your Code</div>
                    <h2 style="color: #16a34a; margin: 0; font-family: monospace; font-size: 32px; letter-spacing: 2px;">${data.code}</h2>
                    <p style="margin: 8px 0 0 0; color: #15803d; font-weight: bold; font-size: 16px;">${data.discount_amount}</p>
                </div>
            </div>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-top: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #334155;">Exclusive Benefits for Your Referrals:</h4>
                <ul style="list-style: none; padding: 0; margin: 0; color: #475569; font-size: 14px;">
                    <li style="margin-bottom: 12px; display: flex; align-items: start;">
                        <span style="color: #16a34a; margin-right: 10px; font-weight: bold;">✓</span> 
                        <div><strong>24-Hour SLA:</strong> Priority scheduling for all your referrals.</div>
                    </li>
                    <li style="margin-bottom: 12px; display: flex; align-items: start;">
                        <span style="color: #16a34a; margin-right: 10px; font-weight: bold;">✓</span> 
                        <div><strong>VIP Status:</strong> Direct access to our senior technician team.</div>
                    </li>
                    <li style="margin-bottom: 0; display: flex; align-items: start;">
                         <span style="color: #16a34a; margin-right: 10px; font-weight: bold;">✓</span> 
                         <div><strong>Easy Booking:</strong> Just mention code <strong>${data.code}</strong> when calling.</div>
                    </li>
                </ul>
            </div>
        `;
        ctaLink = `${company_url}/contact`; 
        ctaText = 'Book a Service';
    }

    // HTML Template Structure
    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
            
            <!-- Hidden Preheader -->
            ${preheaderText ? `
            <span style="display:none;visibility:hidden;mso-hide:all;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
                ${preheaderText}
            </span>
            ` : ''}

            <!-- Header with Logo -->
            <div style="background: white; padding: 24px; text-align: center; border-bottom: 4px solid ${primary_color};">
                <img src="${logo_url}" alt="${company_name}" style="height: 60px; display: block; margin: 0 auto;" />
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px;">
                <h3 style="color: #1e293b; margin-top: 0; font-size: 22px; text-align: center; font-weight: 600;">${title}</h3>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 30px;">${message}</p>
                
                <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 0 0 30px 0; border: 1px solid #e2e8f0;">
                    <div style="font-size: 15px; color: #334155;">
                        ${details}
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="${ctaLink}" style="background: ${primary_color}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                        ${ctaText}
                    </a>
                </div>
            </div>
            
            <!-- Professional Credentials Footer -->
            ${credentialsHtml}
            
            <!-- Standard Footer -->
            <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
                <p style="margin: 0 0 5px 0;">Sent to ${recipientEmail} on ${date}</p>
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${company_name}. All rights reserved.</p>
            </div>
        </div>
    `;
};

/**
 * Unified send function for all document types
 */
export const sendDocumentEmail = async ({ type, recipientEmail, leadId, jobId, estimateId, quoteId, invoiceId, metadata = {}, customData = null }) => {
    try {
        // 1. Fetch Data
        let docId = null;
        if (type === 'estimate') docId = estimateId;
        else if (type === 'quote') docId = quoteId;
        else if (type === 'invoice') docId = invoiceId;
        else if (type === 'receipt') docId = jobId || invoiceId; // Receipt can come from job context or invoice context

        // Fallback for receipt if we only have invoiceId
        let docData = customData || {}; 
        
        if (!customData) {
             if (type === 'receipt' && invoiceId) {
                  docData = await getDocumentData('invoice', invoiceId);
             } else if (docId) {
                  docData = await getDocumentData(type, docId);
             }
        }

        if (!docData && type !== 'receipt' && type !== 'discount') {
             // If data fetch failed but we need it for template
             console.warn('Document data missing for email template');
        }

        // 2. Generate Template with Brand Assets
        const subject = type === 'discount' 
            ? `Exclusive Discount: ${docData.code || 'Your Partner Code'}` 
            : `${type.charAt(0).toUpperCase() + type.slice(1)} from The Vent Guys`;
            
        const html = generateEmailHtml(type, docData || {}, recipientEmail);

        // 3. Send via Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                to: recipientEmail,
                subject,
                html,
                from: 'The Vent Guys <noreply@vent-guys.com>',
            }
        });

        if (error) throw error;

        // 4. Log to DB
        await supabase.from('email_logs').insert({
            lead_id: leadId,
            job_id: jobId,
            estimate_id: estimateId,
            quote_id: quoteId,
            invoice_id: invoiceId,
            recipient_email: recipientEmail,
            email_type: type,
            status: 'sent',
            metadata
        });

        return { success: true };

    } catch (error) {
        console.error('Send Document Error:', error);
        
        // Log failure
        await supabase.from('email_logs').insert({
            lead_id: leadId,
            recipient_email: recipientEmail,
            email_type: type,
            status: 'failed',
            error_message: error.message,
            metadata
        });

        return { success: false, error: error.message };
    }
};

/**
 * Send Edelmira Carrasco the CCREW-001 discount code
 */
export const sendEdelmiraDiscountEmail = async () => {
    return sendDocumentEmail({
        type: 'discount',
        recipientEmail: 'edelmira@example.com', // Placeholder if real email isn't provided, or prompt user
        customData: {
            name: 'Edelmira Carrasco',
            code: 'CCREW-001',
            discount_amount: '25% OFF',
        }
    });
};

/**
 * (Legacy/Existing) Send an Estimate Email
 */
export const sendEstimateEmail = async (params) => {
    return sendDocumentEmail({
        type: 'estimate',
        recipientEmail: params.to_email,
        estimateId: params.estimate_id,
        leadId: params.lead_id,
        metadata: { legacy_call: true }
    });
};