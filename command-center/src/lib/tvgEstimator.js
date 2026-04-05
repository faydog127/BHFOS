
import { getPriceFromBook } from '@/lib/pricing';

/**
 * TVG Estimator Algorithm v3.0 (Dynamic Pricing)
 * 
 * Calculates estimate totals based strictly on the provided priceBook array.
 * If a price is missing in the DB, it uses safe fallbacks to prevent crashes,
 * but logs a warning.
 */

export const calculateEstimate = (inputs, priceBook, partner = null) => {
    // 1. Helper to safely get price using the new utility
    const getPrice = (code, defaultPrice) => {
        // We log warnings for missing codes during development to help catch DB sync issues
        const price = getPriceFromBook(priceBook, code, -1);
        if (price === -1) {
            console.warn(`[Estimator] Missing price for code: ${code}. Using default: ${defaultPrice}`);
            return defaultPrice;
        }
        return price;
    };
    
    // 2. Parse Inputs
    const numSystems = Math.max(1, parseInt(inputs.numSystems || 1));
    const numSupply = parseInt(inputs.numSupply || 0);
    const numReturns = parseInt(inputs.numReturns || 0);
    
    // Service Selection
    const services = inputs.services || { duct: true, dryer: false, audit: false };
    const hasDuct = services.duct === true;
    const hasDryer = services.dryer === true;
    const hasAudit = services.audit === true;

    // Dryer Inputs
    const dryerRoof = inputs.dryerRoof || false;
    const dryerLongRun = inputs.dryerLongRun || false;

    // Access Inputs
    const accessLocations = Array.isArray(inputs.accessLocations) ? inputs.accessLocations : [inputs.accessType || 'closet'];

    // Travel
    const tripZone = inputs.tripZone || 'TRIP-ZONE-1';

    // Health Profile
    const health = inputs.healthProfile || {};

    // 3. Initialize Line Items Container
    let lineItems = [];

    // --- A. HVAC CLEANING BASE ---
    if (hasDuct) {
        // Base price covers 1 system (12 vents included)
        const sys1Price = getPrice('DUCT-SYS1', 149);
        lineItems.push({
            code: 'DUCT-SYS1',
            name: 'Primary HVAC System Cleaning (Negative Air)',
            qty: 1,
            unitPrice: sys1Price,
            total: sys1Price,
            category: 'duct',
            tier: 'base'
        });

        if (numSystems > 1) {
            const sys2Price = getPrice('DUCT-SYS2', 129);
            const qty = numSystems - 1;
            lineItems.push({
                code: 'DUCT-SYS2',
                name: 'Additional HVAC System(s)',
                qty: qty,
                unitPrice: sys2Price,
                total: sys2Price * qty,
                category: 'duct',
                tier: 'base'
            });
        }

        // --- B. VENT OVERAGES (Standard 12 Rule) ---
        // Only apply if Duct cleaning is selected
        const includedSupply = numSystems * 12;
        const includedReturns = numSystems * 1;
        const extraSupplyCount = Math.max(0, numSupply - includedSupply);
        const extraReturnCount = Math.max(0, numReturns - includedReturns);

        if (extraSupplyCount > 0) {
            const price = getPrice('DUCT-SUP-XTRA', 20);
            lineItems.push({
                code: 'DUCT-SUP-XTRA',
                name: 'Additional Supply Vents',
                qty: extraSupplyCount,
                unitPrice: price,
                total: price * extraSupplyCount,
                category: 'duct',
                tier: 'base'
            });
        }

        if (extraReturnCount > 0) {
            const price = getPrice('DUCT-RET-XTRA', 40);
            lineItems.push({
                code: 'DUCT-RET-XTRA',
                name: 'Additional Return Grills',
                qty: extraReturnCount,
                unitPrice: price,
                total: price * extraReturnCount,
                category: 'duct',
                tier: 'base'
            });
        }

        // --- C. ACCESS MODIFIERS ---
        const accessMap = {
            'attic': 'ACC-ATTIC',
            'crawl': 'ACC-CRAWL',
            'crawlspace': 'ACC-CRAWL',
            'tight': 'ACC-TIGHT',
            'roof': 'ACC-ROOF',
            '2nd': 'ACC-2ND'
        };

        accessLocations.forEach((loc, idx) => {
            const sku = accessMap[loc];
            if (sku) {
                const price = getPrice(sku, 0);
                if (price > 0) {
                    lineItems.push({
                        code: sku,
                        name: `Access: ${loc.charAt(0).toUpperCase() + loc.slice(1)} (Sys ${idx + 1})`,
                        qty: 1,
                        unitPrice: price,
                        total: price,
                        category: 'access',
                        tier: 'base'
                    });
                }
            }
        });
    }

    // --- D. INDOOR AIR AUDIT ---
    if (hasAudit) {
        const auditPrice = getPrice('IAQ-AUDIT', 149);
        lineItems.push({
            code: 'IAQ-AUDIT',
            name: 'Diagnostic Air Audit',
            qty: 1,
            unitPrice: auditPrice,
            total: auditPrice,
            category: 'audit',
            tier: 'base'
        });
    }

    // --- E. TRIP CHARGE ---
    const tripPrice = getPrice(tripZone, 29);
    lineItems.push({
        code: tripZone,
        name: 'Travel / Setup Fee',
        qty: 1,
        unitPrice: tripPrice,
        total: tripPrice,
        category: 'trip',
        tier: 'base'
    });

    // --- CALCULATE BASE TOTAL ---
    let baseTotal = lineItems.reduce((acc, item) => acc + item.total, 0);

    // --- F. PACKAGES (Good / Better / Best) ---
    
    // Prices for add-ons
    const dryerBasePrice = getPrice('DV-STD', 129);
    const sanitizerPrice = getPrice('SANITIZER-BASIC', 49);
    const uvPrice = getPrice('HDW-UV-010', 299);
    const coilPrice = getPrice('COIL-CLEAN', 149);
    const blowerRestorePrice = getPrice('BLOWER-RESTORE', 199);
    const pcoUpgradePrice = getPrice('HDW-PCO-010', 499);
    
    // Dryer Component Calculation
    if (hasDryer) {
        let dryerTotal = dryerBasePrice;
        
        lineItems.push({
            code: 'DV-STD',
            name: 'Standard Dryer Vent Cleaning',
            qty: 1,
            unitPrice: dryerBasePrice,
            total: dryerBasePrice,
            category: 'dryer',
            tier: 'base'
        });

        if (dryerRoof) {
            const roofPrice = getPrice('DV-ROOF', 35);
            dryerTotal += roofPrice;
            lineItems.push({
                code: 'DV-ROOF',
                name: 'Dryer Access: Roof',
                qty: 1,
                unitPrice: roofPrice,
                total: roofPrice,
                category: 'dryer',
                tier: 'base'
            });
        }
        if (dryerLongRun) {
             const longRunPrice = getPrice('DV-XTRA', 25);
             dryerTotal += longRunPrice;
             lineItems.push({
                code: 'DV-XTRA',
                name: 'Dryer: Long Run Overage',
                qty: 1,
                unitPrice: longRunPrice,
                total: longRunPrice,
                category: 'dryer',
                tier: 'base'
            });
        }
    }

    let coreServiceTotal = lineItems.reduce((acc, item) => acc + item.total, 0);

    const pkgSanitizer = hasDuct ? (sanitizerPrice * numSystems) : 0;
    const pkgUV = hasDuct ? (uvPrice * numSystems) : 0;
    const pkgCoil = hasDuct ? (coilPrice * numSystems) : 0;
    const pkgBlower = hasDuct ? (blowerRestorePrice * numSystems) : 0;
    const pkgPCO = hasDuct ? (pcoUpgradePrice * numSystems) : 0;

    // Calculate Totals per Tier
    let rawTotals = {
        good: coreServiceTotal,
        better: coreServiceTotal,
        best: coreServiceTotal
    };

    if (hasDuct) {
        // Good: Base + Sanitizer
        rawTotals.good += pkgSanitizer;

        // Better: Base + Sanitizer + UV + Coil
        rawTotals.better += pkgSanitizer + pkgUV + pkgCoil;

        // Best: Base + Sanitizer + PCO + Blower + Coil
        rawTotals.best += pkgSanitizer + pkgPCO + pkgCoil + pkgBlower;
    }

    // --- G. PARTNER DISCOUNT LOGIC ---
    const MIN_CHARGE = getPrice('MIN-VISIT', 199);
    
    let discountAmounts = { good: 0, better: 0, best: 0 };
    let finalTotals = { ...rawTotals };
    let discountClipped = false;

    if (partner && partner.discount_active) {
        ['good', 'better', 'best'].forEach(tier => {
            if (partner.discount_type === 'percent') {
                 discountAmounts[tier] = rawTotals[tier] * (Number(partner.discount_value) / 100);
            } else {
                 discountAmounts[tier] = Number(partner.discount_value);
            }
            finalTotals[tier] = Math.max(MIN_CHARGE, rawTotals[tier] - discountAmounts[tier]);
        });
    }

    // --- H. RECOMMENDATIONS ---
    let recommendations = [];
    
    if (hasDuct) {
        if (inputs.moldDetected) {
            recommendations.push({
                id: 'mold-remediation',
                type: 'critical',
                title: 'Microbial Treatment',
                desc: 'Essential for addressing visible growth.',
                price: sanitizerPrice,
                includedIn: ['good', 'better', 'best']
            });
        }
        if (health.asthma || health.immunocompromised) {
            recommendations.push({
                id: 'pco-upgrade',
                type: 'upgrade',
                title: 'Hospital-Grade PCO Air Purifier',
                desc: 'Active neutralization of viruses & bacteria.',
                price: pcoUpgradePrice,
                includedIn: ['best'],
                upgradeFor: ['good', 'better']
            });
        }
    }

    return {
        lineItems,
        totals: finalTotals,
        baseTotals: rawTotals,
        discounts: discountAmounts,
        discountClipped,
        meta: {
            numSystems,
            hasDuct,
            hasDryer,
            hasAudit,
            healthProfile: health
        },
        recommendations
    };
};
