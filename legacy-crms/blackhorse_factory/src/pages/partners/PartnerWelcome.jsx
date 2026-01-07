import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, Download, Calendar, Smartphone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import confetti from 'canvas-confetti';

const PartnerWelcome = () => {
  const location = useLocation();
  const { discountCode, partnerId } = location.state || {};

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8 text-center">
        
        <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
        </div>

        <h1 className="text-4xl font-bold text-[#1B263B] font-oswald">
            Welcome to the Clean Air Partner Program!
        </h1>
        
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Check your email for your welcome package, access credentials, and next steps.
        </p>

        {discountCode && (
            <Card className="bg-white border-2 border-blue-100 shadow-lg max-w-md mx-auto">
                <CardContent className="p-6">
                    <p className="text-sm text-gray-500 mb-2 uppercase tracking-wider font-semibold">Your Partner Code</p>
                    <div className="text-3xl font-mono font-bold text-[#D7263D] tracking-wider bg-gray-50 py-2 px-4 rounded border border-dashed border-gray-300">
                        {discountCode}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Use this code when booking to unlock your rate.</p>
                </CardContent>
            </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6 mt-12 text-left">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <Smartphone className="w-8 h-8 text-blue-500 mb-4" />
                <h3 className="font-bold text-lg mb-2">1. Concierge Access</h3>
                <p className="text-sm text-gray-600">Save this number: <span className="font-bold text-slate-900">(321) 360-9704</span>. Text or call for priority dispatch.</p>
             </div>
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <Calendar className="w-8 h-8 text-purple-500 mb-4" />
                <h3 className="font-bold text-lg mb-2">2. Onboarding Call</h3>
                <p className="text-sm text-gray-600">Let's set up your portal and billing preferences.</p>
                <Button variant="link" className="p-0 h-auto text-purple-600 mt-2">Book 15-min Call <ArrowRight className="w-3 h-3 ml-1" /></Button>
             </div>
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <Download className="w-8 h-8 text-[#D7263D] mb-4" />
                <h3 className="font-bold text-lg mb-2">3. Partner Kit</h3>
                <p className="text-sm text-gray-600">Download your "Clean Air Certified" marketing assets.</p>
                <Button variant="link" className="p-0 h-auto text-[#D7263D] mt-2">Download PDF <ArrowRight className="w-3 h-3 ml-1" /></Button>
             </div>
        </div>

        <div className="pt-8">
            <Link to="/">
                <Button variant="outline">Return to Home</Button>
            </Link>
        </div>

      </div>
    </div>
  );
};

export default PartnerWelcome;