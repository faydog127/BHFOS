// Standalone script to generate Chris Adams report
// Run from C:\BHFOS\Website directory with: node generateHotelReport.js

import puppeteer from 'puppeteer';
import fs from 'fs';

// Utility functions
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toFileUrl = (path) => {
  const normalized = path.replace(/\\/g, '/');
  return `file:///${normalized}`;
};

// Simple HTML generator for Chris Adams report
const generateHtml = () => {
  const pageBackgrounds = [
    toFileUrl('C:/BHFOS/Reports/Template_pg1.png'),
    toFileUrl('C:/BHFOS/Reports/Template_pg2.png')
  ];

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Commercial Dryer Vent Service Report</title>
  <style>
    @page { size: Letter; margin: 0; }
    * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    .page {
      position: relative;
      width: 8.5in;
      height: 11in;
      margin: 0 auto;
      background-size: cover;
      background-position: top center;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    .field {
      position: absolute;
      color: #0f172a;
      font-size: 15px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .pill-text { color: #0f172a; }
    .pill-text.danger { color: #fff; font-weight: 600; }
  </style>
</head>
<body>
  <!-- Page 1 -->
  <div class="page" style="background-image:url('${pageBackgrounds[0]}');">
    <div class="field" style="top:20%; left:8%; width:40%;">
      <div><strong>Customer:</strong> Chris Adams</div>
      <div><strong>Address:</strong> SpringHill Suites West Melbourne<br/>4446 Hollywood Blvd<br/>West Melbourne, FL 32904</div>
      <div style="margin-top:8px;"><strong>Primary Concern:</strong> Large-capacity commercial dryer intermittently faulting, under-drying, and experiencing airflow-related shutdowns despite clean venting.</div>
    </div>
    <div class="field" style="top:20%; left:55%; width:37%;">
      <div><strong>Service:</strong> Commercial Dryer Vent Inspection & Post-Service Assessment</div>
      <div><strong>Visit Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      <div><strong>Technician:</strong> The Vent Guys Technician</div>
    </div>

    <div class="field" style="top:42%; left:8%; width:84%;">
      <p style="margin:0 0 12px 0;">An on-site post-service inspection was performed following repeated airflow-related faults and performance issues on a large-capacity commercial dryer. Venting was found to be clean, unobstructed, and constructed of rigid metal with a short overall run.</p>
      <p style="margin:0 0 12px 0;">Despite these conditions, both dryers are connected to a <strong>shared exhaust system via a wye fitting</strong>, which creates unstable pressure conditions during operation. This configuration causes backpressure and cross-flow that directly interferes with proper dryer exhaust performance, particularly on the higher-capacity unit.</p>
      <p style="margin:0;">The observed behavior is consistent with an <strong>exhaust system design issue</strong>, not a maintenance or cleaning deficiency.</p>
    </div>

    <div class="field pill-text danger" style="top:58%; left:8%; width:84%; background:rgba(181,32,37,0.95); padding:16px; border-radius:12px;">
      <div style="font-size:16px; font-weight:800; margin-bottom:8px; color:#fff;">⚠️ Critical Risk / Code Concern</div>
      <p style="margin:0 0 12px 0; color:#fff;">Two commercial dryers are connected to a shared exhaust system using a wye fitting. This configuration allows cross-flow and pressure instability and is <strong>not compatible with high-capacity commercial dryers</strong>.</p>
      <p style="margin:0; color:#fff;">Shared exhaust systems can cause dryers to recirculate exhaust air into adjacent branches, leading to safety shutdowns, overheating risks, inefficient drying, and long-term equipment stress. Manufacturer guidance and best practices require <strong>dedicated exhaust runs per dryer</strong> to ensure safe and stable operation.</p>
    </div>

    <div class="field" style="top:76%; left:8%; width:84%;">
      <div style="font-size:16px; font-weight:700; margin-bottom:8px;">Findings (Before Service)</div>
      <ul style="margin:0; padding-left:20px;">
        <li>Repeated airflow-related faults reported on large-capacity dryer</li>
        <li>Dryer under-drying loads and intermittently limiting heat output</li>
        <li>No visible lint blockage at termination or within accessible duct sections</li>
        <li>Venting appeared clean at time of inspection</li>
      </ul>
    </div>
  </div>

  <!-- Page 2 -->
  <div class="page" style="background-image:url('${pageBackgrounds[1]}');">
    <div class="field" style="top:18%; left:8%; width:84%;">
      <div style="font-size:16px; font-weight:700; margin-bottom:8px;">Findings (After / Post-Visit)</div>
      <ul style="margin:0; padding-left:20px;">
        <li>Exhaust ducting verified clean and unobstructed</li>
        <li>Rigid metal duct used throughout with short overall run length</li>
        <li>Internal airflow damper observed operating as designed</li>
        <li>No mechanical failure identified within the dryer itself</li>
      </ul>
      <p style="margin:12px 0 0 0;">The larger dryer continues to experience airflow instability when operating due to interaction with the shared exhaust system. Exhaust air from the larger unit is capable of pressurizing the shared duct and flowing toward the adjacent dryer branch, creating unstable pressure conditions that trigger dryer safety logic.</p>
    </div>

    <div class="field" style="top:40%; left:8%; width:84%;">
      <div style="font-size:16px; font-weight:700; margin-bottom:8px;">Key Improvements</div>
      <ul style="margin:0; padding-left:20px;">
        <li>Confirmed vent cleanliness and eliminated lint blockage as a cause</li>
        <li>Identified root-cause exhaust design issue</li>
        <li>Provided documentation to prevent unnecessary repeat service calls</li>
        <li>Clarified that dryer behavior is a response to unsafe exhaust conditions, not equipment failure</li>
      </ul>
    </div>

    <div class="field" style="top:56%; left:8%; width:84%;">
      <div style="font-size:16px; font-weight:700; margin-bottom:8px;">Remaining Concerns</div>
      <p style="margin:0; color:#b52025; font-weight:600;">The shared exhaust configuration will continue to cause intermittent faults, inefficient drying, and service disruptions until corrected. Continued operation under these conditions may lead to increased maintenance costs and ongoing downtime.</p>
    </div>

    <div class="field" style="top:66%; left:8%; width:84%;">
      <div style="font-size:16px; font-weight:700; margin-bottom:8px;">Recommendations</div>
      <p style="margin:0 0 10px 0;"><strong>Primary Recommendation (Manufacturer-Safe):</strong><br/>Each commercial dryer should be vented through a <strong>fully independent exhaust system</strong>, from dryer connection to exterior termination.</p>
      <p style="margin:0 0 10px 0;"><strong>Secondary Mitigation (Not Guaranteed):</strong><br/>If full separation is not immediately possible, install <strong>commercial-grade backdraft dampers</strong> rated for dryer exhaust temperatures on each dryer branch. This may reduce cross-flow but is not a guaranteed solution.</p>
      <p style="margin:0;">Additional vent cleaning or dryer component replacement is <strong>not recommended</strong> at this time, as the issue is related to exhaust design rather than cleanliness or mechanical failure.</p>
    </div>

    <div class="field" style="top:88%; left:8%; width:84%; font-size:13px;">
      <div style="font-size:14px; font-weight:700; margin-bottom:6px;">Technician Notes</div>
      <p style="margin:0;">Exhaust system design identified as primary cause of airflow instability. Findings discussed on-site. Photo documentation captured showing shared exhaust configuration and wye connection.</p>
    </div>
  </div>
</body>
</html>
  `;
};

const generateReport = async () => {
  console.log('🚀 Starting PDF generation for Chris Adams / SpringHill Suites report...');

  const htmlContent = generateHtml();
  const outputPath = 'C:/BHFOS/Reports/Hotel/SpringHill_Suites_Service_Report.pdf';

  // Ensure directory exists
  const outputDir = 'C:/BHFOS/Reports/Hotel';
  if (!fs.existsSync(outputDir)) {
    console.log('📁 Creating output directory...');
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    console.log('📄 Setting page content...');
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'load']
    });

    console.log('⏳ Waiting for images to load...');
    await page.waitForTimeout(3000);

    console.log('🖨️  Generating PDF...');
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    console.log(`✅ PDF generated successfully!`);
    console.log(`📍 Location: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  } finally {
    await browser.close();
  }
};

// Run the generator
generateReport()
  .then(() => {
    console.log('\n🎉 Report generation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to generate report:', error);
    process.exit(1);
  });
