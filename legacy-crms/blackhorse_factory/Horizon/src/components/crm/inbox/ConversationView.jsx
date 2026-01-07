
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Phone, Mail, User, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const ConversationView = ({ leadId }) => {
  const [messages, setMessages] = useState([]);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (leadId) fetchConversation();
  }, [leadId]);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }
  }, [messages]);

  const fetchConversation = async () => {
    setLoading(true);
    try {
      // 1. Fetch Lead Details
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      setLead(leadData);

      // 2. Fetch Conversation History via RPC
      const { data: history, error } = await supabase.rpc('get_conversation_history', {
        target_lead_id: leadId
      });

      if (error) throw error;
      setMessages(history || []);

      // 3. Mark SMS as read (side effect)
      await supabase
        .from('sms_messages')
        .update({ read: true })
        .eq('lead_id', leadId)
        .eq('read', false);

    } catch (err) {
      console.error('Error fetching conversation:', err);
      toast({ variant: "destructive", title: "Load Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
        // Send via Edge Function
        const { error } = await supabase.functions.invoke('send-sms', {
            body: { to: lead.phone, body: replyText }
        });

        if (error) throw error;

        // Optimistic UI update (or re-fetch)
        setReplyText('');
        fetchConversation(); 
        toast({ title: "Sent", description: "Message sent successfully." });

    } catch (err) {
        toast({ variant: "destructive", title: "Send Failed", description: err.message });
    } finally {
        setSending(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (!lead) return <div className="h-full flex items-center justify-center text-slate-400">Lead not found</div>;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm z-10">
        <div className="flex items-center gap-3">
            <Avatar>
                <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                    {lead.first_name[0]}{lead.last_name[0]}
                </AvatarFallback>
            </Avatar>
            <div>
                <h3 className="font-bold text-slate-900">{lead.first_name} {lead.last_name}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {lead.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {lead.email}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(`tel:${lead.phone}`)}>
                <Phone className="w-4 h-4 mr-2" /> Call
            </Button>
        </div>
      </div>

      {/* Messages Feed */}
      <ScrollArea className="flex-1 bg-slate-50/50 p-4" ref={scrollRef}>
        <div className="space-y-6 pb-4">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] flex flex-col ${msg.direction === 'outbound' ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`p-3 rounded-lg text-sm shadow-sm border ${
                                msg.type === 'email' 
                                    ? 'bg-amber-50 border-amber-100 text-amber-900' 
                                    : msg.direction === 'outbound' 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : 'bg-white border-slate-200 text-slate-800'
                            }`}
                        >
                            {msg.type === 'email' && (
                                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                                    <Mail className="w-3 h-3" /> Email
                                </div>
                            )}
                            <div className="whitespace-pre-wrap">{msg.body}</div>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1">
                            {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                            {msg.status === 'failed' && <span className="text-red-500 flex items-center gap-0.5"><AlertCircle className="w-3 h-3"/> Failed</span>}
                        </span>
                    </div>
                </div>
            ))}
            {messages.length === 0 && (
                <div className="text-center text-slate-400 py-10">
                    <p>No history yet.</p>
                </div>
            )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="p-4 bg-white border-t">
        <div className="flex gap-2">
            <Textarea 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type an SMS message..."
                className="min-h-[50px] max-h-[150px] resize-none"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
            />
            <Button 
                onClick={handleSend} 
                className="h-auto bg-blue-600 hover:bg-blue-700 px-4"
                disabled={sending || !replyText.trim()}
            >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
            Press Enter to send via SMS.
        </p>
      </div>
    </div>
  );
};

export default ConversationView;
