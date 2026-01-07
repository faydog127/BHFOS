import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FileText, Shield, CheckCircle, Clock, Camera, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VendorPacket = () => {
    const packetContents = [
        { icon: FileText, text: 'Company overview & SDVOSB statement' },
        { icon: Shield, text: 'Insurance & W-9' },
        { icon: CheckCircle, text: 'NADCA-aligned scope of work (unit-turn + residential)' },
        { icon: Clock, text: '48-Hour SLA terms & rush options' },
        { icon: Camera, text: 'Photo report samples (before/after + notes)' },
    ];

    const handleDownload = () => {
        // In a real app, this would point to the actual PDF file.
        // For now, we can simulate a download or link to a placeholder.
        window.open('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '_blank');
    };

    return (
        <>
            <Helmet>
                <title>Vendor Packet | The Vent Guys</title>
                <meta name="description" content="Download our Clean Air Partnership Packet. Everything you need for your vendor board—SLA, scope, insurance, W-9, and sample photo reports." />
            </Helmet>

            {/* Hero Section */}
            <section className="relative bg-[#091e39] text-white py-20 md:py-24 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url('https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/2ceb8cf2dda5044ec4c2b4ace9213ead.png')`, backgroundSize: '300px', backgroundRepeat: 'repeat' }}></div>
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-5xl md:text-6xl font-bold mb-4 leading-tight title-case">
                        Clean Air Partnership Packet
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-lg text-[#d1d3d4] mb-8 max-w-3xl mx-auto">
                        Everything you need for your vendor board—SLA, scope, insurance, W-9, and sample photo reports.
                    </motion.p>
                </div>
            </section>

            {/* Packet Contents Section */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                            <h2 className="text-4xl md:text-5xl text-[#091e39] mb-6 title-case">What's Inside</h2>
                            <div className="space-y-4">
                                {packetContents.map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-center"
                                    >
                                        <item.icon className="h-6 w-6 text-green-600 mr-3 flex-shrink-0" />
                                        <span className="text-lg text-[#231f20]">{item.text}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }} 
                            whileInView={{ opacity: 1, scale: 1 }} 
                            viewport={{ once: true }} 
                            className="bg-[#d1d3d4]/50 p-8 rounded-xl text-center"
                        >
                            <FileText className="h-24 w-24 text-[#091e39] mx-auto mb-6" />
                            <h3 className="text-2xl text-[#091e39] mb-4 title-case">Ready to Download?</h3>
                            <p className="text-[#231f20] mb-6">Get instant access to our complete vendor packet.</p>
                            <Button onClick={handleDownload} size="lg" className="w-full bg-[#b52025] hover:bg-[#831618] uppercase tracking-wider">
                                <Download className="mr-3 h-5 w-5" /> Download Packet (PDF)
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-[#091e39]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <h2 className="text-4xl md:text-5xl text-white mb-4 title-case">Have Questions?</h2>
                        <p className="text-lg text-[#d1d3d4] max-w-3xl mx-auto mb-8">
                           Let's discuss how our partnership can benefit your properties or projects.
                        </p>
                        <Link to="/contact">
                            <Button size="lg" variant="outline" className="border-[#f1b57b] text-[#f1b57b] hover:bg-[#f1b57b] hover:text-[#091e39] uppercase tracking-wider">
                                Request Program Pricing
                            </Button>
                        </Link>
                    </motion.div>
                </div>
            </section>
        </>
    );
};

export default VendorPacket;