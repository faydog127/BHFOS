import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PASS1_RECIPIENT,
  assertPass1Recipient,
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
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, destinationRef: 'founder@example.com' }), /settings label/);
  assert.throws(() => assertPass1Recipient({ ...PASS1_RECIPIENT, urgency: 'high' }), /urgency/);
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
