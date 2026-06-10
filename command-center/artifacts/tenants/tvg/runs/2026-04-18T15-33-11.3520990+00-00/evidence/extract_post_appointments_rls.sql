5104:CREATE POLICY "Appointments are deletable by tenant" ON "public"."appointments" FOR DELETE TO "authenticated" USING (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")));
5111:CREATE POLICY "Appointments are insertable by tenant" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")));
5118:CREATE POLICY "Appointments are readable by tenant" ON "public"."appointments" FOR SELECT TO "authenticated" USING (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")));
5125:CREATE POLICY "Appointments are updatable by tenant" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text"))) WITH CHECK (("tenant_id" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'tenant_id'::"text")));
5132:CREATE POLICY "Appointments service role full access" ON "public"."appointments" TO "service_role" USING (true) WITH CHECK (true);
5403:ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;
