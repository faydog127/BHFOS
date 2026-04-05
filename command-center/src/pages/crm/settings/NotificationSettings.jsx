import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/customSupabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BellRing, Smartphone, AlertTriangle } from "lucide-react";

const NotificationSettings = () => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    // Fetch only notification related keys
    const keys = ['ADMIN_ALERT_PHONE', 'PARTNER_NOTIFICATION_PHONE', 'GENERAL_NOTIFICATION_PHONE'];
    const { data, error } = await supabase
        .from('global_config')
        .select('*')
        .in('key', keys);
        
    if (error) {
      toast({ variant: "destructive", title: "Failed to load settings", description: error.message });
    } else {
      const settingsObject = data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
      setCfg(settingsObject);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function set(key, value) {
    setCfg(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const updates = Object.keys(cfg).map(key => ({ key, value: cfg[key] }));

    const { error } = await supabase
      .from('global_config')
      .upsert(updates, { onConflict: 'key' });

    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: "Notifications Updated", description: "Phone numbers saved successfully." });
    }
    setSaving(false);
  }

  if (loading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Loading notification settings...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" /> 
            Critical Alerts
          </CardTitle>
          <CardDescription>
            Configure who receives immediate SMS alerts for critical events like Red Flag sentiment scores (1-7/10).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Admin Alert Number</label>
            <div className="flex gap-2">
                <Smartphone className="w-4 h-4 text-slate-400 mt-3" />
                <Input 
                    value={cfg.ADMIN_ALERT_PHONE || ""} 
                    onChange={e => set("ADMIN_ALERT_PHONE", e.target.value)} 
                    placeholder="(555) 123-4567"
                />
            </div>
            <p className="text-xs text-slate-500">
                Receives "RED FLAG" SMS immediately when a customer submits a negative sentiment score.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-blue-500" /> 
            General Notifications
          </CardTitle>
          <CardDescription>
            Manage contact numbers for standard system notifications and partner updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Partner Notification Number</label>
             <div className="flex gap-2">
                <Smartphone className="w-4 h-4 text-slate-400 mt-3" />
                <Input 
                    value={cfg.PARTNER_NOTIFICATION_PHONE || ""} 
                    onChange={e => set("PARTNER_NOTIFICATION_PHONE", e.target.value)} 
                    placeholder="+1 (555) ..."
                />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">General System Alerts</label>
             <div className="flex gap-2">
                <Smartphone className="w-4 h-4 text-slate-400 mt-3" />
                <Input 
                    value={cfg.GENERAL_NOTIFICATION_PHONE || ""} 
                    onChange={e => set("GENERAL_NOTIFICATION_PHONE", e.target.value)} 
                    placeholder="+1 (555) ..."
                />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Saving...</> : "Save Notification Settings"}
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;