import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Loader2, Filter } from 'lucide-react';

const PricebookManager = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filter, setFilter] = useState('All');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Labor',
    base_price: '',
    price_type: 'flat_rate',
    description: '',
    active: true
  });
  const tenantId = getTenantId();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('price_book')
      .select('*')
      .eq('tenant_id', tenantId) // TENANT FILTER
      .order('name');
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
        if (!formData.name || !formData.base_price) {
            toast({ variant: 'destructive', title: 'Validation', description: 'Name and Price are required.' });
            return;
        }

        const payload = { 
            ...formData, 
            base_price: parseFloat(formData.base_price),
            tenant_id: tenantId // Explicit insert
        };
        
        if (!payload.code) {
            payload.code = payload.name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000);
        }

        let error;
        if (editingItem) {
            ({ error } = await supabase.from('price_book').update(payload).eq('id', editingItem.id).eq('tenant_id', tenantId));
        } else {
            ({ error } = await supabase.from('price_book').insert([payload]));
        }

        if (error) throw error;

        toast({ title: 'Success', description: `Item saved.` });
        setIsModalOpen(false);
        fetchItems();
    } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleDelete = async (id) => {
      if (!window.confirm('Delete this item?')) return;
      const { error } = await supabase.from('price_book').delete().eq('id', id).eq('tenant_id', tenantId);
      if (error) {
          toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
          fetchItems();
      }
  };

  const openModal = (item = null) => {
      setEditingItem(item);
      if (item) {
          setFormData({
              code: item.code,
              name: item.name,
              category: item.category || 'Labor',
              base_price: item.base_price,
              price_type: item.price_type || 'flat_rate',
              description: item.description || '',
              active: item.active
          });
      } else {
          setFormData({
            code: '',
            name: '',
            category: 'Labor',
            base_price: '',
            price_type: 'flat_rate',
            description: '',
            active: true
          });
      }
      setIsModalOpen(true);
  };

  const filteredItems = filter === 'All' ? items : items.filter(i => i.category === filter);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Pricebook</h1>
            <p className="text-gray-500">Manage labor rates, materials, and equipment pricing.</p>
        </div>
        <Button onClick={() => openModal()} className="bg-blue-600">
            <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[150px]">
                        <Filter className="w-4 h-4 mr-2 text-gray-500"/>
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Categories</SelectItem>
                        <SelectItem value="Labor">Labor</SelectItem>
                        <SelectItem value="Materials">Materials</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Service">Service</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-4"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filteredItems.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-4">No items found.</TableCell></TableRow>
                    ) : (
                        filteredItems.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs text-gray-500">{item.code}</TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell className="capitalize">{item.price_type?.replace('_', ' ')}</TableCell>
                                <TableCell className="text-right font-bold text-green-700">${item.base_price}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => openModal(item)}><Edit className="h-4 w-4 text-blue-500" /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
                <DialogTitle>{editingItem ? 'Edit Line Item' : 'Add Line Item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Item Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Service Name" />
                    </div>
                    <div className="space-y-2">
                        <Label>Code (Optional)</Label>
                        <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="Auto-generated if empty" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Labor">Labor</SelectItem>
                                <SelectItem value="Materials">Materials</SelectItem>
                                <SelectItem value="Equipment">Equipment</SelectItem>
                                <SelectItem value="Service">Service</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Pricing Type</Label>
                        <Select value={formData.price_type} onValueChange={val => setFormData({...formData, price_type: val})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="flat_rate">Flat Rate</SelectItem>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="per_unit">Per Unit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Base Price ($)</Label>
                    <Input type="number" step="0.01" value={formData.base_price} onChange={e => setFormData({...formData, base_price: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save Item</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricebookManager;