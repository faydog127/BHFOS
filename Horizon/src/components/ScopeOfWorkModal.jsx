import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ScopeOfWorkModal = ({ open, onOpenChange, onSave, initialScope = [], title = "Air Duct Cleaning Scope" }) => {
    const [components, setComponents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedComponents, setSelectedComponents] = useState({});
    const [quantities, setQuantities] = useState({});
    const { toast } = useToast();

    // Load available components
    useEffect(() => {
        const fetchComponents = async () => {
            const { data, error } = await supabase
                .from('air_duct_components')
                .select('*')
                .order('component_name');
            
            if (error) {
                console.error('Error fetching components:', error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load scope components.' });
            } else {
                setComponents(data || []);
            }
            setLoading(false);
        };

        if (open) {
            fetchComponents();
        }
    }, [open, toast]);

    // Initialize state from initialScope or defaults
    useEffect(() => {
        if (open && components.length > 0) {
            const initSelected = {};
            const initQuantities = {};

            // Default behavior: if initialScope is provided, use it.
            // If empty, maybe select nothing or basic defaults? Let's start clean unless passed.
            if (initialScope && initialScope.length > 0) {
                initialScope.forEach(item => {
                    // Match by name if possible, or create a temporary ID for custom stuff if needed
                    // For now assuming items match DB components by name or ID
                    const comp = components.find(c => c.component_name === item.name || c.component_id === item.id);
                    if (comp) {
                        initSelected[comp.component_id] = true;
                        initQuantities[comp.component_id] = item.quantity || 1;
                    }
                });
            }

            setSelectedComponents(initSelected);
            setQuantities(initQuantities);
        }
    }, [open, components, initialScope]);

    const handleToggle = (id) => {
        setSelectedComponents(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
        
        // Initialize quantity to 1 if selecting for first time
        if (!selectedComponents[id] && !quantities[id]) {
            setQuantities(prev => ({ ...prev, [id]: 1 }));
        }
    };

    const handleQuantityChange = (id, val) => {
        const qty = parseInt(val) || 0;
        setQuantities(prev => ({
            ...prev,
            [id]: Math.max(0, qty)
        }));
    };

    const calculateTotal = () => {
        let total = 0;
        components.forEach(comp => {
            if (selectedComponents[comp.component_id]) {
                const qty = quantities[comp.component_id] || 1;
                total += (comp.base_price * qty);
            }
        });
        return total;
    };

    const handleSave = () => {
        const scopeItems = components
            .filter(comp => selectedComponents[comp.component_id])
            .map(comp => ({
                id: comp.component_id,
                name: comp.component_name,
                description: comp.description,
                base_price: comp.base_price,
                quantity: quantities[comp.component_id] || 1,
                total: comp.base_price * (quantities[comp.component_id] || 1)
            }));

        onSave(scopeItems, calculateTotal());
        onOpenChange(false);
    };

    const currentTotal = calculateTotal();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Select the components included in this service to build the scope of work.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <div className="space-y-4">
                            {components.map(comp => (
                                <div key={comp.component_id} className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${selectedComponents[comp.component_id] ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-slate-200'}`}>
                                    <Checkbox 
                                        id={`comp-${comp.component_id}`} 
                                        checked={!!selectedComponents[comp.component_id]}
                                        onCheckedChange={() => handleToggle(comp.component_id)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor={`comp-${comp.component_id}`} className="font-semibold text-base cursor-pointer">
                                                {comp.component_name}
                                            </Label>
                                            <span className="text-sm font-medium text-slate-600">
                                                ${comp.base_price} {comp.component_name === 'Supply Registers' || comp.component_name === 'Return Grilles' || comp.component_name === 'Branch Ducts' ? '/ ea' : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{comp.description}</p>
                                        
                                        {selectedComponents[comp.component_id] && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <Label className="text-xs">Quantity:</Label>
                                                <Input 
                                                    type="number" 
                                                    min="1" 
                                                    className="h-8 w-20 text-center" 
                                                    value={quantities[comp.component_id] || 1}
                                                    onChange={(e) => handleQuantityChange(comp.component_id, e.target.value)}
                                                />
                                                <div className="ml-auto font-bold text-sm text-blue-700">
                                                    ${(comp.base_price * (quantities[comp.component_id] || 1)).toFixed(2)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t pt-4 mt-2">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-bold text-slate-700">Total Scope Value</span>
                        <span className="text-xl font-bold text-blue-600">${currentTotal.toFixed(2)}</span>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                            Save Scope
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ScopeOfWorkModal;