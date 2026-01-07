import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquarePlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const UnpreparedInput = ({ callId }) => {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setIsSubmitting(true);

    try {
      // Log to database for future training
      const { error } = await supabase.from('call_logs').insert({
        lead_id: null, // If we had lead context we'd add it
        notes: `[UNPREPARED INPUT]: ${input}`,
        outcome: 'training_data',
        checklist: { type: 'gap_analysis' }
      });

      if (error) throw error;

      toast({
        title: "Logged for Training",
        description: "Thanks! We'll use this to improve the AI scripts.",
      });
      setInput('');
    } catch (err) {
      console.error(err);
      toast({
        title: "Error logging",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquarePlus className="w-4 h-4 text-purple-500" />
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Off-Script / Unexpected Response?</h4>
      </div>
      <Textarea 
        placeholder="Type what the customer said that we didn't have a script for..."
        className="mb-2 text-sm min-h-[80px]"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <div className="flex justify-end">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleSubmit} 
          disabled={!input || isSubmitting}
          className="text-xs h-8"
        >
          {isSubmitting ? 'Logging...' : 'Log for AI Training'}
        </Button>
      </div>
    </div>
  );
};

export default UnpreparedInput;