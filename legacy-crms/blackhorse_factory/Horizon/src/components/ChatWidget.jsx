import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Loader2, Bot, User, AlertCircle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    // Initialize sessionId once
    const [sessionId] = useState(() => uuidv4());
    
    const viewportRef = useRef(null);
    const inputRef = useRef(null);
    const bottomRef = useRef(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, isLoading]);

    // Initialize chat with welcome message
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                { role: 'assistant', content: "Hi! I'm KLAIRE, your AI assistant for The Vent Guys. How can I help you today?" }
            ]);
        }
    }, [isOpen]);

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessageText = input.trim();
        const userMessage = { role: 'user', content: userMessageText };
        
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setIsError(false); // Reset error state on new attempt

        try {
            const { data, error } = await supabase.functions.invoke('klaire-chat', {
                body: { 
                    messages: [...messages, userMessage], // Send history + new message
                    sessionId: sessionId 
                }
            });

            if (error) throw error;

            if (data && data.reply) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
            } else {
                throw new Error('Empty response from AI');
            }

        } catch (error) {
            console.error("Chat Error:", error);
            setIsError(true);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: (
                    <span className="flex flex-col gap-1">
                        <span>Chat temporarily unavailable.</span>
                        <a href="tel:3213609704" className="underline font-semibold flex items-center gap-1">
                            <Phone className="w-3 h-3" /> Call us at (321) 360-9704
                        </a>
                    </span>
                ),
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95, originBottomRight: 1 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed bottom-24 right-4 md:bottom-24 md:right-6 w-[90vw] md:w-[380px] h-[500px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 z-50 overflow-hidden font-sans"
                    >
                        {/* Header */}
                        <div className={cn(
                            "p-4 border-b dark:border-slate-700 flex justify-between items-center text-white transition-colors duration-300",
                            isError ? "bg-red-600" : "bg-blue-600"
                        )}>
                            <div className="flex items-center gap-2">
                                <div className="bg-white/20 p-1.5 rounded-full">
                                    {isError ? <AlertCircle className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm md:text-base">The Vent Guys Assistant</h3>
                                    <p className="text-xs text-blue-100 flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${isError ? 'bg-red-300' : 'bg-green-400'}`}></span>
                                        {isError ? 'Connection Issue' : 'Online'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <ScrollArea className="flex-1 p-4 bg-slate-50 dark:bg-slate-950">
                            <div className="space-y-4">
                                {messages.map((msg, index) => (
                                    <div 
                                        key={index} 
                                        className={cn(
                                            "flex items-end gap-2 max-w-[85%]", 
                                            msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                                        )}
                                    >
                                        {/* Avatar */}
                                        <div className={cn(
                                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm",
                                            msg.role === 'user' ? 'bg-slate-200' : (isError && msg.isError ? 'bg-red-100' : 'bg-blue-100')
                                        )}>
                                            {msg.role === 'user' 
                                                ? <User className="w-5 h-5 text-slate-600" />
                                                : <Bot className={cn("w-5 h-5", isError && msg.isError ? "text-red-600" : "text-blue-600")} />
                                            }
                                        </div>

                                        {/* Bubble */}
                                        <div className={cn(
                                            "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                            msg.role === 'user' 
                                                ? 'bg-blue-600 text-white rounded-br-none' 
                                                : cn(
                                                    'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-none',
                                                    msg.isError && "bg-red-50 border-red-100 text-red-800"
                                                )
                                        )}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex items-end gap-2 mr-auto max-w-[85%]">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Bot className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                                            <div className="flex space-x-1">
                                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 relative">
                                <Input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Type a message..."
                                    className="pr-12 py-6 rounded-full bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 transition-all"
                                    disabled={isLoading}
                                />
                                <Button
                                    onClick={handleSend}
                                    size="icon"
                                    className={cn(
                                        "absolute right-1 w-10 h-10 rounded-full transition-all duration-200",
                                        !input.trim() || isLoading 
                                            ? "bg-slate-300 text-slate-500 hover:bg-slate-300" 
                                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg hover:scale-105"
                                    )}
                                    disabled={!input.trim() || isLoading}
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 group">
                 {/* Tooltip Label */}
                <span className={cn(
                    "absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none",
                    isOpen && "opacity-0"
                )}>
                    Chat with us
                </span>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-14 h-14 md:w-16 md:h-16 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 border-4 border-white",
                        isOpen ? "bg-slate-800 rotate-90" : (isError ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700")
                    )}
                >
                    {isOpen ? (
                        <X className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    ) : (
                        <>
                            {isError ? <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-white" /> : <MessageSquare className="w-6 h-6 md:w-8 md:h-8 text-white" />}
                            {/* Notification Dot */}
                            {!isOpen && messages.length > 0 && !isError && (
                                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                            )}
                        </>
                    )}
                </motion.button>
            </div>
        </>
    );
};

export default ChatWidget;