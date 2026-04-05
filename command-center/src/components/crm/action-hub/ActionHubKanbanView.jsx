import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, closestCorners } from '@dnd-kit/core';
import { Loader2 } from 'lucide-react';
import KanbanColumn from '@/components/crm/kanban/KanbanColumn';
import KanbanCard from '@/components/crm/kanban/KanbanCard';
import { KANBAN_COLUMNS, distributeItemsToColumns } from '@/lib/kanbanUtils';
import { tenantPath } from '@/lib/tenantUtils';

const ActionHubKanbanView = ({ items = [], isLoading, onMove }) => {
    const [columns] = useState(KANBAN_COLUMNS);
    const navigate = useNavigate();
    const { tenantId } = useParams();
    
    // Drag State
    const [activeItem, setActiveItem] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );
    
    const itemsById = useMemo(() => {
        const map = new Map();
        items.forEach((item) => map.set(item.id, item));
        return map;
    }, [items]);

    const handleDragStart = (event) => {
        const { active } = event;
        const item = itemsById.get(active.id);
        setActiveItem(item);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveItem(null);

        if (!over) return;

        const activeCardId = active.id;
        const overId = over.id;

        const item = itemsById.get(activeCardId);
        if (!item) return;

        let targetColumnId = null;
        
        if (columns.some(col => col.id === overId)) {
            targetColumnId = overId;
        } else {
            const overItem = itemsById.get(overId);
            if (overItem) {
                targetColumnId = overItem.column_key;
            }
        }

        if (!targetColumnId) return;

        if (item.column_key !== targetColumnId) {
            if (onMove) onMove({ item, toColumnKey: targetColumnId });
        }
    };

    const handleCardClick = (card) => {
        if (!card?.entity_type || !card?.entity_id) {
            return;
        }

        const resolvedTenantId = card.tenant_id || tenantId;

        switch (card.entity_type) {
            case 'lead': {
                navigate(tenantPath(`/crm/leads?leadId=${card.entity_id}`, resolvedTenantId));
                break;
            }
            case 'quote': {
                navigate(tenantPath(`/crm/estimates/${card.entity_id}`, resolvedTenantId));
                break;
            }
            case 'invoice': {
                navigate(tenantPath(`/crm/invoices/${card.entity_id}`, resolvedTenantId));
                break;
            }
            case 'job': {
                navigate(tenantPath(`/crm/jobs?jobId=${card.entity_id}`, resolvedTenantId));
                break;
            }
            default: {
                // Unknown entity type - no-op.
                break;
            }
        }
    };

    const boardData = distributeItemsToColumns(columns, items);

    return (
        <div className="h-full flex flex-col">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                    <div className="flex h-full gap-4 min-w-max">
                        {columns.map(col => (
                            <KanbanColumn 
                                key={col.id} 
                                column={col} 
                                cards={boardData[col.id]}
                                onCardClick={handleCardClick}
                            />
                        ))}
                    </div>
                </div>

                <DragOverlay>
                    {activeItem ? <KanbanCard card={activeItem} isOverlay /> : null}
                </DragOverlay>
            </DndContext>

            {isLoading && (
                 <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
                    <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
                 </div>
            )}
        </div>
    );
};

export default ActionHubKanbanView;
