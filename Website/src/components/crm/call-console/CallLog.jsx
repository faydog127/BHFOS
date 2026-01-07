import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Book, MessageSquare, Mail, Phone, Calendar, User, Loader2, AlertCircle } from 'lucide-react';

const LogItem = ({ log }) => {
    const icons = {
        'call': <Phone className="h-4 w-4 text-blue-500" />,
        'email': <Mail className="h-4 w-4 text-purple-500" />,
        'chat': <MessageSquare className="h-4 w-4 text-green-500" />,
        'meeting': <Calendar className="h-4 w-4 text-orange-500" />,
        'note': <Book className="h-4 w-4 text-gray-500" />,
    };

    const getIcon = () => {
        if (log.type === 'call') return icons.call;
        if (log.type === 'chat') return icons.chat;
        if (log.type === 'email') return icons.email;
        return icons.note;
    };

    // Helper to determine display title
    const getTitle = () => {
        if (log.type === 'call') return `Call: ${log.outcome || 'Completed'}`;
        if (log.type === 'chat') return `Chat Session`;
        return 'Interaction';
    };

    // Helper for timestamp
    const getDate = () => {
        return new Date(log.created_at).toLocaleString();
    };

    // Helper for notes/content
    const getContent = () => {
        if (log.type === 'call') return log.notes || 'No notes.';
        if (log.type === 'chat') return log.user_message || log.bot_response || 'Chat interaction';
        return '';
    };

    return (
        <div className="flex items-start space-x-3 py-3 border-b border-slate-100 last:border-0">
            <div className="flex-shrink-0 pt-1">
                <div className="p-2 bg-slate-50 rounded-full border border-slate-200">
                    {getIcon()}
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-slate-900 truncate">
                        {getTitle()}
                    </p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                        {getDate()}
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {getContent()}
                </p>
            </div>
        </div>
    );
};

const CallLog = ({ lead }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLogs = async () => {
            if (!lead) {
                setLogs([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                // 1. Fetch Calls from 'calls' table
                // Note: We use prospect_id which matches the lead.id for prospects
                const { data: callData, error: callError } = await supabase
                    .from('calls')
                    .select('*')
                    .eq('prospect_id', lead.id)
                    .order('created_at', { ascending: false });
                
                if (callError) {
                    console.error("Error fetching calls:", callError);
                    // Don't throw here, strictly, so we can try fetching chats
                }

                // 2. Fetch Chat Logs from 'chat_logs' table
                // We only attempt this if the lead has a known session_id or if we can link via other means.
                // Currently, partner_prospects doesn't strictly have session_id, but if it did:
                let chatData = [];
                if (lead.session_id) {
                    const { data: chatLogs, error: chatError } = await supabase
                        .from('chat_logs')
                        .select('*')
                        .eq('session_id', lead.session_id)
                        .order('created_at', { ascending: false });
                    
                    if (!chatError) chatData = chatLogs || [];
                }

                // Normalize data structure for display
                const normalizedCalls = (callData || []).map(c => ({ ...c, type: 'call' }));
                const normalizedChats = (chatData || []).map(c => ({ ...c, type: 'chat' }));

                const combined = [...normalizedCalls, ...normalizedChats].sort(
                    (a, b) => new Date(b.created_at) - new Date(a.created_at)
                );

                setLogs(combined);

            } catch (err) {
                console.error("Error aggregating logs:", err);
                setError("Failed to load history.");
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [lead]);

    if (!lead) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                <User className="h-12 w-12 mb-2 opacity-20" />
                <p>Select a prospect to view history</p>
            </div>
        );
    }
    
    if (loading) {
        return (
            <div className="p-6 flex flex-col items-center justify-center text-sm text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin mb-2 text-blue-500" />
                Loading history...
            </div>
        );
    }

    if (error) {
        return (
             <div className="p-6 text-center text-sm text-red-500 flex flex-col items-center">
                <AlertCircle className="h-6 w-6 mb-2" />
                {error}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto p-4">
                {logs.length > 0 ? (
                    logs.map(log => <LogItem key={log.id} log={log} />)
                ) : (
                    <div className="text-center py-10 px-4">
                        <div className="bg-slate-50 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                            <Book className="h-6 w-6 text-slate-300" />
                        </div>
                        <h4 className="text-sm font-medium text-slate-900">No History Yet</h4>
                        <p className="text-xs text-slate-500 mt-1">
                            Calls and chats will appear here automatically.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CallLog;