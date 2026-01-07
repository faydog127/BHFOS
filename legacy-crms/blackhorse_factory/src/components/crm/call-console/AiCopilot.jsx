
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  BrainCircuit, 
  Copy, 
  Activity,
  Mic,
  Volume2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// Mock Data for Simulation
const MOCK_TRANSCRIPT = [
  { role: 'agent', text: "Hi, this is Alex from The Vent Guys. How are you today?" },
  { role: 'customer', text: "I'm okay, just busy. What is this about?" },
  { role: 'agent', text: "I'm calling because we're in your neighborhood doing safety inspections." },
  { role: 'customer', text: "Look, I'm not interested in buying anything right now." }
];

const OBJECTION_HANDLERS = [
  {
    id: 'price',
    label: "It's too expensive",
    response: "I understand price is a concern. However, a clogged vent can increase your energy bill by $20-30 a month, so the service actually pays for itself in about 6 months.",
    confidence: 92
  },
  {
    id: 'busy',
    label: "I'm too busy",
    response: "I completely understand. The inspection only takes 15 minutes, and we can schedule it around your availability. Would a weekend work better?",
    confidence: 88
  },
  {
    id: 'competitor',
    label: "I use someone else",
    response: "That's great that you're maintaining your system. We actually specialize in NADCA-certified cleaning with photo verification, which many general handymen don't provide.",
    confidence: 85
  }
];

const AiCopilot = ({ activeCall = false }) => {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState([]);
  const [sentiment, setSentiment] = useState('neutral'); // neutral, positive, negative
  const [sentimentScore, setSentimentScore] = useState(50);
  const [suggestions, setSuggestions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const transcriptEndRef = useRef(null);

  // Simulate Live Transcription & AI Analysis
  useEffect(() => {
    let interval;
    if (activeCall && isListening) {
      let index = 0;
      interval = setInterval(() => {
        if (index < MOCK_TRANSCRIPT.length) {
          const entry = MOCK_TRANSCRIPT[index];
          setTranscript(prev => [...prev, { ...entry, timestamp: new Date().toLocaleTimeString() }]);
          
          // Simulate Sentiment Shift
          if (entry.text.includes("not interested")) {
            setSentiment('negative');
            setSentimentScore(30);
            setSuggestions([
              { text: "Acknowledge the objection and pivot to value.", type: "coaching" },
              { text: "I understand. I'm not asking for a commitment today, just offering a free safety check.", type: "response" }
            ]);
          } else if (entry.text.includes("busy")) {
            setSentiment('neutral');
            setSentimentScore(45);
          } else {
             setSentimentScore(prev => Math.min(100, prev + 5));
          }
          
          index++;
        }
      }, 3000);
    } else {
      setTranscript([]);
      setSentiment('neutral');
      setSentimentScore(50);
      setSuggestions([]);
    }
    return () => clearInterval(interval);
  }, [activeCall, isListening]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Response ready to paste.",
    });
  };

  const getSentimentColor = (score) => {
    if (score >= 70) return "text-green-600 bg-green-100 border-green-200";
    if (score <= 40) return "text-red-600 bg-red-100 border-red-200";
    return "text-amber-600 bg-amber-100 border-amber-200";
  };
  
  const getProgressBarColor = (score) => {
      if (score >= 70) return "bg-green-500";
      if (score <= 40) return "bg-red-500";
      return "bg-amber-500";
  };

  return (
    <Card className="h-full flex flex-col border-slate-200 shadow-sm bg-slate-50/50">
      <CardHeader className="pb-3 border-b bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BrainCircuit className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">AI Copilot</CardTitle>
              <CardDescription className="text-xs">Real-time call assistance</CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <Badge variant="outline" className={cn(
               "transition-colors", 
               activeCall ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500"
             )}>
                {activeCall ? (
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400 mr-1" />
                    Offline
                  </span>
                )}
             </Badge>
             <Button 
                variant={isListening ? "default" : "outline"} 
                size="sm" 
                className={cn("h-7 text-xs", isListening && "bg-indigo-600 hover:bg-indigo-700")}
                onClick={() => setIsListening(!isListening)}
                disabled={!activeCall}
             >
                {isListening ? <Mic className="w-3 h-3 mr-1 fill-current" /> : <Mic className="w-3 h-3 mr-1" />}
                {isListening ? "Listening" : "Start AI"}
             </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
        
        {/* 1. Real-time Sentiment */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                 <Activity className="w-3 h-3" /> Sentiment Analysis
              </span>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", getSentimentColor(sentimentScore))}>
                 {sentimentScore >= 70 ? 'Positive' : sentimentScore <= 40 ? 'Negative' : 'Neutral'} ({sentimentScore}%)
              </span>
           </div>
           <Progress value={sentimentScore} className="h-2 bg-slate-100" indicatorClassName={getProgressBarColor(sentimentScore)} />
        </div>

        {/* 2. Transcription & Suggestions Tabs */}
        <Tabs defaultValue="transcript" className="flex-1 flex flex-col min-h-0">
           <TabsList className="grid grid-cols-2 mb-2">
              <TabsTrigger value="transcript">Live Transcript</TabsTrigger>
              <TabsTrigger value="objections">Objection Handlers</TabsTrigger>
           </TabsList>

           <TabsContent value="transcript" className="flex-1 flex flex-col min-h-0 gap-3 mt-0">
              
              {/* Transcript Area */}
              <Card className="flex-1 border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
                 <ScrollArea className="flex-1 p-3">
                    <div className="space-y-3">
                       {transcript.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 opacity-60">
                             <MessageSquare className="w-8 h-8 mb-2" />
                             <p className="text-xs">Waiting for voice input...</p>
                          </div>
                       ) : (
                          transcript.map((msg, idx) => (
                             <div key={idx} className={cn("flex flex-col max-w-[90%] text-sm mb-2", msg.role === 'agent' ? "self-end items-end ml-auto" : "self-start items-start")}>
                                <div className={cn("px-3 py-2 rounded-lg", 
                                   msg.role === 'agent' ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none"
                                )}>
                                   {msg.text}
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1">{msg.role === 'agent' ? 'You' : 'Customer'} • {msg.timestamp}</span>
                             </div>
                          ))
                       )}
                       <div ref={transcriptEndRef} />
                    </div>
                 </ScrollArea>
              </Card>

              {/* Live Coaching / Suggestions */}
              {suggestions.length > 0 && (
                 <div className="space-y-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="flex items-center gap-2">
                       <Sparkles className="w-4 h-4 text-purple-500" />
                       <span className="text-xs font-semibold text-slate-700">AI Suggestions</span>
                    </div>
                    {suggestions.map((sugg, i) => (
                       <Alert key={i} className={cn("py-2 px-3 border-l-4", sugg.type === 'coaching' ? "border-l-amber-500 bg-amber-50" : "border-l-indigo-500 bg-indigo-50")}>
                          <div className="flex justify-between gap-2">
                             <div className="text-xs text-slate-700">
                                {sugg.type === 'coaching' && <span className="font-bold text-amber-700 block mb-0.5">💡 Coaching Tip</span>}
                                {sugg.text}
                             </div>
                             {sugg.type === 'response' && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-indigo-600" onClick={() => copyToClipboard(sugg.text)}>
                                   <Copy className="w-3 h-3" />
                                </Button>
                             )}
                          </div>
                       </Alert>
                    ))}
                 </div>
              )}
           </TabsContent>

           <TabsContent value="objections" className="flex-1 overflow-y-auto mt-0 pr-1">
              <div className="space-y-3">
                 {OBJECTION_HANDLERS.map((obj) => (
                    <Card key={obj.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                       <CardHeader className="p-3 pb-0">
                          <div className="flex justify-between items-center">
                             <CardTitle className="text-sm font-semibold text-slate-800">{obj.label}</CardTitle>
                             <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                                {obj.confidence}% match
                             </Badge>
                          </div>
                       </CardHeader>
                       <CardContent className="p-3 pt-2">
                          <p className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-900 transition-colors">
                             "{obj.response}"
                          </p>
                       </CardContent>
                       <CardFooter className="p-2 bg-slate-50 border-t flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-slate-400"> Proven conversion rate: High</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => copyToClipboard(obj.response)}>
                             <Copy className="w-3 h-3 mr-1" /> Copy Script
                          </Button>
                       </CardFooter>
                    </Card>
                 ))}
              </div>
           </TabsContent>
        </Tabs>

      </CardContent>
    </Card>
  );
};

export default AiCopilot;
