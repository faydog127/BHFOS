import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { 
    Calendar, DollarSign, Clock, Hash, Briefcase, User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { getCardSlaStatus } from '@/lib/kanbanUtils';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

const KanbanCard = ({ id, card, onClick, isOverlay }) => {
  const navigate = useNavigate();
  
  // Safe ID for hook
  const safeId = id || card?.id || `fallback-${Math.random()}`;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: safeId,
    data: card ? { ...card, type: card.type || 'unknown' } : {},
    disabled: !card 
  });

  if (!card) return null;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // SLA Calculation
  let headerColorClass = 'bg-slate-200';
  let headerBadgeText = null;
  try {
      if (typeof getCardSlaStatus === 'function') {
        const sla = getCardSlaStatus(card, card.stage_id);
        headerColorClass = sla.colorClass;
        headerBadgeText = sla.badgeText;
      }
  } catch (e) { console.warn(e); }

  const title = card.title || 'Untitled';
  const subtitle = card.subtitle || 'No details';
  const serviceType = card.service_type || 'General';
  const value = typeof card.value === 'number' ? card.value : 0;
  
  // Reference Numbers
  const refNumber = card.estimate_number || card.work_order_number || card.quote_number;
  const isEstimate = Boolean(card.estimate_number);
  
  // Tech Info
  const techName = card.tech_name;

  const handleRefClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEstimate) navigate('/crm/estimates'); 
  };

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        {...listeners} 
        {...attributes} 
        className={cn(
            "touch-none group relative mb-3 outline-none",
            isOverlay ? "z-50 rotate-2 scale-105 opacity-90" : ""
        )}
    >
      <Card 
        className={cn(
          "cursor-grab active:cursor-grabbing border-0 shadow-sm ring-1 ring-slate-200 transition-all duration-200 bg-white",
          "hover:shadow-md hover:ring-blue-300 hover:ring-2 hover:-translate-y-0.5",
          isDragging ? "opacity-50" : ""
        )}
        onClick={(e) => {
            if (!isDragging) {
                e.stopPropagation();
                onClick && onClick(card);
            }
        }}
      >
        {/* Colored Header */}
        <div className={cn("h-1.5 w-full rounded-t-lg", headerColorClass)} />

        <CardContent className="p-3">
          {/* Header Row */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0 pr-2">
                <div className="font-bold text-sm text-slate-900 truncate" title={title}>{title}</div>
                <div className="flex items-center text-xs text-slate-500 truncate mt-0.5">
                     <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] mr-1 truncate max-w-[120px]" title={subtitle}>
                        {subtitle}
                     </span>
                     {headerBadgeText && (
                        <span className="text-[10px] text-red-600 font-bold ml-auto shrink-0">{headerBadgeText}</span>
                     )}
                </div>
            </div>
          </div>

          {/* Tags / Info Row */}
          <div className="mb-2 flex flex-wrap gap-1 items-center">
             <div className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                {serviceType}
             </div>
             
             {/* Work Order / Estimate Display */}
             {refNumber && (
                 <div 
                    onClick={handleRefClick}
                    className={cn(
                        "text-[10px] font-mono text-slate-500 flex items-center bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100",
                        isEstimate && "cursor-pointer hover:bg-blue-50 hover:text-blue-600 hover:underline"
                    )}
                 >
                    {card.work_order_number ? <Briefcase className="w-3 h-3 mr-1 text-orange-500"/> : <Hash className="w-2.5 h-2.5 mr-0.5"/>}
                    {refNumber}
                 </div>
             )}
          </div>
          
          {/* Tech Assignment Row (New Feature) */}
          {techName && (
              <div className="mb-2 flex items-center gap-1.5 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 w-fit">
                  <User className="w-3 h-3 text-indigo-600" />
                  <span className="text-[10px] font-semibold text-indigo-700">{techName}</span>
              </div>
          )}

          {/* Footer Metrics */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
             <div className="flex items-center text-sm font-bold text-emerald-600">
                <DollarSign className="w-3.5 h-3.5 -ml-1" />
                {value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
             </div>
             
             <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3"/>
                {card.updated_at ? formatDistanceToNow(new Date(card.updated_at), { addSuffix: true }).replace('about ', '') : 'New'}
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KanbanCard;