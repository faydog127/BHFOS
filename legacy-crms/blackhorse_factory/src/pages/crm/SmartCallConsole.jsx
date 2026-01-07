
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Phone, Mic, MicOff, Pause, Play, Forward, LayoutGrid, 
  MessageSquare, User, MapPin, Calendar, Clock, 
  ShieldCheck, AlertTriangle, Sparkles, Send, 
  Voicemail, PhoneMissed, GripHorizontal, 
  ChevronRight, ChevronLeft, Search, Save,
  MoreVertical, CheckCircle2, History, Zap,
  BarChart3, Globe, BrainCircuit, PhoneIncoming
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { 
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

// --- Mock Data & Sub-components ---

const SCRIPT_OPTIONS = {
  opener: {
    title: "Intro & Hook",
    text: "Hi [Name], this is [Agent] from The Vent Guys. I'm calling because we're currently in [Neighborhood] doing safety inspections for dryer vents, and I noticed your home hasn't been serviced in over 12 months. Did you know that's the #1 cause of household fires?"
  },
  discovery: {
    title: "Discovery",
    text: "I understand. Before we move forward, could you tell me roughly how long your dryer vent run is? Also, have you noticed your clothes taking longer than one cycle to dry recently?"
  },
  objection: {
    title: "Handling 'Too Expensive'",
    text: "I completely hear you on the price. However, consider that a clogged vent increases your energy bill by $20-30 a month. Our service actually pays for itself in about 6 months, not to mention the peace of mind regarding fire safety."
  },
  closing: {
    title: "Assumptive Close",
    text: "Great. Since our technician Mike is already on [Street Name] this Tuesday, I can squeeze you in for the 2 PM slot without the standard trip charge. Does 2 PM work, or would 4 PM be better?"
  }
};

const SUGGESTIONS = [
  { id: 1, type: 'insight', text: "Customer mentioned 'high electric bill' previously." },
  { id: 2, type: 'action', text: "Ask about drying time for heavy loads." },
  { id: 3, type: 'upsell', text: "Suggest bird guard installation (high activity area)." },
];

const HISTORY_ITEMS = [
  { id: 1, type: 'call', status: 'missed', date: '2 days ago', note: 'Voicemail left' },
  { id: 2, type: 'email', status: 'opened', date: '3 days ago', note: 'Opened "Safety Alert" campaign' },
  { id: 3, type: 'sms', status: 'replied', date: '1 week ago', note: 'Replied "Not interested right now"' },
];

const SmartCallConsole = () => {
  const { toast } = useToast();
  
  // Console State
  const [activeTab, setActiveTab] = useState('call'); // 'call' | 'sms'
  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'calling' | 'connected' | 'on-hold'
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  // AI Tools State
  const [selectedScript, setSelectedScript] = useState('opener');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [sentimentScore, setSentimentScore] = useState(75); // 0-100

  // Timer Effect
  useEffect(() => {
    let interval;
    if (callStatus === 'connected' || callStatus === 'on-hold') {
      interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCallAction = (action) => {
    switch(action) {
      case 'dial':
        setCallStatus('calling');
        setTimeout(() => setCallStatus('connected'), 2000);
        toast({ title: "Dialing...", description: "Connecting to (321) 555-0123" });
        break;
      case 'hangup':
        setCallStatus('idle');
        setCallDuration(0);
        setIsMuted(false);
        toast({ title: "Call Ended", description: "Duration: " + formatTime(callDuration) });
        break;
      case 'hold':
        setCallStatus(prev => prev === 'on-hold' ? 'connected' : 'on-hold');
        break;
      case 'mute':
        setIsMuted(!isMuted);
        break;
      case 'transfer':
        toast({ title: "Transfer Initiated", description: "Select a department or agent." });
        break;
      case 'voicemail':
        toast({ title: "Voicemail Drop", description: "Leaving 'Standard_VM_1.mp3'" });
        setCallStatus('idle');
        break;
    }
  };

  const handleLifelineQuery = (e) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setIsAiThinking(true);
    setTimeout(() => {
      setAiResponse("Based on the customer's location in a flood zone, mention that our vent materials are rust-resistant and mold-proof, which is critical for their area.");
      setIsAiThinking(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Helmet><title>Smart Console | The Vent Guys</title></Helmet>
      
      {/* 1. Header / Softphone Bar */}
      <header className="bg-slate-900 text-white p-4 shadow-md z-20 sticky top-0">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className={`w-3 h-3 rounded-full animate-pulse ${callStatus === 'connected' ? 'bg-green-500' : callStatus === 'on-hold' ? 'bg-amber-500' : 'bg-slate-500'}`} />
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-wide">
                {callStatus === 'idle' ? 'Ready' : callStatus === 'calling' ? 'Calling...' : callStatus === 'on-hold' ? 'On Hold' : 'Connected'}
              </span>
              <span className="text-slate-400 text-xs font-mono">{formatTime(callDuration)}</span>
            </div>
            {callStatus !== 'idle' && (
               <Badge variant="outline" className="ml-2 border-slate-600 text-slate-300">
                  <Globe className="w-3 h-3 mr-1" /> VoIP
               </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4 bg-slate-800/50 p-2 rounded-xl backdrop-blur-sm border border-slate-700">
             {/* Call Controls */}
             <Button 
                variant="ghost" 
                size="icon" 
                className={cn("rounded-full hover:bg-slate-700 text-slate-300", isMuted && "bg-red-900/50 text-red-400 hover:bg-red-900/70")}
                onClick={() => handleCallAction('mute')}
                disabled={callStatus === 'idle'}
             >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
             </Button>
             
             <Button 
                variant="ghost" 
                size="icon" 
                className={cn("rounded-full hover:bg-slate-700 text-slate-300", callStatus === 'on-hold' && "bg-amber-900/50 text-amber-400 hover:bg-amber-900/70")}
                onClick={() => handleCallAction('hold')}
                disabled={callStatus === 'idle'}
             >
                {callStatus === 'on-hold' ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
             </Button>

             <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-700 text-slate-300"
                onClick={() => handleCallAction('transfer')}
                disabled={callStatus === 'idle'}
             >
                <Forward className="w-5 h-5" />
             </Button>

            <HoverCard>
              <HoverCardTrigger asChild>
                 <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-700 text-slate-300" disabled={callStatus === 'idle'}>
                    <GripHorizontal className="w-5 h-5" />
                 </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-64 bg-slate-800 border-slate-700 text-slate-200">
                <div className="grid grid-cols-3 gap-2">
                   {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map(key => (
                     <Button key={key} variant="outline" className="h-10 border-slate-600 hover:bg-slate-700 hover:text-white">
                        {key}
                     </Button>
                   ))}
                </div>
              </HoverCardContent>
            </HoverCard>

            <Separator orientation="vertical" className="h-8 bg-slate-700 mx-2" />

             {callStatus === 'idle' ? (
                <Button 
                  size="lg" 
                  className="bg-green-600 hover:bg-green-700 text-white rounded-full px-8 shadow-lg shadow-green-900/20"
                  onClick={() => handleCallAction('dial')}
                >
                  <Phone className="w-5 h-5 mr-2" /> Call Lead
                </Button>
             ) : (
                <>
                  <Button 
                    variant="destructive" 
                    size="lg" 
                    className="rounded-full px-8 shadow-lg"
                    onClick={() => handleCallAction('hangup')}
                  >
                    <PhoneMissed className="w-5 h-5 mr-2" /> End
                  </Button>
                  <Button 
                     variant="secondary"
                     className="bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 rounded-full"
                     onClick={() => handleCallAction('voicemail')}
                  >
                     <Voicemail className="w-4 h-4 mr-2" /> VM Drop
                  </Button>
                </>
             )}
          </div>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-grow p-4 md:p-6 max-w-[1800px] mx-auto w-full grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-80px)]">
        
        {/* LEFT PANEL: Context & Profile (3 Cols) */}
        <div className="xl:col-span-3 flex flex-col gap-6 h-full overflow-hidden">
           
           {/* Customer Profile Card */}
           <Card className="flex-shrink-0 shadow-sm border-slate-200">
             <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
               <div className="flex items-center gap-3">
                 <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                   <AvatarImage src="https://i.pravatar.cc/150?u=fake" />
                   <AvatarFallback>JD</AvatarFallback>
                 </Avatar>
                 <div>
                   <CardTitle className="text-lg">John Doe</CardTitle>
                   <CardDescription>Residential Owner</CardDescription>
                 </div>
               </div>
               <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <StarIcon filled className="w-3 h-3 mr-1 text-blue-500" /> VIP
               </Badge>
             </CardHeader>
             <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-y-2 text-slate-600">
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400"/> Melbourne, FL</div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400"/> EST (Local)</div>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400"/> (321) 555-0123</div>
                  <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-500"/> Verified</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                   <Badge variant="secondary">Dryer Vent</Badge>
                   <Badge variant="secondary">Lead</Badge>
                   <Badge variant="secondary" className="bg-amber-100 text-amber-800">High Intent</Badge>
                </div>
             </CardContent>
           </Card>

           {/* Google Street View Context */}
           <Card className="flex-shrink-0 overflow-hidden border-slate-200 bg-slate-900 relative group h-48">
              <img 
                 src="/placeholder-street-view.jpg" 
                 alt="Street view of 123 Palm Ave" 
                 className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
               src="https://images.unsplash.com/photo-1691729086702-f52f2bcdd528" />
              <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                  <div className="flex justify-between items-start">
                     <Badge className="bg-black/50 hover:bg-black/70 border-none text-white backdrop-blur-md">
                        <MapPin className="w-3 h-3 mr-1" /> 123 Palm Ave
                     </Badge>
                  </div>
                  <Button variant="outline" size="sm" className="self-start text-xs border-white/20 text-white hover:bg-white/20">
                     View Property Details
                  </Button>
              </div>
           </Card>

           {/* Interaction History Timeline */}
           <Card className="flex-1 flex flex-col min-h-0 border-slate-200">
             <CardHeader className="py-3 border-b bg-slate-50/50">
               <CardTitle className="text-sm font-semibold flex items-center gap-2">
                 <History className="w-4 h-4 text-slate-500"/> Interaction History
               </CardTitle>
             </CardHeader>
             <ScrollArea className="flex-1 p-4">
               <div className="space-y-4 relative pl-4 border-l border-slate-200">
                 {HISTORY_ITEMS.map((item) => (
                   <div key={item.id} className="relative text-sm">
                     <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                        item.type === 'call' ? 'bg-blue-400' : item.type === 'email' ? 'bg-purple-400' : 'bg-green-400'
                     }`} />
                     <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-slate-700 capitalize">{item.type}</span>
                        <span className="text-xs text-slate-400">{item.date}</span>
                     </div>
                     <p className="text-slate-500 text-xs bg-slate-50 p-2 rounded border">{item.note}</p>
                   </div>
                 ))}
               </div>
             </ScrollArea>
           </Card>
        </div>

        {/* CENTER PANEL: Active Interaction (6 Cols) */}
        <div className="xl:col-span-6 flex flex-col gap-6 h-full">
           
           {/* Communication Tabs (Call/SMS) */}
           <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
             <div className="flex items-center justify-between mb-2">
               <TabsList className="bg-white border shadow-sm">
                 <TabsTrigger value="call" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <Phone className="w-4 h-4 mr-2" /> Voice Console
                 </TabsTrigger>
                 <TabsTrigger value="sms" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <MessageSquare className="w-4 h-4 mr-2" /> SMS / Text
                 </TabsTrigger>
               </TabsList>
               <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Auto-Save: On</span>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
               </div>
             </div>

             <TabsContent value="call" className="flex-1 flex flex-col gap-4 mt-0 h-full min-h-0">
                
                {/* Script & Playbook Area */}
                <Card className="flex-1 flex flex-col shadow-sm border-slate-200 overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b py-2 px-4 flex flex-row items-center justify-between space-y-0">
                     <div className="flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-purple-600" />
                        <span className="font-semibold text-slate-700">Dynamic Script</span>
                     </div>
                     <Select value={selectedScript} onValueChange={setSelectedScript}>
                        <SelectTrigger className="w-[180px] h-8 text-xs bg-white">
                           <SelectValue placeholder="Select Stage" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="opener">1. Opener & Hook</SelectItem>
                           <SelectItem value="discovery">2. Discovery</SelectItem>
                           <SelectItem value="objection">3. Handling Objections</SelectItem>
                           <SelectItem value="closing">4. Closing & Booking</SelectItem>
                        </SelectContent>
                     </Select>
                  </CardHeader>
                  <CardContent className="flex-1 p-6 flex flex-col justify-center bg-white">
                     <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        {SCRIPT_OPTIONS[selectedScript].title}
                     </h3>
                     <p className="text-xl leading-relaxed text-slate-600 font-medium">
                        "{SCRIPT_OPTIONS[selectedScript].text}"
                     </p>
                  </CardContent>
                  <CardFooter className="bg-slate-50 border-t p-2 px-4 flex justify-between items-center">
                     <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedScript(prev => {
                           const keys = Object.keys(SCRIPT_OPTIONS);
                           const currIdx = keys.indexOf(selectedScript);
                           return keys[Math.max(0, currIdx - 1)];
                        })} disabled={selectedScript === 'opener'}>
                           <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedScript(prev => {
                           const keys = Object.keys(SCRIPT_OPTIONS);
                           const currIdx = keys.indexOf(selectedScript);
                           return keys[Math.min(keys.length - 1, currIdx + 1)];
                        })} disabled={selectedScript === 'closing'}>
                           Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                     </div>
                     <Badge variant="outline" className="text-xs font-mono text-slate-400">AI Generated</Badge>
                  </CardFooter>
                </Card>

                {/* Live Transcript / Notes */}
                <Card className="h-1/3 shadow-sm border-slate-200 flex flex-col">
                   <Tabs defaultValue="notes" className="flex-1 flex flex-col">
                      <div className="px-4 py-2 border-b flex justify-between items-center bg-slate-50/50">
                         <TabsList className="h-8">
                            <TabsTrigger value="notes" className="text-xs h-6">Notes</TabsTrigger>
                            <TabsTrigger value="transcript" className="text-xs h-6">Live Transcript</TabsTrigger>
                         </TabsList>
                         <Button variant="ghost" size="sm" className="h-6 text-xs"><Save className="w-3 h-3 mr-1"/> Save</Button>
                      </div>
                      <TabsContent value="notes" className="flex-1 p-0 m-0 relative">
                         <Textarea 
                           className="w-full h-full resize-none border-0 focus-visible:ring-0 p-4 text-sm" 
                           placeholder="Type call notes here..." 
                        />
                      </TabsContent>
                      <TabsContent value="transcript" className="flex-1 p-4 m-0 overflow-y-auto bg-slate-50">
                         <p className="text-xs text-slate-400 italic mb-2">Transcript started at 10:42 AM...</p>
                         <div className="space-y-2">
                            <div className="flex gap-2"><span className="font-bold text-blue-600 text-xs w-8">AGT:</span> <span className="text-sm text-slate-700">Hi John, calling about the dryer vent.</span></div>
                            <div className="flex gap-2"><span className="font-bold text-slate-600 text-xs w-8">CUST:</span> <span className="text-sm text-slate-700">Oh right, I've been meaning to look into that.</span></div>
                            {callDuration > 5 && (
                              <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2"><span className="font-bold text-blue-600 text-xs w-8">AGT:</span> <span className="text-sm text-slate-700">That's great. Have you noticed longer drying times?</span></div>
                            )}
                         </div>
                      </TabsContent>
                   </Tabs>
                </Card>
             </TabsContent>

             <TabsContent value="sms" className="flex-1 bg-white rounded-lg border shadow-sm mt-0 p-4 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                   <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                   <p>No active SMS conversation selected.</p>
                   <Button variant="outline" className="mt-4">Start New Thread</Button>
                </div>
             </TabsContent>
           </Tabs>
        </div>

        {/* RIGHT PANEL: AI & Tools (3 Cols) */}
        <div className="xl:col-span-3 flex flex-col gap-6 h-full overflow-hidden">
           
           {/* Real-time Coaching / Sentiment */}
           <Card className="flex-shrink-0 shadow-sm border-slate-200 bg-gradient-to-b from-white to-slate-50">
             <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                   <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Live Coaching</span>
                   <Badge className={cn("text-[10px]", sentimentScore > 70 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                      {sentimentScore > 70 ? 'Positive' : 'Negative'} Sentiment
                   </Badge>
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="space-y-1">
                   <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Customer Sentiment</span>
                      <span>{sentimentScore}%</span>
                   </div>
                   <Progress value={sentimentScore} className="h-2" indicatorClassName={cn(sentimentScore > 70 ? "bg-green-500" : "bg-red-500")} />
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                   <p className="text-xs text-blue-800 font-medium flex gap-2">
                      <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      Tip: Customer seems responsive to safety stats. Mention the "15,000 fires/year" statistic next.
                   </p>
                </div>
             </CardContent>
           </Card>

           {/* Predictive Suggestions */}
           <Card className="flex-shrink-0 shadow-sm border-slate-200">
             <CardHeader className="py-3 border-b bg-slate-50/50">
               <CardTitle className="text-sm font-semibold flex items-center gap-2">
                 <BrainCircuit className="w-4 h-4 text-purple-600"/> Next Best Actions
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               {SUGGESTIONS.map((sugg, idx) => (
                  <div key={sugg.id} className={cn("p-3 border-b last:border-0 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors", idx === 0 && "bg-purple-50/50")}>
                     <div className={cn("mt-0.5 w-1.5 h-1.5 rounded-full", 
                        sugg.type === 'insight' ? 'bg-blue-400' : sugg.type === 'action' ? 'bg-green-400' : 'bg-amber-400'
                     )} />
                     <p className="text-xs text-slate-700 leading-snug">{sugg.text}</p>
                  </div>
               ))}
             </CardContent>
           </Card>

           {/* Lifeline / Ad-Hoc AI Query */}
           <Card className="flex-1 flex flex-col min-h-0 shadow-sm border-slate-200">
              <CardHeader className="py-3 bg-slate-900 text-white rounded-t-lg">
                 <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-400" /> Agent Lifeline
                 </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-3 overflow-y-auto bg-slate-50 flex flex-col gap-3">
                 <div className="self-start bg-white p-2 rounded-lg rounded-tl-none border shadow-sm max-w-[90%]">
                    <p className="text-xs text-slate-600">I'm listening. Ask me anything about the customer, objection handling, or technical specs.</p>
                 </div>
                 {aiResponse && (
                    <div className="self-start bg-purple-50 p-2 rounded-lg rounded-tl-none border border-purple-100 shadow-sm max-w-[90%] animate-in fade-in slide-in-from-left-2">
                       <p className="text-xs text-purple-800">{aiResponse}</p>
                    </div>
                 )}
                 {isAiThinking && (
                    <div className="self-start bg-slate-100 p-2 rounded-lg rounded-tl-none max-w-[90%]">
                       <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                       </div>
                    </div>
                 )}
              </CardContent>
              <div className="p-2 border-t bg-white">
                 <form onSubmit={handleLifelineQuery} className="flex gap-2">
                    <Input 
                       value={aiQuery}
                       onChange={(e) => setAiQuery(e.target.value)}
                       placeholder="Ask AI Copilot..." 
                       className="h-8 text-xs focus-visible:ring-1"
                    />
                    <Button type="submit" size="sm" className="h-8 w-8 p-0 bg-slate-900 hover:bg-slate-800">
                       <Send className="w-3 h-3" />
                    </Button>
                 </form>
              </div>
           </Card>

           {/* Appointment Widget */}
           <Card className="flex-shrink-0 shadow-sm border-slate-200">
              <CardHeader className="py-2 border-b bg-green-50/50">
                 <CardTitle className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Book Appointment
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                 <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                       <Label className="text-[10px] text-slate-500 uppercase">Date</Label>
                       <Input type="date" className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                       <Label className="text-[10px] text-slate-500 uppercase">Time</Label>
                       <Select>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Slot" /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="9am">9:00 AM - 11:00 AM</SelectItem>
                             <SelectItem value="11am">11:00 AM - 1:00 PM</SelectItem>
                             <SelectItem value="2pm">2:00 PM - 4:00 PM</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
                 <Button className="w-full bg-green-600 hover:bg-green-700 h-8 text-xs font-medium">
                    Confirm Booking
                 </Button>
              </CardContent>
           </Card>

        </div>
      </main>
    </div>
  );
};

// Simple helper icon
const StarIcon = ({ filled, className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill={filled ? "currentColor" : "none"} 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default SmartCallConsole;
