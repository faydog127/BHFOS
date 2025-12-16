
import React, { useState } from 'react';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  History, 
  MousePointerClick, 
  Eye, 
  MessageSquare,
  Target, 
  Lightbulb, 
  FileText, 
  Star,
  ArrowUpRight,
  Flame,
  Snowflake
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// Mock Data for Preview
const MOCK_LEAD = {
  id: 'lead-123',
  name: "Sarah Jenkins",
  role: "Residential Owner",
  company: null,
  phone: "(321) 555-0199",
  email: "sarah.j@example.com",
  address: "742 Evergreen Terrace, Melbourne, FL 32935",
  timezone: "EST (Local Time: 10:42 AM)",
  pqiScore: 88, // Partner Qualification Index / Lead Score
  status: "hot", // hot, warm, cold
  intent: "High",
  propertyType: "Single Family Home",
  lastInteraction: "2 days ago",
  source: "Google Ads",
  signals: [
    { type: 'web', text: "Visited 'Pricing' page 2x", time: "1 hour ago", icon: Eye },
    { type: 'email', text: "Opened 'Fire Safety' blast", time: "Yesterday", icon: Mail },
    { type: 'form', text: "Request: 'Dryer taking long to dry'", time: "3 days ago", icon: FileText }
  ],
  history: [
    { type: 'call', text: "Outbound Call - No Answer", time: "2 days ago", agent: "System" },
    { type: 'sms', text: "Sent Intro SMS", time: "2 days ago", agent: "Auto-Workflow" },
    { type: 'web', text: "Lead Capture Form Submitted", time: "3 days ago", agent: "Customer" }
  ],
  strategy: {
    primary: "Safety & Efficiency",
    hook: "Mention the 'long drying time' she reported in the form.",
    offer: "Waive trip charge if booked for this week."
  },
  objective: "Secure Booking (Inspection)"
};

const PreCallBrief = ({ lead = MOCK_LEAD, onStartCall }) => {
  const [notes, setNotes] = useState('');

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'hot': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"><Flame className="w-3 h-3 mr-1 fill-red-500" /> Hot Lead</Badge>;
      case 'warm': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200"><Activity className="w-3 h-3 mr-1" /> Warm</Badge>;
      case 'cold': return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"><Snowflake className="w-3 h-3 mr-1" /> Cold</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50 space-y-4 p-1">
      
      {/* 1. Header: Profile & Score */}
      <Card className="border-l-4 border-l-blue-600 shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
              <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
                <AvatarImage src={`https://i.pravatar.cc/150?u=${lead.id}`} />
                <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xl">
                  {lead.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{lead.name}</h2>
                  {getStatusBadge(lead.status)}
                </div>
                <div className="flex items-center text-sm text-slate-500 gap-3">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.address}</span>
                  <span className="hidden md:inline text-slate-300">|</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {lead.timezone}</span>
                </div>
                <div className="flex gap-2 mt-1">
                   <Badge variant="outline" className="text-xs font-normal text-slate-500">{lead.propertyType}</Badge>
                   <Badge variant="outline" className="text-xs font-normal text-slate-500">Source: {lead.source}</Badge>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="flex flex-col items-end">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Lead Score (PQI)</span>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-3xl font-bold", getScoreColor(lead.pqiScore))}>{lead.pqiScore}</span>
                  <span className="text-sm text-slate-400">/ 100</span>
                </div>
              </div>
              <Progress 
                value={lead.pqiScore} 
                className="h-1.5 w-24 mt-2 bg-slate-100" 
                indicatorClassName={lead.pqiScore >= 80 ? "bg-green-500" : lead.pqiScore >= 50 ? "bg-amber-500" : "bg-red-500"} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        
        {/* 2. Left Column: Signals & Strategy */}
        <div className="space-y-4 flex flex-col">
           
           {/* Signals Panel */}
           <Card className="shadow-sm">
             <CardHeader className="pb-2 py-3 bg-slate-50 border-b">
               <CardTitle className="text-sm font-semibold flex items-center gap-2">
                 <Activity className="w-4 h-4 text-blue-600" /> Digital Body Language
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {lead.signals.map((signal, idx) => (
                    <div key={idx} className="p-3 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-full shrink-0">
                        <signal.icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{signal.text}</p>
                        <p className="text-xs text-slate-400">{signal.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
             </CardContent>
           </Card>

           {/* Strategy Card */}
           <Card className="flex-1 shadow-sm border-l-4 border-l-purple-500 bg-purple-50/30">
             <CardHeader className="pb-2 py-3">
               <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-900">
                 <Lightbulb className="w-4 h-4 text-purple-600" /> Recommended Strategy
               </CardTitle>
             </CardHeader>
             <CardContent className="p-4 pt-0 space-y-3">
                <div>
                   <span className="text-xs font-bold text-purple-700 uppercase">Focus</span>
                   <p className="text-sm text-slate-700">{lead.strategy.primary}</p>
                </div>
                <div>
                   <span className="text-xs font-bold text-purple-700 uppercase">The Hook</span>
                   <p className="text-sm text-slate-700 italic">"{lead.strategy.hook}"</p>
                </div>
                <div className="bg-white p-2 rounded border border-purple-100 shadow-sm">
                   <span className="text-xs font-bold text-green-700 uppercase flex items-center gap-1">
                      <Star className="w-3 h-3" /> Offer to Close
                   </span>
                   <p className="text-sm text-slate-800 font-medium">{lead.strategy.offer}</p>
                </div>
             </CardContent>
           </Card>
        </div>

        {/* 3. Right Column: History & Notes */}
        <div className="space-y-4 flex flex-col">
           
           {/* Timeline */}
           <Card className="shadow-sm max-h-[250px] flex flex-col">
             <CardHeader className="pb-2 py-3 bg-slate-50 border-b">
               <CardTitle className="text-sm font-semibold flex items-center gap-2">
                 <History className="w-4 h-4 text-slate-500" /> Recent History
               </CardTitle>
             </CardHeader>
             <ScrollArea className="flex-1">
               <CardContent className="p-4 pt-4">
                  <div className="space-y-4 relative pl-2 border-l-2 border-slate-100">
                    {lead.history.map((event, idx) => (
                       <div key={idx} className="relative pl-4">
                          <div className={cn("absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm", 
                             event.type === 'call' ? "bg-blue-400" : event.type === 'sms' ? "bg-green-400" : "bg-amber-400"
                          )} />
                          <div className="flex justify-between items-start">
                             <span className="text-xs font-semibold text-slate-700">{event.text}</span>
                             <span className="text-[10px] text-slate-400 whitespace-nowrap">{event.time}</span>
                          </div>
                          <p className="text-[10px] text-slate-500">by {event.agent}</p>
                       </div>
                    ))}
                  </div>
               </CardContent>
             </ScrollArea>
           </Card>

           {/* Objective & Notes */}
           <Card className="flex-1 shadow-sm flex flex-col">
             <CardHeader className="pb-2 py-3 bg-slate-50 border-b">
               <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-red-500" /> Call Objective
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px] bg-white border font-normal">
                     {lead.objective}
                  </Badge>
               </div>
             </CardHeader>
             <CardContent className="p-3 flex-1 flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-500">Pre-Call Notes / Prep</label>
                <Textarea 
                  placeholder="Type notes here (e.g., 'Ask about gate code')..." 
                  className="flex-1 min-h-[80px] text-sm resize-none bg-yellow-50/50 border-yellow-200 focus-visible:ring-yellow-400"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
             </CardContent>
             <CardFooter className="p-3 border-t bg-slate-50">
                <Button className="w-full bg-green-600 hover:bg-green-700 shadow-md transition-all" onClick={onStartCall}>
                   <Phone className="w-4 h-4 mr-2" /> Start Call Now
                </Button>
             </CardFooter>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default PreCallBrief;
