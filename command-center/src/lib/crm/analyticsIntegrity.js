/**
 * Operational appointment-price series.
 * A missing or non-finite price is incomplete. It is not zero.
 * A failed query is unavailable. It is not a measured zero.
 */

export function finiteAppointmentPrice(job) {
  const price = job?.pricing_snapshot?.price;
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  return price;
}

export function summarizeScheduledPrices(completed) {
  const rows = Array.isArray(completed) ? completed : [];
  let total = 0;
  const prices = [];
  for (const job of rows) {
    const price = finiteAppointmentPrice(job);
    if (price === null) return { ok: false, code: 'incomplete_price' };
    total += price;
    prices.push({ at: job?.scheduled_start || null, amount: price });
  }
  return { ok: true, total, prices };
}

export function queryRows(result) {
  if (!result || result.error || !Array.isArray(result.data)) return { ok: false, rows: [] };
  return { ok: true, rows: result.data };
}
