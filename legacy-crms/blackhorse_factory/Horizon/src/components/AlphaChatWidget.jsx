import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, ShieldCheck, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';

const AlphaChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Alpha. Ask me why 'blowing' isn't 'cleaning'—or ask for a Free Air Check!" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadData, setLeadData] = useState({ name: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Trigger words that activate the lead form
  const TRIGGER_WORDS = ['yes', 'book', 'schedule', 'okay', 'please', 'sure', 'interested'];

  useEffect(() => {
    // Initialize session ID on mount with error handling for restricted environments
    let currentSession = null;
    
    try {
      currentSession = localStorage.getItem('alpha_chat_session_id');
    } catch (e) {
      // Silent fail for SecurityError in restricted iframes
      console.warn('LocalStorage access restricted, using in-memory session only.');
    }

    if (!currentSession) {
      currentSession = uuidv4();
      try {
        localStorage.setItem('alpha_chat_session_id', currentSession);
      } catch (e) {
        // Silent fail for SecurityError
      }
    }
    setSessionId(currentSession);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, showLeadForm]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    // Check for trigger words locally
    const hasTriggerWord = TRIGGER_WORDS.some(word => userMessage.toLowerCase().includes(word));

    try {
      // Call Updated Edge Function: alpha-chat-v2
      const { data, error } = await supabase.functions.invoke('alpha-chat-v2', {
        body: { 
          message: userMessage,
          history: newMessages.slice(-4), // Send only last 4 messages for context
          session_id: sessionId
        }
      });

      if (error) throw error;

      const botReply = data?.reply || "I'm sorry, I didn't catch that. Could you please try again?";
      setMessages(prev => [...prev, { role: 'assistant', content: botReply }]);

      if (hasTriggerWord) {
        setTimeout(() => setShowLeadForm(true), 1000);
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to the server right now. Please try again later or call us directly at (321) 360-9704." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Insert into Supabase 'chatbot_leads' table
      const { error } = await supabase
        .from('chatbot_leads')
        .insert([
          {
            name: leadData.name,
            phone_number: leadData.phone,
            full_transcript: `Manual Form Submit. Last msg: "${messages[messages.length - 1].content}"`,
            status: 'new',
            intent: 'Free Air Check'
          }
        ]);

      if (error) throw error;

      setIsOpen(false);
      navigate('/thank-you');
      
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Please try calling us instead at (321) 360-9704."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-[340px] h-[480px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="bg-[#0044cc] p-4 text-white shrink-0">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold text-lg">The Vent Guys</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-white hover:bg-blue-700 -mr-2 -mt-1"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-blue-100 flex items-center gap-2">
                <span className="bg-blue-800 px-1.5 py-0.5 rounded">NADCA Certified</span>
                <span>•</span>
                <a href="tel:3213609704" className="hover:underline">(321) 360-9704</a>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex w-full",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                      msg.role === 'user' 
                        ? "bg-[#0044cc] text-white rounded-br-sm" 
                        : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start w-full">
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  </div>
                </div>
              )}
              
              {/* Lead Capture Form */}
              {showLeadForm && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4"
                >
                  <h4 className="font-semibold text-[#0044cc] text-sm mb-2">Ready to schedule?</h4>
                  <form onSubmit={handleLeadSubmit} className="space-y-3">
                    <div>
                      <Label htmlFor="chat-name" className="text-xs text-slate-600">Name</Label>
                      <Input
                        id="chat-name"
                        value={leadData.name}
                        onChange={(e) => setLeadData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe"
                        className="h-8 text-sm bg-white"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="chat-phone" className="text-xs text-slate-600">Phone</Label>
                      <Input
                        id="chat-phone"
                        value={leadData.phone}
                        onChange={(e) => setLeadData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(321) 555-0123"
                        className="h-8 text-sm bg-white"
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-8 bg-[#0044cc] hover:bg-blue-700 text-xs mt-1"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                      ) : (
                        <span className="flex items-center justify-center">
                          Book Free Air Check <ChevronRight className="w-3 h-3 ml-1" />
                        </span>
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-100">
              <form 
                onSubmit={handleSendMessage}
                className="flex items-center gap-2"
              >
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={showLeadForm ? "Fill out the form above..." : "Type a message..."}
                  className="flex-1 focus-visible:ring-[#0044cc]"
                  disabled={showLeadForm || isLoading}
                />
                <Button 
                  type="submit" 
                  size="icon"
                  className="bg-[#0044cc] hover:bg-blue-700 shrink-0"
                  disabled={!inputValue.trim() || showLeadForm || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button (Bubble) */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-[60px] h-[60px] rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
          isOpen ? "bg-slate-800 rotate-90" : "bg-[#0044cc] hover:bg-blue-700"
        )}
      >
        {isOpen ? (
          <X className="w-8 h-8 text-white" />
        ) : (
          <MessageCircle className="w-8 h-8 text-white" />
        )}
        
        {/* Notification Dot (only when closed) */}
        {!isOpen && messages.length > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </motion.button>
    </div>
  );
};

export default AlphaChatWidget;