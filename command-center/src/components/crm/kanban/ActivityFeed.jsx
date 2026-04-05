import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const ActivityFeed = ({ entityId }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!entityId) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('kanban_status_events')
                    .select('*')
                    .eq('entity_id', entityId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setEvents(data || []);
            } catch (err) {
                console.error("Error fetching history:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [entityId]);

    if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-gray-400" /></div>;

    if (events.length === 0) {
        return (
            <div className="text-center p-4 text-gray-400 text-sm border-2 border-dashed rounded-lg">
                No activity recorded yet.
            </div>
        );
    }

    return (
        <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
                {events.map((event) => (
                    <div key={event.id} className="flex gap-3 text-sm">
                        <div className="mt-1">
                            <div className="h-2 w-2 rounded-full bg-blue-400 ring-4 ring-blue-50" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-gray-500 font-medium">
                                {format(new Date(event.created_at), 'yyyy-MM-dd HH:mm')}
                            </p>
                            <p className="text-gray-700">
                                <span className="font-semibold text-gray-900">{event.from_stage}</span> → <span className="font-semibold text-gray-900">{event.to_stage}</span>
                            </p>
                            {event.metadata?.archive_reason && (
                                <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded inline-block">
                                    Reason: {event.metadata.archive_reason}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
};

export default ActivityFeed;