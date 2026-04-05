import React from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Lock, CreditCard, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getScriptForPartner } from '@/lib/hvac-scripts';
import { Badge } from '@/components/ui/badge';

const HvacCallConsoleState = ({ partner, loading }) => {
    if (loading) {
        return (
            <div className="mb-4 p-4 border rounded-lg bg-gray-50 animate-pulse flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">Analyzing partner status...</span>
            </div>
        );
    }

    if (!partner) return null;

    const script = getScriptForPartner(partner);

    // 1. RED STATE: Chaos Flag Active (Highest Priority)
    if (partner.chaos_flag) {
        return (
            <div className="mb-4 animate-in slide-in-from-top-2 duration-300">
                <Alert variant="destructive" className="bg-red-50 border-l-4 border-l-red-600 border-red-200 text-red-900 shadow-sm">
                    <ShieldAlert className="h-6 w-6 text-red-600" />
                    <div className="ml-2 w-full">
                        <AlertTitle className="text-lg font-bold flex justify-between items-center">
                            <span>CHAOS PROTOCOL ACTIVE: {partner.chaos_flag_type?.replace('_', ' ')}</span>
                            <Badge variant="destructive" className="bg-red-600 hover:bg-red-700">RESTRICTED</Badge>
                        </AlertTitle>
                        <AlertDescription className="mt-2 text-sm">
                             <div className="font-semibold mb-1 text-red-800">⚠️ ACTION REQUIRED: TERMINATE ENGAGEMENT</div>
                             <p className="mb-2">Do not book service. Do not provide pricing. Execute the following script immediately:</p>
                             <div className="p-3 bg-white rounded-md border border-red-200 font-mono text-sm text-red-800 italic shadow-inner">
                                 "{script || "Script not found for this chaos type."}"
                             </div>
                             <div className="mt-3 flex justify-between items-center text-xs">
                                 <span className="text-red-700 font-medium flex items-center gap-1">
                                     <Lock className="h-3 w-3" /> Account Locked
                                 </span>
                                 {partner.chaos_override_allowed ? (
                                     <span className="px-2 py-1 bg-green-100 text-green-800 rounded border border-green-200 font-bold cursor-pointer">ADMIN OVERRIDE AVAILABLE</span>
                                 ) : (
                                     <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded border border-gray-200 font-bold">STRICT ENFORCEMENT</span>
                                 )}
                             </div>
                        </AlertDescription>
                    </div>
                </Alert>
            </div>
        );
    }

    // 2. YELLOW STATE: Financial Hold OR At Risk
    // Financial Hold (Overdue > 60 days)
    if (partner.invoice_overdue_days > 60) {
         return (
            <div className="mb-4 animate-in slide-in-from-top-2 duration-300">
                <Alert className="bg-amber-50 border-l-4 border-l-amber-500 border-amber-200 text-amber-900 shadow-sm">
                    <CreditCard className="h-6 w-6 text-amber-600" />
                    <div className="ml-2 w-full">
                        <AlertTitle className="text-lg font-bold flex justify-between items-center">
                            <span>CREDIT HOLD: INVOICE OVERDUE</span>
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white">HOLD</Badge>
                        </AlertTitle>
                        <AlertDescription className="mt-2 text-sm">
                            <p className="mb-1">Partner has invoices <strong>{partner.invoice_overdue_days} days</strong> overdue.</p>
                            <div className="font-bold text-amber-800 mb-2">🛑 STOP: COLLECT PAYMENT BEFORE BOOKING.</div>
                            <div className="p-3 bg-white rounded border border-amber-200 font-mono text-sm text-amber-800 italic shadow-inner">
                                "{script || "I'm showing a past due balance on the account. We need to resolve that before I can schedule this service."}"
                            </div>
                        </AlertDescription>
                    </div>
                </Alert>
            </div>
        );
    }

    // At Risk (Engagement Drop)
    if (partner.partner_status === 'AT_RISK') {
        return (
            <div className="mb-4 animate-in slide-in-from-top-2 duration-300">
                <Alert className="bg-yellow-50 border-l-4 border-l-yellow-400 border-yellow-200 text-yellow-900 shadow-sm">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    <div className="ml-2 w-full">
                        <AlertTitle className="text-lg font-bold flex justify-between items-center">
                            <span>PARTNER AT RISK</span>
                            <Badge variant="outline" className="border-yellow-500 text-yellow-700">WAKE UP PROTOCOL</Badge>
                        </AlertTitle>
                        <AlertDescription className="mt-2 text-sm">
                            <p>Engagement dropping. Last referral was over 60 days ago.</p>
                            <div className="font-bold mt-1 text-yellow-800">🚀 OPPORTUNITY: Offer "swag drop" or "lunch & learn".</div>
                        </AlertDescription>
                    </div>
                </Alert>
            </div>
        );
    }

    // 3. GREEN STATE: System Green
    return (
        <div className="mb-4 animate-in slide-in-from-top-2 duration-300">
            <Alert className="bg-green-50 border-l-4 border-l-green-500 border-green-200 text-green-900 shadow-sm">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div className="ml-2 w-full">
                    <AlertTitle className="text-lg font-bold flex justify-between items-center">
                        <span>SYSTEM GREEN</span>
                        <Badge className="bg-green-600 hover:bg-green-700">ACTIVE</Badge>
                    </AlertTitle>
                    <AlertDescription className="mt-1 text-sm">
                        Partner active and in good standing. Proceed with standard engagement protocols.
                        {partner.last_referral_at && <div className="text-xs text-green-700 mt-1">Last Referral: {new Date(partner.last_referral_at).toLocaleDateString()}</div>}
                    </AlertDescription>
                </div>
            </Alert>
        </div>
    );
};

export default HvacCallConsoleState;