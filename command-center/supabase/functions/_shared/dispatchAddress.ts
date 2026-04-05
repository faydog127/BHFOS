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

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeSpaces = (value: unknown) => asText(value).replace(/\s+/g, ' ');
const normalizeToken = (value: unknown) => normalizeSpaces(value).replace(/[.,]/g, '').toUpperCase();

const parseTail = (tail: string) => {
  const normalized = normalizeSpaces(tail);
  if (!normalized) return { city: '', state: '', zip: '' };

  const parts = normalized.split(/\s+/).filter(Boolean);
  let zip = '';
  let state = '';

  if (parts.length > 0 && ZIP_RE.test(parts[parts.length - 1])) {
    zip = parts.pop() || '';
  }

  if (parts.length > 0 && STATE_RE.test(String(parts[parts.length - 1]).toUpperCase())) {
    state = String(parts.pop() || '').toUpperCase();
  }

  return {
    city: parts.join(' ').trim(),
    state,
    zip,
  };
};

const splitStreetAndCity = (value: string) => {
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

export const getDispatchAddressValidation = (value: unknown) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) {
    return {
      raw: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      missingParts: ['street', 'city', 'state'],
      hasText: false,
      hasDispatchableAddress: false,
    };
  }

  const commaParts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  let street = '';
  let city = '';
  let state = '';
  let zip = '';

  if (commaParts.length >= 3) {
    street = commaParts[0];
    city = commaParts[1];
    ({ state, zip } = parseTail(commaParts.slice(2).join(' ')));
  } else if (commaParts.length === 2) {
    street = commaParts[0];
    ({ city, state, zip } = parseTail(commaParts[1]));
  } else {
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length > 0 && ZIP_RE.test(parts[parts.length - 1])) {
      zip = parts.pop() || '';
    }

    if (parts.length > 0 && STATE_RE.test(String(parts[parts.length - 1]).toUpperCase())) {
      state = String(parts.pop() || '').toUpperCase();
    }

    if (state) {
      ({ street, city } = splitStreetAndCity(parts.join(' ')));
    } else {
      street = normalized;
    }
  }

  const missingParts: string[] = [];
  if (!street) missingParts.push('street');
  if (!city) missingParts.push('city');
  if (!state) missingParts.push('state');

  return {
    raw: normalized,
    street,
    city,
    state,
    zip,
    missingParts,
    hasText: true,
    hasDispatchableAddress: missingParts.length === 0,
  };
};
