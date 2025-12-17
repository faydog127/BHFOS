import brandConfigJson from '@/config/brand.config.json';

// Define base storage URL dynamically based on environment or default
const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wwyxohjnyqnegzbxtuxs.supabase.co';
const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_ASSET_BUCKET || 'vent-guys-images';
const STORAGE_URL = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${STORAGE_BUCKET}`;
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'tvg';
const tenantLogo = (brandConfigJson[TENANT_ID] || brandConfigJson.tvg || brandConfigJson.default || {}).logo_url;
const heroFallback = 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80';

/**
 * Centralized registry of all brand asset URLs pointing to Supabase Storage.
 * Using this ensures consistency across the application and makes updates easier.
 */
export const brandAssets = {
  logo: {
    // Prefer tenant-specific logo from config; fall back to known storage filenames
    main: tenantLogo || `${STORAGE_URL}/TVG_Logo.jpg`,
    // Upload a transparent/white version later and update this filename
    white: `${STORAGE_URL}/TVG_Logo_white.png`,
    icon: `${STORAGE_URL}/logo-icon.png`,
    iconWhite: `${STORAGE_URL}/logo-icon-white.png`,
  },
  mascot: {
    // Current bucket appears to store assets at the root (no folders)
    full: `${STORAGE_URL}/Mascot.png`,
    head: `${STORAGE_URL}/Mascot.png`,
    working: `${STORAGE_URL}/Mascot.png`,
    waving: `${STORAGE_URL}/Mascot-01.jpg`,
  },
  certifications: {
    // Root-level filenames confirmed in the storage bucket
    nadca: `${STORAGE_URL}/NADCA-Logo-2016-RGB_hires.png`,
    cleanAir: `${STORAGE_URL}/CleanAirCert_Colored_no_background.png`,
    sdvosb: `${STORAGE_URL}/Service-Disabled%20Veteran-Owned-Certified.png`,
    locallyOwned: `${STORAGE_URL}/locally-owned.png`,
    // Optional badges (upload later if desired)
    bbb: `${STORAGE_URL}/bbb-accredited.png`,
    epa: `${STORAGE_URL}/epa-certified.png`
  },
  backgrounds: {
    // If you upload a dedicated hero image to storage, point this at it.
    hero: `${STORAGE_URL}/hero-home.jpg`,
    pattern: `${STORAGE_URL}/subtle-pattern.png`,
    wave: `${STORAGE_URL}/wave-divider.svg`
  },
  placeholders: {
    user: `${STORAGE_URL}/placeholders/avatar-placeholder.png`,
    equipment: `${STORAGE_URL}/placeholders/equipment-placeholder.jpg`,
    hero: heroFallback
  }
};

/**
 * Official Brand Color Palette
 */
export const brandColors = {
  navy: '#0F172A',      // Primary Dark (slate-900)
  blue: '#2563EB',      // Primary Brand (blue-600)
  lightBlue: '#3B82F6', // Secondary Brand (blue-500)
  red: '#DC2626',       // Accent/Alert (red-600)
  orange: '#F97316',    // Call to Action (orange-500)
  black: '#020617',     // Text/Deep (slate-950)
  gray: '#64748B',      // Subtext (slate-500)
  lightGray: '#F1F5F9', // Backgrounds (slate-100)
  white: '#FFFFFF'
};

/**
 * Official Brand Tagline
 */
export const brandTagline = "We Clear What Others Miss";

/**
 * Helper to get certification array for easy mapping
 */
export const getCertificationsList = () => [
  { name: 'NADCA Member', src: brandAssets.certifications.nadca },
  { name: 'Clean Air Trust', src: brandAssets.certifications.cleanAir },
  { name: 'SDVOSB Certified', src: brandAssets.certifications.sdvosb }
];

export default brandAssets;
