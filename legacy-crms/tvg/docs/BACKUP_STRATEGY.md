# Data Protection & Backup Strategy

## 1. Database Backups (Supabase)

### Automated Daily Backups
*   **Frequency**: Daily (Midnight UTC).
*   **Retention**: 7 Days (Free Plan) / 30 Days (Pro Plan).
*   **Scope**: Full database dump including schema, data, and roles.

### Point-in-Time Recovery (PITR)
*   **Status**: Enabled (Pro Plan).
*   **Granularity**: Second-by-second recovery capability.
*   **Use Case**: Accidental deletions, malicious attacks, bad migrations.

### Manual Snapshots
*   **Trigger**: Before any major deployment (e.g., v2.5.0 -> v2.6.0).
*   **Method**: `supabase db dump` CLI command.
*   **Storage**: Stored in a secure, encrypted S3 bucket separate from the hosting provider.

## 2. Codebase Backups

### Git Repository
*   **Primary Host**: GitHub / GitLab (Remote).
*   **Redundancy**: 
    *   Developer local machines (Distributed).
    *   Mirror repository on secondary provider (e.g., Bitbucket) synced nightly.

### Code Freeze Snapshots
*   **Mechanism**: Tags (`v2.5.0`) are immutable pointers to specific commits.
*   **Artifacts**: Build artifacts (`dist/` folder) are archived in the CI/CD pipeline storage for 90 days.

## 3. Disaster Recovery (DR) Plan

### Scenario: Cloud Provider Outage
1.  **Code**: Deploy the latest stable Docker container or build artifact to a secondary provider (e.g., AWS/Vercel/Netlify).
2.  **Data**: If Supabase is down, assess read-replica availability. If total loss, provision new Postgres instance and restore from latest S3 dump.
3.  **DNS**: Update DNS records (Cloudflare) to point to the failover deployment.

### Testing
*   **Drill Frequency**: Quarterly.
*   **Procedure**: Simulate a table deletion in the `staging` environment and execute the Restore procedure to verify data integrity and time-to-recovery (RTO).