import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, Phone, User, Calendar, Flame, Snowflake, Loader2, CheckCheck, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SmsConversations = () => {
  const { toast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchConversations();
    
    // Subscribe to new messages
    const channel = supabase
      .channel('sms_messages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_messages' }, () => {
        // Simple refetch on any change for now
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      // Fetch messages
      const { data: messages, error: msgError } = await supabase
        .from('sms_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      // Group by lead
      const grouped = {};
      const leadIds = new Set();
      
      messages?.forEach(msg => {
        if (!msg.lead_id) return;
        leadIds.add(msg.lead_id);
        if (!grouped[msg.lead_id]) grouped[msg.lead_id] = [];
        grouped[msg.lead_id].push(msg);
      });

      // Fetch lead details
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, first_name, last_name, phone, status, pqi, created_at, service')
        .in('id', Array.from(leadIds));

      if (leadsError) throw leadsError;

      // Combine data
      const convos = leads.map(lead => {
        const msgs = grouped[lead.id] || [];
        const lastMsg = msgs[msgs.length - 1];
        return {
          lead,
          messages: msgs,
          lastMessage: lastMsg,
          lastMessageAt: lastMsg ? new Date(lastMsg.created_at) : new Date(0),
          unreadCount: msgs.filter(m => m.direction === 'inbound' && !m.read).length
        };
      }).sort((a, b) => b.lastMessageAt - a.lastMessageAt);

      setConversations(convos);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load messages.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedLeadId) return;

    // Validate phone
    const activeConvo = conversations.find(c => c.lead.id === selectedLeadId);
    if (!activeConvo?.lead?.phone) {
        toast({ variant: 'destructive', title: "Error", description: "Lead has no phone number." });
        return;
    }

    setSending(true);
    try {
      // 1. Insert (Queued)
      const { data: msg, error: dbError } = await supabase.from('sms_messages').insert([{
        lead_id: selectedLeadId,
        direction: 'outbound',
        body: newMessage,
        status: 'queued',
        created_at: new Date().toISOString()
      }]).select().single();

      if (dbError) throw dbError;

      // 2. Invoke Edge Function
      const { error: sendError } = await supabase.functions.invoke('send-sms', {
          body: { to: activeConvo.lead.phone, body: newMessage }
      });

      if (sendError) {
          await supabase.from('sms_messages').update({ status: 'failed' }).eq('id', msg.id);
          throw sendError;
      }

      // 3. Update to 'sent'
      await supabase.from('sms_messages').update({ status: 'sent' }).eq('id', msg.id);

      setNewMessage('');
      // UI updates via realtime subscription or next fetch cycle

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to send message.' });
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const name = `${c.lead.first_name} ${c.lead.last_name}`.toLowerCase();
      const phone = c.lead.phone || '';
      const matchesSearch = name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
      
      let matchesStatus = true;
      if (statusFilter === 'hot') matchesStatus = (c.lead.pqi || 0) >= 80;
      if (statusFilter === 'warm') matchesStatus = (c.lead.pqi || 0) >= 50 && (c.lead.pqi || 0) < 80;
      if (statusFilter === 'cold') matchesStatus = (c.lead.pqi || 0) < 50;

      return matchesSearch && matchesStatus;
    });
  }, [conversations, searchQuery, statusFilter]);

  const activeConversation = conversations.find(c => c.lead.id === selectedLeadId);

  const getLeadTemperature = (pqi) => {
    if (!pqi) return { color: 'text-gray-400', icon: Snowflake, label: 'Unknown' };
    if (pqi >= 80) return { color: 'text-red-500', icon: Flame, label: 'Hot' };
    if (pqi >= 50) return { color: 'text-orange-500', icon: Flame, label: 'Warm' };
    return { color: 'text-blue-400', icon: Snowflake, label: 'Cold' };
  };

  return (
    <div className="h-[calc(100vh-100px)] flex gap-6 p-6 max-w-[1600px] mx-auto">
      {/* Sidebar List */}
      <Card className="w-1/3 flex flex-col h-full border-slate-200 shadow-sm">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Inbox</h2>
            <Badge variant="secondary">{conversations.length} Threads</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Search leads..." 
              className="pl-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Badge 
              variant={statusFilter === 'all' ? 'default' : 'outline'} 
              className="cursor-pointer"
              onClick={() => setStatusFilter('all')}
            >All</Badge>
            <Badge 
              variant={statusFilter === 'hot' ? 'destructive' : 'outline'} 
              className="cursor-pointer text-red-600 border-red-200"
              onClick={() => setStatusFilter('hot')}
            >Hot</Badge>
            <Badge 
              variant={statusFilter === 'warm' ? 'secondary' : 'outline'} 
              className="cursor-pointer text-orange-600 border-orange-200"
              onClick={() => setStatusFilter('warm')}
            >Warm</Badge>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : filteredConversations.length === 0 ? (
             <div className="text-center p-8 text-gray-500 text-sm">No conversations found.</div>
          ) : (
            <div className="flex flex-col">
              {filteredConversations.map((convo) => {
                const temp = getLeadTemperature(convo.lead.pqi);
                const TempIcon = temp.icon;
                return (
                  <button
                    key={convo.lead.id}
                    onClick={() => setSelectedLeadId(convo.lead.id)}
                    className={cn(
                      "flex items-start gap-3 p-4 text-left transition-colors border-b border-gray-50 hover:bg-slate-50",
                      selectedLeadId === convo.lead.id ? "bg-slate-100 border-l-4 border-l-blue-600" : "border-l-4 border-l-transparent"
                    )}
                  >
                    <Avatar className="h-10 w-10 border bg-white">
                      <AvatarFallback>{convo.lead.first_name?.[0] || '?'}{convo.lead.last_name?.[0] || ''}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-semibold truncate text-slate-900">
                          {convo.lead.first_name} {convo.lead.last_name}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                          {convo.lastMessageAt > new Date(0) ? format(convo.lastMessageAt, 'MMM d') : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate h-5">
                        {convo.lastMessage ? convo.lastMessage.body : <span className="italic text-gray-300">No messages yet</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs flex items-center gap-1 ${temp.color}`}>
                           <TempIcon className="w-3 h-3" /> {temp.label}
                        </span>
                        {convo.lead.service && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 truncate max-w-[100px]">
                            {convo.lead.service}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col h-full border-slate-200 shadow-sm overflow-hidden">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border bg-blue-50 text-blue-700 font-bold">
                  <AvatarFallback>{activeConversation.lead.first_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    {activeConversation.lead.first_name} {activeConversation.lead.last_name}
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal`}>
                      {activeConversation.lead.status}
                    </span>
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {activeConversation.lead.phone}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Added {format(new Date(activeConversation.lead.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm">View Lead Details</Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6 bg-slate-50/50">
               <div className="space-y-6">
                 {activeConversation.messages.map((msg, idx) => (
                   <div 
                      key={msg.id || idx} 
                      className={cn(
                        "flex w-full",
                        msg.direction === 'outbound' ? "justify-end" : "justify-start"
                      )}
                   >
                     <div className={cn(
                       "max-w-[70%] rounded-2xl p-4 shadow-sm relative group",
                       msg.direction === 'outbound' 
                        ? (msg.status === 'failed' ? "bg-red-100 text-red-900 border border-red-200" : "bg-blue-600 text-white rounded-br-none")
                        : "bg-white border border-gray-100 text-slate-800 rounded-bl-none"
                     )}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        <div className={cn(
                          "text-[10px] mt-2 opacity-70 flex items-center gap-1",
                          msg.direction === 'outbound' ? (msg.status === 'failed' ? "text-red-700 justify-end" : "text-blue-100 justify-end") : "text-gray-400"
                        )}>
                          {format(new Date(msg.created_at), 'h:mm a')}
                          {msg.direction === 'outbound' && (
                             msg.status === 'failed' ? <AlertCircle className="w-3 h-3" /> : (msg.status === 'sent' && <CheckCheck className="w-3 h-3" />)
                          )}
                          {msg.status === 'queued' && <Loader2 className="w-3 h-3 animate-spin" />}
                        </div>
                     </div>
                   </div>
                 ))}
                 <div id="messages-end" />
               </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !newMessage.trim()} className="bg-blue-600 hover:bg-blue-700">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-slate-300" />
             </div>
             <p className="font-medium">Select a conversation to start chatting</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SmsConversations;