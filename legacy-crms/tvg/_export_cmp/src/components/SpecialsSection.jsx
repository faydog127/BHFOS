
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Timer, ArrowRight, ShieldCheck, Flame, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EstimateWizard from '@/components/EstimateWizard';
import { fetchPriceBook, getPriceFromBook, formatPrice } from '@/lib/pricing';

const SpecialsSection = () => {
  const [showWizard, setShowWizard] = useState(false);
  const [prices, setPrices] = useState({
    dryer: 129, // Default fallback
    duct: 149,  // Default fallback
    bundle: 249 // Default fallback
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPrices = async () => {
      const book = await fetchPriceBook();
      
      // Get base prices
      const dryerBase = getPriceFromBook(book, 'DV-STD', 129);
      const ductBase = getPriceFromBook(book, 'DUCT-SYS1', 149);
      
      // Calculate a bundle example (mock logic if no explicit bundle SKU exists)
      // If there's a specific SKU for a bundle, use that. Otherwise, sum - discount.
      // Let's assume we want to show the "Better" package start price or a specific deal.
      // For now, let's just use the logic of (Duct + Dryer) - $30
      const bundlePrice = (dryerBase + ductBase) - 30;

      setPrices({
        dryer: dryerBase,
        duct: ductBase,
        bundle: bundlePrice
      });
      setLoading(false);
    };

    loadPrices();
  }, []);

  const offers = [
    {
      id: 'dryer-special',
      title: "Dryer Vent Safety Clean",
      price: prices.dryer,
      originalPrice: prices.dryer + 30, // Mock original
      description: "Prevent fires & reduce drying time. Includes airflow test.",
      icon: Flame,
      color: "orange",
      link: "/services"
    },
    {
      id: 'duct-special',
      title: "Whole Home Air Duct Cleaning",
      price: prices.duct,
      originalPrice: prices.duct + 50, // Mock original
      description: "Remove dust & allergens. Includes free sanitizer treatment.",
      icon: Wind,
      color: "blue",
      popular: true,
      link: "/services"
    },
    {
      id: 'bundle-special',
      title: "Ultimate Home Detox Bundle",
      price: prices.bundle,
      originalPrice: prices.bundle + 80, // Mock original
      description: "Combine Air Duct + Dryer Vent cleaning for maximum savings.",
      icon: ShieldCheck,
      color: "purple",
      link: "/services"
    }
  ];

  return (
    <section className="py-12 bg-white border-y border-slate-100">
      <div className="container mx-auto px-4">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-red-600 font-bold uppercase tracking-wider text-sm mb-1">
              <Timer className="w-4 h-4" /> Limited Time Offers
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Current Specials</h2>
          </div>
          {/* Removed: "View Full Price List" link */}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {offers.map((offer, index) => (
            <motion.div 
              key={offer.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl p-6 border ${offer.popular ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200'} bg-white hover:shadow-xl transition-all group`}
            >
              {offer.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  MOST POPULAR
                </div>
              )}

              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-${offer.color}-50 text-${offer.color}-600 group-hover:scale-110 transition-transform`}>
                <offer.icon className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">{offer.title}</h3>
              <p className="text-slate-500 text-sm mb-4 min-h-[40px]">{offer.description}</p>
              
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-3xl font-bold text-slate-900">
                  {loading ? "..." : formatPrice(offer.price)}
                </span>
                <span className="text-sm text-slate-400 line-through decoration-slate-400/50">
                   {loading ? "" : formatPrice(offer.originalPrice)}
                </span>
              </div>

              <Button 
                onClick={() => setShowWizard(true)}
                className={`w-full ${offer.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                Get This Deal
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Removed: Mobile "View Full Price List" link */}
      </div>

      <EstimateWizard open={showWizard} onOpenChange={setShowWizard} />
    </section>
  );
};

export default SpecialsSection;
