const STATE_RE = /^[A-Z]{2}$/;
const ZIP_RE = /^\d{5}(?:-\d{4})?$/;
const STREET_SUFFIXES = new Set([
  'ALY',
  'ALLEY',
  'AVE',
  'AVENUE',
  'BLVD',
  'BOULEVARD',
  'CIR',
  'CIRCLE',
  'CT',
  'COURT',
  'CV',
  'COVE',
  'DR',
  'DRIVE',
  'HWY',
  'HIGHWAY',
  'LN',
  'LANE',
  'LOOP',
  'PKWY',
  'PARKWAY',
  'PL',
  'PLACE',
  'RD',
  'ROAD',
  'SQ',
  'SQUARE',
  'ST',
  'STREET',
  'TER',
  'TERRACE',
  'TRL',
  'TRAIL',
  'WAY',
]);
const DIRECTIONALS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
const UNIT_KEYWORDS = new Set(['APT', 'APARTMENT', 'UNIT', 'STE', 'SUITE', 'LOT', 'BLDG', 'BUILDING', 'FL', 'FLOOR', 'RM', 'ROOM']);

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeSpaces = (value) => asText(value).replace(/\s+/g, ' ');
const normalizeToken = (value) => normalizeSpaces(value).replace(/[.,]/g, '').toUpperCase();

const parseTail = (tail) => {
  const normalized = normalizeSpaces(tail);
  if (!normalized) return { city: '', state: '', zip: '' };

  const parts = normalized.split(/\s+/).filter(Boolean);
  let zip = '';
  let state = '';

  if (parts.length > 0 && ZIP_RE.test(parts[parts.length - 1])) {
    zip = parts.pop();
  }

  if (parts.length > 0 && STATE_RE.test(parts[parts.length - 1].toUpperCase())) {
    state = parts.pop().toUpperCase();
  }

  return {
    city: parts.join(' ').trim(),
    state,
    zip,
  };
};

const splitStreetAndCity = (value) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) return { street: '', city: '' };

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return {
      street: normalized,
      city: '',
    };
  }

  let bestSplitIndex = -1;

  for (let index = 0; index < parts.length; index += 1) {
    const token = normalizeToken(parts[index]);
    if (!STREET_SUFFIXES.has(token)) continue;

    let endIndex = index;
    if (DIRECTIONALS.has(normalizeToken(parts[endIndex + 1] || ''))) {
      endIndex += 1;
    }

    const maybeUnit = parts[endIndex + 1] || '';
    if (UNIT_KEYWORDS.has(normalizeToken(maybeUnit)) || maybeUnit.startsWith('#')) {
      endIndex += 1;
      if (parts[endIndex + 1]) {
        endIndex += 1;
      }
    }

    bestSplitIndex = endIndex;
  }

  if (bestSplitIndex >= 0 && bestSplitIndex < parts.length - 1) {
    return {
      street: parts.slice(0, bestSplitIndex + 1).join(' '),
      city: parts.slice(bestSplitIndex + 1).join(' '),
    };
  }

  return {
    street: normalized,
    city: '',
  };
};

export const parseDispatchAddress = (value) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) {
    return {
      raw: '',
      street: '',
      city: '',
      state: '',
      zip: '',
    };
  }

  const commaParts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (commaParts.length >= 3) {
    const street = commaParts[0];
    const city = commaParts[1];
    const { state, zip } = parseTail(commaParts.slice(2).join(' '));

    return {
      raw: normalized,
      street,
      city,
      state,
      zip,
    };
  }

  if (commaParts.length === 2) {
    const street = commaParts[0];
    const { city, state, zip } = parseTail(commaParts[1]);

    return {
      raw: normalized,
      street,
      city,
      state,
      zip,
    };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  let zip = '';
  let state = '';

  if (parts.length > 0 && ZIP_RE.test(parts[parts.length - 1])) {
    zip = parts.pop();
  }

  if (parts.length > 0 && STATE_RE.test(parts[parts.length - 1].toUpperCase())) {
    state = parts.pop().toUpperCase();
  }

  if (state) {
    const { street, city } = splitStreetAndCity(parts.join(' '));
    return {
      raw: normalized,
      street,
      city,
      state,
      zip,
    };
  }

  return {
    raw: normalized,
    street: normalized,
    city: '',
    state: '',
    zip: '',
  };
};

export const getDispatchAddressValidation = (value) => {
  const parsed = parseDispatchAddress(value);
  const missingParts = [];

  if (!parsed.street) missingParts.push('street');
  if (!parsed.city) missingParts.push('city');
  if (!parsed.state) missingParts.push('state');

  return {
    ...parsed,
    hasText: Boolean(parsed.raw),
    hasDispatchableAddress: missingParts.length === 0,
    missingParts,
  };
};

export const hasDispatchableAddress = (value) =>
  getDispatchAddressValidation(value).hasDispatchableAddress;
