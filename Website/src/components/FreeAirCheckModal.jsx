
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/customSupabaseClient';

const FreeAirCheckModal = ({ open, onOpenChange, children }) => {
  const [date, setDate] = useState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      // 1. Submit to Leads table in Supabase
      const { error } = await supabase
        .from('leads')
        .insert([{
          first_name: data.fullName.split(' ')[0],
          last_name: data.fullName.split(' ').slice(1).join(' ') || '',
          email: data.email,
          phone: data.phone,
          status: 'New',
          pipeline_stage: 'new',
          service: 'Free Air Check',
          message: `Address: ${data.address}. Preferred Date: ${date ? format(date, 'yyyy-MM-dd') : 'Anytime'}. Note: ${data.notes || 'None'}`,
          source: 'Website Modal',
          lead_source: 'Free Air Check Offer'
        }]);

      if (error) throw error;

      // 2. Success State
      setIsSuccess(true);
      toast({
        title: "Request Received!",
        description: "We'll call you shortly to confirm your free inspection.",
      });
      
      // Reset form after delay if needed, or keep success state until close
      setTimeout(() => {
        // reset();
        // setIsSuccess(false);
        // onOpenChange(false);
      }, 3000);

    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us directly.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation completes
    setTimeout(() => {
      setIsSuccess(false);
      reset();
      setDate(undefined);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white">
        <div className="bg-blue-600 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-blue-200" />
            <DialogHeader className="z-10 relative">
            <DialogTitle className="text-2xl font-bold text-white text-center">Free Air Quality Check</DialogTitle>
            <DialogDescription className="text-blue-100 text-center">
                No cost. No obligation. Just honest answers.
            </DialogDescription>
            </DialogHeader>
        </div>

        <div className="p-6">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Request Sent!</h3>
                <p className="text-slate-600 max-w-xs mx-auto mt-2">
                  One of our certified technicians will contact you within 24 hours to schedule your inspection.
                </p>
              </div>
              <Button onClick={handleClose} className="mt-4 bg-slate-900 text-white w-full">
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input 
                  id="fullName" 
                  placeholder="John Doe" 
                  {...register("fullName", { required: "Name is required" })}
                  className={errors.fullName ? "border-red-500" : ""}
                />
                {errors.fullName && <span className="text-xs text-red-500">{errors.fullName.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    {...register("email", { 
                        required: "Email is required",
                        pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address"
                        }
                    })}
                    className={errors.email ? "border-red-500" : ""}
                    />
                     {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="(321) 555-0123" 
                    {...register("phone", { required: "Phone is required" })}
                    className={errors.phone ? "border-red-500" : ""}
                    />
                    {errors.phone && <span className="text-xs text-red-500">{errors.phone.message}</span>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Home Address</Label>
                <Input 
                  id="address" 
                  placeholder="123 Palm Ave, Melbourne" 
                  {...register("address", { required: "Address is required for inspection" })}
                  className={errors.address ? "border-red-500" : ""}
                />
                 {errors.address && <span className="text-xs text-red-500">{errors.address.message}</span>}
              </div>

              <div className="space-y-2">
                <Label>Preferred Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                  <Label htmlFor="notes">Specific Concerns?</Label>
                  <Textarea 
                    id="notes" 
                    placeholder="e.g. Smell mold, high humidity, just moved in..." 
                    {...register("notes")}
                  />
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Schedule My Free Check"
                )}
              </Button>
              <p className="text-xs text-center text-slate-400 mt-2">
                Your information is secure. We never sell your data.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FreeAirCheckModal;
