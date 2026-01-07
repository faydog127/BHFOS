import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List, Calendar as CalendarIcon, Filter, RefreshCcw } from 'lucide-react';

// Views
import ActionHubKanbanView from '@/components/crm/action-hub/ActionHubKanbanView';
import ActionHubListView from '@/components/crm/action-hub/ActionHubListView';
import ActionHubCalendarView from '@/components/crm/action-hub/ActionHubCalendarView';

// Modals
import LeadCaptureForm from '@/components/marketing/LeadCaptureForm'; // Reusing existing form for "New Lead"

const ActionHub = () => {
    const [viewMode, setViewMode] = useState('kanban');
    const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50/50">
            <Helmet>
                <title>Action Hub | CRM</title>
            </Helmet>

            {/* Header Toolbar */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">Action Hub</h1>
                    <div className="h-4 w-px bg-slate-300 mx-2" />
                    <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
                        <TabsList className="h-8 bg-slate-100">
                            <TabsTrigger value="kanban" className="h-6 text-xs px-2"><LayoutGrid className="w-3 h-3 mr-1"/> Board</TabsTrigger>
                            <TabsTrigger value="list" className="h-6 text-xs px-2"><List className="w-3 h-3 mr-1"/> List</TabsTrigger>
                            <TabsTrigger value="calendar" className="h-6 text-xs px-2"><CalendarIcon className="w-3 h-3 mr-1"/> Calendar</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={handleRefresh}>
                        <RefreshCcw className="w-3 h-3 mr-2" /> Refresh
                    </Button>
                    <Button variant="outline" size="sm">
                        <Filter className="w-3 h-3 mr-2" /> Filters
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsNewLeadOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> New Lead
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {viewMode === 'kanban' && <ActionHubKanbanView key={`kanban-${refreshTrigger}`} />}
                {viewMode === 'list' && <ActionHubListView key={`list-${refreshTrigger}`} />}
                {viewMode === 'calendar' && <ActionHubCalendarView key={`calendar-${refreshTrigger}`} />}
            </div>

            {/* Modals */}
             {/* Using a simple dialog wrapper for the LeadForm since it might not be a modal itself */}
            {isNewLeadOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
                            <h2 className="text-lg font-bold">Create New Lead</h2>
                            <Button variant="ghost" size="sm" onClick={() => setIsNewLeadOpen(false)}>Close</Button>
                        </div>
                        <div className="p-4">
                             <LeadCaptureForm onSuccess={() => { setIsNewLeadOpen(false); handleRefresh(); }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionHub;