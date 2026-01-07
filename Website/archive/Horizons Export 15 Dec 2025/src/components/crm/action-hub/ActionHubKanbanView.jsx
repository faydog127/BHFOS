import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, closestCorners } from '@dnd-kit/core';
import { Loader2 } from 'lucide-react';
import KanbanColumn from '@/components/crm/kanban/KanbanColumn';
import KanbanCard from '@/components/crm/kanban/KanbanCard';
import CardProgressionModal from '@/components/crm/kanban/CardProgressionModal';
import { KANBAN_COLUMNS, distributeItemsToColumns } from '@/lib/kanbanUtils';

const ActionHubKanbanView = ({ initialItems, isLoading, onRefresh }) => {
    const [columns] = useState(KANBAN_COLUMNS);
    const [items, setItems] = useState([]);
    
    // Drag State
    const [activeId, setActiveId] = useState(null);
    const [activeItem, setActiveItem] = useState(null);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [pendingDrag, setPendingDrag] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );
    
    // The component now receives data as a prop instead of fetching it itself
    useEffect(() => {
        setItems(initialItems || []);
    }, [initialItems]);

    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);
        const item = items.find(i => i.id === active.id);
        setActiveItem(item);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveItem(null);

        if (!over) return;

        const activeCardId = active.id;
        const overId = over.id;

        const item = items.find(i => i.id === activeCardId);
        if (!item) return;

        let targetColumnId = null;
        
        if (columns.some(col => col.id === overId)) {
            targetColumnId = overId;
        } else {
            const overItem = items.find(i => i.id === overId);
            if (overItem) {
                targetColumnId = overItem.stage_id;
            }
        }

        if (!targetColumnId) return;

        if (item.stage_id !== targetColumnId) {
            console.log(`Dragging ${item.type} ${item.id} from ${item.stage_id} to ${targetColumnId}`);
            
            setPendingDrag({
                entityId: item.id,
                entityType: item.type,
                currentStage: item.stage_id,
                targetStage: targetColumnId
            });
            setModalOpen(true);
        }
    };

    const handleModalSuccess = () => {
        setModalOpen(false);
        setPendingDrag(null);
        if (onRefresh) onRefresh();
    };

    const handleCardClick = (card) => {
        console.log("Card clicked:", card);
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

            <CardProgressionModal 
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                entityId={pendingDrag?.entityId}
                entityType={pendingDrag?.entityType}
                currentStageId={pendingDrag?.currentStage}
                targetStageId={pendingDrag?.targetStage}
                onSuccess={handleModalSuccess}
            />
        </div>
    );
};

export default ActionHubKanbanView;