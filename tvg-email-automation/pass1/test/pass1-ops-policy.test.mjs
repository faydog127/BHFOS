import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertAttachmentMetadataOnly,
  captureThreadMetadata,
} from '../lib/pass1-intake-logic.mjs';
import {
  HOSTINGER_MAILBOX_PROBE,
  PRIMARY_PATH_TARGET_SECONDS,
  RECONCILE_TARGET_SECONDS,
  buildHealthAlertSql,
  planHealthAlert,
  planMailboxProbe,
  primaryPathWithinTarget,
  reconcileWithinTarget,
} from '../lib/pass1-ops-policy.mjs';

test('quiet inbox is not a fault and outage recovery is one each', () => {
  const quiet = planHealthAlert({
    component: 'primary_path',
    alertsEnabled: true,
    pipelineOk: true,
    dependencyOk: true,
    stale: false,
    messagesSeen: 0,
    queueLagSeconds: 0,
    targetSeconds: PRIMARY_PATH_TARGET_SECONDS,
    openIncidentKey: null,
  });
  assert.equal(quiet.action, 'ok');
  assert.equal(quiet.fault, false);
  assert.equal(quiet.quietInbox, true);
  assert.equal(quiet.alert, null);

  const outage = planHealthAlert({
    component: 'primary_path',
    alertsEnabled: true,
    pipelineOk: true,
    dependencyOk: true,
    stale: true,
    messagesSeen: 0,
    queueLagSeconds: 0,
    openIncidentKey: null,
    now: '2026-09-24T13:00:00.000Z',
  });
  assert.equal(outage.action, 'outage');
  assert.equal(outage.fault, 'stale');
  assert.equal(outage.alert.kind, 'health_outage');
  assert.match(outage.alert.smsText, /review/);
  assert.match(outage.alert.smsText, /No reply sent by automation/);

  const repeat = planHealthAlert({
    component: 'primary_path',
    alertsEnabled: true,
    stale: true,
    pipelineOk: true,
    dependencyOk: true,
    openIncidentKey: outage.alert.incidentKey,
  });
  assert.equal(repeat.action, 'dedup');
  assert.equal(repeat.alert, null);

  const recovery = planHealthAlert({
    component: 'primary_path',
    alertsEnabled: true,
    pipelineOk: true,
    dependencyOk: true,
    stale: false,
    messagesSeen: 0,
    queueLagSeconds: 0,
    openIncidentKey: outage.alert.incidentKey,
  });
  assert.equal(recovery.action, 'recover');
  assert.equal(recovery.alert.kind, 'health_recovery');
  assert.equal(recovery.alert.incidentKey, outage.alert.incidentKey);

  const secondRecovery = planHealthAlert({
    component: 'primary_path',
    alertsEnabled: true,
    pipelineOk: true,
    dependencyOk: true,
    stale: false,
    messagesSeen: 3,
    queueLagSeconds: 10,
    openIncidentKey: null,
  });
  assert.equal(secondRecovery.action, 'ok');
  assert.equal(secondRecovery.alert, null);
});

test('dependency and lag faults are named and alerts stay off by default', () => {
  const dep = planHealthAlert({
    alertsEnabled: true,
    dependencyOk: false,
    pipelineOk: true,
    openIncidentKey: null,
    now: '2026-09-24T13:00:00.000Z',
  });
  assert.equal(dep.fault, 'dep');
  const fail = planHealthAlert({
    alertsEnabled: true,
    dependencyOk: true,
    pipelineOk: false,
    openIncidentKey: null,
    now: '2026-09-24T13:00:00.000Z',
  });
  assert.equal(fail.fault, 'fail');
  assert.match(buildHealthAlertSql(fail.alert, 'founder_mobile_ref'), /health_outage/);
  assert.match(buildHealthAlertSql(fail.alert, 'founder_mobile_ref'), /recorded_not_sent/);
  assert.match(buildHealthAlertSql(fail.alert, 'founder_mobile_ref'), /credential_not_approved/);
  const lag = planHealthAlert({
    alertsEnabled: true,
    dependencyOk: true,
    pipelineOk: true,
    stale: false,
    mailboxProbeLive: true,
    queueLagSeconds: PRIMARY_PATH_TARGET_SECONDS + 1,
    targetSeconds: PRIMARY_PATH_TARGET_SECONDS,
    openIncidentKey: null,
    now: '2026-09-24T13:00:00.000Z',
  });
  assert.equal(lag.fault, 'lag');
  assert.equal(lag.mailboxProbe, 'live');
  const dormantLag = planHealthAlert({
    alertsEnabled: true,
    dependencyOk: true,
    pipelineOk: true,
    stale: false,
    queueLagSeconds: PRIMARY_PATH_TARGET_SECONDS + 500,
    newerMailCount: 12,
    targetSeconds: PRIMARY_PATH_TARGET_SECONDS,
    openIncidentKey: null,
    now: '2026-09-24T13:00:00.000Z',
  });
  assert.equal(dormantLag.fault, false);
  assert.equal(dormantLag.action, 'ok');
  assert.equal(dormantLag.mailboxProbe, HOSTINGER_MAILBOX_PROBE);
  const probe = planMailboxProbe({ newerMailCount: 4, intakeLagSeconds: 9999 });
  assert.equal(probe.mode, 'dormant');
  assert.equal(probe.mock, true);
  assert.equal(probe.fault, null);
  assert.equal(probe.reason, 'pre_webhook_closed');
  const off = planHealthAlert({
    alertsEnabled: false,
    dependencyOk: false,
    messagesSeen: 0,
  });
  assert.equal(off.action, 'skip');
  assert.equal(off.fault, false);
  assert.equal(off.alert, null);
});

test('timing targets are two minutes, fifteen minutes, and have no quiet hours', () => {
  assert.equal(PRIMARY_PATH_TARGET_SECONDS, 120);
  assert.equal(RECONCILE_TARGET_SECONDS, 900);
  const start = '2026-09-24T13:00:00.000Z';
  assert.equal(primaryPathWithinTarget(start, '2026-09-24T13:02:00.000Z'), true);
  assert.equal(primaryPathWithinTarget(start, '2026-09-24T13:02:01.000Z'), false);
  assert.equal(reconcileWithinTarget(start, '2026-09-24T13:15:00.000Z'), true);
  assert.equal(reconcileWithinTarget(start, '2026-09-24T13:15:01.000Z'), false);
});

test('attachments stay metadata and thread headers are captured without a parent link', () => {
  const clean = assertAttachmentMetadataOnly([
    { filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 1200, attachment_id: 'att-1' },
  ]);
  assert.equal(clean[0].filename, 'photo.jpg');
  assert.throws(() => assertAttachmentMetadataOnly([{ filename: 'a.bin', bytes: 'AAAA' }]), /bytes/);
  const thread = captureThreadMetadata({
    inReplyTo: '<parent@vent-guys.test>',
    references: '<a@vent-guys.test> <b@vent-guys.test>',
  });
  assert.equal(thread.in_reply_to, '<parent@vent-guys.test>');
  assert.equal(thread.references_header.includes('<a@vent-guys.test>'), true);
  assert.equal(Object.hasOwn(thread, 'parent_id'), false);
});
