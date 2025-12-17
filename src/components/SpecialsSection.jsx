import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Sparkles, Tag, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import UrgencyTimer from '@/components/UrgencyTimer';

export default function SpecialsSection() {
  const specials = [
    {
      id: 1,
      icon: Flame,
      badge: "Most Popular",
      badgeColor: "bg-red-500",
      title: "Dryer Vent Cleaning Special",
      originalPrice: "$150",
      specialPrice: "$129",
      savings: "Save $21",
      description: "Complete dryer vent cleaning from connection to termination point. Includes airflow testing and safety inspection.",
      features: [
        "Lint removal from entire vent run",
        "Before & after airflow measurement",
        "Fire safety inspection",
        "Same-day service available"
      ],
      gradient: "from-red-500 to-orange-500",
      cta: "Book Now",
      link: "/booking"
    },
    {
      id: 2,
      icon: Sparkles,
      badge: "Best Value",
      badgeColor: "bg-blue-500",
      title: "NADCA Duct Cleaning Package",
      originalPrice: "$449",
      specialPrice: "$399",
      savings: "Save $50",
      description: "Full NADCA-compliant air duct cleaning with photo documentation. Perfect for homes up to 2,500 sq ft.",
      features: [
        "Negative pressure system",
        "Before & after photos",
        "HEPA filtration",
        "Free air filter upgrade"
      ],
      gradient: "from-blue-500 to-cyan-500",
      cta: "Get Started",
      link: "/booking"
    },
    {
      id: 3,
      icon: CheckCircle,
      badge: "Premium",
      badgeColor: "bg-purple-500",
      title: "Complete Home Package",
      originalPrice: "$649",
      specialPrice: "$549",
      savings: "Save $100",
      description: "Everything your home needs: dryer vent + full duct cleaning + IAQ testing. The ultimate clean air solution.",
      features: [
        "Dryer vent cleaning",
        "Complete duct cleaning",
        "IAQ testing & report",
        "Clean Air Certification"
      ],
      gradient: "from-purple-500 to-pink-500",
      cta: "Book Package",
      link: "/booking"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-block bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
            🎉 Limited Time Offers
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Special Pricing for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">Brevard County</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Professional, photo-verified service at unbeatable prices
          </p>
        </motion.div>

        {/* Timer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <UrgencyTimer endDate="2025-12-31" />
        </motion.div>

        {/* Special Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {specials.map((special, index) => (
            <motion.div
              key={special.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden hover:shadow-2xl transition-all duration-300 group h-full flex flex-col border-2 hover:border-blue-400">
                {/* Gradient Header */}
                <div className={`bg-gradient-to-r ${special.gradient} p-6 text-white relative`}>
                  <div className="absolute top-4 right-4">
                    <div className={`${special.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg`}>
                      {special.badge}
                    </div>
                  </div>

                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                    <special.icon className="w-8 h-8" />
                  </div>

                  <h3 className="text-2xl font-bold mb-2">{special.title}</h3>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-white/60 line-through text-lg">{special.originalPrice}</span>
                    <span className="text-4xl font-bold">{special.specialPrice}</span>
                  </div>
                  <div className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold mt-2">
                    {special.savings}
                  </div>
                </div>

                <CardContent className="p-6 flex-1 flex flex-col">
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    {special.description}
                  </p>

                  <ul className="space-y-3 mb-6 flex-1">
                    {special.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to={special.link} className="block">
                    <Button 
                      size="lg" 
                      className={`w-full bg-gradient-to-r ${special.gradient} hover:opacity-90 text-white font-bold shadow-lg group-hover:shadow-xl transition-all`}
                    >
                      {special.cta}
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Fine Print */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8 text-sm text-gray-500"
        >
          <p>* All prices subject to on-site verification of square footage and system accessibility.</p>
          <p className="mt-1">Online booking required for special pricing. Offers valid through Dec 31, 2025.</p>
        </motion.div>
      </div>
    </section>
  );
}