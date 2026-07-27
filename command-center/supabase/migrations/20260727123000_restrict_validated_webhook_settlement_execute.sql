-- Keep the validated settlement implementation internal to trusted callers.
revoke execute on function public.record_stripe_webhook_payment_validated(
  text, text, text, bigint, text, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.record_stripe_webhook_payment_validated(
  text, text, text, bigint, text, jsonb, uuid
) to service_role;
