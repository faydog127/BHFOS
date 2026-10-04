/**
 * One Finance entity profile. Screens and reports read this module only.
 * They do not fork per report and they do not read the other brand modules.
 *
 * TVG identity is the live public site vent-guys.com (read 2026-10-03):
 * header and footer logo /brand/logo-primary.png, CSS tokens in the site stylesheet
 * (--navy #173861, --navy-deep #091e39, --red #b52025, --maroon #831618, --ink #231f20),
 * copyright line "The Vent Guys", phone (321) 360-9704, email info@vent-guys.com,
 * tagline "We Clear What Others Miss".
 * The logo file is stored at public/assets/finance/tvg-logo-primary.png.
 * sha256 3df56b3d6bbcf91dab9adb74d5e1baf993a3720f8c21a53bd0245f2b31ccdd5c.
 * Evidence and the sources that were not adopted: docs/finance/ENTITY_BRAND.md.
 *
 * Black Horse / BHFOS stays incomplete. No live production mark was verified.
 */
export const TVG_LOGO_PATH = '/assets/finance/tvg-logo-primary.png';

const TVG_COLORS = Object.freeze({
  navyDeep: '#091e39',
  navy: '#173861',
  maroon: '#831618',
  red: '#b52025',
  ink: '#231f20',
  paper: '#ffffff',
});

export const ENTITY_BRAND_MISSING_INPUTS = Object.freeze([
  'A live Black Horse production logo, verified and stored in this repository.',
  'A live Black Horse color-token set. Repo defaults were not verified on a production site.',
  'Approved Black Horse legal name for Finance documents.',
  'Approved Black Horse contact block, only if a document requires it.',
]);

const PROFILES = Object.freeze({
  tvg: Object.freeze({
    productName: 'BHFOS',
    entityId: 'tvg',
    displayName: 'The Vent Guys',
    legalName: null,
    tagline: 'We Clear What Others Miss',
    logoUrl: TVG_LOGO_PATH,
    logoAlt: 'The Vent Guys',
    colors: TVG_COLORS,
    contact: Object.freeze({
      phone: '(321) 360-9704',
      email: 'info@vent-guys.com',
    }),
    identityLabel: 'The Vent Guys',
    complete: true,
    missingInputs: Object.freeze([]),
  }),
  bhfos: Object.freeze({
    productName: 'BHFOS',
    entityId: 'bhfos',
    displayName: null,
    legalName: null,
    tagline: null,
    logoUrl: null,
    logoAlt: null,
    colors: null,
    contact: null,
    identityLabel: 'BHFOS',
    complete: false,
    missingInputs: ENTITY_BRAND_MISSING_INPUTS,
  }),
});

export function resolveEntityBrand(entityId) {
  if (entityId === 'tvg') return PROFILES.tvg;
  if (entityId === 'bhfos' || entityId === 'blackhorse') return PROFILES.bhfos;
  return Object.freeze({
    productName: 'BHFOS',
    entityId: entityId || 'unassigned',
    displayName: null,
    legalName: null,
    tagline: null,
    logoUrl: null,
    logoAlt: null,
    colors: null,
    contact: null,
    identityLabel: 'BHFOS',
    complete: false,
    missingInputs: ENTITY_BRAND_MISSING_INPUTS,
  });
}
