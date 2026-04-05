import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Inbox as InboxIcon, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import InboxSidebar from '@/components/crm/inbox/InboxSidebar';
import ConversationView from '@/components/crm/inbox/ConversationView';

const Inbox = () => {
  const [threads, setThreads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchThreads();
    
    // Realtime subscription for new messages
    const channel = supabase.channel('inbox-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_messages' }, () => {
          fetchThreads();
      })
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, []);

  const fetchThreads = async () => {
    setLoading(true);
    try {
        // Use the new DB function we just created in the audit
        const { data, error } = await supabase.rpc('get_inbox_threads', { limit_count: 50 });
        if (error) throw error;
        setThreads(data || []);
    } catch (error) {
        console.error("Error loading inbox:", error);
    } finally {
        setLoading(false);
    }
  };

  const filteredThreads = threads.filter(t => 
    (t.first_name + ' ' + t.last_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone?.includes(searchTerm)
  );

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      <Helmet>
        <title>Unified Inbox | CRM</title>
      </Helmet>

      {/* Sidebar List */}
      <aside className="w-full md:w-80 lg:w-96 border-r flex flex-col bg-white z-10">
        <div className="p-4 border-b space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="font-bold text-xl flex items-center gap-2 text-slate-900">
                    <InboxIcon className="w-6 h-6 text-blue-600" /> Inbox
                </h1>
                <Button variant="ghost" size="icon" onClick={fetchThreads} className="text-slate-400 hover:text-blue-600">
                    <Filter className="w-4 h-4" />
                </Button>
            </div>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search messages..." 
                    className="pl-9 bg-slate-50 border-slate-200" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
            <InboxSidebar 
                threads={filteredThreads} 
                selectedThreadId={selectedLeadId}
                onSelect={setSelectedLeadId}
                loading={loading}
            />
        </div>
      </aside>

      {/* Main Conversation Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {selectedLeadId ? (
            <ConversationView leadId={selectedLeadId} />
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <InboxIcon className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-lg font-medium text-slate-600">Unified Inbox</p>
                <p className="text-sm">Select a conversation to view SMS and Email history.</p>
            </div>
        )}
      </main>
    </div>
  );
};

export default Inbox;