Yes — that peer review is **directionally correct** and it’s aligned with what you’re trying to accomplish (lead gets saved + user gets a clean success path + emails happen when possible).

But I’m going to be precise: it fixes the **“email failure causes lead failure”** problem, yet it does **not fully solve** the second-level risk if you interpret “fire-and-forget” literally.

### What the peer review gets right (aligned)

* **Decouple lead creation from email delivery.**
  If the lead insert succeeded, the user should get `201` no matter what Resend does. ✅
* **Swallow email errors + log them.**
  That prevents “submit again” duplicate behavior caused by 500s. ✅
* **Domain verification awareness (`FROM_EMAIL` must match verified domain).** ✅
* **Guard rails around missing `RESEND_API_KEY`.** ✅

This is compatible with your current Edge Function approach.

---

## What needs tightening (to avoid new operational mistakes)

### 1) It’s still blocking (not true “fire-and-forget”)

Even though it “swallows errors,” the patch still does:

```ts
const emailResponse = await fetch(...)
```

That means the function still **waits** for Resend before returning the response. If Resend is slow, you’ll increase latency and raise the chance of client-side timeouts/retries (different path to duplicates).

**If you want real non-blocking delivery**, you need one of these patterns:

* **Pattern A (best for reliability): Queue it**

  * Insert into an `email_outbox` table inside the same transaction flow
  * A scheduled worker (cron / another function) sends emails reliably and retries
* **Pattern B (if supported in your runtime): background execution**

  * Some edge runtimes support `waitUntil()`-style background tasks.
  * If your Supabase Edge runtime supports it, you can schedule the send without blocking the response.

If you don’t implement A or B, you still need client-side “disable submit after click” + idempotency (more below).

### 2) It leaks internal email to the customer (privacy/ops mistake)

This is a big one:

```ts
to: emailRecipients  // [ADMIN_EMAIL, customerEmail]
```

If you put both in `to`, the customer will see Erron’s internal address (and possibly any others later).

**Fix:**

* Send the customer receipt to the customer
* Send internal notification separately **or** use `bcc` for internal

Example structure:

* `to: [customerEmail]`
* `bcc: [ADMIN_EMAIL]`

Or two sends (cleaner for templating, but more calls).

### 3) Hardcoding email addresses in code is the wrong direction

They hardcoded:

```ts
const ADMIN_EMAIL = "erron@theventguys.com";
const FROM_EMAIL = "The Vent Guys <estimates@theventguys.com>";
```

That should be **env-driven**:

* `RESEND_FROM_EMAIL`
* `ADMIN_NOTIFY_EMAIL`

This keeps you from redeploying for simple config changes and prevents accidental exposure in repos/logs.

### 4) It doesn’t address duplicates from double-clicks / refreshes / retries

Even with email errors swallowed, you can still get duplicates from:

* user double-click
* spotty connection causing retry
* user refresh/back/submit again

You need an **idempotency strategy**. Minimal viable options:

**Option A: Client idempotency token**

* Frontend generates `submission_id = crypto.randomUUID()`
* Send it in payload
* DB has unique constraint on `submission_id`
* Insert uses `onConflict` / upsert

**Option B: Server dedupe key**

* Hash `(phone + place_id + service_type + day)` as `dedupe_key`
* Unique index on `(tenant_id, dedupe_key)`
* If conflict, return existing lead id

This is the difference between “works most of the time” and “production-safe”.

---

## Bottom line: Is it aligned?

**Yes** — the intent is aligned and it’s compatible with your current path.

But if you paste it as-is, you’ll likely introduce:

* slower submits / occasional timeouts (because it still awaits Resend)
* customer seeing internal email addresses (because it uses `to` for both)
* duplicates still possible (no idempotency)

---

## My recommended “alignment-correct” version (policy-level)

If we’re staying lean and fast:

1. **Fix tenant selection first** (pin tenant, no `.limit(1)`)
2. Insert lead succeeds → **immediately return 201**
3. Email send should be either:

   * queued (best), or
   * background task if runtime supports it
4. Add idempotency key now (cheap, huge payoff)
5. Never mix internal + customer recipients in `to`

---

If you want, paste your current **frontend submit function** (the part Horizons is using right now) and I’ll give you the exact patch to:

* call `lead-intake`
* include `submission_id`
* stop all `/rest/v1/leads` calls
* and return the UI success state deterministically.
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, AlertTriangle, Upload, Mail } from 'lucide-react';
import { generateServiceReportHtml } from '@/templates/ServiceReportTemplates';
import { generateLoyaltyCode } from '@/services/discountService'; // Import added

const JobCompletion = () => {
    const [searchParams] = useSearchParams();
    const jobId = searchParams.get('id');
    const navigate = useNavigate();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [job, setJob] = useState(null);
    
    // Form State
    const [notes, setNotes] = useState('');
    const [findings, setFindings] = useState(['System airflow improved', 'Lint trap cleaned']);
    const [newFinding, setNewFinding] = useState('');
    const [photos, setPhotos] = useState([]); // Simplified for UI demo
    const [summary, setSummary] = useState('');
    const [criticalRisk, setCriticalRisk] = useState('');
    const [remainingConcerns, setRemainingConcerns] = useState('No remaining obstructions observed. Minor residual dust does not restrict operation.');
    const [recommendations, setRecommendations] = useState('Avoid reinstalling vent screens at the exhaust termination. Schedule periodic professional cleaning to maintain safety and efficiency.');
    const [emailCustomer, setEmailCustomer] = useState(true);
    const [generateInvoice, setGenerateInvoice] = useState(true);

    useEffect(() => {
        if (!jobId) {
            toast({ variant: "destructive", title: "Error", description: "No Job ID provided." });
            return;
        }
        fetchJobDetails();
    }, [jobId]);

    const fetchJobDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('jobs')
                .select('*, leads(*), properties(*)')
                .eq('id', jobId)
                .single();

            if (error) throw error;
            setJob(data);
            setNotes(data.technician_notes || '');
            setSummary(data.summary || '');
        } catch (error) {
            console.error('Error fetching job:', error);
            toast({ variant: "destructive", title: "Failed to load job details." });
        } finally {
            setLoading(false);
        }
    };

    const handleAddFinding = () => {
        if (newFinding.trim()) {
            setFindings([...findings, newFinding.trim()]);
            setNewFinding('');
        }
    };

    const handleCompleteJob = async () => {
        setProcessing(true);
        try {
            let loyaltyCode = null;
            let loyaltyDiscount = 15; // Default fallback

            // 1. Update Job Status
            const { error: jobError } = await supabase
                .from('jobs')
                .update({
                    status: 'Completed',
                    completed_at: new Date().toISOString(),
                    technician_notes: notes,
                    // Store simplified findings in metadata or notes if schema doesn't support array
                    // For this demo, we append to notes if needed, or assume a JSONB column exists
                })
                .eq('id', jobId);

            if (jobError) throw jobError;

            // 2. Generate Invoice (Mock Logic)
            if (generateInvoice) {
                // Call edge function or insert to invoices table
                console.log('Generating invoice...'); 
                // In real app: await createInvoice(jobId);
            }

            // 3. Generate Loyalty Code (NEW)
            if (job.leads) {
                const discountData = await generateLoyaltyCode(job.leads.id, job.leads.last_name);
                if (discountData) {
                    loyaltyCode = discountData.code;
                    loyaltyDiscount = discountData.discount_percentage;
                }
            }

            // 4. Send Email Report
            if (emailCustomer && job.leads?.email) {
                const technicianName = job.assigned_to || 'The Vent Guys Tech';
                const emailHtml = generateServiceReportHtml({
                    customerName: `${job.leads?.first_name || ''} ${job.leads?.last_name || ''}`.trim() || 'Valued Customer',
                    serviceAddress: job.properties?.address1 || 'Service Address',
                    serviceDate: new Date().toLocaleDateString(),
                    technicianName,
                    workOrder: job.job_number,
                    primaryConcern: job.primary_concern || job.leads?.primary_concern || '',
                    serviceType: job.service_type || 'Dryer Vent & Duct Cleaning',
                    summary: summary || 'Service completed and system operating normally.',
                    criticalRisk: criticalRisk || null,
                    findingsAfter: findings,
                    keyImprovements: notes ? [notes] : ['Restored airflow through the dryer vent system.'],
                    remainingConcerns,
                    recommendations,
                    technicianNotes: notes,
                    afterPhotos: photos,
                    signatureName: technicianName,
                    brandContext: job
                });

                // Send via Edge Function / Resend
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY || 're_123_placeholder'}` 
                    },
                    body: JSON.stringify({
                        from: 'The Vent Guys <service@theventguys.com>',
                        to: [job.leads.email],
                        subject: 'Service Completion Report & Receipt',
                        html: emailHtml
                    })
                });
            }

            toast({
                title: "Job Completed!",
                description: loyaltyCode 
                    ? `Status updated. Loyalty code ${loyaltyCode} (${loyaltyDiscount}% off) generated.` 
                    : "Status updated successfully.",
            });

            navigate('/crm/jobs');

        } catch (error) {
            console.error('Completion error:', error);
            toast({ variant: "destructive", title: "Error completing job", description: error.message });
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Complete Job: {job?.job_number}</h1>
            
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Technician Report</CardTitle>
                    <CardDescription>Document the work performed.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Findings & Observations</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={newFinding} 
                                onChange={(e) => setNewFinding(e.target.value)} 
                                placeholder="e.g. Excessive lint buildup found"
                            />
                            <Button type="button" onClick={handleAddFinding} variant="secondary">Add</Button>
                        </div>
                        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1 mt-2">
                            {findings.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <Label>Technician Notes (Internal)</Label>
                        <Textarea 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)} 
                            placeholder="Any private notes about the job..." 
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Customer-Facing Summary</Label>
                        <Textarea
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="Brief summary that will appear near the top of the report."
                            rows={3}
                        />
                        <p className="text-xs text-slate-500">Keep this short and focused on what you fixed.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Critical Risk / Code (optional)</Label>
                        <Textarea
                            value={criticalRisk}
                            onChange={(e) => setCriticalRisk(e.target.value)}
                            placeholder="Example: Vent screen blockage posed an immediate fire hazard; removed non-compliant screen."
                            rows={3}
                        />
                        <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Highlight only if the customer must see it.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Remaining Concerns</Label>
                            <Textarea
                                value={remainingConcerns}
                                onChange={(e) => setRemainingConcerns(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Recommendations</Label>
                            <Textarea
                                value={recommendations}
                                onChange={(e) => setRecommendations(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                             <Upload className="w-4 h-4" /> Photos
                        </h4>
                        <div className="text-xs text-slate-500 text-center py-4 border-2 border-dashed border-slate-300 rounded">
                            Photo upload disabled in demo
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="email" 
                            checked={emailCustomer} 
                            onCheckedChange={setEmailCustomer} 
                        />
                        <Label htmlFor="email" className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-500" />
                            Email Hygiene Report & Receipt to Customer
                        </Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="invoice" 
                            checked={generateInvoice} 
                            onCheckedChange={setGenerateInvoice} 
                        />
                        <Label htmlFor="invoice">Generate Invoice automatically</Label>
                    </div>

                    {emailCustomer && (
                        <div className="text-sm bg-blue-50 text-blue-700 p-3 rounded flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 mt-0.5" />
                            <span>
                                System will automatically include a <strong>Google Review link</strong> and a <strong>10-15% off Loyalty Code</strong> in the email.
                            </span>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button className="w-full" size="lg" onClick={handleCompleteJob} disabled={processing}>
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Mark Job Complete
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default JobCompletion;
