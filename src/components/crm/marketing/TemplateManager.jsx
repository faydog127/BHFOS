import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Mail, MessageSquare, Plus, FileText, Smartphone, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TemplateManager = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'marketing', // marketing, operational, sales
    channels: ['email'], // array of strings
    subject: '',
    body_text: '',
    active: true,
    version: '1.0',
    audience: ['all']
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('doc_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({ title: "Error", description: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.body_text) {
      toast({ title: "Validation Error", description: "Name and Content are required.", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const payload = {
        ...formData,
        id: crypto.randomUUID(), // Generate ID client side or let DB handle it if configured (doc_templates is text ID usually)
        created_at: new Date().toISOString(),
        required_fields: [],
        attachments: {}
      };

      const { error } = await supabase
        .from('doc_templates')
        .insert([payload]);

      if (error) throw error;

      toast({ title: "Success", description: "Template created successfully." });
      setIsCreateOpen(false);
      fetchTemplates();
      // Reset form
      setFormData({
        name: '',
        category: 'marketing',
        channels: ['email'],
        subject: '',
        body_text: '',
        active: true,
        version: '1.0',
        audience: ['all']
      });

    } catch (error) {
      console.error('Create Error:', error);
      toast({ title: "Error", description: error.message || "Failed to create template", variant: "destructive" });
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('doc_templates')
        .update({ active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      // Optimistic update
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, active: !currentStatus } : t));
      toast({ title: "Updated", description: `Template ${!currentStatus ? 'activated' : 'deactivated'}.` });
    } catch (error) {
      toast({ title: "Error", description: "Could not update status", variant: "destructive" });
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'email') return t.channels && t.channels.includes('email');
    if (activeFilter === 'sms') return t.channels && t.channels.includes('sms');
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Message Templates</h3>
          <p className="text-sm text-muted-foreground">Manage standardized email and SMS content.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Template
        </Button>
      </div>

      <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2"><Mail className="w-3 h-3" /> Email</TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-2"><Smartphone className="w-3 h-3" /> SMS</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     <TableRow><TableCell colSpan={6} className="text-center py-8">Loading templates...</TableCell></TableRow>
                  ) : filteredTemplates.length === 0 ? (
                     <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No templates found.</TableCell></TableRow>
                  ) : (
                    filteredTemplates.map((template) => (
                      <TableRow key={template.id} className="group">
                        <TableCell className="font-medium">
                            <div className="flex flex-col">
                                <span>{template.name}</span>
                                <span className="text-xs text-muted-foreground">v{template.version}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="capitalize">{template.category}</Badge>
                        </TableCell>
                        <TableCell>
                            <div className="flex gap-1">
                                {template.channels?.includes('email') && <Badge variant="secondary" className="text-xs"><Mail className="w-3 h-3 mr-1"/> Email</Badge>}
                                {template.channels?.includes('sms') && <Badge variant="secondary" className="text-xs"><Smartphone className="w-3 h-3 mr-1"/> SMS</Badge>}
                            </div>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                            <div className="truncate text-sm text-muted-foreground" title={template.body_text || template.body_html}>
                                {template.subject ? <span className="font-semibold text-slate-700 mr-1">[{template.subject}]</span> : null}
                                {template.body_text || "No text content"}
                            </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className="cursor-pointer hover:opacity-80"
                            variant={template.active ? 'default' : 'destructive'}
                            onClick={() => toggleStatus(template.id, template.active)}
                          >
                            {template.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                             <Button variant="ghost" size="sm">Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Message Template</DialogTitle>
            <DialogDescription>
              Design reusable content for automation or manual sending.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Welcome Email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
                <Label>Channels</Label>
                <div className="flex gap-4">
                    <Button 
                        type="button"
                        variant={formData.channels.includes('email') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                            const newChannels = formData.channels.includes('email') 
                                ? formData.channels.filter(c => c !== 'email')
                                : [...formData.channels, 'email'];
                            setFormData({...formData, channels: newChannels});
                        }}
                    >
                        <Mail className="w-4 h-4 mr-2" /> Email
                    </Button>
                    <Button 
                        type="button"
                        variant={formData.channels.includes('sms') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                            const newChannels = formData.channels.includes('sms') 
                                ? formData.channels.filter(c => c !== 'sms')
                                : [...formData.channels, 'sms'];
                            setFormData({...formData, channels: newChannels});
                        }}
                    >
                        <Smartphone className="w-4 h-4 mr-2" /> SMS
                    </Button>
                </div>
            </div>

            {formData.channels.includes('email') && (
                <div className="space-y-2">
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input id="subject" value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} placeholder="Welcome to the family!" />
                </div>
            )}

            <div className="space-y-2">
              <Label>Body Content</Label>
              <Textarea 
                className="h-32" 
                value={formData.body_text} 
                onChange={(e) => setFormData({...formData, body_text: e.target.value})} 
                placeholder="Hi {{first_name}}, thanks for contacting us..." 
              />
              <p className="text-xs text-muted-foreground">Supports variable injection like {'{{first_name}}'}.</p>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateManager;