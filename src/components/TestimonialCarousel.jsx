import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';

const testimonials = [
  {
    id: 1,
    name: "Sarah M.",
    location: "Melbourne, FL",
    text: "I thought our ducts were clean. Then John showed me the camera footage. I was HORRIFIED. They removed a garbage bag worth of dust! My daughter's allergies cleared up within a week.",
    rating: 5,
    service: "Air Duct Cleaning",
    image: "https://i.pravatar.cc/150?img=5",
    verified: true
  },
  {
    id: 2,
    name: "Mike T.",
    location: "Viera, FL",  
    text: "Our electric bill dropped $30/month after they cleaned our system. Paid for itself in 6 months! The before and after photos were shocking.",
    rating: 5,
    service: "Full System Clean",
    image: "https://i.pravatar.cc/150?img=12",
    verified: true
  },
  {
    id: 3,
    name: "Jennifer & Carlos R.",
    location: "Suntree, FL",
    text: "We called them for a dryer vent cleaning after our clothes kept taking 2 cycles to dry. They pulled out so much lint it was scary. Now our dryer works like new and we have peace of mind.",
    rating: 5,
    service: "Dryer Vent Cleaning",
    image: "https://i.pravatar.cc/150?img=8",
    verified: true
  },
  {
    id: 4,
    name: "Tom H.",
    location: "Rockledge, FL",
    text: "As a property manager, I've worked with a lot of duct cleaners. The Vent Guys are the ONLY ones who actually follow NADCA standards. I recommend them to all my tenants now.",
    rating: 5,
    service: "Property Management",
    image: "https://i.pravatar.cc/150?img=15",
    verified: true
  },
  {
    id: 5,
    name: "Amanda K.",
    location: "Palm Bay, FL",
    text: "Honest, professional, and thorough. They didn't try to upsell me on anything I didn't need. The free air check showed me exactly what needed to be done. Highly recommend!",
    rating: 5,
    service: "Free Air Check",
    image: "https://i.pravatar.cc/150?img=9",
    verified: true
  }
];

export default function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [current]);

  const handleNext = () => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  return (
    <section className="py-20 bg-gradient-to-b from-blue-900 to-slate-900 text-white relative overflow-hidden">
      {/* Floating Particles Background */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
        }
        .animate-float {
          animation: float ease-in-out infinite;
        }
      `}</style>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-block bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold mb-4">
            ⭐ 4.9/5 from 487 Reviews
          </div>
          <h2 className="text-4xl font-bold mb-2">Brevard Families Love Us</h2>
          <p className="text-blue-200">Real customers. Real results. Real relief.</p>
        </motion.div>

        <div className="max-w-4xl mx-auto relative">
          {/* Testimonial Card */}
          <div className="relative h-[400px] sm:h-[350px]">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={current}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="absolute w-full"
              >
                <div className="bg-white text-gray-900 rounded-2xl p-8 md:p-12 shadow-2xl">
                  {/* Quote Icon */}
                  <Quote className="w-12 h-12 text-blue-200 mb-4" />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-blue-600 shadow-lg flex-shrink-0">
                      <img 
                        src={testimonials[current].image} 
                        alt={testimonials[current].name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-bold text-lg">{testimonials[current].name}</div>
                        {testimonials[current].verified && (
                          <div className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            ✓ Verified
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mb-2">{testimonials[current].location}</div>
                      <div className="flex text-yellow-400">
                        {[...Array(testimonials[current].rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-xl leading-relaxed text-gray-700 mb-6 italic">
                    "{testimonials[current].text}"
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                      {testimonials[current].service}
                    </div>
                    <div className="text-xs text-gray-400">
                      Posted on Google Reviews
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex justify-center gap-4 mt-8">
            <Button
              onClick={handlePrev}
              variant="ghost"
              size="icon"
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border-2 border-white/20 transition-all hover:scale-110"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button
              onClick={handleNext}
              variant="ghost"
              size="icon"
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border-2 border-white/20 transition-all hover:scale-110"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > current ? 1 : -1);
                  setCurrent(i);
                }}
                className={`h-2 rounded-full transition-all ${
                  i === current ? 'bg-white w-8' : 'bg-white/30 w-2 hover:bg-white/50'
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}