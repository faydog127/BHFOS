
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, TestTube, CheckCircle, Calendar, ArrowRight, HelpCircle, BookOpen, Tag, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FaqAccordion from '@/components/FaqAccordion';
import EstimateWizard from '@/components/EstimateWizard';
import SpecialsSection from '@/components/SpecialsSection';
import { allFaqs } from '@/config/faqs';
import { fetchPriceBook, getPriceFromBook, formatPrice } from '@/lib/pricing';

const ServiceFaqs = ({ ids }) => {
    const faqs = allFaqs.filter(faq => ids.includes(faq.id));
    return (
        <div className="mt-12">
            <h3 className="text-2xl font-bold text-[#1B263B] mb-4 flex items-center">
                <HelpCircle className="mr-3 text-[#D7263D]"/>
                Frequently Asked Questions
            </h3>
            <FaqAccordion faqs={faqs} />
            <div className="text-right mt-4">
                <Link to="/faq" className="text-sm font-semibold text-[#D7263D] hover:underline">
                    See all FAQs →
                </Link>
            </div>
        </div>
    );
};

const RelatedReading = ({ links }) => (
    <div className="mt-12 bg-gray-100 p-6 rounded-lg">
        <h3 className="text-2xl font-bold text-[#1B263B] mb-4 flex items-center">
            <BookOpen className="mr-3 text-[#D7263D]"/>
            Related Reading
        </h3>
        <ul className="space-y-3">
            {links.map((link, i) => (
                <li key={i}>
                    <Link to={link.path} className="flex items-center text-gray-700 hover:text-[#D7263D] group">
                        <span className="font-semibold group-hover:underline">{link.title}</span>
                        <ArrowRight className="ml-auto h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"/>
                    </Link>
                </li>
            ))}
        </ul>
    </div>
);

const AirDuctCleaningDetails = ({ startPrice }) => (
    <div className="space-y-6">
       <p className="text-lg text-gray-700 leading-relaxed">
          Professional Air Duct Cleaning — We use negative pressure with HEPA filtration and NADCA-aligned agitation tools to remove dust and debris from the entire system.
          {startPrice && <span className="block mt-2 font-semibold text-blue-700">Packages starting at {startPrice} per system.</span>}
       </p>
  
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
          <div className="font-bold text-[#1B263B] mb-1">Step 1: Prep & Protect</div>
          <div className="text-sm text-gray-600">Booties and drop cloths; floors stay spotless.</div>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
          <div className="font-bold text-[#1B263B] mb-1">Step 2: Negative Pressure</div>
          <div className="text-sm text-gray-600">HEPA vac on trunk line captures 100% of debris.</div>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
          <div className="font-bold text-[#1B263B] mb-1">Step 3: Agitation</div>
          <div className="text-sm text-gray-600">Air whips/brushes scrub every inch of duct walls.</div>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
          <div className="font-bold text-[#1B263B] mb-1">Step 4: Photo Proof</div>
          <div className="text-sm text-gray-600">You see the results before we pack up.</div>
        </div>
      </div>
  
      <div className="flex flex-col sm:flex-row gap-4 pt-2">
         <Link to="/free-air-check">
            <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white w-full sm:w-auto h-12 px-8 text-base">
              Get My Free Air Check
            </Button>
         </Link>
         <Link to="/gallery">
            <Button variant="outline" size="lg" className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 w-full sm:w-auto h-12 px-8 text-base">
              See Before & After Photos
            </Button>
         </Link>
      </div>
    </div>
  );


const Services = () => {
    const [showEstimator, setShowEstimator] = useState(false);
    const [prices, setPrices] = useState({ duct: null, dryer: null, audit: null });

    useEffect(() => {
        const loadPrices = async () => {
            const book = await fetchPriceBook();
            setPrices({
                duct: formatPrice(getPriceFromBook(book, 'DUCT-SYS1', 149)),
                dryer: formatPrice(getPriceFromBook(book, 'DV-STD', 129)),
                audit: formatPrice(getPriceFromBook(book, 'IAQ-AUDIT', 149))
            });
        };
        loadPrices();
    }, []);

    const services = [
        {
            icon: () => <img src="https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/e72bce9f7a2ca70965b162625bec1491.jpg" alt="NADCA Certified Logo" className="h-16"/>,
            title: 'Air Duct Cleaning',
            description: '', 
            benefits: [],
            faqIds: ['q1', 'q2', 'q7', 'q8'],
            relatedLinks: [
                { title: "Learn more about return duct leaks →", path: "/blog/return-duct-leak-attic-air/" },
                { title: "Mechanical Hygiene vs. Air Duct Cleaning", path: "/mechanical-hygiene-vs-duct-cleaning" },
            ],
            image: {
                src: "https://images.unsplash.com/photo-1602075422734-a8a43c7347c2",
                alt: "Diverse technician performing air duct cleaning"
            }
        },
        {
            icon: Flame,
            title: 'Dryer Vent Cleaning',
            badge: prices.dryer ? `Only ${prices.dryer}` : "Online Special",
            description: 'Prevent fire hazards and improve dryer efficiency with our professional dryer vent cleaning. Lint buildup is a leading cause of home fires and can negatively impact your indoor air quality.',
            benefits: [
                'Prevents dryer fires',
                'Reduces drying time',
                'Lowers energy bills',
                'Extends dryer lifespan',
                'Improves air quality'
            ],
            faqIds: ['q5'],
            relatedLinks: [],
            image: {
                src: "https://images.unsplash.com/photo-1581578731548-c64695cc6952",
                alt: "Technician showing a relieved homeowner the amount of lint removed"
            }
        },
        {
            icon: TestTube,
            title: 'IAQ Testing',
            description: `Our Free Air Check and comprehensive indoor air quality testing services (starting at ${prices.audit || '$149'}) identify pollutants, allergens, and contaminants affecting your home's air quality.`,
            benefits: [
                'Identifies air quality issues',
                'Tests for mold and allergens',
                'Measures humidity levels',
                'Detects VOCs and pollutants',
                'Provides actionable solutions'
            ],
            faqIds: ['q3', 'q4', 'q6'],
            relatedLinks: [
                { title: "Understand filter strategy →", path: "/blog/florida-air-filter-guide-merv-cadence/" },
                { title: "The Return Leak Problem", path: "/blog/return-duct-leak-attic-air/" },
                { title: "How NADCA Standards Protect Your Air", path: "/nadca-standards-air-quality-protection" },
            ],
            image: {
                src: "https://images.unsplash.com/photo-1576091160550-2173dba999ef",
                alt: "Asian American couple reviewing an IAQ report"
            }
        }
    ];

    return (
        <>
            <Helmet>
                <title>Services & Pricing | The Vent Guys</title>
                <meta name="description" content="Professional air duct cleaning, dryer vent cleaning, and instant online estimates for Brevard County homes." />
            </Helmet>

            {/* Hero Section */}
            <section className="relative bg-gradient-to-br from-[#1B263B] to-[#2a3f5f] text-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center"
                    >
                        <h1 className="text-4xl md:text-5xl font-bold mb-6">Our Services & Estimator</h1>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            Comprehensive indoor air quality solutions. Get an instant price or learn more about our NADCA-certified process.
                        </p>
                        {/* Button triggers modal */}
                        <div className="mt-8">
                           <Button 
                               size="lg" 
                               className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold text-lg h-14 px-8 shadow-md"
                               onClick={() => setShowEstimator(true)}
                           >
                               <Calculator className="mr-2 h-5 w-5" />
                               Get Your Instant Estimate
                           </Button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Insert Specials Section Here */}
            <SpecialsSection />

            {/* Services Detail Sections */}
            {services.map((service, index) => (
                <section key={index} className={`py-20 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="grid md:grid-cols-2 gap-12 items-start">
                                {/* Text Content */}
                                <div>
                                    <div className="mb-6 flex items-center gap-4">
                                        {service.title === 'Air Duct Cleaning' ? (
                                            <img src="https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/e72bce9f7a2ca70965b162625bec1491.jpg" alt="NADCA Certified Logo" className="h-16" />
                                        ) : (
                                            <service.icon className="h-16 w-16 text-[#D7263D]" />
                                        )}
                                        {service.badge && (
                                            <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full flex items-center border border-green-200 animate-pulse">
                                                <Tag className="w-4 h-4 mr-1" /> {service.badge}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-4">{service.title}</h2>
                                    
                                    {service.title === 'Air Duct Cleaning' ? (
                                        <AirDuctCleaningDetails startPrice={prices.duct} />
                                    ) : (
                                        <>
                                            <p className="text-lg text-gray-700 mb-6">{service.description}</p>
                                            
                                            <div className="mb-8">
                                                <h3 className="text-xl font-bold text-[#1B263B] mb-4">Benefits:</h3>
                                                <ul className="space-y-3">
                                                    {service.benefits.map((benefit, i) => (
                                                        <li key={i} className="flex items-start gap-3">
                                                            <CheckCircle className="h-6 w-6 text-[#4DA6FF] flex-shrink-0 mt-0.5" />
                                                            <span className="text-gray-700">{benefit}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <Link to="/booking">
                                                <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white">
                                                    <Calendar className="mr-2 h-5 w-5" />
                                                    Book Online Now
                                                </Button>
                                            </Link>
                                        </>
                                    )}
                                </div>
                                
                                {/* Image */}
                                <div>
                                    <div className="relative rounded-xl overflow-hidden shadow-xl">
                                        <img className="w-full h-auto aspect-[16/9] object-cover" alt={service.image.alt} src={service.image.src} />
                                        {service.title === 'Air Duct Cleaning' && (
                                            <div className="absolute top-4 left-4 bg-[#4DA6FF] text-white px-4 py-2 rounded-full text-sm font-semibold">Professional Process</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <ServiceFaqs ids={service.faqIds} />
                            {service.relatedLinks.length > 0 && <RelatedReading links={service.relatedLinks} />}
                        </motion.div>
                    </div>
                </section>
            ))}

            <section className="py-20 bg-gradient-to-r from-[#1B263B] to-[#2a3f5f] text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">
                        Ready to Breathe Cleaner Air?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Schedule your professional service today and experience the difference NADCA-certified cleaning makes.
                    </p>
                    <Link to="/contact">
                        <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white px-8 py-6 text-lg font-semibold">
                            <Calendar className="mr-2 h-5 w-5" />
                            Book Your Service
                        </Button>
                    </Link>
                </div>
            </section>

            <EstimateWizard open={showEstimator} onOpenChange={setShowEstimator} />
        </>
    );
};

export default Services;
