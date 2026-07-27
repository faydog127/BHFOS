const ACTIVE_ATTEMPT_STATUSES = new Set(['initiated', 'pending']);

export const invalidateCheckoutAttempts = async ({
  attempts,
  retrieveSession,
  expireSession,
  markAttemptExpired,
}) => {
  const activeAttempts = (Array.isArray(attempts) ? attempts : []).filter((attempt) =>
    ACTIVE_ATTEMPT_STATUSES.has(String(attempt?.attempt_status ?? '').toLowerCase()),
  );

  for (const attempt of activeAttempts) {
    const sessionId = typeof attempt?.checkout_session_id === 'string' ? attempt.checkout_session_id.trim() : '';
    if (!sessionId) {
      throw new Error('CHECKOUT_INVALIDATION_MISSING_SESSION');
    }

    const session = await retrieveSession(sessionId);
    const status = String(session?.status ?? '').toLowerCase();

    if (status === 'complete') {
      throw new Error('CHECKOUT_INVALIDATION_PAYMENT_COMPLETED');
    }

    if (status === 'open') {
      await expireSession(sessionId);
    } else if (status !== 'expired') {
      throw new Error('CHECKOUT_INVALIDATION_UNKNOWN_SESSION_STATE');
    }

    await markAttemptExpired(attempt.id);
  }

  return { invalidated: activeAttempts.length };
};

