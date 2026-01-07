
import React from 'react';
import { 
  User, MapPin, Phone, Building, History, AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getTenantConfig } from '@/lib/tenantUtils';

const PreCallBrief = ({ lead, onStartCall }) => {
  const tenantConfig = getTenantConfig();
  const primaryColor = tenantConfig.branding.primary_color || '#2563eb';

  if (!lead) return null;

  return (
    <div className="h-full flex flex-col bg-slate-50/50 p-4 overflow-y-auto">
       {/* Identity Card */}
       <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
          <div className="flex justify-between items-start mb-4">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md" style={{ backgroundColor: primaryColor }}>
                   {lead.first_name?.[0]}{lead.last_name?.[0]}
                </div>
                <div>
                   <h2 className="text-xl font-bold text-slate-900">{lead.first_name} {lead.last_name}</h2>
                   <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Building className="w-3 h-3" /> {lead.company || 'Residential'}
                   </div>
                </div>
             </div>
             <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                {lead.status}
             </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
             <div className="space-y-1">
                <span className="text-xs text-slate-400 uppercase font-bold">Contact</span>
                <div className="flex items-center gap-2 text-slate-700">
                   <Phone className="w-3.5 h-3.5 text-slate-400" /> {lead.phone || 'No Phone'}
                </div>
                <div className="flex items-center gap-2 text-slate-700 truncate">
                   <User className="w-3.5 h-3.5 text-slate-400" /> {lead.email}
                </div>
             </div>
             <div className="space-y-1">
                <span className="text-xs text-slate-400 uppercase font-bold">Location</span>
                <div className="flex items-start gap-2 text-slate-700">
                   <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                   <span>{lead.city ? `${lead.city}, ${lead.state || ''}` : 'Unknown Location'}</span>
                </div>
             </div>
          </div>
       </div>

       {/* Quick Actions */}
       <div className="grid grid-cols-2 gap-3 mb-4">
          <Button 
            className="w-full shadow-sm text-white" 
            style={{ backgroundColor: primaryColor }}
            onClick={onStartCall}
          >
             <Phone className="w-4 h-4 mr-2" /> Start Call
          </Button>
          <Button variant="outline" className="w-full bg-white">
             <History className="w-4 h-4 mr-2" /> View Log
          </Button>
       </div>

       {/* Insights / Risks */}
       <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Key Insights</h3>
          
          {lead.pqi > 75 && (
             <Card className="border-l-4 border-l-red-500 border-y-0 border-r-0 bg-white shadow-sm">
                <CardContent className="p-3 flex items-start gap-3">
                   <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                   <div>
                      <p className="text-sm font-bold text-slate-800">High Priority Lead</p>
                      <p className="text-xs text-slate-600">PQI Score is {lead.pqi}. Immediate action recommended.</p>
                   </div>
                </CardContent>
             </Card>
          )}

          <Card className="bg-white border-slate-200 shadow-sm">
             <CardContent className="p-3">
                <div className="text-xs font-medium text-slate-500 mb-1">Source</div>
                <p className="text-sm text-slate-800 font-medium">{lead.source || 'Direct Traffic'}</p>
             </CardContent>
          </Card>

          {lead.notes && (
             <Card className="bg-amber-50 border-amber-100 shadow-sm">
                <CardContent className="p-3">
                   <div className="text-xs font-bold text-amber-700 mb-1 uppercase">Notes</div>
                   <p className="text-xs text-amber-900 leading-relaxed italic">"{lead.notes}"</p>
                </CardContent>
             </Card>
          )}
       </div>
    </div>
  );
};

export default PreCallBrief;
