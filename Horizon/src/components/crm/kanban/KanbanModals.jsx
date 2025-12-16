import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const KanbanModals = ({ transition, isOpen, onClose, onConfirm, technicians = [] }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  // ... (keep existing config fetching logic if needed, omitted for brevity but assumed present)

  useEffect(() => {
    if (isOpen) setData({}); 
  }, [isOpen, transition]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(data);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateData = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  if (!transition) return null;

  const renderContent = () => {
    switch (transition.modal) {
      // ... (Keep existing cases: log_interaction, booking, approval, scheduling, reschedule, invoice, payment)
      case 'log_interaction':
        return (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Interaction Type</Label>
              <Select onValueChange={(v) => updateData('method', v)}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea onChange={(e) => updateData('notes', e.target.value)} />
            </div>
          </div>
        );
      case 'booking':
        return (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <Label>Scheduled Date</Label>
               <Input type="datetime-local" onChange={(e) => updateData('date', e.target.value)} />
            </div>
            <div className="space-y-2">
               <Label>Notes</Label>
               <Textarea onChange={(e) => updateData('notes', e.target.value)} />
            </div>
          </div>
        );
      case 'approval':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2 border p-4 rounded bg-slate-50">
               <Checkbox id="signed" onCheckedChange={(c) => updateData('signed', c)} />
               <Label htmlFor="signed" className="font-bold">Quote Signed?</Label>
            </div>
            <div className="space-y-2">
               <Label>Notes</Label>
               <Textarea onChange={(e) => updateData('notes', e.target.value)} />
            </div>
          </div>
        );
      case 'scheduling':
        return (
          <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Technician</Label>
               <Select onValueChange={(v) => updateData('technician_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select Tech" /></SelectTrigger>
                  <SelectContent>
                     {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
               </Select>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label>Start Time</Label>
                   <Input type="datetime-local" onChange={(e) => updateData('start_time', e.target.value)} />
                </div>
                <div className="space-y-2">
                   <Label>Est. Minutes</Label>
                   <Input type="number" onChange={(e) => updateData('estimated_minutes', e.target.value)} />
                </div>
             </div>
          </div>
        );
      case 'invoice':
         return (
            <div className="space-y-4 py-4">
               <div className="flex items-center space-x-2">
                   <Checkbox id="email_inv" defaultChecked onCheckedChange={(c) => updateData('send_email', c)} />
                   <Label htmlFor="email_inv">Email Invoice</Label>
               </div>
            </div>
         );
      case 'payment':
          return (
             <div className="space-y-4 py-4">
                <div className="space-y-2">
                   <Label>Amount</Label>
                   <Input type="number" onChange={(e) => updateData('amount', e.target.value)} />
                </div>
                <div className="space-y-2">
                   <Label>Method</Label>
                   <Select onValueChange={(v) => updateData('method', v)}>
                      <SelectTrigger><SelectValue placeholder="Select Method" /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="card">Card</SelectItem>
                         <SelectItem value="cash">Cash</SelectItem>
                         <SelectItem value="check">Check</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>
          );
      // UPDATED CANCELLATION MODAL
      case 'cancellation':
          return (
             <div className="space-y-4 py-4">
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded text-sm">
                   Archive Disposition. Select reason for reporting.
                </div>
                <div className="space-y-2">
                   <Label>Reason *</Label>
                   <Select onValueChange={(v) => updateData('archive_reason', v)}>
                      <SelectTrigger><SelectValue placeholder="Select Reason" /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="Price">Price</SelectItem>
                         <SelectItem value="Competitor">Competitor</SelectItem>
                         <SelectItem value="Timing">Timing</SelectItem>
                         <SelectItem value="Out of Area">Out of Area</SelectItem>
                         <SelectItem value="Chaos">Chaos / Difficult</SelectItem>
                         <SelectItem value="Internal Error">Internal Error</SelectItem>
                         <SelectItem value="Duplicate">Duplicate</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label>Notes</Label>
                   <Textarea placeholder="Context..." onChange={(e) => updateData('notes', e.target.value)} />
                </div>
             </div>
          );
      default: return <div>Confirm?</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{transition.label || 'Action'}</DialogTitle>
        </DialogHeader>
        {renderContent()}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading || (transition.modal === 'cancellation' && !data.archive_reason)}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KanbanModals;