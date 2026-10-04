function parseScalar(text) {
  const t = text.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
  if (/^(true|false)$/i.test(t)) return /^true$/i.test(t);
  return t;
}

export function parseManualRelay(text, format = 'KV') {
  if (typeof text !== 'string') throw new TypeError('manual relay input must be text');
  if (format === 'JSON') {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  if (format === 'KV') {
    const record = {};
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const idx = line.indexOf(':');
      if (idx <= 0) throw new Error('INVALID_KV_LINE');
      record[line.slice(0, idx).trim()] = parseScalar(line.slice(idx + 1));
    }
    return [record];
  }
  throw new Error(`UNSUPPORTED_MANUAL_FORMAT:${format}`);
}

export function prepareBatch(bot, records, optionsFactory) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  return records.map((record, index) => bot.handoff(record, typeof optionsFactory === 'function' ? optionsFactory(record, index) : optionsFactory));
}
