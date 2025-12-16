# TVG Node Test Pack (Hostinger-compatible, long-form JS)

This suite tests:
- Lead Intake Edge Function
- SmartDocs Send Edge Function
- Rep Checklist Edge Function
- Signals → PQI trigger
- Basic RLS write protection

## Env Vars
- SUPABASE_EDGE_URL
- SUPABASE_REST_URL
- SUPABASE_SERVICE_KEY
- SUPABASE_ANON_KEY
- TEST_MODE=true

## Seed
- SQL: run seed_templates.sql in your DB
- OR REST: node seed/seed_templates_via_rest.js

## Run Tests
node run-all.js