export const generateHygieneReportEmail = (data) => {
    // Data expectations:
    // customerName, serviceAddress, serviceDate, technicianName, 
    // findings (array of strings), photos (array of urls),
    // nextServiceDate, loyaltyCode (NEW), loyaltyDiscount (NEW - e.g. 10 or 15)
    
    const GOOGLE_REVIEW_LINK = "https://g.page/r/YOUR_GOOGLE_REVIEW_LINK/review"; // Replace with actual link
    
    const findingsList = data.findings?.map(f => `<li style="margin-bottom: 8px;">${f}</li>`).join('') || '<li>Standard cleaning performed. System is operating normally.</li>';
    
    // Determine the "Before" and "After" photos if available, or just show a gallery
    const photoGallery = data.photos?.slice(0, 4).map(url => `
        <div style="display: inline-block; width: 45%; margin: 2%; vertical-align: top;">
            <img src="${url}" style="width: 100%; border-radius: 4px; border: 1px solid #ddd;" alt="Service Photo" />
        </div>
    `).join('') || '<p style="font-style: italic; color: #666;">Photos available upon request.</p>';

    // Conditional Discount Section
    const discountValue = data.loyaltyDiscount || 15; // Default to 15 if not provided for safety
    
    const discountSection = data.loyaltyCode ? `
        <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
            <h3 style="color: #166534; margin-top: 0;">Thanks for being a loyal customer!</h3>
            <p style="color: #15803d; margin-bottom: 15px;">Save ${discountValue}% on your next annual maintenance or share this code with a neighbor.</p>
            <div style="background-color: #fff; padding: 10px 20px; display: inline-block; font-family: monospace; font-size: 24px; font-weight: bold; color: #16a34a; letter-spacing: 2px; border-radius: 4px; border: 1px solid #bbf7d0;">
                ${data.loyaltyCode}
            </div>
            <p style="font-size: 12px; color: #166534; margin-top: 10px;">Valid until ${data.loyaltyExpiration || 'next year'}</p>
        </div>
    ` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>System Hygiene Report</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background-color: #1e3a8a; padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">System Hygiene Report</h1>
                <p style="color: #bfdbfe; margin: 5px 0 0;">The Vent Guys Service Record</p>
            </div>

            <!-- Content -->
            <div style="padding: 30px;">
                <p>Hello <strong>${data.customerName || 'Valued Customer'}</strong>,</p>
                <p>Thank you for choosing The Vent Guys. This report confirms the completion of your recent service.</p>

                <!-- Job Details Box -->
                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Service Address:</strong> ${data.serviceAddress}</p>
                    <p style="margin: 5px 0;"><strong>Date Completed:</strong> ${data.serviceDate}</p>
                    <p style="margin: 5px 0;"><strong>Technician:</strong> ${data.technicianName || 'The Vent Guys Team'}</p>
                </div>

                <!-- Findings -->
                <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Technician Notes & Findings</h3>
                <ul style="padding-left: 20px;">
                    ${findingsList}
                </ul>

                <!-- Photo Verification -->
                <h3 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px;">Photo Verification</h3>
                <div style="text-align: center; margin-top: 15px;">
                    ${photoGallery}
                </div>

                <!-- DISCOUNT CODE SECTION -->
                ${discountSection}

                <!-- Review Request (Prominent) -->
                <div style="text-align: center; margin: 40px 0; padding: 25px; background-color: #eff6ff; border-radius: 12px;">
                    <h2 style="color: #1e40af; margin-top: 0; font-size: 20px;">How did we do?</h2>
                    <p style="color: #1e3a8a; margin-bottom: 20px;">Your review helps our small business grow and helps your neighbors find trusted service.</p>
                    
                    <a href="${GOOGLE_REVIEW_LINK}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
                        ⭐⭐⭐⭐⭐ Leave a Google Review
                    </a>
                </div>

                <p>Your next recommended service date is: <strong>${data.nextServiceDate}</strong>. We'll send you a reminder closer to that time.</p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
                <p>&copy; ${new Date().getFullYear()} The Vent Guys. All rights reserved.</p>
                <p>Questions? Call us at <a href="tel:3213609704" style="color: #3b82f6;">(321) 360-9704</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
};