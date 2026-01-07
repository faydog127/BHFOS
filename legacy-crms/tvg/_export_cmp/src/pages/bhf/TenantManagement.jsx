import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Loader2, Plus, Edit, Trash2, Save, Globe, CheckCircle2, 
  Building, LayoutGrid, Palette, Terminal, AlertCircle, Search,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TenantManagement = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit/Create State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle Loading State tracker
  const [togglingFeatures, setTogglingFeatures] = useState({});

  const availableFlags = [
    { id: 'enableLeads', label: 'Leads Management', icon: '👥' },
    { id: 'enablePipeline', label: 'Deal Pipeline', icon: '📊' },
    { id: 'enableJobs', label: 'Jobs & Projects', icon: '👷' },
    { id: 'enableSchedule', label: 'Smart Scheduling', icon: '📅' },
    { id: 'enableEstimates', label: 'Estimates', icon: '📝' },
    { id: 'enableInvoicing', label: 'Invoicing & Payments', icon: '💰' },
    { id: 'enableContacts', label: 'CRM Contacts', icon: '📒' },
    { id: 'enableCallConsole', label: 'Call Console', icon: '📞' },
    { id: 'enableSMS', label: 'SMS & Messaging', icon: '💬' },
    { id: 'enableMarketing', label: 'Marketing Automation', icon: '🚀' },
    { id: 'enableReporting', label: 'Analytics & Reporting', icon: '📈' },
    { id: 'enablePricebook', label: 'Pricebook', icon: '💲' },
    { id: 'enablePartners', label: 'Partner Portal', icon: '🤝' },
    { id: 'enableSettings', label: 'System Settings', icon: '⚙️' }
  ];

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: true });
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error fetching tenants', description: error.message });
    } else {
      setTenants(data);
    }
    setLoading(false);
  };

  const handleEdit = (tenant) => {
    setCurrentTenant(tenant);
    setFormData({
      ...tenant,
      feature_flags: tenant.feature_flags || {}
    });
    setActiveTab('general');
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setCurrentTenant(null);
    setFormData({
      id: '',
      name: '',
      logo_url: '',
      primary_color: '#0f172a',
      secondary_color: '#fbbf24',
      website_url: '',
      description: '',
      feature_flags: availableFlags.reduce((acc, flag) => ({ ...acc, [flag.id]: true }), {})
    });
    setActiveTab('general');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Ensure ID is lowercase and url-safe
    const payload = {
      ...formData,
      id: formData.id.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    };

    let error;
    if (currentTenant) {
      ({ error } = await supabase.from('tenants').update(payload).eq('id', currentTenant.id));
    } else {
      ({ error } = await supabase.from('tenants').insert(payload));
    }

    setIsSaving(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } else {
      toast({ 
        title: currentTenant ? 'Tenant Updated' : 'Tenant Created',
        description: `${payload.name} has been successfully configured.`,
        className: "bg-green-50 border-green-200"
      });
      setIsModalOpen(false);
      fetchTenants();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!tenantToDelete) return;
    
    setIsDeleting(true);
    const { error } = await supabase.from('tenants').delete().eq('id', tenantToDelete.id);
    setIsDeleting(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    } else {
      toast({ 
        title: 'Tenant Deleted',
        description: `${tenantToDelete.name} has been removed.`,
        className: "bg-red-50 border-red-200"
      });
      setDeleteConfirmOpen(false);
      setTenantToDelete(null);
      fetchTenants();
    }
  };

  // Real-time toggle update
  const handleFeatureToggle = async (tenantId, flagId, currentValue) => {
    // 1. Optimistic Update in UI
    const newValue = !currentValue;
    const toggleKey = `${tenantId}-${flagId}`;
    
    setTogglingFeatures(prev => ({ ...prev, [toggleKey]: true }));
    
    setTenants(prevTenants => prevTenants.map(t => {
      if (t.id === tenantId) {
        return {
          ...t,
          feature_flags: {
            ...t.feature_flags,
            [flagId]: newValue
          }
        };
      }
      return t;
    }));

    // 2. Persist to DB
    const tenantToUpdate = tenants.find(t => t.id === tenantId);
    if (!tenantToUpdate) return;

    const updatedFlags = {
      ...tenantToUpdate.feature_flags,
      [flagId]: newValue
    };

    const { error } = await supabase
      .from('tenants')
      .update({ feature_flags: updatedFlags })
      .eq('id', tenantId);

    setTogglingFeatures(prev => ({ ...prev, [toggleKey]: false }));

    if (error) {
      // Revert optimistic update on error
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update feature flag.' });
      setTenants(prevTenants => prevTenants.map(t => {
        if (t.id === tenantId) {
          return {
            ...t,
            feature_flags: {
              ...t.feature_flags,
              [flagId]: currentValue // revert
            }
          };
        }
        return t;
      }));
    } else {
      toast({ 
        title: newValue ? 'Feature Enabled' : 'Feature Disabled',
        description: `Successfully updated ${flagId} for ${tenantToUpdate.name}`,
        duration: 2000
      });
    }
  };

  // Filter tenants based on search
  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-8 space-y-8 font-sans text-slate-900">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-start gap-5">
           <div className="p-3 bg-slate-900 rounded-xl shadow-lg shadow-slate-900/20">
              <Building className="w-8 h-8 text-[#fbbf24]" />
           </div>
           <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tenant Management</h1>
              <p className="text-slate-500 mt-1 max-w-2xl">
                Control plane for the Black Horse Factory multi-tenant architecture. Manage environments, branding, and feature availability.
              </p>
           </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <Input 
                placeholder="Search tenants..." 
                className="pl-9 w-64 border-slate-200 focus:border-slate-400"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
             />
          </div>
          <Button onClick={handleCreate} className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-6">
            <Plus className="w-4 h-4 mr-2" /> New Environment
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-white/50 px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Active Environments</CardTitle>
              <CardDescription>Overview of all registered tenants and their configurations.</CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
              <CheckCircle2 className="w-3 h-3 mr-1.5" />
              {tenants.length} Systems Online
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-slate-50/80 border-slate-100">
                <TableHead className="w-[300px] pl-8">Organization</TableHead>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Branding</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-8"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-lg" /><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><div className="flex gap-2"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-6 w-6 rounded-full" /></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="pr-8"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                            <Building className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium text-slate-600">No tenants found</p>
                            <p className="text-sm">Try adjusting your search terms</p>
                        </div>
                    </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden p-2">
                          {tenant.logo_url ? (
                            <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-contain" />
                          ) : (
                            <Building className="w-6 h-6 text-slate-300" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-base">{tenant.name}</div>
                          <a href={tenant.website_url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 mt-0.5">
                             {tenant.website_url || 'No website configured'} <Globe className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono text-xs border border-slate-200">
                        {tenant.id}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: tenant.primary_color }} title="Primary" />
                            <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: tenant.secondary_color }} title="Secondary" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-slate-700">
                             {Object.values(tenant.feature_flags || {}).filter(Boolean).length} Active
                          </span>
                          <span className="text-xs text-slate-400">
                             {availableFlags.length} Available
                          </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 shadow-none">
                         Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(tenant)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Configuration
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(tenant.website_url, '_blank')} disabled={!tenant.website_url}>
                              <Globe className="mr-2 h-4 w-4" /> Visit Website
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => {
                                setTenantToDelete(tenant);
                                setDeleteConfirmOpen(true);
                            }}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Tenant
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Tenant?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{tenantToDelete?.name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-3 mt-6">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Professional Configuration Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50">
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
             <div>
                <DialogTitle className="text-xl font-bold text-slate-900">
                    {currentTenant ? `Edit ${currentTenant.name}` : 'New Tenant Configuration'}
                </DialogTitle>
                <DialogDescription className="mt-1">
                    Manage identity, branding assets, and feature availability.
                </DialogDescription>
             </div>
             <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px]">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
             </div>
          </div>

          <div className="flex-1 overflow-hidden flex">
             {/* Sidebar Tabs */}
             <div className="w-64 bg-white border-r border-slate-200 p-4 shrink-0 overflow-y-auto">
                <nav className="space-y-1">
                   <button 
                      onClick={() => setActiveTab('general')}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                   >
                      <LayoutGrid className="w-4 h-4" /> General Info
                   </button>
                   <button 
                      onClick={() => setActiveTab('branding')}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'branding' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                   >
                      <Palette className="w-4 h-4" /> Branding & UI
                   </button>
                   <button 
                      onClick={() => setActiveTab('features')}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'features' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                   >
                      <Terminal className="w-4 h-4" /> Feature Flags
                   </button>
                </nav>

                <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tenant Status</h4>
                    <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                        <CheckCircle2 className="w-4 h-4" /> System Active
                    </div>
                </div>
             </div>

             {/* Content Area */}
             <div className="flex-1 overflow-y-auto p-8">
                {activeTab === 'general' && (
                   <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <Label>Tenant ID (Slug)</Label>
                           <Input 
                              value={formData.id || ''} 
                              onChange={e => setFormData({...formData, id: e.target.value})} 
                              disabled={!!currentTenant}
                              className="font-mono bg-slate-50"
                              placeholder="e.g. acme-corp"
                           />
                           {!currentTenant && <p className="text-xs text-slate-500">Unique identifier used in URLs. Cannot be changed later.</p>}
                        </div>
                         <div className="space-y-2">
                           <Label>Display Name</Label>
                           <Input 
                              value={formData.name || ''} 
                              onChange={e => setFormData({...formData, name: e.target.value})} 
                              placeholder="e.g. Acme Corp"
                           />
                        </div>
                      </div>

                      <div className="space-y-2">
                         <Label>Description</Label>
                         <Input 
                            value={formData.description || ''} 
                            onChange={e => setFormData({...formData, description: e.target.value})} 
                            placeholder="Internal description of this environment"
                         />
                      </div>

                      <div className="space-y-2">
                         <Label>Website URL</Label>
                         <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                               <Globe className="w-4 h-4" />
                            </span>
                            <Input 
                               className="rounded-l-none"
                               value={formData.website_url || ''} 
                               onChange={e => setFormData({...formData, website_url: e.target.value})} 
                               placeholder="https://example.com"
                            />
                         </div>
                      </div>
                   </div>
                )}

                {activeTab === 'branding' && (
                   <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className="flex gap-8">
                          <div className="w-1/2 space-y-6">
                             <div className="space-y-2">
                                <Label>Primary Brand Color</Label>
                                <div className="flex gap-2">
                                   <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
                                      <input 
                                        type="color" 
                                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
                                        value={formData.primary_color || '#000000'}
                                        onChange={e => setFormData({...formData, primary_color: e.target.value})}
                                      />
                                   </div>
                                   <Input 
                                      value={formData.primary_color || ''}
                                      onChange={e => setFormData({...formData, primary_color: e.target.value})}
                                      className="font-mono"
                                      placeholder="#HEX"
                                   />
                                </div>
                             </div>

                             <div className="space-y-2">
                                <Label>Secondary Accent Color</Label>
                                <div className="flex gap-2">
                                   <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
                                      <input 
                                        type="color" 
                                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
                                        value={formData.secondary_color || '#ffffff'}
                                        onChange={e => setFormData({...formData, secondary_color: e.target.value})}
                                      />
                                   </div>
                                   <Input 
                                      value={formData.secondary_color || ''}
                                      onChange={e => setFormData({...formData, secondary_color: e.target.value})}
                                      className="font-mono"
                                      placeholder="#HEX"
                                   />
                                </div>
                             </div>

                             <div className="space-y-2">
                                <Label>Logo URL</Label>
                                <Input 
                                   value={formData.logo_url || ''}
                                   onChange={e => setFormData({...formData, logo_url: e.target.value})}
                                   placeholder="https://..."
                                />
                             </div>
                          </div>

                          {/* Live Preview */}
                          <div className="w-1/2">
                             <Label className="mb-3 block">Theme Preview</Label>
                             <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                <div className="h-16 flex items-center px-4 border-b border-slate-100" style={{ borderTop: `4px solid ${formData.primary_color}` }}>
                                   <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: `${formData.primary_color}20` }}>
                                      {formData.logo_url ? (
                                         <img src={formData.logo_url} alt="Logo" className="w-6 h-6 object-contain" />
                                      ) : (
                                         <Building className="w-5 h-5" style={{ color: formData.primary_color }} />
                                      )}
                                   </div>
                                   <div className="font-bold text-slate-800">
                                      {formData.name || 'Tenant Name'}
                                   </div>
                                </div>
                                <div className="p-6 space-y-4">
                                   <div className="h-4 w-3/4 bg-slate-100 rounded"></div>
                                   <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
                                   <div className="flex gap-2 pt-2">
                                      <button className="px-4 py-2 rounded-md text-white text-sm font-medium shadow-sm transition-opacity hover:opacity-90" style={{ backgroundColor: formData.primary_color }}>
                                         Primary Action
                                      </button>
                                      <button className="px-4 py-2 rounded-md bg-white border text-sm font-medium shadow-sm" style={{ borderColor: formData.secondary_color, color: formData.secondary_color === '#ffffff' ? '#000' : formData.secondary_color }}>
                                         Secondary
                                      </button>
                                   </div>
                                </div>
                             </div>
                          </div>
                       </div>
                   </div>
                )}

                {activeTab === 'features' && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {availableFlags.map(flag => {
                         const isEnabled = formData.feature_flags?.[flag.id] !== false;
                         return (
                            <div 
                               key={flag.id}
                               className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${isEnabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-75'}`}
                            >
                               <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${isEnabled ? 'bg-indigo-50' : 'bg-slate-200'}`}>
                                     {flag.icon}
                                  </div>
                                  <div>
                                     <div className="font-medium text-slate-900">{flag.label}</div>
                                     <div className="text-xs text-slate-500 font-mono">{flag.id}</div>
                                  </div>
                               </div>
                               
                               {/* If editing existing, use live toggle, else use form state */}
                               {currentTenant ? (
                                 <div className="flex items-center gap-2">
                                     {togglingFeatures[`${currentTenant.id}-${flag.id}`] && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                     <Switch 
                                        checked={currentTenant.feature_flags?.[flag.id] !== false}
                                        onCheckedChange={(checked) => handleFeatureToggle(currentTenant.id, flag.id, currentTenant.feature_flags?.[flag.id] !== false)}
                                     />
                                 </div>
                               ) : (
                                 <Switch 
                                    checked={isEnabled}
                                    onCheckedChange={(checked) => {
                                       setFormData(prev => ({
                                          ...prev,
                                          feature_flags: {
                                             ...prev.feature_flags,
                                             [flag.id]: checked
                                          }
                                       }))
                                    }}
                                 />
                               )}
                            </div>
                         );
                      })}
                   </div>
                )}
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantManagement;