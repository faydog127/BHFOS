import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Bot, Loader2, Save, Plus, Trash2, Mic, HandMetal, BookOpen } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { invoke } from '@/lib/api';

const Section = ({ title, description, children, ...props }) => (
  <Card {...props}>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const Field = ({ label, children, description }) => (
  <div className="space-y-2">
    <Label className="font-semibold">{label}</Label>
    {children}
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
  </div>
);

const AiBrainstormButton = ({ prompt, onReceive, context, buttonText = "AI Brainstorm" }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const { data, error } = await invoke('generate-marketing-copy', {
                body: { context: { ...context, prompt_type: prompt } },
            });

            if (error || !data.result) {
                throw new Error(error || 'Failed to get a valid response from AI.');
            }
            onReceive(data.result);
        } catch (err) {
            toast({ variant: 'destructive', title: 'AI Generation Failed', description: err.message });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {buttonText}
        </Button>
    );
};

const BrandingSettings = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('brand-voice');
  const [loading, setLoading] = useState({});
  
  // Data States
  const [brandProfile, setBrandProfile] = useState({});
  const [services, setServices] = useState([]);
  const [objections, setObjections] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);

  // Dialog states
  const [serviceModal, setServiceModal] = useState({ isOpen: false, data: null });
  const [objectionModal, setObjectionModal] = useState({ isOpen: false, data: null });
  const [playbookModal, setPlaybookModal] = useState({ isOpen: false, data: null });

  const fetchData = useCallback(async (table, setter) => {
    setLoading(prev => ({ ...prev, [table]: true }));
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      toast({ variant: 'destructive', title: `Failed to load ${table}`, description: error.message });
    } else {
      if (table === 'brand_profile') {
        const profile = data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
        setter(profile);
      } else {
        setter(data);
      }
    }
    setLoading(prev => ({ ...prev, [table]: false }));
  }, [toast]);

  useEffect(() => {
    fetchData('brand_profile', setBrandProfile);
    fetchData('services', setServices);
    fetchData('objections', setObjections);
    fetchData('playbook_templates', setPlaybooks);
  }, [fetchData]);

  const handleSave = async (table, data, id) => {
    setLoading(prev => ({ ...prev, saving: true }));
    let error;
    if (id) { // Update
        ({ error } = await supabase.from(table).update(data).eq('id', id));
    } else { // Insert
        ({ error } = await supabase.from(table).insert(data));
    }

    if (error) {
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
        toast({ title: 'Saved successfully!' });
    }
    setLoading(prev => ({ ...prev, saving: false }));
    return !error;
  };
  
  const handleDelete = async (table, id) => {
    const confirmed = window.confirm('Are you sure you want to delete this item?');
    if (!confirmed) return;

    const { error } = await supabase.from(table).delete().eq('id', id);
    if(error) {
         toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    } else {
        toast({ title: 'Item deleted.' });
        fetchData(table, {
            'services': setServices,
            'objections': setObjections,
            'playbook_templates': setPlaybooks
        }[table]);
    }
  };

  const handleBrandProfileSave = async () => {
    setLoading(prev => ({...prev, brandSaving: true}));
    const updates = Object.keys(brandProfile).map(key => ({ key, value: brandProfile[key] }));
    const { error } = await supabase.from('brand_profile').upsert(updates, { onConflict: 'key' });
    if(error) {
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
        toast({ title: 'Brand Profile Saved!' });
    }
    setLoading(prev => ({...prev, brandSaving: false}));
  }

  const renderLoading = (key) => (
    loading[key] ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : null
  );

  return (
    <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="brand-voice"><Mic className="w-4 h-4 mr-2"/>Brand Voice</TabsTrigger>
                <TabsTrigger value="services"><BookOpen className="w-4 h-4 mr-2"/>Services</TabsTrigger>
                <TabsTrigger value="objections"><HandMetal className="w-4 h-4 mr-2"/>Objections</TabsTrigger>
                <TabsTrigger value="playbooks"><Bot className="w-4 h-4 mr-2"/>Playbooks</TabsTrigger>
            </TabsList>
            
            {/* BRAND VOICE */}
            <TabsContent value="brand-voice" className="space-y-4">
                <Section title="Brand Voice & Personality" description="Define the core attributes of your brand's communication style for the AI.">
                    <div className="space-y-4">
                        <Field label="Brand Persona (e.g., 'Helpful Expert', 'Friendly Neighbor')">
                            <Input value={brandProfile.persona || ''} onChange={e => setBrandProfile({...brandProfile, persona: e.target.value})} />
                        </Field>
                        <Field label="Key Value Proposition (What you do best)">
                            <Textarea value={brandProfile.value_prop || ''} onChange={e => setBrandProfile({...brandProfile, value_prop: e.target.value})} />
                        </Field>
                        <Field label="Tone of Voice (Keywords: e.g., 'professional, empathetic, clear, concise')">
                            <div className="flex items-center gap-2">
                                <Input className="flex-1" value={brandProfile.tone_keywords || ''} onChange={e => setBrandProfile({...brandProfile, tone_keywords: e.target.value})} />
                                <AiBrainstormButton 
                                    prompt="brainstorm_tone"
                                    context={{ value_prop: brandProfile.value_prop, persona: brandProfile.persona }}
                                    onReceive={text => setBrandProfile({...brandProfile, tone_keywords: text})}
                                />
                            </div>
                        </Field>
                        
                        <div className="h-px bg-slate-200 my-6" />

                        <Field label="Detailed Voice Description" description="A more detailed paragraph describing how the AI should behave.">
                            <Textarea rows={4} value={brandProfile.voice_details || ''} onChange={e => setBrandProfile({...brandProfile, voice_details: e.target.value})} />
                        </Field>
                        <Field label="Tone Guardrails" description="Specific things the AI should NEVER do or say. One rule per line.">
                            <Textarea rows={3} value={brandProfile.tone_guardrails || ''} onChange={e => setBrandProfile({...brandProfile, tone_guardrails: e.target.value})} placeholder="e.g., Never make medical claims.&#10;Never use high-pressure sales tactics." />
                        </Field>
                        <Field label="Service Area Description" description="Define your geographic service area in natural language.">
                            <Textarea value={brandProfile.service_area_description || ''} onChange={e => setBrandProfile({...brandProfile, service_area_description: e.target.value})} placeholder="e.g., We serve all of Brevard County, from Mims to Micco, including coastal areas like Melbourne Beach and inland cities like Palm Bay." />
                        </Field>
                        <Field label="Lead Capture Protocol" description="Instructions for how to handle a lead who is ready to book.">
                            <Textarea value={brandProfile.lead_capture_protocol || ''} onChange={e => setBrandProfile({...brandProfile, lead_capture_protocol: e.target.value})} placeholder="e.g., Collect their full name, phone number, and property address. Let them know our scheduling team will call them back within 15 minutes to confirm an appointment time."/>
                        </Field>
                        <Field label="Pricing Configuration" description="High-level overview of pricing to guide AI responses. Avoid specific dollar amounts if they change often.">
                            <Textarea value={brandProfile.pricing_config || ''} onChange={e => setBrandProfile({...brandProfile, pricing_config: e.target.value})} placeholder="e.g., Dryer vent cleaning starts at $XX. Full system duct cleaning is based on system size and home square footage. We always provide a firm quote on-site before any work begins."/>
                        </Field>
                        <Field label="Florida Mold Law Detail" description="Specific legal disclosure about mold-related work in Florida.">
                            <Textarea rows={4} value={brandProfile.florida_mold_law_detail || ''} onChange={e => setBrandProfile({...brandProfile, florida_mold_law_detail: e.target.value})} placeholder="e.g., While we can clean and sanitize ductwork to improve air quality, Florida law requires a separate licensed mold assessor and remediator for any project involving more than 10 square feet of mold."/>
                        </Field>
                    </div>
                     <CardFooter className="pt-6">
                        <Button onClick={handleBrandProfileSave} disabled={loading.brandSaving}>
                            {loading.brandSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>} Save Brand Profile
                        </Button>
                    </CardFooter>
                </Section>
            </TabsContent>
            
            {/* SERVICES */}
            <TabsContent value="services">
                 <Section title="Services Library" description="Manage the services you offer. This is used by AI to make recommendations.">
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Typical Price Range</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {services.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-semibold">{s.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{s.description}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{s.typical_price_range}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => setServiceModal({ isOpen: true, data: s })}>Edit</Button>
                                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('services', s.id)}><Trash2 className="w-4"/></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <CardFooter className="pt-6">
                        <Button onClick={() => setServiceModal({isOpen: true, data: null})}> <Plus className="mr-2"/> Add Service</Button>
                    </CardFooter>
                 </Section>
            </TabsContent>

            {/* OBJECTIONS */}
            <TabsContent value="objections">
                 <Section title="Objection Handling" description="Library of common customer objections and your standard responses.">
                    <Table>
                         <TableHeader><TableRow><TableHead>Objection Keyword</TableHead><TableHead>Category</TableHead><TableHead>Response Script</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                         <TableBody>
                            {objections.map(o => (
                                <TableRow key={o.id}>
                                    <TableCell className="font-semibold">{o.keyword}</TableCell>
                                    <TableCell><Badge variant="secondary">{o.category}</Badge></TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{o.response}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => setObjectionModal({ isOpen: true, data: o })}>Edit</Button>
                                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('objections', o.id)}><Trash2 className="w-4"/></Button>
                                    </TableCell>
                                ></TableRow>
                            ))}
                         </TableBody>
                    </Table>
                    <CardFooter className="pt-6">
                        <Button onClick={() => setObjectionModal({isOpen: true, data: null})}> <Plus className="mr-2"/> Add Objection</Button>
                    </CardFooter>
                 </Section>
            </TabsContent>

            {/* PLAYBOOKS */}
            <TabsContent value="playbooks">
                <Section title="AI Playbook Templates" description="System and user prompts that guide AI content generation for specific tasks.">
                    <Table>
                        <TableHeader><TableRow><TableHead>Playbook Key</TableHead><TableHead>System Prompt</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {playbooks.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-semibold font-mono text-sm">{p.playbook_key}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground truncate max-w-lg">{p.system_prompt}</TableCell>
                                     <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => setPlaybookModal({ isOpen: true, data: p })}>Edit</Button>
                                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('playbook_templates', p.id)}><Trash2 className="w-4"/></Button>
                                    </TableCell>
                                ></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                     <CardFooter className="pt-6">
                        <Button onClick={() => setPlaybookModal({isOpen: true, data: null})}> <Plus className="mr-2"/> Add Playbook</Button>
                    </CardFooter>
                </Section>
            </TabsContent>
        </Tabs>

        {/* DIALOGS */}
        <CrudDialog model="Service" table="services" state={serviceModal} setState={setServiceModal} onSave={handleSave} onFetch={() => fetchData('services', setServices)} fields={[
            { name: 'name', label: 'Service Name', type: 'text' },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'typical_price_range', label: 'Typical Price Range (e.g. $100-$200)', type: 'text' },
            { name: 'target_audience', label: 'Target Audience (comma-separated)', type: 'text', process: v => v.split(',').map(s=>s.trim()) },
            { name: 'talking_points', label: 'AI Talking Points (one per line)', type: 'textarea', process: v => v.split('\n').filter(Boolean) },
        ]} />
        <CrudDialog model="Objection" table="objections" state={objectionModal} setState={setObjectionModal} onSave={handleSave} onFetch={() => fetchData('objections', setObjections)} fields={[
            { name: 'keyword', label: 'Customer Says (Keyword)', type: 'text' },
            { name: 'category', label: 'Category (e.g., cost, timing, trust)', type: 'text' },
            { name: 'response', label: 'Our Response', type: 'textarea', aiPrompt: 'brainstorm_objection_response' },
        ]} />
        <CrudDialog model="Playbook" table="playbook_templates" state={playbookModal} setState={setPlaybookModal} onSave={handleSave} onFetch={() => fetchData('playbook_templates', setPlaybooks)} fields={[
            { name: 'playbook_key', label: 'Playbook Key (e.g., free_air_check_welcome)', type: 'text' },
            { name: 'system_prompt', label: 'System Prompt (Instructions for AI)', type: 'textarea' },
            { name: 'user_prompt_template', label: 'User Prompt Template (Variables: {{...}})', type: 'textarea' },
        ]} />
    </div>
  );
};

// Generic CRUD Dialog
const CrudDialog = ({ model, table, state, setState, onSave, onFetch, fields }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (state.isOpen) {
            setFormData(state.data || {});
        }
    }, [state]);

    const handleChange = (name, value, processor) => {
        const processedValue = processor ? processor(value) : value;
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleSaveClick = async () => {
        // Ensure arrays are handled correctly for Supabase
        const payload = { ...formData };
        fields.forEach(field => {
            if (field.process && typeof payload[field.name] === 'string') {
                 payload[field.name] = field.process(payload[field.name]);
            }
        });

        const success = await onSave(table, payload, state.data?.id);
        if (success) {
            setState({ isOpen: false, data: null });
            onFetch();
        }
    };
    
    return (
        <Dialog open={state.isOpen} onOpenChange={(open) => setState({isOpen: open, data: state.data})}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{state.data ? 'Edit' : 'Create'} {model}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {fields.map(f => (
                        <div key={f.name} className="space-y-2">
                             <Label htmlFor={f.name}>{f.label}</Label>
                             {f.type === 'textarea' ? (
                                <Textarea id={f.name} value={Array.isArray(formData[f.name]) ? formData[f.name].join('\n') : formData[f.name] || ''} onChange={e => handleChange(f.name, e.target.value)} />
                             ) : (
                                <Input id={f.name} value={Array.isArray(formData[f.name]) ? formData[f.name].join(', ') : formData[f.name] || ''} onChange={e => handleChange(f.name, e.target.value)} />
                             )}
                             {f.aiPrompt && (
                                <AiBrainstormButton
                                    prompt={f.aiPrompt}
                                    context={formData}
                                    buttonText={`Brainstorm ${model} Response`}
                                    onReceive={text => handleChange(f.name, text)}
                                />
                             )}
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setState({ isOpen: false, data: null })}>Cancel</Button>
                    <Button onClick={handleSaveClick}>Save {model}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default BrandingSettings;