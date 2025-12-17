
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Mail, MessageSquare, User } from 'lucide-react';

const InboxSidebar = ({ threads, selectedThreadId, onSelect, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col divide-y divide-slate-100">
        {threads.map((thread) => (
          <button
            key={thread.lead_id}
            onClick={() => onSelect(thread.lead_id)}
            className={cn(
              "flex flex-col gap-1 p-4 text-left transition-colors hover:bg-slate-50 focus:bg-slate-50",
              selectedThreadId === thread.lead_id && "bg-blue-50/60 hover:bg-blue-50 border-l-4 border-blue-500 pl-3"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={cn(
                    "text-xs font-bold",
                    selectedThreadId === thread.lead_id ? "bg-blue-200 text-blue-700" : "bg-slate-200 text-slate-600"
                  )}>
                    {thread.first_name?.[0]}{thread.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className={cn(
                  "font-semibold text-sm", 
                  selectedThreadId === thread.lead_id ? "text-blue-900" : "text-slate-900"
                )}>
                  {thread.first_name} {thread.last_name}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {thread.last_message_at && formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
              </span>
            </div>

            <div className="flex items-start gap-2 mt-1 pl-10">
              {thread.last_message_type === 'email' 
                ? <Mail className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" /> 
                : <MessageSquare className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" />
              }
              <p className="text-xs text-slate-500 line-clamp-2 w-full font-medium">
                {thread.last_message_body}
              </p>
            </div>
            
            {thread.unread_count > 0 && (
                <div className="ml-auto flex">
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                        {thread.unread_count}
                    </span>
                </div>
            )}
          </button>
        ))}
        {threads.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
                No active conversations found.
            </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default InboxSidebar;
