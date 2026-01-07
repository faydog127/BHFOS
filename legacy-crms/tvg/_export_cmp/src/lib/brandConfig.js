// BRAND SOP:
// 1. Receipts: Header (Logo), Footer (Credentials: NADCA, SDVOSB, Local, + Clean Air Cert if qualified)
// 2. Reports: Header (Logo), Footer (Credentials: Same as Receipts)
// 3. Proposals: Header (Logo), Credential Band (All qualified credentials)

// Canonical Asset Map
export const BRAND_ASSETS = {
  logo_url: '/assets/branding/TVG_logo.png',
  badge_nadca_url: '/assets/branding/NADCA-Logo-2016-RGB_hires.png',
  badge_clean_air_cert_url: '/assets/branding/CleanAirCert_Colored_no_background.png',
  badge_sdv_osb_url: '/assets/branding/Service-Disabled Veteran-Owned-Certified.png',
  badge_local_url: '/assets/branding/locally-owned.png'
};

// Default Brand Colors (TVG Blue/Grey standard)
// Can be overridden by DB settings passed in context
export const BRAND_COLORS = {
  primary: '#2563eb',    // Blue-600
  secondary: '#64748b',  // Slate-500
  accent: '#f59e0b',     // Amber-500
  text: '#0f172a',       // Slate-900
  background: '#ffffff', // White
};

/**
 * Builds the standardized brand asset payload for emails and documents.
 * Ensures consistent credential rows across all communication.
 * @param {Object} context - Context object (e.g., job, invoice, lead, db_settings)
 * @returns {Object} - Object containing all brand URLs, visibility flags, and config
 */
export const getBrandPayload = (context = {}) => {
  // Determine if Clean Air Cert badge should be shown based on specific job flag
  const showCleanAirCert = context?.has_clean_air_cert === true;

  // Allow DB overrides for colors if present in context
  const colors = context?.brand_colors ? { ...BRAND_COLORS, ...context.brand_colors } : BRAND_COLORS;

  return {
    ...BRAND_ASSETS,
    show_clean_air_cert: showCleanAirCert,
    company_name: 'The Vent Guys',
    company_url: 'https://vent-guys.com',
    primary_color: colors.primary,
    secondary_color: colors.secondary,
    accent_color: colors.accent,
    text_color: colors.text,
    background_color: colors.background,
    address_line: 'Melbourne, FL | Space Coast Serving Brevard & Volusia'
  };
};

/**
 * Generates the HTML string for the Professional Credentials section.
 * Designed to be injected into the footer of emails.
 * @param {Object} brandPayload - The payload returned from getBrandPayload
 * @returns {string} - HTML string for the credential row
 */
export const getCredentialRowHtml = (brandPayload) => {
  const { 
    badge_nadca_url, 
    badge_sdv_osb_url, 
    badge_local_url, 
    badge_clean_air_cert_url, 
    show_clean_air_cert 
  } = brandPayload;

  // Inline styles for email compatibility
  const containerStyle = "text-align: center; padding: 25px 10px; border-top: 1px solid #e2e8f0; margin-top: 30px; background-color: #f8fafc;";
  const titleStyle = "font-size: 11px; color: #64748b; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;";
  const imgStyle = "height: 35px; width: auto; margin: 0 12px; vertical-align: middle; display: inline-block;";

  return `
    <div style="${containerStyle}">
      <p style="${titleStyle}">Professional Credentials</p>
      <div>
        <img src="${badge_nadca_url}" alt="NADCA Certified" title="National Air Duct Cleaners Association" style="${imgStyle}" />
        <img src="${badge_sdv_osb_url}" alt="Veteran Owned" title="Service-Disabled Veteran-Owned Small Business" style="${imgStyle}" />
        <img src="${badge_local_url}" alt="Locally Owned" title="Locally Owned & Operated" style="${imgStyle}" />
        ${show_clean_air_cert ? `<img src="${badge_clean_air_cert_url}" alt="Clean Air Certified" title="Clean Air Certified" style="${imgStyle}" />` : ''}
      </div>
    </div>
  `;
};