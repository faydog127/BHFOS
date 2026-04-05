import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Smartphone, Loader2, Plus } from 'lucide-react';

const SmsTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [formData, setFormData] = useState({ name: '', body_text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    // Using doc_templates where channels contains 'sms'
    const { data, error } = await supabase
        .from('doc_templates')
        .select('*')
        .contains('channels', ['sms']);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      setTemplates(data || []);
      if (data && data.length > 0 && !selectedTemplateId) {
          selectTemplate(data[0]);
      }
    }
    setLoading(false);
  };

  const selectTemplate = (tpl) => {
      setSelectedTemplateId(tpl.id);
      setFormData({
          name: tpl.name,
          body_text: tpl.body_text || tpl.sms_fallback || ''
      });
  };

  const handleSave = async () => {
      setSaving(true);
      try {
          const { error } = await supabase
            .from('doc_templates')
            .update({ 
                name: formData.name,
                body_text: formData.body_text,
                sms_fallback: formData.body_text 
            })
            .eq('id', selectedTemplateId);

          if (error) throw error;
          
          toast({ title: 'Saved', description: 'Template updated successfully.' });
          fetchTemplates();
      } catch (err) {
          toast({ variant: 'destructive', title: 'Error', description: err.message });
      } finally {
          setSaving(false);
      }
  };

  const charCount = formData.body_text.length;
  const segmentCount = Math.ceil(charCount / 160);

  return (
    <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">SMS Templates</h1>
                <p className="text-gray-500">Manage automated text message responses.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
                <CardHeader>
                    <CardTitle>Templates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : (
                        templates.map(t => (
                            <div 
                                key={t.id}
                                onClick={() => selectTemplate(t)}
                                className={`p-3 rounded cursor-pointer border transition-colors ${selectedTemplateId === t.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-100'}`}
                            >
                                <div className="font-medium">{t.name}</div>
                                <div className="text-xs text-gray-500 truncate">{t.body_text}</div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Edit Template</CardTitle>
                    <CardDescription>Modify the content of the selected SMS.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Template Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Message Body</Label>
                        <Textarea 
                            value={formData.body_text} 
                            onChange={e => setFormData({...formData, body_text: e.target.value})} 
                            rows={5}
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Segments: {segmentCount} ({charCount} chars)</span>
                            <span>Variables: {'{{first_name}}'}, {'{{company}}'}</span>
                        </div>
                    </div>

                    <div className="bg-slate-100 p-4 rounded-lg">
                        <Label className="text-xs uppercase text-slate-500 font-bold mb-2 block">Preview</Label>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 max-w-xs">
                            <p className="text-sm text-gray-800 leading-snug">
                                {formData.body_text || 'Select a template to preview...'}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving || !selectedTemplateId}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
};

export default SmsTemplates;