import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PASS1_RECIPIENT,
  assertPass1Recipient,
  assertPass1SendBoundary,
  resolvePass1Recipients,
} from '../lib/pass1-recipient-config.mjs';
import { planInternalSms } from '../lib/pass1-internal-sms.mjs';

test('Pass 1 recipient is Founder internal SMS with no cadence', () => {
  const row = assertPass1Recipient(PASS1_RECIPIENT);
  assert.equal(row.recipientKey, 'founder');
  assert.equal(row.channel, 'internal_sms');
  assert.equal(row.destinationRef, 'founder_mobile_ref');
  assert.equal(row.enabled, false);
  assert.equal(row.escalationAfter, null);
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, recipientKey: 'office' }), /Founder only/);
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, channel: 'customer_sms' }), /internal SMS only/);
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, escalationAfter: '1 day' }), /cadence/);
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, destinationRef: 'founder@example.com' }), /single Founder destination/);
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, destinationRef: 'office_mobile_ref' }), /single Founder destination/);
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, urgency: 'high' }), /urgency detection/);
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, replyVoice: 'The Vent Guys Team' }), /reply voice/);
});

test('after-hours acknowledgement stays disabled and does not enable auto-send', () => {
  const boundary = assertPass1SendBoundary({
    autoSendEnabled: false,
    afterHoursAckEnabled: false,
  });
  assert.equal(boundary.autoSendEnabled, false);
  assert.equal(boundary.afterHoursAckEnabled, false);
  assert.equal(boundary.quietHours, null);
  assert.equal(boundary.urgencyKeywords, null);
  assert.equal(boundary.replyVoice, null);
  assert.throws(() => assertPass1SendBoundary({ afterHoursAckEnabled: true }), /after-hours acknowledgement is disabled/);
  assert.throws(() => assertPass1SendBoundary({ autoSendEnabled: true }), /auto send is outside Pass 1/);
  assert.throws(() => assertPass1SendBoundary({ quietHours: '22:00-06:00' }), /quiet hours/);
  assert.throws(() => assertPass1SendBoundary({ urgencyKeywords: ['urgent'] }), /keyword rules/);
  assert.throws(() => assertPass1SendBoundary({ draftReview: true }), /draft review/);
});

test('quiet hours do not change the Pass 1 notification decision', () => {
  const decision = planInternalSms({
    status: 'awaiting_pass2',
    emailEventId: '40000000-0000-4000-8000-000000000001',
    subject: 'Dryer vent question',
    senderName: 'Kelly Martin',
    senderEmail: 'kelly@example.com',
    quietHours: '22:00-06:00',
  });
  assert.equal(decision.action, 'send');
  assert.equal(decision.kind, 'actionable_inbound');
});

test('free-text urgency words do not classify the notification', () => {
  const decision = planInternalSms({
    status: 'awaiting_pass2',
    emailEventId: '40000000-0000-4000-8000-000000000001',
    subject: 'URGENT emergency asap',
    senderName: 'Kelly Martin',
    senderEmail: 'kelly@example.com',
  });
  assert.equal(decision.action, 'send');
  assert.equal(decision.kind, 'actionable_inbound');
  assert.match(decision.smsBody, /New email — review/);
  assert.equal(Object.hasOwn(decision, 'urgency'), false);
  assert.equal(Object.hasOwn(decision, 'urgencyClass'), false);
});

test('resolvePass1Recipients rejects a second recipient', () => {
  assert.throws(
    () => resolvePass1Recipients([
      PASS1_RECIPIENT,
      { ...PASS1_RECIPIENT, recipientKey: 'tech' },
    ]),
    /Founder only/,
  );
});
