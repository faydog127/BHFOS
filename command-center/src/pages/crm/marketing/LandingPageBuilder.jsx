import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ExternalLink, Edit, Plus, Loader2, Eye } from 'lucide-react';

const LandingPageBuilder = () => {
  const { toast } = useToast();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    headline: '',
    subheadline: '',
    cta_text: 'Get Started',
    background_image_url: '',
    primary_color: '#3b82f6'
  });

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('landing_pages').select('*').order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else setPages(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    try {
        if (!formData.slug || !formData.headline) {
            toast({ variant: 'destructive', title: 'Required', description: 'Slug and Headline are required.' });
            return;
        }

        const payload = { ...formData };
        let error;

        if (editingPage) {
            ({ error } = await supabase.from('landing_pages').update(payload).eq('id', editingPage.id));
        } else {
            ({ error } = await supabase.from('landing_pages').insert([payload]));
        }

        if (error) throw error;

        toast({ title: 'Success', description: 'Landing page saved.' });
        setIsModalOpen(false);
        fetchPages();
    } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const openModal = (page = null) => {
      setEditingPage(page);
      if (page) {
          setFormData({ ...page });
      } else {
          setFormData({
            slug: '',
            title: '',
            headline: '',
            subheadline: '',
            cta_text: 'Get Started',
            background_image_url: '',
            primary_color: '#3b82f6'
          });
      }
      setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Landing Pages</h1>
            <p className="text-gray-500">Create high-converting pages for your campaigns.</p>
        </div>
        <Button onClick={() => openModal()} className="bg-blue-600">
            <Plus className="mr-2 h-4 w-4" /> New Page
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Slug</TableHead>
                        <TableHead>Headline</TableHead>
                        <TableHead>CTA</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? <TableRow><TableCell colSpan={4} className="text-center py-4"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> : 
                    pages.map(p => (
                        <TableRow key={p.id}>
                            <TableCell className="font-mono text-sm">/lp/{p.slug}</TableCell>
                            <TableCell>{p.headline}</TableCell>
                            <TableCell><span className="px-2 py-1 rounded bg-gray-100 text-xs">{p.cta_text}</span></TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => window.open(`/lp/${p.slug}`, '_blank')}>
                                        <ExternalLink className="h-4 w-4 text-gray-500" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => openModal(p)}>
                                        <Edit className="h-4 w-4 text-blue-500" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editingPage ? 'Edit Page' : 'Create Landing Page'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-6 py-4">
                <div className="col-span-2 space-y-2">
                    <Label>Headline</Label>
                    <Input value={formData.headline} onChange={e => setFormData({...formData, headline: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Slug (URL Path)</Label>
                    <div className="flex items-center">
                        <span className="text-gray-500 text-sm mr-1">/lp/</span>
                        <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="summer-sale" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Page Title (SEO)</Label>
                    <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-2">
                    <Label>Subheadline</Label>
                    <Input value={formData.subheadline} onChange={e => setFormData({...formData, subheadline: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>CTA Button Text</Label>
                    <Input value={formData.cta_text} onChange={e => setFormData({...formData, cta_text: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                        <Input type="color" className="w-12 h-10 p-1" value={formData.primary_color} onChange={e => setFormData({...formData, primary_color: e.target.value})} />
                        <Input value={formData.primary_color} onChange={e => setFormData({...formData, primary_color: e.target.value})} />
                    </div>
                </div>
                <div className="col-span-2 space-y-2">
                    <Label>Background Image URL</Label>
                    <Input value={formData.background_image_url} onChange={e => setFormData({...formData, background_image_url: e.target.value})} placeholder="https://..." />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save Page</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPageBuilder;