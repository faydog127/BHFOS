/**
 * Media Intelligence source of record vs Command Center (CRM).
 *
 * Live split: app.bhfos.com is CRM. mil.bhfos.com holds the working media library.
 * Do not treat Command Center Media as the MIL library.
 */

export const CRM_PRODUCTION_HOST = 'app.bhfos.com';
export const MIL_RECORD_ORIGIN = 'https://mil.bhfos.com';

export function isCrmProductionHost(
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
) {
  return String(hostname || '').trim().toLowerCase() === CRM_PRODUCTION_HOST;
}

/** Preserve path/query/hash so /media/review and /creator bookmarks land on MIL. */
export function buildMilRecordUrl(
  locationLike = typeof window !== 'undefined' ? window.location : { pathname: '/', search: '', hash: '' },
) {
  const pathname = locationLike.pathname || '/';
  const search = locationLike.search || '';
  const hash = locationLike.hash || '';
  return `${MIL_RECORD_ORIGIN}${pathname}${search}${hash}`;
}
