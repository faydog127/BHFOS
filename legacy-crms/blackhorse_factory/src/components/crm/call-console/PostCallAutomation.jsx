
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, CalendarCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const PostCallAutomation = ({ leadId }) => {
  const { toast } = useToast();

  const handleAction = async (type) => {
    if (!leadId) return;

    try {
        let actionPayload = {
            lead_id: leadId,
            status: 'pending',
            action_type: type
        };

        if (type === 'sms') {
            actionPayload.body = "Hi, sorry I missed you! This is The Vent Guys. Are you still interested in a quote?";
        } else if (type === 'email') {
            actionPayload.subject_line = "Follow up: Duct Cleaning Quote";
            actionPayload.body = "Thank you for speaking with us today...";
        }

        await supabase.from('marketing_actions').insert(actionPayload);
        
        toast({
            title: "Automation Triggered",
            description: `${type.toUpperCase()} added to queue.`,
        });
    } catch (e) {
        console.error(e);
        toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" onClick={() => handleAction('sms')}>
        <MessageSquare className="h-4 w-4 text-blue-500" />
        <span className="text-[10px]">Send "Missed You" SMS</span>
      </Button>
      <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" onClick={() => handleAction('email')}>
        <Mail className="h-4 w-4 text-purple-500" />
        <span className="text-[10px]">Send Info Email</span>
      </Button>
      <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" onClick={() => {
        toast({ title: "Opening Calendar..." });
      }}>
        <CalendarCheck className="h-4 w-4 text-green-500" />
        <span className="text-[10px]">Book Follow-up</span>
      </Button>
    </div>
  );
};

export default PostCallAutomation;
