import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Mic, BookOpen, Phone } from 'lucide-react';

const TechTalkTrack = ({ scenario = 'normal', packageLevel = 'better' }) => {
  // Content Logic based on Props
  const isMold = scenario === 'mold';
  const isBetter = packageLevel === 'better';
  const isBest = packageLevel === 'best';
  const isGood = packageLevel === 'good';

  return (
    <div className="h-full border-l border-slate-200 bg-slate-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
           <Mic className="w-5 h-5 text-blue-600" />
           <span>Tech Talk Track</span>
        </div>
        <Badge variant={isMold ? "destructive" : "secondary"}>
           {isMold ? "⚠️ MOLD PROTOCOL" : "NORMAL PROTOCOL"}
        </Badge>
      </div>

      <div className="space-y-6">
        {/* NEW: PHONE SCRIPT SECTION */}
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="py-3 px-4 bg-slate-100">
            <CardTitle className="text-sm uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
              <Phone className="w-4 h-4" /> Pricing Explanation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-slate-700 leading-relaxed text-sm">
            <p>
              "Our premium cleaning includes the first 12 vents and 1 return per system, which is what we see in most 
              3-bedroom Florida homes. If you've got a bigger layout with more vents, it's just $20 per extra vent 
              and $40 per extra return, and we'll count those with you before we start so there are no surprises."
            </p>
          </CardContent>
        </Card>

        {/* SECTION 1: FINDINGS */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="py-3 px-4 bg-slate-100">
            <CardTitle className="text-sm uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Step 1: The Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-slate-700 leading-relaxed text-sm">
            {isMold ? (
              <p>
                "Mr./Ms. Customer, upon inspecting the plenum and blower wheel, I found evidence of 
                <strong> organic growth and microbial activity</strong>. This is likely due to humidity issues 
                interacting with the dust layer. Because this is a biological contaminant, standard removal 
                isn't enough—we need to treat the surface."
              </p>
            ) : (
              <p>
                "Mr./Ms. Customer, the inspection shows a <strong>moderate buildup of dust and debris</strong> 
                throughout the return lines. The good news is the system integrity looks solid, but this 
                buildup is restricting airflow and acting as a sponge for odors and allergens."
              </p>
            )}
          </CardContent>
        </Card>

        {/* SECTION 2: THE FRAMEWORK */}
        <Card className="border-l-4 border-l-indigo-500 shadow-sm">
          <CardHeader className="py-3 px-4 bg-slate-100">
            <CardTitle className="text-sm uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
               <BookOpen className="w-4 h-4" /> Step 2: The Solution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-slate-700 leading-relaxed text-sm">
            {isMold ? (
               <p>
                 "To fix this permanently, we can't just 'sweep' it out. We need to use our 
                 <strong> Source Removal & Sterilization</strong> process. This includes physical cleaning 
                 followed by a coil-safe UV treatment to ensure the air passing through is sterile."
               </p>
            ) : (
               <p>
                 "To restore factory airflow, we use <strong>Negative Pressure Source Removal</strong>. 
                 We hook up a vacuum to the main trunk and use agitation tools to pull everything out 
                 safely without contaminating your living space."
               </p>
            )}
          </CardContent>
        </Card>

        {/* SECTION 3: RECOMMENDATION (DYNAMIC) */}
        <Card className={`border-l-4 shadow-sm ${isMold ? 'border-l-red-500' : 'border-l-green-500'}`}>
          <CardHeader className="py-3 px-4 bg-slate-100">
            <CardTitle className="text-sm uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4" /> Step 3: Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-slate-700 leading-relaxed text-sm">
            {isGood && !isMold && (
              <p>
                "Based on the light usage, the <strong>Good Level</strong> is a solid choice. It gets the 
                ducts clean and sanitizes the system. It's our most popular maintenance option."
              </p>
            )}
            {(isBetter || (isGood && isMold)) && (
              <p>
                "I strongly recommend the <strong>Better Level</strong>. {isMold ? "Because of the growth found, we need the UV light to prevent it from coming back." : "It includes the blower motor cleaning which is the heart of your system."} This package gives you the best protection against future buildup."
              </p>
            )}
            {isBest && (
              <p>
                "For complete peace of mind, the <strong>Best Level</strong> is the way to go. It restores the entire mechanical side 
                to like-new condition with the PCO unit, which actively scrubs viruses from the air 24/7. 
                Plus, it includes your next year's check-up."
              </p>
            )}
          </CardContent>
        </Card>

        {/* ALERTS */}
        {isMold && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Technician Note</AlertTitle>
            <AlertDescription>
              Do not sell "Good" package when active mold is present. It is a liability risk.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default TechTalkTrack;