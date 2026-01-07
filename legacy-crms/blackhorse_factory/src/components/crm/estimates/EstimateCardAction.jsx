import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import SendEstimateModal from './SendEstimateModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * A reusable component to place on Kanban Cards or Lists.
 * Displays a button to send the estimate, handling the modal state internally.
 */
const EstimateCardAction = ({ estimate, lead, size = "sm", variant = "secondary", showLabel = true, className }) => {
    const [modalOpen, setModalOpen] = useState(false);

    if (!estimate || !lead) return null;

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant={variant} 
                            size={size} 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation(); // Critical: Prevent card click in Kanban
                                setModalOpen(true);
                            }}
                            className={cn("gap-2 shadow-sm", className)}
                        >
                            <Send className="h-3.5 w-3.5" />
                            {showLabel && "Send Estimate"}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Email Estimate #{estimate.estimate_number}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <SendEstimateModal 
                open={modalOpen} 
                onOpenChange={setModalOpen}
                estimate={estimate}
                lead={lead}
            />
        </>
    );
};

export default EstimateCardAction;