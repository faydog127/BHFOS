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
        let bodyText = "";
        let subjectLine = null;
        let contentPreview = "";

        // Define content based on type
        if (type === 'sms') {
            bodyText = "Hi, sorry I missed you! This is The Vent Guys. Are you still interested in a quote?";
            contentPreview = bodyText;
        } else if (type === 'email') {
            subjectLine = "Follow up: Duct Cleaning Quote";
            bodyText = "Thank you for speaking with us today. We would love to help with your ventilation needs. Please let us know when is a good time to reschedule.";
            contentPreview = "Thank you for speaking with us today...";
        }

        // Retrieve current user to get tenant_id context indirectly via RLS or explicit insert if needed
        // Note: In standard Supabase RLS with a trigger, tenant_id is often set automatically.
        // However, explicitly fetching profile or letting the trigger handle it is safer. 
        // Here we rely on the DB trigger `trg_set_tenant_id_marketing_actions` (if it exists) or similar.
        // But to be explicit as requested, we'd normally fetch the user profile. 
        // Given the constraints and typical setup, we'll let RLS/Triggers handle tenant_id 
        // unless we have the context readily available. 
        // For now, I will omit explicit tenant_id fetch to avoid extra DB calls, 
        // assuming `set_tenant_id` trigger handles it, or RLS policies inject it.
        // If strict client-side inclusion is needed, we would need to fetch user profile first.
        
        // UPDATE: The user explicitly asked to "Ensure all marketing action inserts include tenant_id".
        // I will fetch the current user's tenant_id from their profile first.
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

        let actionPayload = {
            lead_id: leadId,
            status: 'needs_approval', // Changed from 'pending' to require approval
            action_type: type,
            channel: type, // Explicitly set channel
            type: 'manual_follow_up', // Explicitly set type category
            content_preview: contentPreview, // Set preview for the dashboard
            body: bodyText,
            subject_line: subjectLine,
            created_at: new Date().toISOString(),
            tenant_id: profile?.tenant_id // Explicitly include tenant_id
        };

        const { error } = await supabase.from('marketing_actions').insert(actionPayload);
        
        if (error) throw error;

        toast({
            title: "Automation Triggered",
            description: `${type.toUpperCase()} added to approval queue.`,
        });
    } catch (e) {
        console.error("Automation error:", e);
        toast({ 
            title: "Error", 
            description: e.message || "Failed to queue action", 
            variant: "destructive" 
        });
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
        toast({ title: "Opening Calendar...", description: "Calendar integration coming soon." });
      }}>
        <CalendarCheck className="h-4 w-4 text-green-500" />
        <span className="text-[10px]">Book Follow-up</span>
      </Button>
    </div>
  );
};

export default PostCallAutomation;