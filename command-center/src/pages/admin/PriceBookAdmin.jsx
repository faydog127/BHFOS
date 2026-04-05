import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const PriceBookAdmin = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const { toast } = useToast();

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Duct Cleaning',
    base_price: '',
    price_type: 'flat',
    description: '',
    rules_notes: '',
    active: true
  });

  // Editing State
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('price_book')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load price book.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked) => {
    setFormData(prev => ({ ...prev, active: checked }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('price_book')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Success', description: 'Item updated successfully.' });
      } else {
        const { error } = await supabase
          .from('price_book')
          .insert([formData]);
        if (error) throw error;
        toast({ title: 'Success', description: 'New item added to price book.' });
      }
      
      setIsDialogOpen(false);
      setEditingId(null);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteItemId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItemId) return;
    
    try {
      const { error } = await supabase.from('price_book').delete().eq('id', deleteItemId);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Item removed.' });
      setDeleteConfirmOpen(false);
      setDeleteItemId(null);
      fetchItems();
    } catch (error) {
      toast({ title: 'Error', description: 'Could not delete item.', variant: 'destructive' });
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      code: item.code,
      name: item.name,
      category: item.category,
      base_price: item.base_price,
      price_type: item.price_type,
      description: item.description || '',
      rules_notes: item.rules_notes || '',
      active: item.active
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category: 'Duct Cleaning',
      base_price: '',
      price_type: 'flat',
      description: '',
      rules_notes: '',
      active: true
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <Helmet>
        <title>Price Book Admin | The Vent Guys</title>
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Price Book Management</h1>
            <p className="text-slate-600">Manage service offerings, pricing, and SKUs.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
               <Link to="/crm">Back to CRM</Link>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) { setEditingId(null); resetForm(); } }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Item' : 'Add New Service Item'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">SKU / Code</Label>
                      <Input id="code" name="code" value={formData.code} onChange={handleInputChange} required placeholder="e.g. DUCT-SYS1" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Service Name</Label>
                      <Input id="name" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g. Standard Clean" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <select 
                        id="category" 
                        name="category" 
                        value={formData.category} 
                        onChange={handleInputChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="Duct Cleaning">Duct Cleaning</option>
                        <option value="Dryer Vent">Dryer Vent</option>
                        <option value="Hardware">Hardware</option>
                        <option value="Testing">Testing</option>
                        <option value="Add-On">Add-On</option>
                        <option value="Membership">Membership</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="base_price">Base Price ($)</Label>
                      <Input id="base_price" name="base_price" type="number" step="0.01" value={formData.base_price} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price_type">Price Type</Label>
                      <select 
                        id="price_type" 
                        name="price_type" 
                        value={formData.price_type} 
                        onChange={handleInputChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="flat">Flat Rate</option>
                        <option value="sqft">Per Sq Ft</option>
                        <option value="tiered">Tiered (Size)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Public)</Label>
                    <Input id="description" name="description" value={formData.description} onChange={handleInputChange} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rules_notes">Internal Rules / Notes</Label>
                    <Input id="rules_notes" name="rules_notes" value={formData.rules_notes} onChange={handleInputChange} placeholder="e.g. Only allow if mold detected" />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch id="active" checked={formData.active} onCheckedChange={handleSwitchChange} />
                    <Label htmlFor="active">Active Item</Label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">{editingId ? 'Save Changes' : 'Create Item'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">No items found in price book.</TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-medium">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>${parseFloat(item.base_price).toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{item.price_type}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                        {item.active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                          <Edit2 className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PriceBookAdmin;