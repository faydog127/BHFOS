import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, ArrowUpCircle, Hash } from 'lucide-react';
import { SERVICE_CATALOG } from '@/lib/serviceCatalog';

const ServicePicker = ({ open, onOpenChange, onSelect, currentServices }) => {
  const currentServiceIds = currentServices.map(s => s.code || s.id);
  
  // Local state for vent quantities by service ID
  const [ventQuantities, setVentQuantities] = useState({});

  const handleQuantityChange = (serviceId, value) => {
      setVentQuantities(prev => ({
          ...prev,
          [serviceId]: parseInt(value) || 1
      }));
  };

  const getUpgradeInfo = (service) => {
    if (!service.upgrades_from) return null;
    const upgradeBase = service.upgrades_from.find(fromId => currentServiceIds.some(csId => csId === fromId || csId.includes(fromId)));
    if (!upgradeBase) return null;
    
    // Find the existing item to calculate price diff
    const existingItem = currentServices.find(s => (s.code === upgradeBase || s.id === upgradeBase));
    const priceDiff = service.price - (existingItem ? (existingItem.unitPrice || 0) : 0);
    
    return {
      isUpgrade: true,
      upgradeBaseName: existingItem ? existingItem.name : 'Current Service',
      priceDiff: Math.max(0, priceDiff)
    };
  };

  const handleSelectService = (service, upgradeInfo) => {
      // Check if vent quantity is needed
      const ventQty = ventQuantities[service.id] || 1;
      
      // Pass vent quantity in metadata
      onSelect(service, upgradeInfo, { vent_quantity: service.pricing_model === 'per_vent' ? ventQty : undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add or Upgrade Services</DialogTitle>
          <DialogDescription>Select services to add to this estimate.</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
          {SERVICE_CATALOG.map((service) => {
            const isSelected = currentServiceIds.includes(service.id);
            const upgradeInfo = getUpgradeInfo(service);
            const isVentBased = service.pricing_model === 'per_vent';
            const currentVentQty = ventQuantities[service.id] || 1;

            return (
              <div 
                key={service.id} 
                className={`p-4 border rounded-xl flex flex-col justify-between transition-all ${isSelected ? 'bg-slate-50 border-slate-300 opacity-60' : 'hover:border-blue-400 hover:shadow-sm bg-white'}`}
              >
                <div onClick={() => !isSelected && !isVentBased && handleSelectService(service, upgradeInfo)} className={!isSelected && !isVentBased ? "cursor-pointer" : ""}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-900">{service.name}</h4>
                    <Badge variant="outline" className="text-xs uppercase">{service.category}</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mb-2">{service.description}</p>
                </div>

                <div className="mt-auto space-y-3">
                   {/* Vent Quantity Input for specific services */}
                   {!isSelected && isVentBased && (
                       <div className="bg-slate-50 p-2 rounded border border-slate-200">
                           <Label className="text-xs text-slate-500 mb-1 block">Number of Vents/Units</Label>
                           <div className="flex items-center gap-2">
                               <Hash className="w-4 h-4 text-slate-400" />
                               <Input 
                                   type="number" 
                                   min="1" 
                                   className="h-8 bg-white" 
                                   value={currentVentQty}
                                   onChange={(e) => handleQuantityChange(service.id, e.target.value)}
                               />
                               <div className="text-xs font-mono text-slate-600 whitespace-nowrap">
                                   x ${service.price} = <span className="font-bold">${service.price * currentVentQty}</span>
                               </div>
                           </div>
                       </div>
                   )}

                   {isSelected ? (
                       <div className="flex items-center text-slate-500 font-medium text-sm pt-2">
                           <CheckCircle2 className="w-4 h-4 mr-2" /> Already Added
                       </div>
                   ) : upgradeInfo ? (
                       <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                           <div className="text-xs text-blue-600 font-semibold mb-1 flex items-center">
                              <ArrowUpCircle className="w-3 h-3 mr-1" /> Upgrade from {upgradeInfo.upgradeBaseName}
                           </div>
                           <div className="flex justify-between items-end">
                               <div className="text-lg font-bold text-blue-700">
                                   +${isVentBased ? (service.price * currentVentQty) : upgradeInfo.priceDiff}
                               </div>
                               <Button 
                                    size="sm" 
                                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                    onClick={() => handleSelectService(service, upgradeInfo)}
                                >
                                    Select Upgrade
                                </Button>
                           </div>
                       </div>
                   ) : (
                       <div className="flex justify-between items-end pt-2 border-t mt-2">
                           <div className="text-lg font-bold text-slate-900">
                               ${isVentBased ? (service.price * currentVentQty) : service.price}
                               {isVentBased && <span className="text-xs font-normal text-slate-500 ml-1">total</span>}
                           </div>
                           <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8"
                                onClick={() => handleSelectService(service, upgradeInfo)}
                            >
                                Add Service
                            </Button>
                       </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServicePicker;