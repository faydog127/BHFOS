run_id: 2026-04-18T15:27:15.9440864+00:00
--
-- PostgreSQL database dump
--

\restrict xrbz8BaNExhn7eumgqCESeTrrq7MHUGOW5Tu51BLAkMF2Yd0hYlT0kzT1OBa7kQ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text DEFAULT 'tvg'::text NOT NULL,
    lead_id uuid,
    technician_id uuid,
    price_book_id uuid,
    service_name text NOT NULL,
    service_category text,
    pricing_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    scheduled_start timestamp with time zone NOT NULL,
    scheduled_end timestamp with time zone NOT NULL,
    arrival_window_start timestamp with time zone,
    arrival_window_end timestamp with time zone,
    duration_minutes integer DEFAULT 120 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    service_address text,
    customer_notes text,
    admin_notes text,
    reminders_enabled boolean DEFAULT true NOT NULL,
    confirmation_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    job_id uuid
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- Name: appointments appointments_job_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_job_id_unique UNIQUE (job_id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: appointments_job_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX appointments_job_id_idx ON public.appointments USING btree (job_id);


--
-- Name: appointments_lead_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX appointments_lead_idx ON public.appointments USING btree (lead_id);


--
-- Name: appointments_technician_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX appointments_technician_idx ON public.appointments USING btree (technician_id, scheduled_start);


--
-- Name: appointments_tenant_status_start_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX appointments_tenant_status_start_idx ON public.appointments USING btree (tenant_id, status, scheduled_start);


--
-- Name: appointments trg_appointments_sync_job_schedule; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_appointments_sync_job_schedule AFTER INSERT OR UPDATE OF job_id, status, scheduled_start, scheduled_end, technician_id, service_address ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_job_schedule_from_appointment();


--
-- Name: appointments appointments_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_price_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_price_book_id_fkey FOREIGN KEY (price_book_id) REFERENCES public.price_book(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(user_id) ON DELETE SET NULL;


--
-- Name: appointments Appointments are deletable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Appointments are deletable by tenant" ON public.appointments FOR DELETE TO authenticated USING ((tenant_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'tenant_id'::text)));


--
-- Name: appointments Appointments are insertable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Appointments are insertable by tenant" ON public.appointments FOR INSERT TO authenticated WITH CHECK ((tenant_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'tenant_id'::text)));


--
-- Name: appointments Appointments are readable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Appointments are readable by tenant" ON public.appointments FOR SELECT TO authenticated USING ((tenant_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'tenant_id'::text)));


--
-- Name: appointments Appointments are updatable by tenant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Appointments are updatable by tenant" ON public.appointments FOR UPDATE TO authenticated USING ((tenant_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'tenant_id'::text))) WITH CHECK ((tenant_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'tenant_id'::text)));


--
-- Name: appointments Appointments service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Appointments service role full access" ON public.appointments TO service_role USING (true) WITH CHECK (true);


--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE appointments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.appointments TO anon;
GRANT ALL ON TABLE public.appointments TO authenticated;
GRANT ALL ON TABLE public.appointments TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict xrbz8BaNExhn7eumgqCESeTrrq7MHUGOW5Tu51BLAkMF2Yd0hYlT0kzT1OBa7kQ


