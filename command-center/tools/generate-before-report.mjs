import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_VENDOR = 'RB Heating and Air';

const parseArgs = (argv) => {
  const args = { input: '', output: '', estimate: '', evaluation: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) continue;
    if (key === '--input') args.input = value;
    if (key === '--output') args.output = value;
    if (key === '--estimate') args.estimate = value;
    if (key === '--evaluation') args.evaluation = value;
  }
  return args;
};

const exists = async (p) => {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
};

const listImages = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
};

const runOptimizeImages = async (assetsDir) => {
  const scriptPath = path.resolve(__dirname, 'optimize-images.ps1');
  if (!(await exists(scriptPath))) return { ok: false, error: 'optimize-images.ps1 not found' };

  return await new Promise((resolve) => {
    const child = spawn(
      'pwsh',
      ['-NoProfile', '-File', scriptPath, '-Path', assetsDir, '-MaxDimension', '1600', '-Quality', '82'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: stderr.trim() || `Image optimizer exited with code ${code}` });
    });
  });
};

const copyBrandingAssets = async (assetsDir) => {
  const brandingDir = path.join(assetsDir, 'branding');
  await fs.mkdir(brandingDir, { recursive: true });

  // Keep the output bundle clean: only include the logos we explicitly use.
  try {
    const existing = await fs.readdir(brandingDir, { withFileTypes: true });
    await Promise.all(
      existing
        .filter((entry) => entry.isFile())
        .map((entry) => fs.unlink(path.join(brandingDir, entry.name)).catch(() => {})),
    );
  } catch {
    // ignore
  }

  const srcRoot = path.resolve(__dirname, '..', 'public', 'assets', 'branding');
  const files = [
    { src: path.join(srcRoot, 'logo-primary-seal.png'), dst: path.join(brandingDir, 'logo-primary-seal.png') },
    { src: path.join(srcRoot, 'badge-nadca.png'), dst: path.join(brandingDir, 'badge-nadca.png') },
  ];

  await Promise.all(
    files.map(async ({ src, dst }) => {
      if (!(await exists(src))) return;
      await fs.copyFile(src, dst);
    }),
  );
};

const readJson = async (p) => {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
};

const readJsonIfExists = async (p) => {
  try {
    return await readJson(p);
  } catch {
    return null;
  }
};

const writeJson = async (p, value) => {
  await fs.writeFile(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const asString = (v) => (typeof v === 'string' ? v.trim() : '');

const stripPlaceholders = (value) => {
  const raw = asString(value);
  if (!raw) return '';
  return raw
    .replace(/\(\s*fill\s+in\s+full\s+address\s*\)/gi, '')
    .replace(/\bfill\s+in\s+full\s+address\b/gi, '')
    .replace(/\(\s*full\s+address\s+to\s+be\s+confirmed\s*\)/gi, '')
    .replace(/\bfull\s+address\s+to\s+be\s+confirmed\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .trim();
};

const isMissingOrPlaceholder = (value) => {
  const raw = asString(value);
  if (!raw) return true;
  const normalized = raw.toLowerCase();
  if (normalized === 'address not available') return true;
  if (normalized === 'n/a' || normalized === 'na') return true;
  if (normalized === 'tbd' || normalized === 'unknown') return true;
  return false;
};

const parseServiceAddress = (value) => {
  const raw = stripPlaceholders(asString(value));
  if (isMissingOrPlaceholder(raw)) return { address: '', city: '', state: '', zip: '' };

  const oneLine = raw.replace(/\s*\r?\n\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
  const match = oneLine.match(/^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\s*$/);
  if (!match) return { address: oneLine, city: '', state: '', zip: '' };

  return {
    address: asString(match[1]),
    city: asString(match[2]),
    state: asString(match[3]).toUpperCase(),
    zip: asString(match[4]),
  };
};

const extractPropertyParts = (obj) => {
  if (!obj || typeof obj !== 'object') return { address: '', city: '', state: '', zip: '' };

  const address1 = stripPlaceholders(asString(obj.address1));
  const address2 = stripPlaceholders(asString(obj.address2));
  const addressLine = stripPlaceholders(asString(obj.address));
  const structuredAddress = [address1, address2].filter(Boolean).join(', ') || addressLine;

  const serviceAddressRaw = asString(obj.service_address) || asString(obj.serviceAddress);
  const parsedService = parseServiceAddress(serviceAddressRaw);

  const address = stripPlaceholders(structuredAddress || parsedService.address);
  const city = asString(obj.city) || parsedService.city;
  const state = asString(obj.state) || parsedService.state;
  const zip = asString(obj.zip) || parsedService.zip;

  return {
    address: isMissingOrPlaceholder(address) ? '' : address,
    city: isMissingOrPlaceholder(city) ? '' : city,
    state: isMissingOrPlaceholder(state) ? '' : state,
    zip: isMissingOrPlaceholder(zip) ? '' : zip,
  };
};

const resolvePropertyFromWorkflow = (cfg) => {
  const sources = [
    cfg?.work_order,
    cfg?.workOrder,
    cfg?.job,
    cfg?.invoice,
    cfg?.estimate,
    cfg?.customer,
    // Lowest priority fallback (often hand-edited / local-output owned)
    cfg?.property,
  ];

  const out = { address: '', city: '', state: '', zip: '' };

  for (const src of sources) {
    const parts = extractPropertyParts(src);
    if (!out.address && parts.address) out.address = parts.address;
    if (!out.city && parts.city) out.city = parts.city;
    if (!out.state && parts.state) out.state = parts.state;
    if (!out.zip && parts.zip) out.zip = parts.zip;
  }

  out.address = stripPlaceholders(out.address);
  return out;
};

const mergeConfigWithSiblingWorkflow = (cfg, siblingCfg) => {
  if (!cfg || typeof cfg !== 'object') return siblingCfg;
  if (!siblingCfg || typeof siblingCfg !== 'object') return cfg;

  const merged = { ...cfg };

  const cfgProp = cfg?.property && typeof cfg.property === 'object' ? cfg.property : {};
  const sibProp = siblingCfg?.property && typeof siblingCfg.property === 'object' ? siblingCfg.property : {};

  const pick = (primary, fallback) => {
    const cleanPrimary = stripPlaceholders(asString(primary));
    if (!isMissingOrPlaceholder(cleanPrimary)) return cleanPrimary;
    const cleanFallback = stripPlaceholders(asString(fallback));
    return isMissingOrPlaceholder(cleanFallback) ? '' : cleanFallback;
  };

  merged.property = {
    ...cfgProp,
    address: pick(cfgProp.address, sibProp.address),
    city: pick(cfgProp.city, sibProp.city),
    state: pick(cfgProp.state, sibProp.state),
    zip: pick(cfgProp.zip, sibProp.zip),
  };

  return merged;
};

const formatDate = (value) => {
  const raw = asString(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return raw;
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(parsed);
  } catch {
    return raw;
  }
};

const todayIsoLocal = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatMoney = (n, currency = 'USD') => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sanitizeCustomerCopy = (value) => {
  const raw = asString(value);
  if (!raw) return '';
  return raw
    .replace(/\bbuyer\s+perception\s+risk\b/gi, 'perception risk')
    .replace(/\bhome[-\s]?sale\s+context\b/gi, 'home context');
};

const captionForFilename = (filename) => {
  const map = new Map([
    ['IMG_5006.jpeg', 'Evaporator coil face with a dryer sheet resting on the coil fins; visible debris buildup.'],
    ['IMG_5008.jpeg', 'Close-up: dryer sheets on the evaporator coil fins with heavy residue buildup.'],
    ['IMG_4998.jpeg', 'Evaporator coil surface showing significant accumulation on coil fins (restricts airflow and impacts system performance).'],
    ['IMG_4995.jpeg', 'Blower wheel blades with visible buildup (this is what moves air through the home).'],
    ['IMG_5010.jpeg', 'Close-up: blower wheel blade buildup/film (can shed downstream into supply air).'],
    ['IMG_4993.jpeg', 'Air handler interior: dust/particulate accumulation in the cabinet around the blower compartment.'],
    ['IMG_4994.jpeg', 'Blower motor compartment showing dust accumulation on components and wiring.'],
    ['IMG_4996.jpeg', 'Blower housing and wheel area showing buildup on surrounding surfaces.'],
    ['IMG_4997.jpeg', 'Coil compartment/piping area showing debris and dust accumulation inside the air handler.'],
    ['IMG_4999.jpeg', 'Air handler interior surfaces with dust accumulation above the coil compartment.'],
    ['IMG_5001.jpeg', 'Air handler interior detail showing residue build-up on internal surfaces near the coil section.'],
    ['IMG_5002.jpeg', 'Additional blower wheel buildup visible along blade edges.'],
    ['IMG_5003.jpeg', 'Blower wheel housing detail showing lint/dust buildup along seams and surfaces.'],
    ['IMG_5004.jpeg', 'Dust buildup visible on blower motor wiring harness and connectors.'],
    ['IMG_5005.jpeg', 'Filter size reference: 20×20×1.'],
    ['IMG_5009.jpeg', 'Blower motor/control area showing dust accumulation on electrical connections.'],
    ['IMG_5011.jpeg', 'Air handler internal section (heat strip/duct section) showing dust accumulation on adjacent surfaces.'],
  ]);

  return map.get(filename) || 'Before-condition photo evidence.';
};

const normalizeActionPath = (evaluation) => {
  if (!evaluation || typeof evaluation !== 'object') return 'Document Follow-Up';
  if (evaluation.licensed_hvac_review_recommended) return 'Licensed HVAC Follow-Up';
  if (evaluation.documentation_followup_required || asString(evaluation.verification_status) === 'Unverified') {
    return 'Additional Verification Required';
  }
  const systemCondition = asString(evaluation.system_condition);
  if (systemCondition === 'Heavily Compromised' || systemCondition === 'Compromised') return 'Corrective Cleaning';
  return 'Observe';
};

const buildSystemConditionSummary = (evaluation, vendorName) => {
  if (!evaluation || typeof evaluation !== 'object') return 'Before-condition findings are documented in this report.';

  const condition = safeSystemConditionLabel(evaluation);
  const verification = asString(evaluation.verification_status) || 'Unverified';

  const findings = Array.isArray(evaluation.findings) ? evaluation.findings : [];
  const severeMajorAirContact = Array.from(
    new Set(
      findings
        .filter((f) => asString(f?.component_class) === 'major' && asString(f?.airflow_interaction) === 'in_path' && asString(f?.severity) === 'Severe')
        .map((f) => asString(f?.component))
        .filter(Boolean),
    ),
  );

  const formatComponentList = (list) => {
    const items = Array.isArray(list) ? list.filter(Boolean) : [];
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items[0]} and ${items[1]}`;
  };

  const componentText = formatComponentList(severeMajorAirContact);

  const sentence1 = componentText
    ? `${condition}: severe before-condition contamination is documented on ${componentText}.`
    : `${condition}: documented findings support this classification.`;

  const sentence2 =
    verification === 'Unverified'
      ? `Verification remains Unverified due to missing after-service documentation for outsourced AHU scope${vendorName ? ` (${vendorName})` : ''}; restored/clean claims are blocked.`
      : verification === 'Partially Verified'
        ? 'Verification is Partially Verified; documentation gaps remain for represented scope.'
        : 'Verification is Verified Restored across represented scope.';

  return `${sentence1} ${sentence2}`;
};

const buildStatusNarrative = (evaluation, nextStep) => {
  if (!evaluation || typeof evaluation !== 'object') {
    return {
      line1: 'Before-condition findings are documented in this report.',
      line2: 'This report documents photo-backed evidence of observed conditions.',
      line3: nextStep ? `Next step: ${nextStep}` : '',
      blockedNote: '',
    };
  }

  const findings = Array.isArray(evaluation.findings) ? evaluation.findings : [];
  const severeMajorAirContact = Array.from(
    new Set(
      findings
        .filter((f) => asString(f?.component_class) === 'major' && asString(f?.airflow_interaction) === 'in_path' && asString(f?.severity) === 'Severe')
        .map((f) => asString(f?.component))
        .filter(Boolean),
    ),
  );

  const formatComponentList = (list) => {
    const items = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    return `${items[0]} and ${items[1]}`;
  };

  const friendlyComponentName = (value) => {
    const raw = asString(value);
    if (!raw) return '';
    if (raw === 'Evaporator Coil') return 'evaporator coil';
    if (raw.startsWith('Blower Assembly')) return 'blower assembly';
    return raw.toLowerCase();
  };

  const friendlyComponents = severeMajorAirContact.map(friendlyComponentName).filter(Boolean);

  const componentText = formatComponentList(friendlyComponents);
  const line1 = componentText
    ? `Severe contamination is documented on the ${componentText}.`
    : 'Documented findings support the reported classification.';

  const line2 = 'This report documents photo-backed evidence of observed conditions.';

  const line3 = nextStep ? `Next step: ${nextStep}` : '';

  const blockedNote = '';

  return { line1, line2, line3, blockedNote };
};

const safeSystemConditionLabel = (evaluation) => {
  const raw = asString(evaluation?.system_condition) || asString(evaluation?.system_status_summary?.system_condition) || '';
  const verification = asString(evaluation?.verification_status) || asString(evaluation?.system_status_summary?.verification_status) || '';
  if ((raw === 'Clean' || raw === 'Partially Restored') && verification !== 'Verified Restored') {
    return 'Compromised';
  }
  return raw || 'Compromised';
};

const conditionToneClass = (label) => {
  const value = asString(label);
  if (value === 'Heavily Compromised' || value === 'Compromised') return 'critical';
  if (value === 'Partially Restored') return 'warning';
  if (value === 'Clean') return 'ok';
  return 'critical';
};

const riskPillClass = (risk) => {
  const value = asString(risk);
  if (value === 'High') return 'high';
  if (value === 'Moderate') return 'warning';
  if (value === 'Low') return 'neutral';
  return 'neutral';
};

const verificationPillClass = (status) => {
  const value = asString(status);
  if (value === 'Verified') return 'ok';
  if (value === 'Verified Restored') return 'ok';
  if (value === 'Partially Verified') return 'warning';
  return 'neutral';
};

const actionPathPillLabel = (actionPath) => {
  const value = asString(actionPath);
  if (value.startsWith('Additional Verification')) return 'Additional Verification Required';
  if (value.startsWith('Verification Required')) return 'Additional Verification Required';
  if (value === 'Licensed HVAC Follow-Up') return 'Licensed HVAC Follow-Up';
  if (value === 'Corrective Cleaning') return 'Corrective Cleaning';
  if (value === 'Observe') return 'Observe';
  return value || 'Additional Verification Required';
};

const actionPillClass = (actionPath) => {
  const value = asString(actionPathPillLabel(actionPath));
  if (value === 'Additional Verification Required') return 'warning';
  if (value === 'Licensed HVAC Follow-Up') return 'high';
  if (value === 'Corrective Cleaning') return 'warning';
  return 'neutral';
};

const getComponentSeverity = (evaluation, component) => {
  const list = Array.isArray(evaluation?.component_assessments) ? evaluation.component_assessments : [];
  const match = list.find((entry) => asString(entry?.component) === component);
  return asString(match?.worst_severity) || 'Not Assessed';
};

const photoComponentForFilename = (filename) => {
  const map = new Map([
    // Coil / coil section
    ['IMG_4998.jpeg', 'Evaporator Coil'],
    ['IMG_5006.jpeg', 'Evaporator Coil'],
    ['IMG_5008.jpeg', 'Evaporator Coil'],
    ['IMG_4997.jpeg', 'Evaporator Coil'],
    ['IMG_4999.jpeg', 'AHU Cabinet/Insulation'],
    ['IMG_5001.jpeg', 'AHU Cabinet/Insulation'],

    // Blower
    ['IMG_4995.jpeg', 'Blower Assembly (wheel/housing)'],
    ['IMG_5002.jpeg', 'Blower Assembly (wheel/housing)'],
    ['IMG_5003.jpeg', 'Blower Assembly (wheel/housing)'],
    ['IMG_5010.jpeg', 'Blower Assembly (wheel/housing)'],
    ['IMG_4996.jpeg', 'Blower Assembly (wheel/housing)'],

    // Wiring / electrical
    ['IMG_5004.jpeg', 'Electrical/Wiring Compartment'],
    ['IMG_5009.jpeg', 'Electrical/Wiring Compartment'],
    ['IMG_4994.jpeg', 'Electrical/Wiring Compartment'],

    // Cabinet / interior
    ['IMG_4993.jpeg', 'AHU Cabinet/Insulation'],
    ['IMG_5011.jpeg', 'AHU Cabinet/Insulation'],

    // Filter
    ['IMG_5005.jpeg', 'Filter/Filter Housing'],
  ]);

  return map.get(filename) || 'Other/Unspecified';
};

const buildHtml = (cfg, images, evaluation) => {
  const estimateNumber = escapeHtml(asString(cfg?.estimate?.number) || asString(cfg?.estimateNumber) || '');
  const reportDate = formatDate(asString(cfg?.report?.date) || asString(cfg?.reportDate) || todayIsoLocal());
  const customerName = escapeHtml(asString(cfg?.customer?.name) || 'Homeowner');
  const property = resolvePropertyFromWorkflow(cfg);
  if (!property.address) {
    throw new Error('Missing property address in workflow data. Provide cfg.property.address or a workflow-owned service_address on work_order / invoice / estimate.');
  }
  const propertyAddress = escapeHtml(property.address);
  const propertyCity = escapeHtml(property.city);
  const propertyState = escapeHtml(property.state);
  const propertyZip = escapeHtml(property.zip);
  const propertyLocation = [propertyCity, propertyState, propertyZip].filter(Boolean).join(', ');
  const preparedBy = escapeHtml(asString(cfg?.report?.preparedBy) || 'The Vent Guys');
  const preparedFor = escapeHtml(asString(cfg?.report?.preparedFor) || customerName);
  const vendorRaw = asString(cfg?.outsourced?.vendor) || DEFAULT_VENDOR;
  const vendorName = escapeHtml(vendorRaw);
  const decision = evaluation && typeof evaluation === 'object'
    ? evaluation.system_status_summary
    : (cfg?.mechanical_hygiene_decision && typeof cfg.mechanical_hygiene_decision === 'object'
      ? cfg.mechanical_hygiene_decision
      : null);

  const representationLimitsClause = escapeHtml(
    asString(evaluation?.representation_limits?.fixed_clause) ||
    asString(decision?.representation_limits_clause) ||
      'Representation Limits (Mechanical Hygiene): This is an observational Mechanical Hygiene report, not a medical assessment. It is not a mold diagnosis and does not confirm microbial conditions unless separately licensed testing and documentation are provided. It is not a mechanical failure diagnosis unless specifically noted as requiring licensed HVAC evaluation. Findings and conclusions are based on visual inspection and available documentation at the time of service.',
  );

  const photoCards = images
    .map((filename) => {
      const component = photoComponentForFilename(filename);
      const severity = evaluation ? getComponentSeverity(evaluation, component) : '';
      const caption = escapeHtml(captionForFilename(filename));
      const safeAlt = caption || 'Photo';
      const src = `assets/${encodeURIComponent(filename)}`;
      return `
        <figure class="card">
          <img src="${src}" alt="${safeAlt}" />
          <figcaption>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px;">
              <span class="pill" style="background:#fff;border-color:rgba(147,147,147,0.55);color:#0b1b4a;">Photo ID: ${escapeHtml(filename.replace(/\.[^.]+$/, ''))}</span>
              <span class="pill" style="background:#fff;border-color:rgba(147,147,147,0.55);color:#0b1b4a;">Component: ${escapeHtml(component)}</span>
              ${severity ? `<span class="pill" style="background:#fff;border-color:rgba(147,147,147,0.55);color:#0b1b4a;">Severity: ${escapeHtml(severity)}</span>` : ''}
            </div>
            ${caption}
          </figcaption>
        </figure>
      `.trim();
    })
    .join('\n');

  const logoSrc = 'assets/branding/logo-primary-seal.png';
  const nadcaBadgeSrc = 'assets/branding/badge-nadca.png';
  const nextStep = asString(cfg?.report?.nextStep) || asString(cfg?.report?.next_step) || 'Schedule a Cleaning.';
  const verificationStatusDisplay = asString(cfg?.report?.verificationStatus) || asString(cfg?.report?.verification_status) || 'Verified';
  const statusNarrative = buildStatusNarrative(evaluation, nextStep);
  const conditionLabel = evaluation ? safeSystemConditionLabel(evaluation) : (asString(decision?.verdict) || asString(decision?.overall_verdict_label) || 'Compromised');
  const verificationStatus = verificationStatusDisplay;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Total Home Refresh — Before Condition Report${estimateNumber ? ` (Estimate #${estimateNumber})` : ''}</title>
    <style>
      :root {
        --ink: #231f20;
        --muted: #475569;
        --border: #e2e8f0;
        --bg: #f8fafc;
        /* TVG brand guide palette */
        --navy-dark: #091e39;
        --navy: #173861;
        --maroon: #831618;
        --red: #b52025;
        --orange: #cd743f;
        --peach: #f1b57b;
        --gray: #939393;
        --light-gray: #d1d3d4;
        --green: #166534;
      }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif; color: var(--ink); }
      .wrap { max-width: 980px; margin: 0 auto; padding: 24px; }
      .header { background: linear-gradient(135deg, var(--navy-dark), var(--navy)); color: #fff; padding: 18px 22px 18px 22px; border-radius: 16px; position: relative; overflow: hidden; }
      .header:before { content: ""; position: absolute; left: -40px; top: -48px; width: 160px; height: 220px; background: rgba(181,32,37,0.85); transform: rotate(18deg); }
      .header:after { content: ""; position: absolute; right: -80px; bottom: -90px; width: 240px; height: 240px; background: rgba(181,32,37,0.20); border-radius: 999px; }
      .header-inner { position: relative; z-index: 2; display: grid; grid-template-columns: 1fr; gap: 10px; }
      .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .brand-row img { max-height: 78px; width: auto; display: block; }
      .header h1 { margin: 0; font-size: 24px; line-height: 1.18; letter-spacing: -0.01em; }
      .header .sub { margin-top: 6px; color: rgba(219,234,254,0.95); font-size: 13px; }
      .property-anchor { margin-top: 12px; background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.18); padding: 12px 12px; border-radius: 14px; }
      .property-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(219,234,254,0.95); }
      .property-value { margin-top: 4px; font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -0.01em; }
      .property-sub { margin-top: 2px; font-size: 12px; color: rgba(219,234,254,0.95); }
      .meta { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .meta .box { background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.18); padding: 10px 12px; border-radius: 12px; font-size: 13px; }
      .meta strong { display: block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #dbeafe; margin-bottom: 3px; }
      h2 { font-size: 16px; margin: 26px 0 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border); color: #0b1b4a; }
      p { margin: 10px 0; line-height: 1.55; }
      .callout { background: var(--bg); border: 1px solid var(--border); border-left: 5px solid #3b82f6; padding: 14px 16px; border-radius: 12px; }
      .callout ul { margin: 8px 0 0; padding-left: 18px; }
      .callout li { margin: 6px 0; }
      .small { color: var(--muted); font-size: 12px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .card { margin: 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #fff; break-inside: avoid; page-break-inside: avoid; }
      .card img { width: 100%; height: auto; display: block; }
      .card figcaption { padding: 10px 12px; font-size: 12px; color: var(--muted); line-height: 1.35; }
      .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #ecfdf5; color: var(--green); font-size: 12px; font-weight: 600; border: 1px solid #bbf7d0; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid var(--border); padding: 10px; vertical-align: top; }
      th { text-align: left; background: var(--bg); font-size: 12px; color: #0b1b4a; }
      td { font-size: 13px; }
      .right { text-align: right; white-space: nowrap; }
      .page-break { break-before: page; page-break-before: always; }
      .footer { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; }
      @media screen and (max-width: 720px) { .grid { grid-template-columns: 1fr; } .meta { grid-template-columns: 1fr; } }
      @page { margin: 0.55in; }
      @media print {
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .status, .callout, .card, .tier, .limits { break-inside: avoid; page-break-inside: avoid; }
        h2 { break-after: avoid-page; page-break-after: avoid; }
        .status-item--wide { grid-column: 1 / -1; }
      }
      .method-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
      .badge { width: 116px; max-width: 32%; height: auto; display: block; }
      .status { border: 1px solid var(--border); background: #fff; border-radius: 16px; padding: 18px; }
      .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin-bottom: 16px; align-items: start; }
      .status-item { border: 1px solid var(--border); background: var(--bg); border-radius: 12px; padding: 10px 10px; }
      .status-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px; line-height: 1.25; }
      .status-pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; border: 1px solid var(--border); background: #fff; line-height: 1.2; }
      .status-pill.neutral { background: #f1f5f9; color: #0b1b4a; }
      .status-pill.warning { background: #fef3c7; color: #92400e; border-color: rgba(146,64,14,0.25); }
      .status-pill.high { background: #fee2e2; color: #991b1b; border-color: rgba(153,27,27,0.25); }
      .status-pill.ok { background: #dcfce7; color: #166534; border-color: rgba(22,101,52,0.25); }
      .status-hero { margin-bottom: 16px; }
      .status-hero-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 4px; }
      .status-hero-value { font-size: 22px; font-weight: 800; color: #0b1b4a; }
      .status-hero-value.critical { color: var(--red); }
      .status-hero-value.warning { color: #92400e; }
      .status-hero-value.ok { color: var(--green); }
      .status-summary { font-size: 13px; line-height: 1.5; color: #334155; margin: 0 0 10px 0; }
      .status-summary div { margin: 0 0 6px 0; }
      .status-summary div:last-child { margin-bottom: 0; }
      .status-footnote { font-size: 11px; color: var(--muted); }
      .limits { border: 1px dashed rgba(147,147,147,0.65); background: #fff; border-radius: 14px; padding: 12px 14px; }
      .limits-title { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px 0; font-weight: 800; }
      .limits-body { font-size: 12px; color: var(--muted); line-height: 1.45; margin: 0; }
      .tier { border: 1px solid var(--border); background: #fff; border-radius: 14px; padding: 14px 16px; }
      .tier-title { margin: 0 0 10px 0; font-size: 14px; color: #0b1b4a; }
      .tier ul { margin: 8px 0 0; padding-left: 18px; }
      .tier li { margin: 6px 0; }
      @media screen and (max-width: 980px) { .status-grid { grid-template-columns: 1fr 1fr; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="header">
        <div class="header-inner">
          <div class="brand-row">
            <img src="${logoSrc}" alt="The Vent Guys" />
            <div style="text-align: right;">
              <div class="pill" style="background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.20); color: #fff;">Customer Copy</div>
            </div>
          </div>
          <div>
            <h1>Total Home Refresh — Before Condition Report</h1>
            <div class="sub">
              Documentation of observed system condition and supporting findings.
            </div>
          </div>
          <div class="property-anchor">
            <div class="property-label">Property</div>
            <div class="property-value">${propertyAddress}</div>
            ${propertyLocation ? `<div class="property-sub">${propertyLocation}</div>` : ''}
          </div>
          <div class="meta">
          <div class="box"><strong>Prepared For</strong>${preparedFor}</div>
          <div class="box"><strong>Report Date</strong>${escapeHtml(reportDate)}</div>
          <div class="box"><strong>Prepared By</strong>${preparedBy}</div>
          <div class="box"><strong>Estimate</strong>${estimateNumber ? `#${estimateNumber}` : '—'}</div>
        </div>
        </div>
      </section>

      <h2>System Status Summary</h2>
      <div class="status">
        <div class="status-hero">
          <div class="status-hero-label">Overall System Condition</div>
          <div class="status-hero-value ${escapeHtml(conditionToneClass(conditionLabel))}">${escapeHtml(conditionLabel)}</div>
        </div>
        <div class="status-grid">
          <div class="status-item">
            <div class="status-label">Verification Status</div>
            <div class="status-pill ${escapeHtml(verificationPillClass(verificationStatus))}">${escapeHtml(verificationStatus)}</div>
          </div>
          <div class="status-item status-item--wide">
            <div class="status-label">Next Step</div>
            <div class="status-pill warning">${escapeHtml(nextStep)}</div>
          </div>
        </div>
        <div class="status-summary">
          <div>${escapeHtml(statusNarrative.line1)}</div>
          ${statusNarrative.line2 ? `<div>${escapeHtml(statusNarrative.line2)}</div>` : ''}
          ${statusNarrative.line3 ? `<div>${escapeHtml(statusNarrative.line3)}</div>` : ''}
        </div>
        <div class="status-footnote">
          Classification is based on observed condition of primary air-contact components and available photo documentation.
        </div>
      </div>

      <h2>Scope Boundary</h2>
      <div class="callout">
        <p style="margin:0 0 10px 0;">
          This report documents observed mechanical hygiene conditions and available supporting documentation at the time of inspection/service.
        </p>
        <p style="margin:0;">
          This is not a mechanical diagnosis and does not represent post-service condition unless separately documented.
        </p>
      </div>

      <h2>Representation Limits (Mechanical Hygiene)</h2>
      <div class="limits">
        <div class="limits-title">Representation Limits</div>
        <p class="limits-body">${representationLimitsClause}</p>
      </div>

      <h2>Purpose</h2>
      <p>This report documents photo-backed mechanical hygiene findings based on observed conditions and available documentation at the time of service.</p>

      <h2>Key Observations (Before Condition)</h2>
      ${
        evaluation && Array.isArray(evaluation.findings) && evaluation.findings.length
          ? (() => {
              const findings = evaluation.findings;
              const majorAirContact = findings.filter(
                (f) => asString(f?.component_class) === 'major' && asString(f?.airflow_interaction) === 'in_path',
              );
              const contextAdjacent = findings.filter(
                (f) => !(asString(f?.component_class) === 'major' && asString(f?.airflow_interaction) === 'in_path'),
              );

              const renderFinding = (f) => `
                <li style="margin: 10px 0;">
                  <div><strong>${escapeHtml(asString(f?.component) || 'Component')} — ${escapeHtml(asString(f?.severity) || '')}</strong></div>
                  <div class="small" style="margin-top:4px;">${escapeHtml(sanitizeCustomerCopy(f?.why_it_matters) || '')}</div>
                </li>
              `.trim();

              const renderBlock = (title, list) => `
                <div class="callout" style="margin-bottom: 12px;">
                  <div style="font-weight:800;color:#0b1b4a;margin-bottom:6px;">${escapeHtml(title)}</div>
                  <ul style="margin:0;padding-left:18px;">
                    ${list.slice(0, 8).map(renderFinding).join('')}
                  </ul>
                </div>
              `.trim();

              return `
                ${renderBlock('Major Air-Contact Components', majorAirContact)}
                ${renderBlock('Internal / Adjacent Context Components', contextAdjacent)}
              `.trim();
            })()
          : `
            <div class="callout">
              <ul>
                <li><strong>Evaporator coil contamination</strong>: visible buildup on coil fins, which can restrict airflow and reduce performance.</li>
                <li><strong>Foreign material on the coil</strong>: dryer sheets were present on/against the coil surface, contributing to residue accumulation.</li>
                <li><strong>Blower wheel buildup</strong>: residue on blower blades can affect airflow and can shed downstream as the blower spins.</li>
                <li><strong>Downstream impact</strong>: when contaminants accumulate on the coil/blower, small particles can be carried through supply ductwork and may appear at registers over time.</li>
              </ul>
            </div>
          `
      }

      <h2>Recommended Cleaning Method (NADCA-Aligned)</h2>
      <div class="method-row">
        <div style="flex: 1 1 auto;">
          <p>
            The Vent Guys uses a NADCA-aligned approach with a <strong>NAM (Negative Air Machine)</strong> for duct system cleaning.
            A NAM places the duct system under negative pressure while mechanical agitation dislodges debris so it is captured and removed,
            rather than redistributed into the home.
          </p>
        </div>
        <img class="badge" src="${nadcaBadgeSrc}" alt="NADCA" />
      </div>

      <h2>When AHU Deep Cleaning Requires Licensed HVAC</h2>
      <p>
        Certain air handler cleaning tasks require licensed HVAC handling. If internal air handler components require deep-clean service,
        it must be handled by a licensed HVAC contractor.
      </p>

      <h2>Photo Evidence</h2>
      <div class="grid">
        ${photoCards}
      </div>

      <h2>Next Step</h2>
      <div class="callout">
        <ul>
          <li>${escapeHtml(nextStep)}</li>
        </ul>
      </div>

      <div class="footer">
        The Vent Guys · Customer-facing findings documentation · Generated ${escapeHtml(formatDate(todayIsoLocal()) || '')}
      </div>
    </div>
  </body>
</html>
  `.trim();
};

const defaultConfig = (estimate) => ({
  report: {
    date: todayIsoLocal(),
    preparedBy: 'The Vent Guys',
    preparedFor: '',
  },
  estimate: {
    number: estimate || '20267601',
  },
  customer: {
    name: '',
  },
  property: {
    address: '',
    city: '',
    state: '',
    zip: '',
  },
  outsourced: {
    vendor: DEFAULT_VENDOR,
    note: 'Evaporator coil and blower assembly removed and cleaned off-site.',
  },
});

const tryGeneratePdfWithPlaywright = async ({ htmlPath, pdfPath, previewPath }) => {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (err) {
    return { ok: false, error: 'Playwright is not available in this repo environment.' };
  }

  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
      null,
      { timeout: 15000 },
    ).catch(() => {});
    if (previewPath) {
      await page.screenshot({ path: previewPath, fullPage: true }).catch(() => {});
    }
    await page.pdf({
      path: pdfPath,
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.55in', right: '0.55in', bottom: '0.55in', left: '0.55in' },
    });
    await page.close();
    await browser.close();
    return { ok: true };
  } catch (err) {
    try {
      if (browser) await browser.close();
    } catch {
      // ignore
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

const timestampSlug = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const main = async () => {
  const args = parseArgs(process.argv);
  if (!args.input) throw new Error('Missing --input');
  if (!args.output) throw new Error('Missing --output');

  const inputDir = path.resolve(process.cwd(), args.input);
  const outputDir = path.resolve(process.cwd(), args.output);
  const assetsDir = path.join(outputDir, 'assets');
  const evaluationPath = args.evaluation
    ? path.resolve(process.cwd(), args.evaluation)
    : path.join(outputDir, 'evaluation.json');

  if (!(await exists(inputDir))) {
    throw new Error(`Input folder not found: ${inputDir}`);
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
  await copyBrandingAssets(assetsDir);

  const images = await listImages(inputDir);
  if (!images.length) throw new Error(`No images found in ${inputDir}`);

  // Copy images into output/assets so HTML+PDF is portable.
  await Promise.all(
    images.map(async (name) => {
      const src = path.join(inputDir, name);
      const dst = path.join(assetsDir, name);
      await fs.copyFile(src, dst);
    }),
  );

  const optimizeResult = await runOptimizeImages(assetsDir);
  if (!optimizeResult.ok) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: image optimization skipped: ${optimizeResult.error}`);
  }

  const configPath = path.join(outputDir, 'config.json');
  if (!(await exists(configPath))) {
    const siblingConfigPath = args.evaluation
      ? path.join(path.dirname(evaluationPath), 'config.json')
      : '';

    if (siblingConfigPath && (await exists(siblingConfigPath))) {
      await fs.copyFile(siblingConfigPath, configPath);
    } else {
      await writeJson(configPath, defaultConfig(args.estimate));
    }
  }

  let cfg = await readJson(configPath);
  if (args.evaluation) {
    const siblingConfigPath = path.join(path.dirname(evaluationPath), 'config.json');
    if (await exists(siblingConfigPath)) {
      const siblingCfg = await readJson(siblingConfigPath);
      const mergedCfg = mergeConfigWithSiblingWorkflow(cfg, siblingCfg);
      if (mergedCfg?.property?.address !== cfg?.property?.address) {
        cfg = mergedCfg;
        await writeJson(configPath, cfg);
      }
    }
  }
  const evaluation = await readJsonIfExists(evaluationPath);

  const html = buildHtml(cfg, images, evaluation);

  const htmlPath = path.join(outputDir, `estimate-${args.estimate || asString(cfg?.estimate?.number) || 'before'}-before-report.html`);
  await fs.writeFile(htmlPath, `${html}\n`, 'utf8');

  const desiredPdfPath = htmlPath.replace(/\.html$/i, '.pdf');
  let pdfPath = desiredPdfPath;
  const previewPath = path.join(outputDir, 'preview.png');

  // Best-effort: if an existing PDF is locked/open, fall back to a timestamped filename
  try {
    await fs.unlink(desiredPdfPath);
  } catch (err) {
    if (await exists(desiredPdfPath)) {
      const slug = timestampSlug();
      pdfPath = desiredPdfPath.replace(/\.pdf$/i, `-${slug}.pdf`);
    }
  }

  const pdfResult = await tryGeneratePdfWithPlaywright({ htmlPath, pdfPath, previewPath });

  const result = {
    ok: true,
    input: inputDir,
    output: outputDir,
    html: htmlPath,
    pdf: pdfResult.ok ? pdfPath : null,
    pdf_error: pdfResult.ok ? null : pdfResult.error,
    config: configPath,
    preview: previewPath,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
