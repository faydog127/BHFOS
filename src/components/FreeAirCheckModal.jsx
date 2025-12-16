import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';
import { SERVICE_CATALOG } from '@/lib/serviceCatalog';

const FreeAirCheckModal = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    jobType: 'residential',
    partnerName: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleJobTypeChange = (value) => {
      setFormData(prev => ({ ...prev, jobType: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create Lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          notes: formData.notes,
          status: 'New',
          pipeline_stage: 'new',
          source: 'Free Air Check',
          service: 'Free Air Check',
          // New Fields
          job_type: formData.jobType,
          time_gate: formData.jobType === 'residential' ? 120 : 180, // Default 2h res, 3h comm
          partner_name: formData.jobType === 'commercial' ? formData.partnerName : null
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // 2. Create Property (Basic)
      const { error: propError } = await supabase
        .from('properties')
        .insert({
           address1: formData.address,
           city: 'Unknown',
           state: 'FL',
           zip: '00000',
           label: 'Primary',
           account_id: lead.account_id 
        });
        
      if (propError && propError.code !== '23502') { 
          // Ignore null violation if account_id is null (schema might allow loose properties)
          console.warn('Property creation issue:', propError);
      }

      // 3. Create Initial Estimate Stub
      // Pre-populate with Free Air Check service
      const freeService = SERVICE_CATALOG.find(s => s.id === 'free_air_check');
      const initialServices = freeService ? [{
          id: freeService.id,
          name: freeService.name,
          code: freeService.id,
          qty: 1,
          unitPrice: freeService.price,
          total: freeService.price,
          category: freeService.category,
          description: freeService.description
      }] : [];

      const { error: estError } = await supabase.from('estimates').insert({
          lead_id: lead.id,
          status: 'draft',
          total_price: 0,
          services: initialServices,
          property_details: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              address: formData.address
          }
      });

      if (estError) throw estError;

      toast({
        title: "Request Received",
        description: "Free Air Check request created successfully. Estimate stub generated.",
      });
      
      onOpenChange(false);
      
      // Reset form
      setFormData({
        firstName: '', lastName: '', email: '', phone: '', address: '', notes: '', jobType: 'residential', partnerName: ''
      });

    } catch (error) {
      console.error('Submission error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit request.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Free Air Check Request</DialogTitle>
          <DialogDescription>
            Enter customer details to start a new lead and estimate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" name="firstName" required value={formData.firstName} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" name="lastName" required value={formData.lastName} onChange={handleChange} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Service Address</Label>
            <Input id="address" name="address" placeholder="123 Main St, City, FL" value={formData.address} onChange={handleChange} />
          </div>

          {/* New Fields: Job Type & Partner */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                 <Label>Job Type</Label>
                 <Select value={formData.jobType} onValueChange={handleJobTypeChange}>
                     <SelectTrigger>
                         <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                         <SelectItem value="residential">Residential</SelectItem>
                         <SelectItem value="commercial">Commercial</SelectItem>
                     </SelectContent>
                 </Select>
             </div>
             
             {formData.jobType === 'commercial' && (
                 <div className="space-y-2">
                     <Label>Partner / Business Name</Label>
                     <Input 
                        name="partnerName" 
                        placeholder="e.g. Hostinger Property Mgmt" 
                        value={formData.partnerName} 
                        onChange={handleChange} 
                     />
                 </div>
             )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Issues</Label>
            <Textarea 
                id="notes" 
                name="notes" 
                placeholder="Any specific concerns? (e.g. mold, weak airflow)" 
                value={formData.notes} 
                onChange={handleChange} 
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FreeAirCheckModal;