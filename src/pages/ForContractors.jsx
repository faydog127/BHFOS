import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle, Zap, Shield, FileText, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ForContractors = () => {
    const features = [
        { icon: Award, text: 'NADCA-Aligned Method: Repeatable, defensible hygiene—not blow-and-go.' },
        { icon: FileText, text: 'Photo & Notes: Your dispatcher sees exactly what we did.' },
        { icon: Shield, text: 'No Poaching Policy: Your customer is your customer—period.' },
    ];

    return (
        <>
            <Helmet>
                <title>Trade Partner Program | The Vent Guys</title>
                <meta name="description" content="White-label mechanical hygiene services for HVAC contractors. We handle the airflow mess so your team can focus on installs and service." />
            </Helmet>

            {/* Hero Section */}
            <section className="relative bg-[#091e39] text-white py-20 md:py-24 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url('https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/2ceb8cf2dda5044ec4c2b4ace9213ead.png')`, backgroundSize: '300px', backgroundRepeat: 'repeat' }}></div>
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight title-case">Trade Partner: Mechanical Hygiene You Can Trust</h1>
                        <p className="text-lg text-[#d1d3d4] mb-8 max-w-3xl mx-auto">
                            White-label or co-branded duct and coil hygiene to <Link to="/nadca-standards-air-quality-protection" className="text-white font-semibold hover:underline">NADCA baselines</Link>. We handle the airflow mess—your team stays on installs and service.
                        </p>
                        <Link to="/contact">
                            <Button size="lg" className="bg-[#b52025] hover:bg-[#831618] uppercase tracking-wider">
                                Request a Partner Call
                            </Button>
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-white">
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                            <h2 className="text-4xl md:text-5xl text-[#091e39] mb-6 title-case">An Extension of Your Team</h2>
                            <p className="text-lg text-[#231f20] mb-6">
                                When installs and service tickets pile up, we handle the airflow mess—coils, returns, and drains—so your techs stay on revenue work. We operate white-label or co-branded, follow your scheduling rules, and deliver time-stamped photo proof every time. Our <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] font-semibold hover:underline">mechanical hygiene</Link> process is thorough and reliable.
                            </p>
                            <div className="space-y-4">
                                {features.map((feature, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-center"
                                    >
                                        <feature.icon className="h-6 w-6 text-green-600 mr-3 flex-shrink-0" />
                                        <span className="text-lg text-[#231f20]">{feature.text}</span>
                                    </motion.div>
                                ))}
                            </div>
                             <Link to="/contact" className="mt-8 inline-block">
                                <Button size="lg" className="bg-[#b52025] hover:bg-[#831618] uppercase tracking-wider">
                                    Request a Partner Call
                                </Button>
                            </Link>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                           <img class="rounded-2xl shadow-2xl w-full" alt="Two professional technicians shaking hands in front of an HVAC unit" src="https://images.unsplash.com/photo-1630836260064-00718b9f3c06" />
                        </motion.div>
                    </div>
                </div>
            </section>
            
            {/* CTA Section */}
            <section className="py-20 bg-[#d1d3d4]/50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <h2 className="text-4xl md:text-5xl text-[#091e39] mb-4 title-case">Ready to Partner Up?</h2>
                        <p className="text-lg text-[#231f20] max-w-3xl mx-auto mb-8">
                           Download our vendor packet or schedule a call to discuss how we can support your business with reliable, white-label IAQ services.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/vendor-packet">
                                <Button size="lg" className="bg-[#091e39] hover:bg-[#173861] uppercase tracking-wider">
                                    Download Vendor Packet
                                </Button>
                            </Link>
                            <Link to="/contact">
                                <Button size="lg" variant="outline" className="border-[#b52025] text-[#b52025] hover:bg-[#b52025] hover:text-white uppercase tracking-wider">
                                    Request a Partner Call
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </>
    );
};

export default ForContractors;