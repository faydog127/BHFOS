import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, Calendar, CheckCircle2, PlayCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const BeforeAfterSet = ({ title, before, after, index }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1 }}
    className="mb-16 last:mb-0"
  >
    <h3 className="text-2xl font-bold text-[#1B263B] mb-6 border-l-4 border-[#D7263D] pl-4">
      {title}
    </h3>
    <div className="grid md:grid-cols-2 gap-8">
      {/* Before Card */}
      <div className="group">
        <div className="relative rounded-xl overflow-hidden shadow-lg border-2 border-red-100 bg-red-50">
          <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold z-10 shadow-md">
            BEFORE
          </div>
          <div className="aspect-[4/3] overflow-hidden">
             {before.image}
          </div>
          <div className="p-6 min-h-[140px] flex items-center">
            <p className="text-red-900 font-medium leading-relaxed">
              <span className="text-2xl mr-2">🚫</span>
              "{before.caption}"
            </p>
          </div>
        </div>
      </div>

      {/* After Card */}
      <div className="group">
        <div className="relative rounded-xl overflow-hidden shadow-lg border-2 border-green-100 bg-green-50">
          <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold z-10 shadow-md">
            AFTER
          </div>
          <div className="aspect-[4/3] overflow-hidden">
            {after.image}
          </div>
          <div className="p-6 min-h-[140px] flex items-center">
            <p className="text-green-900 font-medium leading-relaxed">
              <span className="text-2xl mr-2">✅</span>
              "{after.caption}"
            </p>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

const ScriptRow = ({ time, visual, audio }) => (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-4 rounded-lg">
    <div className="md:col-span-2 font-mono text-sm text-slate-500 font-bold bg-slate-100 rounded px-2 py-1 w-fit h-fit">{time}</div>
    <div className="md:col-span-5 text-slate-700"><span className="font-bold text-[#1B263B] block md:inline mb-1 md:mb-0">Visual:</span> {visual}</div>
    <div className="md:col-span-5 text-slate-600 italic"><span className="font-bold text-[#1B263B] not-italic block md:inline mb-1 md:mb-0">Audio:</span> "{audio}"</div>
  </div>
);

const Gallery = () => {
  const gallerySets = [
    {
      title: "Set 1: Main Trunk Line",
      before: {
        image: <img alt="Dirty HVAC main trunk line with heavy dust buildup inside" src="https://images.unsplash.com/photo-1696853961331-22ed783d24cd" />,
        caption: "Hidden buildup in main trunk line. A shop-vac at the register never reaches this deep."
      },
      after: {
        image: <img alt="Clean shiny metal HVAC trunk line interior" src="https://images.unsplash.com/photo-1574334292321-4844f63aefef" />,
        caption: "Fully extracted using Negative Pressure. 100% bare metal restored. No debris left behind."
      }
    },
    {
      title: "Set 2: Return Vent",
      before: {
        image: <img alt="Dirty return air vent grille clogged with thick grey dust" src="https://images.unsplash.com/photo-1668065267427-f26334a42359" />,
        caption: "Thick dust & allergen matting blocking airflow. This is what your family breathes 24/7."
      },
      after: {
        image: <img alt="Clean white return air vent grille" src="https://images.unsplash.com/photo-1602669020009-362319315840" />,
        caption: "Sanitized and scrubbed. Airflow restored to factory specs. Breathe easier tonight."
      }
    },
    {
      title: "Set 3: Blower Motor",
      before: {
        image: <img alt="HVAC blower motor wheel impacted with dust" src="https://images.unsplash.com/photo-1665722651322-b67bfe892562" />,
        caption: "Impacted blower wheel. This forces your AC to work 30% harder, spiking your electric bill."
      },
      after: {
        image: <img alt="Clean HVAC blower motor wheel" src="https://images.unsplash.com/photo-1505635374747-431af16edaf2" />,
        caption: "Debris mechanically removed. Your system now runs cooler, quieter, and cheaper."
      }
    }
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <Helmet>
        <title>Before & After Gallery - The Vent Guys | Real Results</title>
        <meta name="description" content="See the difference professional NADCA-certified air duct cleaning makes. View before and after photos of trunk lines, return vents, and blower motors." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-[#1B263B] text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1 text-blue-200 text-sm font-medium mb-6">
              <CheckCircle2 className="w-4 h-4" />
              <span>Documented Proof on Every Job</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              The Camera Doesn't Lie
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              We don't just tell you your ducts are clean—we prove it. Here is what "NADCA-compliant cleaning" actually looks like compared to what we find in Brevard County homes.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Before & After Gallery Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          {gallerySets.map((set, index) => (
            <BeforeAfterSet key={index} {...set} index={index} />
          ))}
        </div>
      </section>

      {/* Video Explainer Section */}
      <section className="py-20 bg-white border-y border-slate-200">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-[#D7263D] text-[#D7263D] px-4 py-1 text-sm">
              Educational Breakdown
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-4">
              The Difference Between "Blowing" and "Cleaning"
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Many services just push dust around. We extract it. Here is the breakdown of our process in a 30-second explainer.
            </p>
          </div>

          <Card className="shadow-xl border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-100 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <PlayCircle className="w-6 h-6 text-[#D7263D]" />
                <CardTitle className="text-lg">Video Script Breakdown</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 bg-white p-4 md:p-6">
                <ScriptRow 
                  time="0:00 - 0:05"
                  visual="Split screen: On the left, a cheap 'blow-and-go' tech using a shop vac. On the right, a homeowner looking skeptical at a dusty vent."
                  audio="Most 'cheap' duct cleaners just blow air around. It's like using a leaf blower in your living room."
                />
                <ScriptRow 
                  time="0:05 - 0:12"
                  visual="Animation of dust particles flying out of a vent and settling onto a pristine white sofa and coffee table."
                  audio="That dust doesn't disappear. It just lands right back on your furniture, your food, and in your lungs."
                />
                <ScriptRow 
                  time="0:12 - 0:22"
                  visual="The Vent Guys truck arrives. Tech connects the large Negative Pressure hose to the main trunk. Cut to: Debris being violently sucked into the HEPA containment unit."
                  audio="At The Vent Guys, we use Negative Pressure. We turn your entire duct system into a vacuum, trapping 100% of the debris outside your living space."
                />
                <ScriptRow 
                  time="0:22 - 0:30"
                  visual="Flash of a bright, clean metal duct interior. Tech gives a thumbs up holding a 'Clean Air Certified' report. Logo animation."
                  audio="Real agitation. Real extraction. Real results you can see. Schedule your free air check today."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#1B263B] text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to See Results Like These?
          </h2>
          <p className="text-blue-200 text-xl mb-8 max-w-2xl mx-auto">
            Stop breathing what previous owners left behind. Get a verified, deep clean for your home.
          </p>
          
          <div className="flex flex-col items-center gap-6">
            <Link to="/contact">
              <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white text-lg px-10 py-6 shadow-xl shadow-red-900/20">
                <Calendar className="mr-2 h-5 w-5" />
                Schedule Your Cleaning Today
              </Button>
            </Link>
            
            <a 
              href="tel:3213609704" 
              className="flex items-center gap-2 text-xl font-semibold text-white hover:text-[#D7263D] transition-colors group"
            >
              <div className="bg-white/10 p-3 rounded-full group-hover:bg-white/20 transition-colors">
                <Phone className="h-6 w-6" />
              </div>
              (321) 360-9704
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Gallery;