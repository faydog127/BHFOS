import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Calculator, TrendingUp, Check, ArrowRight, Building2, Wallet } from 'lucide-react';
import { calculateVolumeDiscount, fetchVolumeTiers, DEFAULT_TIERS } from '@/lib/volumeDiscountUtils';

const VolumeCalculator = () => {
    const [units, setUnits] = useState(15);
    const [tiers, setTiers] = useState(DEFAULT_TIERS);
    const [calculation, setCalculation] = useState(null);

    // Base assumption for a Property Manager
    const BASE_DISCOUNT = 15; // 15% Standard PM Discount

    useEffect(() => {
        // Load real tiers if possible, else use defaults
        const load = async () => {
            const t = await fetchVolumeTiers();
            setTiers(t);
        };
        load();
    }, []);

    useEffect(() => {
        const result = calculateVolumeDiscount(units, tiers);
        setCalculation(result);
    }, [units, tiers]);

    const handleSliderChange = (vals) => {
        setUnits(vals[0]);
    };

    if (!calculation) return null;

    const totalDiscount = BASE_DISCOUNT + calculation.bonusPercent;
    
    // Estimate savings (assuming avg job $300)
    const AVG_JOB = 300;
    const monthlySpend = units * 0.1 * AVG_JOB; // Assume 10% of units need service/mo
    const monthlySavings = monthlySpend * (totalDiscount / 100);

    return (
        <Card className="w-full bg-white shadow-xl border-slate-200 overflow-hidden">
            <div className="bg-[#1B263B] p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-600 rounded-lg">
                        <Calculator className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold font-oswald">Volume Savings Calculator</h3>
                        <p className="text-blue-200 text-sm">See how much you save with our tiered partnership.</p>
                    </div>
                </div>
            </div>
            
            <CardContent className="p-6 md:p-8 space-y-8">
                {/* Input Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <label className="text-sm font-medium text-slate-700">
                            Monthly Service Volume (Jobs/Units)
                        </label>
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            <Input 
                                type="number" 
                                value={units} 
                                onChange={(e) => setUnits(parseInt(e.target.value) || 0)}
                                className="w-24 text-right font-bold text-lg"
                            />
                        </div>
                    </div>
                    <Slider 
                        value={[units]} 
                        max={150} 
                        step={1} 
                        onValueChange={handleSliderChange}
                        className="py-4"
                    />
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>0 units</span>
                        <span>50 units</span>
                        <span>100+ units</span>
                    </div>
                </div>

                {/* Progress to Next Tier */}
                {calculation.nextTier ? (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-slate-600">Progress to {calculation.nextTier.label}</span>
                            <span className="text-blue-600 font-bold">{units} / {calculation.nextTier.threshold} units</span>
                        </div>
                        <Progress value={(units / calculation.nextTier.threshold) * 100} className="h-2" />
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Book <strong>{calculation.bookingsToNext} more jobs</strong> to unlock +{calculation.nextTier.bonus_percent}% extra discount!
                        </p>
                    </div>
                ) : (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                        <p className="text-green-700 font-bold text-sm flex items-center justify-center gap-2">
                            <Check className="h-4 w-4" /> Maximum Volume Tier Unlocked!
                        </p>
                    </div>
                )}

                {/* Results Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Base Discount</p>
                        <p className="text-xl font-bold text-slate-700">{BASE_DISCOUNT}%</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Volume Bonus</p>
                        <p className={`text-xl font-bold ${calculation.bonusPercent > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                            +{calculation.bonusPercent}%
                        </p>
                    </div>
                    <div className="col-span-2 pt-4 border-t border-slate-100 mt-2">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-slate-900">Total Partner Discount</p>
                                <Badge className="mt-1 bg-blue-600 hover:bg-blue-700 text-lg py-1 px-3">
                                    {totalDiscount}% OFF
                                </Badge>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-slate-900 flex items-center justify-end gap-1">
                                    <Wallet className="h-4 w-4 text-green-600" /> Est. Monthly Savings
                                </p>
                                <p className="text-2xl font-black text-green-600">
                                    ${monthlySavings.toFixed(0)}<span className="text-sm text-green-600/60 font-medium">/mo</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 -mx-6 -mb-6 p-4 mt-4 text-center">
                    <p className="text-blue-800 text-sm font-medium">
                        Guaranteed monthly work = Guaranteed savings.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};

export default VolumeCalculator;