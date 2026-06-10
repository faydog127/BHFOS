export const automationService = {
    /**
     * Automation #1: Zombie Archive
     * Quote Sent > 30 days -> Dormant
     */
    async runZombieProtocol() {
        const results = { archived: 0, errors: [] };

        results.errors.push('Disabled: pipeline_stage is reporting-only under STATUS_VOCABULARY_LOCK_V1; implement a status-owned automation path before enabling.');
        return results;
    },

    /**
     * Automation #2: Stale Quote Alert
     * Quote Sent > 72 hours -> Alert
     */
    async runStaleQuoteCheck() {
        const results = { alerted: 0, errors: [] };
        results.errors.push('Disabled: pipeline_stage is reporting-only under STATUS_VOCABULARY_LOCK_V1; implement a status-owned automation path before enabling.');
        return results;
    }
};
