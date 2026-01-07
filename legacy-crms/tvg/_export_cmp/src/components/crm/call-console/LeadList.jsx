import React from 'react';
import { 
  User, Search, RefreshCw, Filter, Phone, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';

const LeadList = ({ 
  leads = [], 
  selectedLead, 
  onSelectLead, 
  loading, 
  activeTab = 'Hot', 
  setActiveTab,
  isFindingLeads,
  onFindNewLeads 
}) => {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search & Filter Header */}
      <div className="p-3 border-b border-slate-100 space-y-3">
         <div className="flex items-center gap-2">
            <div className="relative flex-1">
               <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
               <Input 
                  placeholder="Search queue..." 
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
               />
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={onFindNewLeads} disabled={isFindingLeads}>
               <RefreshCw className={`w-3.5 h-3.5 ${isFindingLeads ? 'animate-spin' : ''}`} />
            </Button>
         </div>
         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full h-7 bg-slate-100 p-0.5">
               <TabsTrigger value="Hot" className="flex-1 text-[10px] h-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">Hot Leads</TabsTrigger>
               <TabsTrigger value="New" className="flex-1 text-[10px] h-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">New</TabsTrigger>
               <TabsTrigger value="FollowUp" className="flex-1 text-[10px] h-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">Follow-up</TabsTrigger>
            </TabsList>
         </Tabs>
      </div>

      {/* List Area */}
      <ScrollArea className="flex-1">
         <div className="divide-y divide-slate-50">
            {leads.length === 0 && !loading && (
               <div className="p-8 text-center text-slate-400">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Queue is empty.</p>
               </div>
            )}
            
            {leads.map((lead) => (
               <div 
                  key={lead.id} 
                  onClick={() => onSelectLead(lead)}
                  className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors border-l-2 ${
                     selectedLead?.id === lead.id 
                        ? 'bg-blue-50/50 border-blue-600' 
                        : 'border-transparent'
                  }`}
               >
                  <div className="flex justify-between items-start mb-1">
                     <span className={`font-semibold text-sm truncate ${selectedLead?.id === lead.id ? 'text-blue-700' : 'text-slate-800'}`}>
                        {lead.first_name} {lead.last_name}
                     </span>
                     {lead.pqi > 70 && (
                        <Badge className="h-4 px-1 text-[9px] bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                           {lead.pqi} PQI
                        </Badge>
                     )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                     <span className="truncate max-w-[120px]">{lead.company || lead.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                     <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> 
                        {lead.created_at ? formatDistanceToNow(new Date(lead.created_at), { addSuffix: true }) : 'Recently'}
                     </span>
                     <span className={`capitalize px-1.5 py-0.5 rounded ${
                        lead.status === 'New' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                     }`}>{lead.status}</span>
                  </div>
               </div>
            ))}
         </div>
      </ScrollArea>
    </div>
  );
};

export default LeadList;