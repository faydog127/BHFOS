import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Camera, CheckCircle2, ArrowRight } from 'lucide-react';
import SignaturePad from '@/components/tech/SignaturePad';
import CardProgressionModal from '@/components/crm/kanban/CardProgressionModal'; // Integration Point

const JobCompletionWizard = ({ job, onComplete }) => {
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // Form State
    const [notes, setNotes] = useState('');
    const [satisfaction, setSatisfaction] = useState('5');
    const [signature, setSignature] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [checklist, setChecklist] = useState({
        site_clean: false,
        system_tested: false,
        customer_demo: false
    });

    // Progression Modal State
    const [showProgressionModal, setShowProgressionModal] = useState(false);

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // In a real app, upload to storage bucket here
        // For now, simulate local URL
        const fakeUrl = URL.createObjectURL(file);
        setPhotos([...photos, { url: fakeUrl, name: file.name }]);
        toast({ title: "Photo Added", description: "Image attached successfully." });
    };

    const handleSubmit = async () => {
        if (!signature) {
            toast({ variant: "destructive", title: "Signature Required", description: "Please capture customer signature." });
            return;
        }

        setLoading(true);
        try {
            // 1. Update Job Status
            const { error: jobError } = await supabase
                .from('jobs')
                .update({
                    status: 'completed', // Or 'pending_invoice' depending on workflow
                    completed_at: new Date().toISOString(),
                    technician_notes: notes,
                    satisfaction_rating: parseInt(satisfaction),
                    signature_url: signature, // In real app, upload base64/blob to storage first
                    photos_json: photos
                })
                .eq('id', job.id);

            if (jobError) throw jobError;

            // 2. Log Survey/Review if needed
            if (satisfaction) {
                await supabase.from('job_surveys').insert({
                    job_id: job.id,
                    rating: parseInt(satisfaction),
                    feedback: notes
                });
            }

            toast({ 
                title: "Job Completed!", 
                description: "Work order finalized successfully.",
                className: "bg-green-50 border-green-200"
            });
            
            setStep(4); // Move to 'Next Actions' step
            
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "Failed to complete job." });
        } finally {
            setLoading(false);
        }
    };

    const renderStep1_Details = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Technician Notes</Label>
                <Textarea 
                    placeholder="Describe work performed, any issues found..." 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    className="h-32"
                />
            </div>
            <div className="space-y-2">
                <Label>Closing Checklist</Label>
                <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="clean" 
                            checked={checklist.site_clean} 
                            onCheckedChange={(c) => setChecklist(prev => ({ ...prev, site_clean: c }))} 
                        />
                        <Label htmlFor="clean" className="font-normal cursor-pointer">Work area cleaned & debris removed</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="tested" 
                            checked={checklist.system_tested} 
                            onCheckedChange={(c) => setChecklist(prev => ({ ...prev, system_tested: c }))} 
                        />
                        <Label htmlFor="tested" className="font-normal cursor-pointer">System operation tested</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="demo" 
                            checked={checklist.customer_demo} 
                            onCheckedChange={(c) => setChecklist(prev => ({ ...prev, customer_demo: c }))} 
                        />
                        <Label htmlFor="demo" className="font-normal cursor-pointer">Demonstrated to customer</Label>
                    </div>
                </div>
            </div>
            <div className="space-y-2">
                <Label>Photos</Label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {photos.map((p, idx) => (
                        <img key={idx} src={p.url} alt="Job proof" className="h-20 w-20 object-cover rounded border" />
                    ))}
                    <label className="h-20 w-20 flex flex-col items-center justify-center border-2 border-dashed rounded cursor-pointer hover:bg-slate-50">
                        <Camera className="h-6 w-6 text-slate-400" />
                        <span className="text-[10px] text-slate-500 mt-1">Add Photo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                </div>
            </div>
        </div>
    );

    const renderStep2_Satisfaction = () => (
        <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
                <Label className="text-lg">Customer Satisfaction</Label>
                <p className="text-sm text-slate-500">How would the customer rate today's service?</p>
            </div>
            <RadioGroup value={satisfaction} onValueChange={setSatisfaction} className="flex justify-center gap-4">
                {[1, 2, 3, 4, 5].map((rating) => (
                    <div key={rating} className="flex flex-col items-center">
                        <RadioGroupItem value={rating.toString()} id={`r-${rating}`} className="peer sr-only" />
                        <Label 
                            htmlFor={`r-${rating}`}
                            className="flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 border-slate-200 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 peer-data-[state=checked]:text-blue-700 cursor-pointer hover:bg-slate-50 transition-all font-bold text-lg"
                        >
                            {rating}
                        </Label>
                        <span className="text-[10px] text-slate-400 mt-1">
                            {rating === 1 ? 'Poor' : rating === 5 ? 'Great' : ''}
                        </span>
                    </div>
                ))}
            </RadioGroup>
        </div>
    );

    const renderStep3_Signature = () => (
        <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 p-2 border-b text-xs text-center text-slate-500">
                    Sign below to confirm work completion
                </div>
                <SignaturePad onEnd={setSignature} />
            </div>
            {signature && (
                <div className="flex items-center text-sm text-green-600 justify-center">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Signature Captured
                </div>
            )}
        </div>
    );

    const renderStep4_NextActions = () => (
        <div className="py-8 flex flex-col items-center space-y-6 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
                <h3 className="text-xl font-bold text-slate-900">Job Complete!</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-2">
                    The job has been successfully recorded. What would you like to do next?
                </p>
            </div>
            
            <div className="grid gap-3 w-full max-w-xs">
                <Button 
                    size="lg" 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowProgressionModal(true)}
                >
                    Move to Next Stage <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full" onClick={onComplete}>
                    Return to Dashboard
                </Button>
            </div>
        </div>
    );

    return (
        <div className="max-w-md mx-auto p-4">
            <Card className="shadow-lg border-t-4 border-t-blue-500">
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        {step < 4 ? `Complete Job (${step}/3)` : 'Summary'}
                    </CardTitle>
                    {step < 4 && <CardDescription>{job.title}</CardDescription>}
                </CardHeader>
                
                <CardContent>
                    {step === 1 && renderStep1_Details()}
                    {step === 2 && renderStep2_Satisfaction()}
                    {step === 3 && renderStep3_Signature()}
                    {step === 4 && renderStep4_NextActions()}
                </CardContent>

                {step < 4 && (
                    <CardFooter className="flex justify-between border-t pt-4 bg-slate-50/50">
                        <Button variant="ghost" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
                            Back
                        </Button>
                        
                        {step < 3 ? (
                            <Button onClick={() => setStep(s => s + 1)}>
                                Next Step
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={loading || !signature}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Finalize Job
                            </Button>
                        )}
                    </CardFooter>
                )}
            </Card>

            {/* INTEGRATION: Progression Modal */}
            {showProgressionModal && (
                <CardProgressionModal 
                    isOpen={showProgressionModal}
                    onClose={() => setShowProgressionModal(false)}
                    entityId={job.id}
                    entityType="job"
                    currentStageId="col_in_progress" // Assuming job was in progress
                    onSuccess={() => {
                        onComplete(); // Close wizard after move
                    }}
                />
            )}
        </div>
    );
};

export default JobCompletionWizard;