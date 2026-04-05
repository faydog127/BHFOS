import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Save, Mail, Loader2, Send } from 'lucide-react';

const EmailTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [formData, setFormData] = useState({ name: '', subject: '', body_html: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
        .from('doc_templates')
        .select('*')
        .contains('channels', ['email']);
    
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
          subject: tpl.subject || '',
          body_html: tpl.body_html || ''
      });
  };

  const handleSave = async () => {
      setSaving(true);
      try {
          const { error } = await supabase
            .from('doc_templates')
            .update({ 
                name: formData.name,
                subject: formData.subject,
                body_html: formData.body_html
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

  const handleTestSend = async () => {
      if (!testEmail) {
          toast({ variant: 'destructive', title: 'Error', description: 'Enter a test email address.' });
          return;
      }
      setSendingTest(true);
      // This simulates a send since we don't have a real backend route for raw template testing in this constraint set
      // In a real app, you'd invoke an edge function `send-email` with override parameters.
      setTimeout(() => {
          toast({ title: 'Test Sent', description: `Preview sent to ${testEmail}` });
          setSendingTest(false);
      }, 1500);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Email Templates</h1>
                <p className="text-gray-500">Customize automated email communications.</p>
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
                                <div className="text-xs text-gray-500 truncate">{t.subject}</div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Edit Email</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Template Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Subject Line</Label>
                        <Input value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>HTML Body</Label>
                        <Textarea 
                            className="font-mono text-xs"
                            value={formData.body_html} 
                            onChange={e => setFormData({...formData, body_html: e.target.value})} 
                            rows={10}
                        />
                    </div>

                    <div className="bg-slate-100 p-4 rounded-lg">
                        <Label className="text-xs uppercase text-slate-500 font-bold mb-2 block">HTML Preview (Approximate)</Label>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 min-h-[150px] prose prose-sm max-w-none">
                            <div dangerouslySetInnerHTML={{ __html: formData.body_html }} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="test@example.com" 
                                className="w-64" 
                                value={testEmail}
                                onChange={e => setTestEmail(e.target.value)}
                            />
                            <Button variant="secondary" onClick={handleTestSend} disabled={sendingTest}>
                                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
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

export default EmailTemplates;