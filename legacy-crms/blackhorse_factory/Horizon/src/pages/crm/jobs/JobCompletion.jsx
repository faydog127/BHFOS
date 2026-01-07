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
import { generateHygieneReportEmail } from '@/templates/HygieneReportTemplateV2';
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
                const emailHtml = generateHygieneReportEmail({
                    customerName: job.leads.first_name,
                    serviceAddress: job.properties?.address1 || 'Your Address',
                    serviceDate: new Date().toLocaleDateString(),
                    technicianName: 'The Vent Guys Tech',
                    findings: findings,
                    photos: [], // Add real photos here
                    nextServiceDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString(),
                    loyaltyCode: loyaltyCode, // Pass code to template
                    loyaltyDiscount: loyaltyDiscount, // Pass percentage to template
                    loyaltyExpiration: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString()
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