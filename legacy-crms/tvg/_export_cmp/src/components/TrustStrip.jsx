import React from 'react';
import { brandAssets, getCertificationsList } from '@/lib/brandAssets';
import BrandImage from '@/components/BrandImage';
import { ShieldCheck, Award, ThumbsUp } from 'lucide-react';

const TrustStrip = () => {
  const certifications = getCertificationsList();
  const extraBadges = [
    { name: 'Locally Owned', src: brandAssets.certifications.locallyOwned },
  ].filter(badge => Boolean(badge.src));

  return (
    <div className="w-full bg-slate-50 border-y border-slate-200 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          
          {/* Text Section */}
          <div className="text-center md:text-left md:w-1/3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Certified & Trusted
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              We adhere to the highest industry standards for air quality and safety.
            </p>
          </div>

          {/* Certifications Grid */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-8 md:gap-12 md:w-2/3">
            {[...certifications, ...extraBadges].map((cert) => (
              <div key={cert.name} className="flex flex-col items-center group">
                <div className="relative h-16 w-24 md:h-20 md:w-32 grayscale opacity-70 transition-all duration-300 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105">
                  <BrandImage 
                    src={cert.src} 
                    alt={`${cert.name} Certification Logo`}
                    className="object-contain w-full h-full"
                    animate={true}
                  />
                </div>
                <span className="mt-2 text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                  {cert.name}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default TrustStrip;