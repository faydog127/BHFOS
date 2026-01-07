import React from 'react';
import EnterpriseLayout from '@/components/crm/EnterpriseLayout';
import { EnterpriseCard } from '@/components/crm/EnterpriseCard';
import { EnterpriseTable, EnterpriseRow, EnterpriseCell } from '@/components/crm/EnterpriseTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, MoreHorizontal } from 'lucide-react';

const mockLeads = [
  { id: 101, source: "Website", name: "Inquiry #442", status: "New", value: "$5,000", score: 85 },
  { id: 102, source: "Referral", name: "Referral from Bob", status: "Contacted", value: "$12,000", score: 92 },
  { id: 103, source: "Ad Campaign", name: "Q4 Promo Lead", status: "Qualified", value: "$3,500", score: 60 },
  { id: 104, source: "Website", name: "Contact Form", status: "New", value: "$8,000", score: 78 },
];

const LeadsPage = () => {
  return (
    <EnterpriseLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Leads</h1>
            <p className="text-slate-500 mt-1">Track and qualify incoming opportunities.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="bg-white">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> New Lead
            </Button>
          </div>
        </div>

        <EnterpriseCard className="overflow-hidden">
          <EnterpriseTable headers={['Lead Name', 'Source', 'Status', 'Est. Value', 'Score', '']}>
            {mockLeads.map((lead) => (
              <EnterpriseRow key={lead.id}>
                <EnterpriseCell className="font-semibold text-slate-900 pl-4">{lead.name}</EnterpriseCell>
                <EnterpriseCell>{lead.source}</EnterpriseCell>
                <EnterpriseCell>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium">
                    {lead.status}
                  </Badge>
                </EnterpriseCell>
                <EnterpriseCell className="font-mono text-slate-700">{lead.value}</EnterpriseCell>
                <EnterpriseCell>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" 
                        style={{ width: `${lead.score}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-600">{lead.score}</span>
                  </div>
                </EnterpriseCell>
                <EnterpriseCell className="text-right pr-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                  </Button>
                </EnterpriseCell>
              </EnterpriseRow>
            ))}
          </EnterpriseTable>
        </EnterpriseCard>
      </div>
    </EnterpriseLayout>
  );
};

export default LeadsPage;