import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Layout, Clock, Zap } from 'lucide-react';

const KanbanSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    wip_limit_quote_sent: 20,
    sla_green_mins: 15,
    sla_yellow_mins: 60,
    rule_stale_quote_72h: true,
    rule_zombie_30d: true,
    estimates: {
      good: 90,
      better: 120,
      best: 150,
      dryer: 45
    }
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase.from('kanban_config').select('value').eq('key', 'global').single();
    if (data) {
        // Merge with defaults to ensure all fields exist
        setConfig(prev => ({ ...prev, ...data.value, estimates: { ...prev.estimates, ...data.value.estimates } }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('kanban_config').upsert({
        key: 'global',
        value: config,
        updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
        toast({ title: 'Saved', description: 'Kanban configuration updated.' });
    }
    setSaving(false);
  };

  const updateEstimate = (key, val) => {
      setConfig(prev => ({
          ...prev,
          estimates: { ...prev.estimates, [key]: parseInt(val) }
      }));
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Kanban Configuration</h2>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Save Config
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Layout className="w-5 h-5"/> Board Limits & SLA</CardTitle>
                    <CardDescription>Control visual thresholds and constraints.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>WIP Limit (Quote Sent)</Label>
                        <Input 
                            type="number" 
                            value={config.wip_limit_quote_sent} 
                            onChange={e => setConfig({...config, wip_limit_quote_sent: parseInt(e.target.value)})} 
                        />
                        <p className="text-xs text-muted-foreground">Hard cap for cards in Quote Sent column.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>SLA Green (Mins)</Label>
                            <Input 
                                type="number" 
                                value={config.sla_green_mins} 
                                onChange={e => setConfig({...config, sla_green_mins: parseInt(e.target.value)})} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>SLA Yellow (Mins)</Label>
                            <Input 
                                type="number" 
                                value={config.sla_yellow_mins} 
                                onChange={e => setConfig({...config, sla_yellow_mins: parseInt(e.target.value)})} 
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5"/> Automations</CardTitle>
                    <CardDescription>Enable or disable automatic board maintenance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Stale Quote Alert (72h)</Label>
                            <p className="text-xs text-muted-foreground">Notify owner if quote untouched for 3 days.</p>
                        </div>
                        <Switch 
                            checked={config.rule_stale_quote_72h} 
                            onCheckedChange={c => setConfig({...config, rule_stale_quote_72h: c})} 
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Zombie Archive (30d)</Label>
                            <p className="text-xs text-muted-foreground">Auto-archive quotes untouched for 30 days.</p>
                        </div>
                        <Switch 
                            checked={config.rule_zombie_30d} 
                            onCheckedChange={c => setConfig({...config, rule_zombie_30d: c})} 
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5"/> Default Estimations</CardTitle>
                    <CardDescription>Set default duration (minutes) for scheduling modal.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>GOOD (Base)</Label>
                            <Input type="number" value={config.estimates.good} onChange={e => updateEstimate('good', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>BETTER (Standard)</Label>
                            <Input type="number" value={config.estimates.better} onChange={e => updateEstimate('better', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>BEST (Premium)</Label>
                            <Input type="number" value={config.estimates.best} onChange={e => updateEstimate('best', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Dryer Vent</Label>
                            <Input type="number" value={config.estimates.dryer} onChange={e => updateEstimate('dryer', e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
};

export default KanbanSettings;