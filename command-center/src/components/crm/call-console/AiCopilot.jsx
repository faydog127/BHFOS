import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, MessageSquare, Activity, Mic, Copy, ShieldCheck, BrainCircuit
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { getTenantConfig } from '@/lib/tenantUtils';

const AiCopilot = ({ activeCall = false }) => {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState([]);
  const [sentimentScore, setSentimentScore] = useState(50);
  const [isListening, setIsListening] = useState(false);
  const transcriptEndRef = useRef(null);

  // Dynamic Tenant Data
  const tenantConfig = getTenantConfig();
  const tenantName = tenantConfig.name || 'Our Company';

  const OBJECTION_HANDLERS = [
    {
      id: 'price',
      label: "It's too expensive",
      response: `I understand price is a concern. However, ${tenantName}'s service is designed to save you money in the long run by improving efficiency and preventing costly repairs.`,
      confidence: 92
    },
    {
      id: 'busy',
      label: "I'm too busy",
      response: "I completely understand. The appointment is quick and we can schedule it entirely around your convenience. Would a weekend work better?",
      confidence: 88
    },
    {
      id: 'competitor',
      label: "I use someone else",
      response: `That's great that you're maintaining your system. ${tenantName} specializes in certified, high-quality service that many general providers may not offer.`,
      confidence: 85
    }
  ];

  useEffect(() => {
    if (activeCall && isListening) {
      // Simulation logic
      const timer = setTimeout(() => {
          setTranscript(prev => [...prev, { 
              role: 'agent', 
              text: `Hi, this is Alex from ${tenantName}. How are you today?`,
              timestamp: new Date().toLocaleTimeString()
          }]);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeCall, isListening, tenantName]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Response ready to paste." });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="font-semibold text-sm text-slate-800">AI Assistant</span>
          </div>
          <div className="flex items-center gap-2">
             <Badge variant="outline" className={cn("text-xs transition-colors", activeCall ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                {activeCall ? 'Live Monitoring' : 'Standby'}
             </Badge>
             <Button 
                variant={isListening ? "secondary" : "outline"} 
                size="sm" 
                className="h-6 text-xs"
                onClick={() => setIsListening(!isListening)}
                disabled={!activeCall}
             >
                {isListening ? <Mic className="w-3 h-3 mr-1 animate-pulse text-red-500" /> : <Mic className="w-3 h-3 mr-1" />}
                {isListening ? "Listening" : "Listen"}
             </Button>
          </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
        {/* Sentiment Analysis */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
           <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                 <Activity className="w-3 h-3" /> Sentiment
              </span>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", sentimentScore > 60 ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>
                 {sentimentScore > 60 ? 'Positive' : 'Neutral'} ({sentimentScore}%)
              </span>
           </div>
           <Progress value={sentimentScore} className="h-1.5" />
        </div>

        {/* Dynamic Content Tabs */}
        <Tabs defaultValue="transcript" className="flex-1 flex flex-col min-h-0">
           <TabsList className="grid grid-cols-2 mb-2 w-full">
              <TabsTrigger value="transcript" className="text-xs">Live Transcript</TabsTrigger>
              <TabsTrigger value="objections" className="text-xs">Objection Killer</TabsTrigger>
           </TabsList>

           <TabsContent value="transcript" className="flex-1 flex flex-col min-h-0 mt-0">
              <ScrollArea className="flex-1 border border-slate-100 rounded-md bg-white">
                 <div className="p-3 space-y-3">
                    {transcript.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 opacity-60">
                          <MessageSquare className="w-8 h-8 mb-2" />
                          <p className="text-xs">Waiting for voice input...</p>
                       </div>
                    ) : (
                       transcript.map((msg, idx) => (
                          <div key={idx} className={cn("flex flex-col max-w-[90%] text-sm mb-2", msg.role === 'agent' ? "self-end items-end ml-auto" : "self-start items-start")}>
                             <div className={cn("px-3 py-2 rounded-lg text-xs shadow-sm", msg.role === 'agent' ? "bg-blue-600 text-white rounded-br-none" : "bg-slate-100 text-slate-800 rounded-bl-none")}>
                                {msg.text}
                             </div>
                             <span className="text-[10px] text-slate-300 mt-1">{msg.timestamp}</span>
                          </div>
                       ))
                    )}
                    <div ref={transcriptEndRef} />
                 </div>
              </ScrollArea>
           </TabsContent>

           <TabsContent value="objections" className="flex-1 overflow-y-auto mt-0 pr-1">
              <div className="space-y-2">
                 {OBJECTION_HANDLERS.map((obj) => (
                    <Card key={obj.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all group">
                       <CardHeader className="p-3 pb-1">
                          <div className="flex justify-between">
                             <CardTitle className="text-xs font-bold text-slate-700">{obj.label}</CardTitle>
                             <Badge variant="secondary" className="text-[10px] h-5 bg-green-50 text-green-700 border-green-100">{obj.confidence}% Match</Badge>
                          </div>
                       </CardHeader>
                       <CardContent className="p-3 pt-1">
                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100 italic">"{obj.response}"</p>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full mt-2 text-slate-400 hover:text-blue-600 group-hover:bg-blue-50" onClick={() => copyToClipboard(obj.response)}>
                             <Copy className="w-3 h-3 mr-1" /> Copy Script
                          </Button>
                       </CardContent>
                    </Card>
                 ))}
              </div>
           </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AiCopilot;