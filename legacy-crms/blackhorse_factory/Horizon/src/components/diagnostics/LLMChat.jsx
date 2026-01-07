
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles, Send, Bot, User, Ban } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const LLMChat = ({ systemContext, aiEnabled = true }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [activeModel, setActiveModel] = useState('OpenAI');

  useEffect(() => {
    // Initial system diagnosis message
    if (systemContext && messages.length === 0 && aiEnabled) {
      const failures = systemContext.failedChecks || [];
      const score = systemContext.healthScore;
      
      let initMsg = `System Health Score is ${score}/100. `;
      if (failures.length > 0) {
        initMsg += `I see issues with: ${failures.map(f => f.name).join(', ')}. What would you like to analyze first?`;
      } else {
        initMsg += "All systems look healthy. How can I assist you with optimizations?";
      }

      setMessages([{ role: 'assistant', content: initMsg, model: 'System' }]);
    }
  }, [systemContext, aiEnabled]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Add User Message
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Mock Response (Simulation)
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `[${activeModel} Simulation]: Based on the diagnostics, I recommend checking the RLS policies for the affected tables. Specifically, ensure the 'authenticated' role has SELECT permissions.`,
        model: activeModel
      }]);
    }, 1000);
  };

  if (!aiEnabled) {
    return (
      <Card className="h-[600px] flex flex-col justify-center items-center bg-slate-50">
        <Ban className="h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-700">AI Features Disabled</h3>
        <p className="text-slate-500 max-w-xs text-center mt-2">
          AI assistance is currently turned off via the Controls tab. Enable it to chat with system diagnostics.
        </p>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Diagnostic Assistant
          </CardTitle>
          <div className="flex gap-2">
             <Button 
               variant={activeModel === 'OpenAI' ? 'default' : 'outline'} 
               size="xs" 
               className="h-7 text-xs"
               onClick={() => setActiveModel('OpenAI')}
             >
               OpenAI
             </Button>
             <Button 
               variant={activeModel === 'Gemini' ? 'default' : 'outline'} 
               size="xs" 
               className="h-7 text-xs"
               onClick={() => setActiveModel('Gemini')}
             >
               Gemini
             </Button>
          </div>
        </div>
        <CardDescription>Context-aware troubleshooting helper.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar className="w-8 h-8 mt-1 border">
                    {msg.role === 'assistant' ? (
                      <AvatarFallback className="bg-purple-50 text-purple-700"><Bot className="w-4 h-4" /></AvatarFallback>
                    ) : (
                      <AvatarFallback className="bg-blue-50 text-blue-700"><User className="w-4 h-4" /></AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                     {msg.role === 'assistant' && (
                       <div className="text-[10px] text-slate-400 mb-1 ml-1">{msg.model}</div>
                     )}
                     <div className={`p-3 rounded-lg text-sm leading-relaxed ${
                       msg.role === 'user' 
                         ? 'bg-blue-600 text-white shadow-md' 
                         : 'bg-white border border-slate-100 shadow-sm text-slate-800'
                     }`}>
                       {msg.content}
                     </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 border-t bg-slate-50">
        <div className="flex w-full gap-2">
          <Input 
            placeholder={`Ask ${activeModel} about the issues...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="bg-white"
          />
          <Button onClick={handleSend} size="icon" className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default LLMChat;
