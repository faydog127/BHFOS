import QRCode from 'qrcode';
import { CONVENTION_QR_PATH, resolveConventionQrTarget } from './conventionIntakePolicy.js';

export const CONVENTION_QR_OPTIONS = Object.freeze({
  errorCorrectionLevel: 'M',
  type: 'image/png',
  margin: 2,
  width: 240,
  color: Object.freeze({ dark: '#0f172a', light: '#ffffff' }),
});

export function conventionQrPayload(origin) {
  return resolveConventionQrTarget(origin);
}

export async function buildConventionQrDataUrl(origin) {
  return QRCode.toDataURL(conventionQrPayload(origin), CONVENTION_QR_OPTIONS);
}

export function conventionQrPath() {
  return CONVENTION_QR_PATH;
}
