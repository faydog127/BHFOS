export const CHAOS_SCRIPTS = {
    HARD_COMPETITOR: "Hi, this is [Rep Name] from The Vent Guys. Our system indicates your firm is a direct competitor in the [Service Area]. We maintain a strict non-solicitation policy for direct competitors to ensure market integrity. I'm updating our records now. Have a great day.",
    GEOGRAPHIC_VAMPIRE: "Hi, this is [Rep Name]. Thanks for your interest. Looking at your project locations, it appears you operate primarily outside our insured service radius of [Radius] miles. To avoid dispatch fees that wouldn't be cost-effective for you, I'm going to refer you to a partner network that covers [Their Location].",
    ETHICS_BREACH: "This is [Rep Name]. We are terminating this engagement due to a documented violation of our safety and ethics protocols during previous interactions. We have a zero-tolerance policy for abusive language or unsafe job site practices. Please do not contact our dispatch again.",
    FINANCIAL_BLACK_HOLE: "Hi, this is [Rep Name]. I'm actually calling from the accounts department regarding invoice #[Invoice Number] which is now over 60 days past due. Our system has placed a credit hold on your account, preventing any new inspections or certifications until this balance is cleared. Can we process a card over the phone right now?",
    ABUSE_PROTOCOL: "Sir/Ma'am, I am terminating this call. We record all interactions, and your language violates our staff protection policy. This incident will be logged and reviewed by management for potential permanent service suspension.",
    SYSTEM_AUTODETECT: "Our system flagged a data anomaly with your account credentials. I need to verify your Tax ID and primary insurance binder before we can proceed with any further bookings. Do you have those handy?"
};

export const getScriptForPartner = (partner) => {
    if (partner.chaos_flag && partner.chaos_flag_type) {
        return CHAOS_SCRIPTS[partner.chaos_flag_type] || CHAOS_SCRIPTS.SYSTEM_AUTODETECT;
    }
    if (partner.invoice_overdue_days > 60) {
        return CHAOS_SCRIPTS.FINANCIAL_BLACK_HOLE;
    }
    return null; // Standard greeting handled elsewhere
};