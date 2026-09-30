/**
 * Staging ops rules from the 2026-09-24 consolidated Pass 1 directive.
 * Quiet inbox is not a fault. SMS delivery is not performed here.
 */
import { quoteLiteral } from './pass1-intake-logic.mjs';
import { buildNotificationInsertSql } from './pass1-internal-sms.mjs';

export const PRIMARY_PATH_TARGET_SECONDS = 120;
export const RECONCILE_TARGET_SECONDS = 15 * 60;

/** Hostinger newer-mail and intake-lag stay mock until Pre-webhook opens. */
export const HOSTINGER_MAILBOX_PROBE = 'dormant';

/**
 * Newer-mail and intake-lag are not Hostinger API calls in this pack.
 * preWebhookOpen must be exactly true before either signal can become a fault.
 * The inactive heartbeat never passes that flag.
 */
export function planMailboxProbe(input = {}) {
  const live = input.preWebhookOpen === true;
  return {
    mode: live ? 'live' : HOSTINGER_MAILBOX_PROBE,
    mock: !live,
    fault: null,
    newerMailCount: input.newerMailCount ?? null,
    intakeLagSeconds: input.intakeLagSeconds ?? null,
    reason: live ? 'pre_webhook_open' : 'pre_webhook_closed',
  };
}

export function primaryPathWithinTarget(webhookAt, dispatcherAt) {
  const start = new Date(webhookAt).getTime();
  const end = new Date(dispatcherAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
  return (end - start) <= PRIMARY_PATH_TARGET_SECONDS * 1000;
}

export function reconcileWithinTarget(startedAt, finishedAt) {
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
  return (end - start) <= RECONCILE_TARGET_SECONDS * 1000;
}

function incidentKey(component, nowIso) {
  return `${component}:${nowIso}`;
}

/**
 * One open outage and one recovery per incident.
 * messagesSeen === 0 with a healthy pipeline is not a fault.
 * alertsEnabled false records no outage (staging default).
 */
export function planHealthAlert(input) {
  const component = input.component || 'primary_path';
  const messagesSeen = input.messagesSeen ?? 0;
  const quietInbox = messagesSeen === 0;
  if (input.alertsEnabled !== true) {
    return {
      action: 'skip',
      reason: 'health_alerts_disabled',
      fault: false,
      quietInbox,
      recordSuccess: input.dependencyOk !== false && input.pipelineOk !== false,
      alert: null,
      mailboxProbe: HOSTINGER_MAILBOX_PROBE,
    };
  }
  const probe = planMailboxProbe({
    preWebhookOpen: input.mailboxProbeLive === true,
    newerMailCount: input.newerMailCount,
    intakeLagSeconds: input.queueLagSeconds,
  });
  const lag = input.queueLagSeconds ?? 0;
  const target = input.targetSeconds
    ?? (component === 'reconcile' ? RECONCILE_TARGET_SECONDS : PRIMARY_PATH_TARGET_SECONDS);
  let fault = null;
  if (input.dependencyOk === false) fault = 'dep';
  else if (input.pipelineOk === false) fault = 'fail';
  else if (input.stale === true) fault = 'stale';
  else if (probe.mode === 'live' && lag > target) fault = 'lag';

  if (!fault) {
    if (input.openIncidentKey) {
      return {
        action: 'recover',
        reason: 'recovered',
        fault: false,
        quietInbox,
        recordSuccess: true,
        mailboxProbe: probe.mode,
        alert: {
          kind: 'health_recovery',
          incidentKey: input.openIncidentKey,
          component,
          smsText: `TVG: Email automation recovered — review. Component: ${component}. No reply sent by automation.`,
        },
      };
    }
    return {
      action: 'ok',
      reason: quietInbox ? 'quiet_inbox' : 'healthy',
      fault: false,
      quietInbox,
      recordSuccess: true,
      mailboxProbe: probe.mode,
      alert: null,
    };
  }

  if (input.openIncidentKey) {
    return {
      action: 'dedup',
      reason: 'outage_open',
      fault,
      quietInbox: false,
      recordSuccess: false,
      mailboxProbe: probe.mode,
      alert: null,
    };
  }
  const key = incidentKey(component, input.now || new Date().toISOString());
  return {
    action: 'outage',
    reason: fault,
    fault,
    quietInbox: false,
    recordSuccess: false,
    mailboxProbe: probe.mode,
    alert: {
      kind: 'health_outage',
      incidentKey: key,
      component,
      smsText: `TVG: Email automation ${fault} — review. Component: ${component}. No reply sent by automation.`,
    },
  };
}

export function buildHealthAlertSql(alert, destinationRef) {
  if (!alert) return null;
  return buildNotificationInsertSql({
    action: 'record_only',
    kind: alert.kind,
    destinationRef,
    deliveryState: 'recorded_not_sent',
    suppressionReason: 'credential_not_approved',
    suppressionWindow: alert.incidentKey,
    status: alert.kind,
    smsText: alert.smsText,
  });
}

export function buildHealthSuccessSql(component) {
  const name = String(component || 'primary_path');
  if (!/^[a-z_]{1,40}$/.test(name)) throw new Error('bad health component');
  return `
UPDATE email_automation.health_checks
SET last_successful_health_at = now(),
    last_checked_at = now(),
    status = 'ok',
    open_incident_key = NULL
WHERE tenant_id = 'tvg' AND component = ${quoteLiteral(name)};
`.trim();
}

export function buildHealthOutageSql(component, incidentKey, status) {
  const name = String(component || 'primary_path');
  if (!/^[a-z_]{1,40}$/.test(name)) throw new Error('bad health component');
  return `
UPDATE email_automation.health_checks
SET last_checked_at = now(),
    status = ${quoteLiteral(status)},
    open_incident_key = ${quoteLiteral(incidentKey)}
WHERE tenant_id = 'tvg'
  AND component = ${quoteLiteral(name)}
  AND open_incident_key IS NULL;
`.trim();
}
