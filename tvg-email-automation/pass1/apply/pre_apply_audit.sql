-- Read-only. Run on glkrykpksbsqmmilmjhs before the apply pack.
-- Do not run on wwyxohjnyqnegzbxtuxs.

SELECT current_database() AS database_name;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('contacts', 'leads', 'network_os_assurance_delivery_claims')
  AND c.relkind = 'r'
ORDER BY c.relname;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('contacts', 'leads')
ORDER BY tablename, policyname;

SELECT to_regclass('email_automation.email_events') AS email_events,
       to_regclass('email_automation.email_responses') AS email_responses,
       to_regclass('email_automation.email_send_queue') AS email_send_queue,
       to_regrole('n8n_email_automation') AS n8n_role;
