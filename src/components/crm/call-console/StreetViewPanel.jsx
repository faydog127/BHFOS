
import React from 'react';
import { Card } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

const StreetViewPanel = ({ address, city, state, zip }) => {
  const fullAddress = `${address}, ${city}, ${state} ${zip}`;
  
  // Using a placeholder for the demo if no key, but structured to accept the key
  const mapUrl = address 
    ? `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodeURIComponent(fullAddress)}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`
    : null;

  return (
    <Card className="overflow-hidden h-full min-h-[200px] bg-slate-100 relative group">
       {address ? (
         <div className="relative w-full h-full">
            {/* Fallback image if API key is missing or fails */}
            <div className="absolute inset-0 bg-slate-200 flex items-center justify-center">
                <div className="text-center p-4">
                    <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Street View</p>
                    <p className="text-xs text-slate-400 font-mono">{fullAddress}</p>
                </div>
            </div>
            {/* Real Image Layer */}
             <img 
               src={mapUrl} 
               alt={`Street view of ${fullAddress}`}
               className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
               onError={(e) => e.target.style.display = 'none'} 
             />
             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <p className="text-white text-xs font-medium truncate">{address}</p>
             </div>
         </div>
       ) : (
         <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MapPin className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">Select a lead to view property</p>
         </div>
       )}
    </Card>
  );
};

export default StreetViewPanel;
