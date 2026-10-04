# Finance entity brand

One profile module, `src/lib/finance/entityBrand.js`, feeds the Finance shell, Guided, Executive, Advanced, Monthly Check-In (the shell shows the mark), the report screen, and the print header and footer. Report builders do not name an entity. The logo is a file in this application. Report rendering does not request a remote URL.

## Sources compared

Ranked by what the live public product actually uses.

1. **Adopted.** https://vent-guys.com, read-only fetch on 2026-10-03. The HTML was last modified 2026-09-25. The header and footer image is `/brand/logo-primary.png` (PNG 1600×995). The stylesheet sets `--navy-deep: #091e39`, `--navy: #173861`, `--maroon: #831618`, `--red: #b52025`, `--ink: #231f20`, `--paper: #fff`. The footer shows phone `(321) 360-9704`, email `info@vent-guys.com`, the tagline “We Clear What Others Miss”, and “© 2026 The Vent Guys.” The homepage does not show an LLC suffix or a street address. The localized file is `command-center/public/assets/finance/tvg-logo-primary.png`. sha256 `3df56b3d6bbcf91dab9adb74d5e1baf993a3720f8c21a53bd0245f2b31ccdd5c`.
2. **Agrees, not fetched.** `Website/bhfos-site/src/brand.config.json` tenant `tvg` uses the same hexes and the same name and tagline. Its `logoPath` points at production Supabase storage on `wwyxohjnyqnegzbxtuxs`. That URL was not fetched and is not used.
3. **Agrees on color only.** Command Center marketing pages and `src/components/documents/QuoteDocument.jsx` hard-code `#173861` and `#b52025`. They are the same palette. They are not the logo file.
4. **Not adopted.** `src/config/brand.config.json` is CRM config: logo `storage://vent-guys-images/TVG_Logo.jpg`, colors `#0a56a6` / `#1e88e5`, email `admin@vent-guys.com`, and a Finsterwald street address. The live site does not use that palette or that email on the homepage.
5. **Not adopted.** `src/lib/brandConfig.js` points at `public/assets/branding/logo-secondary-lockup.png` and `logo-primary-seal.png`. Those files have different hashes from the live logo. Its colors are Tailwind defaults.
6. **Not adopted.** `src/lib/brandAssets.js` points at a remote `Logo_noBG.png` and a different color set.

The live site, the marketing hexes, and the bhfos-site TVG theme agree. The CRM config, `brandConfig.js`, and `brandAssets.js` disagree with the live site and with each other. They are not a second production treatment. The decision is source 1.

## Black Horse

`resolveEntityBrand('bhfos')` stays incomplete: product name BHFOS, no logo, no colors. `Website/public/blackhorse-logo.png` and the bhfos-site default tenant colors were not verified against a live Black Horse production site, so they are not a Finance profile. An incomplete profile renders a visible non-print “Brand pending” line. The TVG profile is complete, so that line is not shown on the TVG Finance route.
