import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';

const ServiceCatalog = () => {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'General',
    default_duration_minutes: 60,
    is_active: true
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('services_catalog').select('*').order('name');
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      setServices(data || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
        if (!formData.name || !formData.slug) {
            toast({ variant: 'destructive', title: 'Validation', description: 'Name and Slug are required.' });
            return;
        }

        const payload = { ...formData };
        let error;

        if (editingService) {
            ({ error } = await supabase.from('services_catalog').update(payload).eq('id', editingService.id));
        } else {
            ({ error } = await supabase.from('services_catalog').insert([payload]));
        }

        if (error) throw error;

        toast({ title: 'Success', description: `Service ${editingService ? 'updated' : 'created'}.` });
        setIsModalOpen(false);
        fetchServices();
    } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleDelete = async (id) => {
      if (!window.confirm('Are you sure? This cannot be undone.')) return;
      const { error } = await supabase.from('services_catalog').delete().eq('id', id);
      if (error) {
          toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
          fetchServices();
      }
  };

  const openModal = (service = null) => {
      setEditingService(service);
      if (service) {
          setFormData({
              name: service.name,
              slug: service.slug,
              description: service.description || '',
              category: service.category || 'General',
              default_duration_minutes: service.default_duration_minutes || 60,
              is_active: service.is_active
          });
      } else {
          setFormData({
            name: '',
            slug: '',
            description: '',
            category: 'General',
            default_duration_minutes: 60,
            is_active: true
          });
      }
      setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Service Catalog</h1>
            <p className="text-gray-500">Define the services available for booking and quotes.</p>
        </div>
        <Button onClick={() => openModal()} className="bg-blue-600">
            <Plus className="mr-2 h-4 w-4" /> Add Service
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Services</CardTitle></CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Duration (min)</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-4"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                    ) : services.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-4">No services found.</TableCell></TableRow>
                    ) : (
                        services.map(s => (
                            <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell className="text-gray-500">{s.slug}</TableCell>
                                <TableCell>{s.category}</TableCell>
                                <TableCell>{s.default_duration_minutes}</TableCell>
                                <TableCell>{s.is_active ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-gray-400">No</span>}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => openModal(s)}><Edit className="h-4 w-4 text-blue-500" /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Service Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Dryer Vent Cleaning" />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug (Unique ID)</Label>
                        <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="e.g. dryer-vent-cleaning" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="HVAC, Plumbing..." />
                    </div>
                    <div className="space-y-2">
                        <Label>Duration (Minutes)</Label>
                        <Input type="number" value={formData.default_duration_minutes} onChange={e => setFormData({...formData, default_duration_minutes: parseInt(e.target.value)})} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="flex items-center space-x-2">
                    <Switch checked={formData.is_active} onCheckedChange={checked => setFormData({...formData, is_active: checked})} />
                    <Label>Active (Visible in booking)</Label>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save Service</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceCatalog;