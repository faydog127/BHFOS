import puppeteer from 'puppeteer';
import { generateServiceReportHtml } from '../templates/ServiceReportTemplates.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Convert file paths to file:// URLs for Puppeteer
const toFileUrl = (path) => {
  const normalized = path.replace(/\\/g, '/');
  return `file:///${normalized}`;
};

const generateChrisAdamsReport = async () => {
  console.log('Starting PDF generation for Chris Adams report...');

  // Report payload for Chris Adams
  const reportPayload = {
    // Meta information
    customerName: 'Chris Adams',
    serviceAddress: 'SpringHill Suites West Melbourne\n4446 Hollywood Blvd\nWest Melbourne, FL 32904',
    serviceType: 'Commercial Dryer Vent Inspection & Post-Service Assessment',
    serviceDate: new Date().toISOString(), // Use today's date or specify actual date
    technicianName: 'The Vent Guys Technician', // Update with actual technician name
    workOrder: '', // Add work order if available
    primaryConcern: 'Large-capacity commercial dryer intermittently faulting, under-drying, and experiencing airflow-related shutdowns despite clean venting.',

    // Summary (Page 1)
    summary: [
      'An on-site post-service inspection was performed following repeated airflow-related faults and performance issues on a large-capacity commercial dryer. Venting was found to be clean, unobstructed, and constructed of rigid metal with a short overall run.',
      'Despite these conditions, both dryers are connected to a shared exhaust system via a wye fitting, which creates unstable pressure conditions during operation. This configuration causes backpressure and cross-flow that directly interferes with proper dryer exhaust performance, particularly on the higher-capacity unit.',
      'The observed behavior is consistent with an exhaust system design issue, not a maintenance or cleaning deficiency.'
    ],

    // Critical Risk (Page 1 - red pill)
    criticalRisk: [
      'Two commercial dryers are connected to a shared exhaust system using a wye fitting. This configuration allows cross-flow and pressure instability and is not compatible with high-capacity commercial dryers.',
      'Shared exhaust systems can cause dryers to recirculate exhaust air into adjacent branches, leading to safety shutdowns, overheating risks, inefficient drying, and long-term equipment stress. Manufacturer guidance and best practices require dedicated exhaust runs per dryer to ensure safe and stable operation.'
    ],

    // Findings Before (Page 1)
    findingsBefore: [
      'Repeated airflow-related faults reported on large-capacity dryer',
      'Dryer under-drying loads and intermittently limiting heat output',
      'No visible lint blockage at termination or within accessible duct sections',
      'Venting appeared clean at time of inspection'
    ],

    // Findings After (Page 2)
    findingsAfter: [
      'Exhaust ducting verified clean and unobstructed',
      'Rigid metal duct used throughout with short overall run length',
      'Internal airflow damper observed operating as designed',
      'No mechanical failure identified within the dryer itself',
      'The larger dryer continues to experience airflow instability when operating due to interaction with the shared exhaust system. Exhaust air from the larger unit is capable of pressurizing the shared duct and flowing toward the adjacent dryer branch, creating unstable pressure conditions that trigger dryer safety logic.'
    ],

    // Key Improvements (Page 2)
    keyImprovements: [
      'Confirmed vent cleanliness and eliminated lint blockage as a cause',
      'Identified root-cause exhaust design issue',
      'Provided documentation to prevent unnecessary repeat service calls',
      'Clarified that dryer behavior is a response to unsafe exhaust conditions, not equipment failure'
    ],

    // Remaining Concerns (Page 2)
    remainingConcerns: [
      'The shared exhaust configuration will continue to cause intermittent faults, inefficient drying, and service disruptions until corrected. Continued operation under these conditions may lead to increased maintenance costs and ongoing downtime.'
    ],

    // Recommendations (Page 2)
    recommendations: [
      'Primary Recommendation (Manufacturer-Safe): Each commercial dryer should be vented through a fully independent exhaust system, from dryer connection to exterior termination.',
      'Secondary Mitigation (Not Guaranteed): If full separation is not immediately possible, install commercial-grade backdraft dampers rated for dryer exhaust temperatures on each dryer branch. This may reduce cross-flow but is not a guaranteed solution.',
      'Additional vent cleaning or dryer component replacement is not recommended at this time, as the issue is related to exhaust design rather than cleanliness or mechanical failure.'
    ],

    // Technician Notes (Page 2)
    technicianNotes: [
      'Exhaust system design identified as primary cause of airflow instability. Findings discussed on-site. Photo documentation captured showing shared exhaust configuration and wye connection.'
    ],

    // Photos (if available, leave empty arrays if not)
    beforePhotos: [],
    afterPhotos: [],

    // Page backgrounds - Use the Template_pg1 and Template_pg2
    pageBackgrounds: [
      toFileUrl('C:/BHFOS/Reports/Template_pg1.png'),
      toFileUrl('C:/BHFOS/Reports/Template_pg2.png')
    ],

    // Brand context
    brandContext: 'vent-guys', // This will use The Vent Guys branding
  };

  // Generate HTML
  const htmlContent = generateServiceReportHtml(reportPayload);

  // Output directory
  const outputDir = resolve('C:/BHFOS/Reports/Hotel');
  const outputPath = resolve(outputDir, 'SpringHill_Suites_Service_Report.pdf');

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set content and wait for images to load
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'load']
    });

    // Give extra time for background images to render
    await page.waitForTimeout(2000);

    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });

    console.log(`✅ PDF generated successfully: ${outputPath}`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    await browser.close();
  }
};

// Run the generator
generateChrisAdamsReport()
  .then(() => {
    console.log('Report generation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to generate report:', error);
    process.exit(1);
  });
