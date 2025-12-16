import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2 } from 'lucide-react';
import LeadCard from '@/components/crm/call-console/LeadCard'; // Assuming LeadCard exists

const LeadList = ({
    leads,
    selectedLead,
    onSelectLead,
    loading,
    activeTab,
    setActiveTab,
    onFindNewLeads,
    isFindingLeads,
    searchCategory,
    setSearchCategory,
    isTrainingMode,
    onToggleTrainingMode,
}) => {
    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Lead Queue</h2>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Training Mode</span>
                    <Switch
                        checked={isTrainingMode}
                        onCheckedChange={onToggleTrainingMode}
                        className="data-[state=checked]:bg-blue-600"
                    />
                </div>
            </div>

            <div className="relative">
                <Input
                    type="text"
                    placeholder="Search category (e.g., HVAC, plumbing)"
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    className="pl-9 pr-2 py-2 border rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            <Button
                onClick={onFindNewLeads}
                disabled={isFindingLeads}
                variant="default" // Reverted to default variant
                className="w-full py-2 flex items-center justify-center transition-all duration-300 ease-in-out"
            >
                {isFindingLeads && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isFindingLeads ? 'Finding Leads...' : 'Find New Leads'}
            </Button>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="Hot">Hot</TabsTrigger>
                    <TabsTrigger value="Warm">Warm</TabsTrigger>
                    <TabsTrigger value="Nurture">Nurture</TabsTrigger>
                </TabsList>
            </Tabs>

            <ScrollArea className="flex-1 pr-2">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Leads...
                    </div>
                ) : leads.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-center p-4">
                        No {activeTab} leads found. Try finding new leads!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {leads.map((lead) => (
                            <LeadCard
                                key={lead.id}
                                lead={lead}
                                isSelected={selectedLead?.id === lead.id}
                                onSelect={() => onSelectLead(lead)}
                                scoreProp={isTrainingMode ? 'kaqi_score' : 'pqi'}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};

export default LeadList;