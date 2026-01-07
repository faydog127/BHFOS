import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ticket, Download, Tag, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const SpecialsSection = () => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        fetchCoupons();
    }, []);

    const fetchCoupons = async () => {
        try {
            const { data, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('is_active', true)
                .gte('valid_until', new Date().toISOString());
            
            if (error) throw error;
            setCoupons(data || []);
        } catch (error) {
            console.error('Failed to load specials:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (coupon) => {
        // Simulate download
        const element = document.createElement("a");
        const file = new Blob(
            [`
------------------------------------------------
THE VENT GUYS - SPECIAL OFFER
------------------------------------------------
Offer: ${coupon.title}
Discount: ${coupon.discount_value}
Details: ${coupon.description}
Code: ${coupon.code}
Valid Until: ${format(new Date(coupon.valid_until), 'MMM d, yyyy')}
------------------------------------------------
Present this coupon at time of service.
www.theventguys.com
            `], 
            {type: 'text/plain'}
        );
        element.href = URL.createObjectURL(file);
        element.download = `TVG_Coupon_${coupon.code}.txt`;
        document.body.appendChild(element);
        element.click();
        
        toast({
            title: "Coupon Downloaded!",
            description: "Present this code to your technician.",
        });
    };

    if (!loading && coupons.length === 0) return null;

    return (
        <section className="py-16 bg-gradient-to-br from-blue-900 via-slate-900 to-black text-white relative overflow-hidden">
             {/* Abstract Shapes */}
             <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-12">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 text-xs font-bold uppercase tracking-wider mb-4">
                        <Tag className="w-3 h-3" /> Limited Time Offers
                    </span>
                    <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">Current Specials</h2>
                    <p className="text-blue-200 max-w-2xl mx-auto text-lg">
                        Take advantage of our seasonal offers to improve your home's air quality for less.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {coupons.map((coupon) => (
                        <div key={coupon.id} className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300">
                            <div className="absolute top-0 right-0 p-4">
                                <Ticket className="w-24 h-24 text-white/5 group-hover:text-white/10 transition-colors rotate-12 transform translate-x-4 -translate-y-4" />
                            </div>
                            
                            <div className="p-6 md:p-8">
                                <div className="text-3xl font-bold text-yellow-400 mb-2">{coupon.discount_value}</div>
                                <h3 className="text-xl font-bold text-white mb-2">{coupon.title}</h3>
                                <p className="text-sm text-blue-200 mb-6 min-h-[40px]">{coupon.description}</p>
                                
                                <div className="flex items-center gap-2 text-xs text-slate-400 mb-6 bg-black/20 w-fit px-3 py-1 rounded-full">
                                    <Clock className="w-3 h-3" />
                                    Expires: {format(new Date(coupon.valid_until), 'MMM d, yyyy')}
                                </div>

                                <div className="border-t border-white/10 pt-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 bg-black/30 rounded-lg p-2 text-center font-mono text-sm font-bold tracking-widest text-white border border-dashed border-white/20 select-all">
                                            {coupon.code}
                                        </div>
                                        <Button onClick={() => handleDownload(coupon)} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white shrink-0">
                                            <Download className="w-4 h-4 mr-2" /> Save
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default SpecialsSection;