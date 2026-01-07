import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

const SmsInbox = () => {
  const { toast } = useToast();
  const [threads, setThreads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const [sending, setSending] = useState(false);
  const tenantId = getTenantId();

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    if (selectedLeadId) fetchMessages(selectedLeadId);
  }, [selectedLeadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchThreads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('id, first_name, last_name, phone')
      .eq('tenant_id', tenantId) // TENANT FILTER
      .order('last_touch_at', { ascending: false })
      .limit(20);

    if (!error) setThreads(data || []);
    setLoading(false);
  };

  const fetchMessages = async (leadId) => {
    const { data, error } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', tenantId) // TENANT FILTER (Technically redundant if lead is filtered, but safe)
      .order('created_at', { ascending: true });

    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else setMessages(data || []);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedLeadId) return;

    const lead = threads.find(t => t.id === selectedLeadId);
    if (!lead?.phone) {
        toast({ variant: 'destructive', title: 'Error', description: 'Lead has no phone number.' });
        return;
    }

    setSending(true);
    try {
        const { data: msgData, error: dbError } = await supabase.from('sms_messages').insert([{
          lead_id: selectedLeadId,
          direction: 'outbound',
          body: newMessage,
          status: 'queued',
          tenant_id: tenantId // Explicit insert
        }]).select().single();

        if (dbError) throw dbError;

        const { error: fnError } = await supabase.functions.invoke('send-sms', {
            body: { to: lead.phone, body: newMessage }
        });

        if (fnError) {
            console.error('Edge Function Error:', fnError);
            await supabase.from('sms_messages').update({ status: 'failed' }).eq('id', msgData.id);
            throw fnError;
        }

        await supabase.from('sms_messages').update({ status: 'sent' }).eq('id', msgData.id);
        
        await supabase.from('leads').update({ last_touch_at: new Date().toISOString() }).eq('id', selectedLeadId);

        toast({ title: 'Sent', description: 'Message sent successfully.' });
        setNewMessage('');
        fetchMessages(selectedLeadId);

    } catch (error) {
        toast({ variant: 'destructive', title: 'Send Failed', description: error.message });
    } finally {
        setSending(false);
    }
  };

  const handleQuickReply = (text) => {
    setNewMessage(text);
  };

  const selectedLead = threads.find(t => t.id === selectedLeadId);

  return (
    <div className="p-6 h-[calc(100vh-64px)] max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
      {/* Threads List */}
      <Card className="w-full md:w-1/3 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-bold text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Conversations</h2>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {loading ? <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto"/></div> : 
          threads.map(t => (
            <div 
              key={t.id} 
              onClick={() => setSelectedLeadId(t.id)}
              className={`p-3 rounded-lg cursor-pointer flex items-center gap-3 hover:bg-slate-100 transition-colors ${selectedLeadId === t.id ? 'bg-blue-50 border-blue-200 border' : ''}`}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-200 text-blue-700">{t.first_name?.[0] || 'L'}</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <div className="font-medium truncate">{t.first_name} {t.last_name}</div>
                <div className="text-xs text-gray-500">{t.phone}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedLeadId ? (
          <>
            <div className="p-4 border-b flex justify-between items-center bg-white">
              <div>
                <h3 className="font-bold text-lg">{selectedLead?.first_name} {selectedLead?.last_name}</h3>
                <span className="text-xs text-gray-500">{selectedLead?.phone}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
              {messages.length === 0 && <p className="text-center text-gray-400 my-10">No messages yet. Start the conversation!</p>}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${
                    m.direction === 'outbound' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white border text-slate-800 rounded-bl-none shadow-sm'
                  }`}>
                    {m.body}
                    <div className={`text-[10px] mt-1 text-right ${m.direction === 'outbound' ? 'text-blue-100' : 'text-gray-400'}`}>
                      {format(new Date(m.created_at), 'h:mm a')}
                      {m.status === 'failed' && <span className="text-red-300 ml-2">(Failed)</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['Yes, we can help!', 'Are you available for a call?', 'Please provide more details.', 'Not interested.'].map(qr => (
                  <button 
                    key={qr} 
                    onClick={() => handleQuickReply(qr)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 whitespace-nowrap transition-colors"
                  >
                    {qr}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  value={newMessage} 
                  onChange={e => setNewMessage(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Type an SMS message..." 
                  className="flex-1"
                  disabled={sending}
                />
                <Button onClick={handleSend} className="bg-blue-600" disabled={sending}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
            <p>Select a conversation to view messages</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SmsInbox;