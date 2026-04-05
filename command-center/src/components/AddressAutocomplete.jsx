import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AddressAutocomplete = ({ 
  value, 
  onChange, 
  onAddressSelect, 
  className, 
  placeholder, 
  disabled, 
  ...props 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!value || value.length < 3 || !showSuggestions) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error: funcError } = await supabase.functions.invoke('google-places', {
          body: { action: 'autocomplete', input: value }
        });

        if (funcError) throw funcError;
        if (data?.error) throw new Error(data.error);

        if (data?.predictions) {
          setSuggestions(data.predictions);
        } else {
            setSuggestions([]);
        }
      } catch (err) {
        console.error("[AddressAutocomplete] Autocomplete Error:", err);
        setSuggestions([]); 
      } finally {
        setLoading(false);
      }
    }, 500); 

    return () => clearTimeout(timer);
  }, [value, showSuggestions]);

  const handleInputChange = (e) => {
    onChange(e);
    setShowSuggestions(true);
    setError(null);
  };

  const handleSelect = async (prediction) => {
    setShowSuggestions(false);
    
    // Optimistic update
    const event = { target: { value: prediction.description, name: props.name || 'address' } };
    onChange(event);

    setLoading(true);
    setError(null);

    try {
      const { data, error: funcError } = await supabase.functions.invoke('google-places', {
        body: { action: 'details', place_id: prediction.place_id }
      });

      if (funcError) throw funcError;
      if (data?.error) throw new Error(data.error);

      console.log("[AddressAutocomplete] Raw Details:", data);

      // Parse Address Components
      let streetNumber = '';
      let route = '';
      let city = '';
      let state = '';
      let zip = '';
      
      if (data.address_components) {
        data.address_components.forEach(comp => {
          if (comp.types.includes('street_number')) streetNumber = comp.long_name;
          if (comp.types.includes('route')) route = comp.long_name;
          if (comp.types.includes('locality')) city = comp.long_name;
          if (comp.types.includes('administrative_area_level_1')) state = comp.short_name; // Use 2-letter code
          if (comp.types.includes('postal_code')) zip = comp.long_name;
        });
      }

      const streetAddress = `${streetNumber} ${route}`.trim() || prediction.description.split(',')[0];

      if (onAddressSelect) {
        onAddressSelect({
          formatted_address: data.formatted_address || prediction.description,
          street: streetAddress, // Clean street address for DB
          city: city || '',
          state: state || '',
          zip: zip || '',
          placePhotoUrl: data.placePhotoUrl,
          location: data.location,
          address_components: data.address_components
        });
        
        if (!data.placePhotoUrl) {
            // Optional: toast warning
        }
      }
    } catch (err) {
      console.error("[AddressAutocomplete] Details Fetch Error:", err);
      setError("Could not load property details.");
      
      // Fallback
      if (onAddressSelect) {
          onAddressSelect({
              formatted_address: prediction.description,
              street: prediction.description.split(',')[0],
              city: '',
              state: '',
              zip: '',
              placePhotoUrl: null,
              location: null,
              address_components: []
          });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={() => value?.length > 2 && setShowSuggestions(true)}
          disabled={disabled}
          className={`pl-9 ${error ? 'border-red-300 focus-visible:ring-red-300' : ''} ${className || ''}`}
          placeholder={placeholder || "Enter property address"}
          autoComplete="off"
          type="text"
          {...props}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
           {loading ? (
             <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
           ) : error ? (
             <AlertCircle className="h-4 w-4 text-red-500" />
           ) : (
             <MapPin className="h-4 w-4 text-gray-400" />
           )}
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((prediction) => (
            <li
              key={prediction.place_id}
              onClick={() => handleSelect(prediction)}
              className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700 flex items-center gap-2"
            >
              <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{prediction.description}</span>
            </li>
          ))}
          <li className="px-2 py-1 text-[10px] text-right text-slate-400 bg-slate-50 border-t">
             Powered by Google
          </li>
        </ul>
      )}
      {error && (
          <div className="absolute z-50 w-full bg-white border border-red-300 rounded-md shadow-lg mt-1 px-4 py-2 text-xs text-red-700">
              {error}
          </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;