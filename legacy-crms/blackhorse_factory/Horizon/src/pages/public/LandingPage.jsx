import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { CheckCircle2, Star, ShieldCheck, Clock, MapPin, Phone } from 'lucide-react';
import LeadCaptureForm from '@/components/marketing/LeadCaptureForm';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const LandingPage = () => {
    const { slug } = useParams();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchPage = async () => {
            try {
                const { data, error } = await supabase
                    .from('landing_pages')
                    .select('*')
                    .eq('slug', slug)
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Not found');
                
                setPageData(data);
            } catch (err) {
                console.error(err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (slug) fetchPage();
    }, [slug]);

    if (loading) return <LandingPageSkeleton />;
    if (error || !pageData) return <Navigate to="/" replace />;

    const primaryColor = pageData.primary_color || '#2563eb';
    
    // Inline styles for dynamic colors from DB
    const heroStyle = {
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(${pageData.background_image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Helmet>
                <title>{pageData.title} | The Vent Guys</title>
                <meta name="description" content={pageData.subheadline} />
            </Helmet>

            {/* Sticky Header */}
            <header className="bg-white shadow-sm sticky top-0 z-50 py-3">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="font-bold text-xl md:text-2xl text-slate-900 tracking-tight font-oswald">
                        THE VENT GUYS
                    </div>
                    <a href="tel:3213609704" className="flex items-center gap-2 text-slate-700 font-bold hover:text-blue-600 transition-colors">
                        <Phone className="w-5 h-5 text-blue-600" />
                        <span className="hidden sm:inline">(321) 360-9704</span>
                        <span className="sm:hidden">Call Now</span>
                    </a>
                </div>
            </header>

            {/* Hero Section */}
            <section style={heroStyle} className="relative text-white py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col lg:flex-row gap-12 items-center max-w-6xl mx-auto">
                        
                        {/* Left: Copy */}
                        <div className="flex-1 text-center lg:text-left space-y-6">
                            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-bold border border-white/30 text-white shadow-sm mx-auto lg:mx-0">
                                <MapPin className="w-4 h-4" /> Serving Brevard County
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                                {pageData.headline}
                            </h1>
                            <p className="text-xl md:text-2xl text-slate-200 font-light leading-relaxed">
                                {pageData.subheadline}
                            </p>
                            
                            {/* Trust Badges */}
                            <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-4 opacity-90">
                                <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded">
                                    <ShieldCheck className="w-5 h-5 text-green-400" />
                                    <span className="text-sm font-bold">Licensed & Insured</span>
                                </div>
                                <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded">
                                    <Clock className="w-5 h-5 text-blue-400" />
                                    <span className="text-sm font-bold">48-Hour SLA</span>
                                </div>
                                <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded">
                                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                    <span className="text-sm font-bold">4.9/5 Rated</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Form */}
                        <div className="w-full max-w-md">
                            <Card className="shadow-2xl border-0 overflow-hidden">
                                <div className="bg-slate-900 p-4 text-center border-b border-slate-800">
                                    <h3 className="text-xl font-bold text-white">Get Your Free Quote</h3>
                                    <p className="text-sm text-slate-400">Takes less than 30 seconds</p>
                                </div>
                                <CardContent className="p-6 bg-white">
                                    <LeadCaptureForm 
                                        landingPageId={pageData.id} 
                                        buttonText={pageData.cta_text}
                                        buttonColor={`bg-[${primaryColor}] hover:opacity-90`} // Note: Tailwind JIT might miss dynamic classes, ideally map colors
                                        onSuccess={() => window.location.href = '/thank-you'}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </section>

            {/* Social Proof / Features */}
            <section className="py-16 bg-white">
                <div className="container mx-auto px-4 max-w-5xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Homeowners Trust Us</h2>
                        <div className="w-20 h-1 bg-blue-600 mx-auto rounded-full"></div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard 
                            icon={<Star className="w-8 h-8 text-yellow-500" />}
                            title="Top Rated Service"
                            description="Hundreds of 5-star reviews from neighbors in Melbourne, Viera, and Palm Bay."
                        />
                        <FeatureCard 
                            icon={<ShieldCheck className="w-8 h-8 text-green-500" />}
                            title="NADCA Certified"
                            description="We adhere to strict standards. No shortcuts, just thorough cleaning for your health."
                        />
                        <FeatureCard 
                            icon={<CheckCircle2 className="w-8 h-8 text-blue-500" />}
                            title="Photo Verification"
                            description="We prove our work with before & after photos of your actual ducts."
                        />
                    </div>
                </div>
            </section>

            {/* Testimonials Snippet */}
            <section className="py-16 bg-slate-50 border-t border-slate-200">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <div className="flex justify-center mb-6">
                         {[1,2,3,4,5].map(i => <Star key={i} className="w-6 h-6 text-yellow-400 fill-yellow-400" />)}
                    </div>
                    <blockquote className="text-2xl font-light italic text-slate-700 mb-6">
                        "The technician was professional, on time, and showed me exactly what came out of my dryer vent. I feel so much safer now!"
                    </blockquote>
                    <cite className="font-bold text-slate-900 not-italic block">– Jennifer M., Viera, FL</cite>
                </div>
            </section>

            {/* Footer Simple */}
            <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
                <div className="container mx-auto px-4">
                    <p>&copy; {new Date().getFullYear()} The Vent Guys. All rights reserved.</p>
                    <div className="mt-2 space-x-4">
                        <a href="/privacy" className="hover:text-white">Privacy Policy</a>
                        <span>|</span>
                        <a href="/terms-of-service" className="hover:text-white">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }) => (
    <div className="text-center p-6 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
        <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600">{description}</p>
    </div>
);

const LandingPageSkeleton = () => (
    <div className="min-h-screen bg-slate-50">
        <div className="h-16 bg-white shadow-sm mb-0"></div>
        <div className="h-[600px] bg-slate-200 animate-pulse relative">
            <div className="container mx-auto px-4 pt-32">
                <div className="max-w-2xl">
                    <Skeleton className="h-16 w-3/4 mb-4 bg-slate-300" />
                    <Skeleton className="h-8 w-1/2 mb-8 bg-slate-300" />
                </div>
            </div>
        </div>
    </div>
);

export default LandingPage;