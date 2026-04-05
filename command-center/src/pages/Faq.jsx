import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HelpCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FaqAccordion from '@/components/FaqAccordion';
import { allFaqs } from '@/config/faqs';

const FaqPage = () => {
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": allFaqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer.replace(/\[(.*?)\]\(.*?\)/g, '$1') // Strip markdown links for schema
            }
        }))
    };

    return (
        <>
            <Helmet>
                <title>Frequently Asked Questions – The Vent Guys</title>
                <meta name="description" content="Get answers to common questions about mechanical hygiene, air duct cleaning, dryer vent safety, and indoor air quality in Brevard County." />
                <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
            </Helmet>

            <div className="bg-white">
                {/* Hero Section */}
                <section className="relative bg-gradient-to-br from-[#1B263B] to-[#2a3f5f] text-white py-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="text-center"
                        >
                            <HelpCircle className="h-16 w-16 text-[#C2F5E9] mx-auto mb-6" />
                            <h1 className="text-4xl md:text-5xl font-bold mb-6">Frequently Asked Questions</h1>
                            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                                Your guide to air duct cleaning, mechanical hygiene, and healthier indoor air in Brevard County.
                            </p>
                        </motion.div>
                    </div>
                </section>

                {/* FAQ Content */}
                <section className="py-20">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <FaqAccordion faqs={allFaqs} />
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-20 bg-gray-50">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-3xl font-bold text-[#1B263B] mb-4">Still have questions?</h2>
                        <p className="text-lg text-gray-600 mb-8">Our NADCA-certified experts are ready to help. Contact us for a free consultation.</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                           <Link to="/contact">
                                <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white">
                                    Ask Our Experts
                                </Button>
                            </Link>
                             <a href="tel:+13213609704">
                                <Button size="lg" variant="outline" className="border-[#1B263B] text-[#1B263B] hover:bg-[#1B263B] hover:text-white">
                                    <Phone className="mr-2 h-5 w-5" />
                                    (321) 360-9704
                                </Button>
                            </a>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
};

export default FaqPage;