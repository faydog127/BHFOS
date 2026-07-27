import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { invalidateCheckoutAttempts } from './checkoutInvalidationCore.js';

const requireRpcRow = (result: { data: unknown; error: { message?: string } | null }, code: string) => {
  if (result.error) throw new Error(code);
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (row === null || row === undefined || row === false) throw new Error(code);
  return row;
};

export const beginInvoiceCheckoutMutation = async ({
  tenantId,
  invoiceId,
  expectedGeneration,
}: {
  tenantId: string;
  invoiceId: string;
  expectedGeneration: number;
}) => {
  const result = await supabaseAdmin.rpc('begin_invoice_checkout_mutation', {
    p_tenant_id: tenantId,
    p_invoice_id: invoiceId,
    p_expected_generation: expectedGeneration,
  });
  const generation = Number(requireRpcRow(result, 'CHECKOUT_MUTATION_FENCE_BEGIN_FAILED'));
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error('CHECKOUT_MUTATION_FENCE_BEGIN_FAILED');
  }
  return generation;
};

export const finishInvoiceCheckoutMutation = async ({
  tenantId,
  invoiceId,
  generation,
}: {
  tenantId: string;
  invoiceId: string;
  generation: number;
}) => {
  const result = await supabaseAdmin.rpc('finish_invoice_checkout_mutation', {
    p_tenant_id: tenantId,
    p_invoice_id: invoiceId,
    p_checkout_generation: generation,
  });
  requireRpcRow(result, 'CHECKOUT_MUTATION_FENCE_FINISH_FAILED');
};

export const abortInvoiceCheckoutMutation = async ({
  tenantId,
  invoiceId,
  generation,
}: {
  tenantId: string;
  invoiceId: string;
  generation: number;
}) => {
  const result = await supabaseAdmin.rpc('abort_invoice_checkout_mutation', {
    p_tenant_id: tenantId,
    p_invoice_id: invoiceId,
    p_checkout_generation: generation,
  });
  requireRpcRow(result, 'CHECKOUT_MUTATION_FENCE_ABORT_FAILED');
};

export const invalidateInvoiceCheckoutSessions = async ({
  tenantId,
  invoiceId,
}: {
  tenantId: string;
  invoiceId: string;
}) => {
  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from('public_payment_attempts')
    .select('id, checkout_session_id, attempt_status')
    .eq('tenant_id', tenantId)
    .eq('invoice_id', invoiceId)
    .in('attempt_status', ['initiated', 'pending']);

  if (attemptsError) {
    throw new Error('CHECKOUT_INVALIDATION_LOOKUP_FAILED');
  }

  if (!attempts?.length) {
    return { invalidated: 0 };
  }

  const secret = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
  if (!secret) {
    throw new Error('CHECKOUT_INVALIDATION_PROVIDER_UNAVAILABLE');
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });

  return await invalidateCheckoutAttempts({
    attempts,
    retrieveSession: (sessionId: string) => stripe.checkout.sessions.retrieve(sessionId),
    expireSession: (sessionId: string) => stripe.checkout.sessions.expire(sessionId),
    markAttemptExpired: async (attemptId: string) => {
      const { data, error } = await supabaseAdmin
        .from('public_payment_attempts')
        .update({
          attempt_status: 'expired',
          checkout_url: null,
          checkout_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('invoice_id', invoiceId)
        .eq('id', attemptId)
        .in('attempt_status', ['initiated', 'pending'])
        .select('id')
        .maybeSingle();

      if (error || !data?.id) {
        throw new Error('CHECKOUT_INVALIDATION_PERSISTENCE_FAILED');
      }
    },
  });
};

export const prepareInvoiceCheckoutMutation = async ({
  tenantId,
  invoiceId,
  expectedGeneration,
}: {
  tenantId: string;
  invoiceId: string;
  expectedGeneration: number;
}) => {
  const generation = await beginInvoiceCheckoutMutation({ tenantId, invoiceId, expectedGeneration });
  try {
    await invalidateInvoiceCheckoutSessions({ tenantId, invoiceId });
    return generation;
  } catch (error) {
    await abortInvoiceCheckoutMutation({ tenantId, invoiceId, generation });
    throw error;
  }
};
