-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'tvg'::"text" NOT NULL,
    "lead_id" "uuid",
    "technician_id" "uuid",
    "price_book_id" "uuid",
    "service_name" "text" NOT NULL,
    "service_category" "text",
    "pricing_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scheduled_start" timestamp with time zone NOT NULL,
    "scheduled_end" timestamp with time zone NOT NULL,
    "arrival_window_start" timestamp with time zone,
    "arrival_window_end" timestamp with time zone,
    "duration_minutes" integer DEFAULT 120 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "service_address" "text",
    "customer_notes" "text",
    "admin_notes" "text",
    "reminders_enabled" boolean DEFAULT true NOT NULL,
    "confirmation_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_id" "uuid"
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";

--
-- Name: automation_suspensions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."automation_suspensions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "suspended_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resumed_at" timestamp with time zone
);


ALTER TABLE "public"."automation_suspensions" OWNER TO "postgres";

--
-- Name: COLUMN "automation_suspensions"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."automation_suspensions"."tenant_id" IS 'Tenant scope (optional in v1; reserved for multi-tenant).';


--
-- Name: business_settings; Type: TABLE; Schema: public; Owner: postgres
