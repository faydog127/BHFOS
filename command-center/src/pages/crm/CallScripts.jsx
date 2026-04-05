import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Copy, Phone, MessageSquare, AlertTriangle, CheckCircle2, 
  ClipboardList, Clock, Shield, Truck, Tablet, PenTool, 
  HelpCircle, Sparkles, AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const ScriptBlock = ({ title, content, context, tags = [] }) => {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Script Copied",
      description: "Ready to paste into chat or notes.",
      duration: 2000,
    });
  };

  return (
    <Card className="mb-4 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
            {context && <CardDescription className="mt-1 text-slate-500 italic">{context}</CardDescription>}
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="text-slate-500 hover:text-blue-600 hover:bg-blue-50">
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex gap-2 mt-2">
            {tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-600">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="bg-slate-50 p-4 rounded-md border text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
          "{content}"
        </div>
      </CardContent>
    </Card>
  );
};

const ProtocolPhase = ({ number, title, icon: Icon, children }) => (
  <div className="relative pl-8 pb-8 border-l-2 border-slate-200 last:border-0">
    <div className="absolute -left-[11px] top-0 bg-white border-2 border-blue-600 rounded-full p-1">
        <Icon className="w-4 h-4 text-blue-600" />
    </div>
    <div className="mb-2">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Phase {number}</span>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
    </div>
    <div className="text-sm text-slate-600 space-y-2">
        {children}
    </div>
  </div>
);

export default function CallScripts() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <Helmet>
        <title>Scripts & Protocols | CRM</title>
      </Helmet>

      <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
        
        {/* LEFT COLUMN: Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="mb-6 shrink-0">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <MessageSquare className="h-8 w-8 text-blue-600" />
                    Call Scripts & Protocols
                </h1>
                <p className="text-slate-500 mt-2">Standard operating procedures for CSRs and Technicians.</p>
            </div>

            <Tabs defaultValue="verification" className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 space-x-6">
                    <TabsTrigger value="verification" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none h-full px-0 font-semibold text-slate-500 data-[state=active]:text-blue-600">Verification Calls</TabsTrigger>
                    <TabsTrigger value="apology" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none h-full px-0 font-semibold text-slate-500 data-[state=active]:text-blue-600">Late Response (Apology)</TabsTrigger>
                    <TabsTrigger value="tech" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none h-full px-0 font-semibold text-slate-500 data-[state=active]:text-blue-600">Tech Protocols</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-6 pr-4">
                    <TabsContent value="verification" className="mt-0 space-y-6">
                        <ScriptBlock 
                            title="Base Verification Script" 
                            context="Standard outbound call for new leads."
                            tags={['General', 'First Contact']}
                            content={`Hi [Name], this is [CSR Name] with The Vent Guys. \n\nI received your request regarding [Service Interest] and wanted to quickly verify a few details to get you the most accurate pricing. Do you have a quick moment?`}
                        />
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ScriptBlock 
                                title="Web Wizard Variant" 
                                context="Lead came from online estimator."
                                tags={['Inbound', 'High Intent']}
                                content={`Hi [Name], I see you just used our online estimate tool for your [Property Type].\n\nI have that preliminary quote here—I just need to confirm: Is the dryer vent exiting through the roof or the side wall?`}
                            />
                            <ScriptBlock 
                                title="Free Air Check Variant" 
                                context="Lead requested free inspection."
                                tags={['Promo', 'Door Opener']}
                                content={`Hi [Name], calling about the Free Air Check you requested.\n\nGreat news—we have a technician in [City] this [Day]. Since this is a specialized diagnostic visit, I just need to confirm if you're experiencing any specific airflow issues or allergies?`}
                            />
                            <ScriptBlock 
                                title="Fast Lane (Urgent)" 
                                context="Lead marked 'Emergency' or 'Fire Hazard'."
                                tags={['Urgent', 'Safety']}
                                content={`Hi [Name], I saw your request come in marked as URGENT regarding the dryer heat issue.\n\nBecause this can be a safety hazard, I'm trying to prioritize a technician to get there ASAP. Are you currently running the dryer, or have you shut it off?`}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="apology" className="mt-0 space-y-6">
                         <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4 flex items-start gap-3">
                            <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-amber-800 text-sm">When to use</h4>
                                <p className="text-sm text-amber-700">Use these scripts when lead response time exceeds <strong>15 minutes</strong> (Yellow/Red SLA status).</p>
                            </div>
                         </div>

                         <ScriptBlock 
                            title="Live Answer Apology" 
                            context="When they pick up the phone."
                            tags={['Damage Control', 'SLA Breach']}
                            content={`Hi [Name], this is [CSR Name] with The Vent Guys.\n\nFirst, I want to sincerely apologize for the delay in getting back to you—we had an unexpected surge of service requests this morning, but I wanted to make sure I personally reached out to handle your [Service] inquiry. Are you still available to discuss this?`}
                        />

                        <ScriptBlock 
                            title="Voicemail Apology" 
                            context="Leaving a message after delay."
                            tags={['Voicemail', 'Follow-up']}
                            content={`Hi [Name], [CSR Name] here from The Vent Guys. So sorry I missed you earlier—I know it took us a little longer than usual to get back to you today.\n\nI've prioritized your file on my desk. Please give me a call back at [Number] so I can get you taken care of immediately. Again, apologies for the wait.`}
                        />
                    </TabsContent>

                    <TabsContent value="tech" className="mt-0">
                         <Card>
                            <CardHeader>
                                <CardTitle>Technician Arrival & Execution Protocol</CardTitle>
                                <CardDescription>The 4-Phase standard for every service call.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <ProtocolPhase number="1" title="The Approach" icon={Truck}>
                                    <p>• <strong>Park clearly visible</strong> on the street (not driveway unless necessary).</p>
                                    <p>• <strong>Wear booties</strong> immediately upon entering.</p>
                                    <p>• <strong>Introduction:</strong> "Hi, I'm [Name] with The Vent Guys. I'm here to get your system running safely and efficiently. Mind if I take a quick look at the unit first?"</p>
                                </ProtocolPhase>
                                
                                <ProtocolPhase number="2" title="The Audit (Red Flags)" icon={Shield}>
                                    <p>• <strong>Visual Inspection:</strong> Check transition hose (plastic/foil = fail).</p>
                                    <p>• <strong>Airflow Test:</strong> Run digital anemometer reading at termination point.</p>
                                    <div className="bg-red-50 p-3 rounded border border-red-100 mt-2">
                                        <span className="font-bold text-red-700 flex items-center gap-2 text-xs uppercase mb-1">
                                            <AlertTriangle className="w-3 h-3" /> Red Flag Triggers
                                        </span>
                                        <ul className="list-disc list-inside text-xs text-red-600">
                                            <li>Vinyl/Plastic transition hose (Fire Hazard)</li>
                                            <li>Bird/Rodent nest visible</li>
                                            <li>Zero airflow reading</li>
                                            <li>Mold growth on vent cover</li>
                                        </ul>
                                    </div>
                                </ProtocolPhase>

                                <ProtocolPhase number="3" title="Quote Presentation" icon={Tablet}>
                                    <p>• <strong>iPad Flow:</strong> Open the "Options" screen BEFORE discussing price.</p>
                                    <p>• <strong>Presentation Script:</strong> "Based on the audit, I've put together three options for you..."</p>
                                    <ul className="pl-4 space-y-1 mt-1 text-slate-700 bg-slate-50 p-2 rounded">
                                        <li><strong>Good:</strong> "This just gets it clean and safe."</li>
                                        <li><strong>Better:</strong> "This fixes the code violation and ensures it stays clean longer."</li>
                                        <li><strong>Best:</strong> "This is the 'never worry about it again' package with our guarantee."</li>
                                    </ul>
                                </ProtocolPhase>

                                <ProtocolPhase number="4" title="Transformation & Execution" icon={Sparkles}>
                                    <p>• Perform the agreed scope.</p>
                                    <p>• <strong>Clean Up:</strong> Leave the area cleaner than you found it.</p>
                                    <p>• <strong>Post-Audit:</strong> Show the "After" photos and new airflow reading.</p>
                                    <p>• <strong>The Ask:</strong> "If you're happy with the airflow improvement, would you mind scanning this QR code for a quick review?"</p>
                                </ProtocolPhase>
                            </CardContent>
                         </Card>
                    </TabsContent>
                </ScrollArea>
            </Tabs>
        </div>

        {/* RIGHT COLUMN: Quick Reference Sidebar */}
        <div className="w-full md:w-80 shrink-0 space-y-6">
            <Card className="bg-slate-900 text-white border-slate-800 shadow-xl sticky top-6">
                <CardHeader className="bg-slate-950/50 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-blue-400" />
                        Quick Reference
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Standard Greeting</h4>
                        <div className="bg-slate-800 p-3 rounded text-sm text-slate-200 border border-slate-700">
                            "Thanks for calling The Vent Guys, this is [Name]. How can I help you breathe easier today?"
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Key Phone Numbers</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-300">Dispatch:</span>
                                <span className="font-mono text-blue-300">x101</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-300">Tech Lead:</span>
                                <span className="font-mono text-blue-300">x104</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-300">Emergency:</span>
                                <span className="font-mono text-red-400">555-9111</span>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-slate-700" />

                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Objection Handling</h4>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="price" className="border-slate-700">
                                <AccordionTrigger className="text-sm py-2 text-slate-200">"It's too expensive"</AccordionTrigger>
                                <AccordionContent className="text-xs text-slate-300 bg-slate-800 p-2 rounded">
                                    "I understand. We aren't the cheapest, but we use high-pressure air whips instead of just brushes, which actually removes the fire hazard completely. Would you like to see the 'Good' option again?"
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="time" className="border-slate-700">
                                <AccordionTrigger className="text-sm py-2 text-slate-200">"Can't do today"</AccordionTrigger>
                                <AccordionContent className="text-xs text-slate-300 bg-slate-800 p-2 rounded">
                                    "No problem. We have a route in your area next Tuesday. Would morning or afternoon work better for you?"
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base text-blue-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Safety Reminder
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-800">
                    If a customer mentions <strong>burning smell</strong> or <strong>hot to touch</strong> dryer, advise them to stop using the appliance immediately until inspected.
                </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}