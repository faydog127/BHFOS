import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import EstimateCardAction from '@/components/crm/estimates/EstimateCardAction';

const EstimateKanbanTest = () => {
    // 1. Mock Data Setup
    const mockData = {
        id: '1',
        estimate_number: 'EST-001',
        total_price: 149,
        estimated_minutes: 60,
        services: ['Dryer Vent Cleaning', 'Bird Guard Installation'],
        lead: {
            id: '1',
            customer_name: 'John Doe',
            email: 'john@example.com',
            phone: '(407) 555-1234'
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 bg-slate-50 min-h-screen">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-slate-900">Estimate Kanban Integration Test</h1>
                <p className="text-slate-500 max-w-3xl">
                    Use this page to verify the "Send Estimate" functionality. This component is designed to be dropped into 
                    <code>src/components/crm/action-hub/ActionHubKanbanView.jsx</code> or any other Kanban card renderer.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                
                {/* Section 1: The Component Demo */}
                <div className="space-y-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Mock Pipeline Column</h3>
                    
                    {/* The Kanban Card Simulation */}
                    <Card className="w-full max-w-sm shadow-md border-l-4 border-l-orange-500 hover:shadow-xl transition-all duration-200 cursor-pointer group">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 mb-2">
                                    Quote Generated
                                </Badge>
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Today</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-slate-200 text-slate-600">JD</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                        {mockData.lead.customer_name}
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        {mockData.lead.email}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-3 pb-3">
                             {/* Price & Time */}
                             <div className="grid grid-cols-2 gap-2">
                                 <div className="bg-slate-100 p-2 rounded flex flex-col justify-center items-center text-center">
                                    <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" /> Value
                                    </span>
                                    <span className="font-bold text-slate-900 text-sm">
                                        ${mockData.total_price}
                                    </span>
                                 </div>
                                 <div className="bg-slate-100 p-2 rounded flex flex-col justify-center items-center text-center">
                                    <span className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Duration
                                    </span>
                                    <span className="font-bold text-slate-900 text-sm">
                                        {mockData.estimated_minutes}m
                                    </span>
                                 </div>
                             </div>

                             {/* Services */}
                             <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-500">Services:</p>
                                <div className="flex flex-wrap gap-1">
                                    {mockData.services.map((svc, i) => (
                                        <span key={i} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                                            {svc}
                                        </span>
                                    ))}
                                </div>
                             </div>
                        </CardContent>

                        <CardFooter className="pt-2 border-t bg-slate-50/50 flex justify-end gap-2 p-3">
                            <Button variant="ghost" size="sm" className="text-xs h-8">Details</Button>
                            
                            {/* THE ACTION BUTTON BEING TESTED */}
                            <EstimateCardAction 
                                lead={mockData.lead} 
                                estimate={mockData} 
                                size="sm"
                                variant="default" // Making it prominent for the demo
                            />
                        </CardFooter>
                    </Card>

                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800 flex gap-2">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p>
                            <strong>Developer Note:</strong> This card mocks the visual appearance of a card in <code>ActionHubKanbanView.jsx</code>. 
                            The functional component <code>&lt;EstimateCardAction /&gt;</code> is ready to be imported and placed in the real pipeline file.
                        </p>
                    </div>
                </div>

                {/* Section 2: Instructions & Verification */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            Verification Steps
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-600">
                        <ol className="list-decimal pl-4 space-y-3">
                            <li>
                                <strong>Click "Send Estimate"</strong> on the card to the left.
                            </li>
                            <li>
                                <strong>Check the Modal:</strong> Ensure the email field is pre-filled with <code>{mockData.lead.email}</code>.
                            </li>
                            <li>
                                <strong>Change the Email:</strong> Update the email to your own address to safely test the send function.
                            </li>
                            <li>
                                <strong>Send:</strong> Click "Send Estimate". The button should show a loading spinner.
                            </li>
                            <li>
                                <strong>Success:</strong> A green toast notification should appear at the bottom right.
                            </li>
                        </ol>

                        <div className="mt-8 pt-6 border-t">
                            <h4 className="font-bold text-slate-800 mb-2">Integration Instructions</h4>
                            <p className="mb-2">To add this to the real Pipeline:</p>
                            <pre className="bg-slate-900 text-slate-50 p-3 rounded-md overflow-x-auto text-xs font-mono">
{`import EstimateCardAction from '@/components/crm/estimates/EstimateCardAction';

// In your card rendering loop:
<EstimateCardAction 
  estimate={card.estimate} // Ensure estimate object is available
  lead={card.lead}         // Ensure lead object is available
/>`}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default EstimateKanbanTest;