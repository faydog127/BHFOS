import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const KanbanColumn = ({ column, cards, onCardClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column }
  });

  // Safety check: Ensure cards is an array before mapping
  // Also filter out any null/undefined items immediately
  const safeCards = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const cardIds = safeCards.map(c => c.id || `temp-${Math.random()}`);

  return (
    <div className="flex flex-col w-[300px] shrink-0 h-full max-h-full">
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-3 rounded-t-lg bg-white border border-slate-200 border-b-0 shadow-sm sticky top-0 z-10",
        column.color ? `border-l-[4px] ${column.color}` : ""
      )}>
        <h3 className="font-semibold text-slate-800 text-sm truncate pr-2" title={column.title}>
          {column.title}
        </h3>
        <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200">
          {safeCards.length}
        </Badge>
      </div>

      {/* Droppable Area */}
      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 bg-slate-100/50 border border-slate-200 border-t-0 rounded-b-lg overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300",
          isOver ? "bg-blue-50/50 ring-2 ring-blue-400 ring-inset" : ""
        )}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3 pb-2 min-h-[100px]">
            {safeCards.map((card) => {
                if (!card) return null; // Double check
                return (
                  <KanbanCard 
                    key={card.id || Math.random()} 
                    id={card.id} 
                    card={card} 
                    onClick={() => onCardClick(card)} 
                  />
                );
            })}
            
            {safeCards.length === 0 && (
              <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                Drop items here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;