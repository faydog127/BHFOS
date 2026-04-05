import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/customSupabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, AtSign, ShieldAlert, LifeBuoy } from "lucide-react";

const EmailSettings = () => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const loadSettings = useCallback(async () => {
    setLoading(true);
    // Fetch only email related keys
    const keys = [
      'EMAIL_SENDER_ADDRESS', 
      'EMAIL_REPLY_TO_ADDRESS', 
      'EMAIL_ADMIN_NOTIFICATION', 
      'EMAIL_SUPPORT_CONTACT'
    ];
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

  function validateEmail(email) {
    if (!email) return true; // Allow empty if not mandatory (though these likely should be)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function set(key, value) {
    setCfg(prev => ({ ...prev, [key]: value }));
    // Clear error when user types
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  }

  async function save() {
    // Validation
    const newErrors = {};
    const keysToValidate = [
      'EMAIL_SENDER_ADDRESS', 
      'EMAIL_REPLY_TO_ADDRESS', 
      'EMAIL_ADMIN_NOTIFICATION', 
      'EMAIL_SUPPORT_CONTACT'
    ];

    keysToValidate.forEach(key => {
      if (cfg[key] && !validateEmail(cfg[key])) {
        newErrors[key] = "Invalid email format";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ variant: "destructive", title: "Validation Error", description: "Please fix the invalid email addresses." });
      return;
    }

    setSaving(true);
    const updates = Object.keys(cfg).map(key => ({ key, value: cfg[key] }));

    const { error } = await supabase
      .from('global_config')
      .upsert(updates, { onConflict: 'key' });

    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: "Email Configuration Updated", description: "Email addresses saved successfully." });
    }
    setSaving(false);
  }

  if (loading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Loading email settings...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-500" /> 
            Email Configuration
          </CardTitle>
          <CardDescription>
            Configure the email addresses used by the system for sending, receiving, and internal alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <AtSign className="w-4 h-4 text-slate-400" /> Sender Email Address
              </label>
              <Input 
                  value={cfg.EMAIL_SENDER_ADDRESS || ""} 
                  onChange={e => set("EMAIL_SENDER_ADDRESS", e.target.value)} 
                  placeholder="noreply@vent-guys.com"
                  className={errors.EMAIL_SENDER_ADDRESS ? "border-red-500" : ""}
              />
              {errors.EMAIL_SENDER_ADDRESS && <p className="text-xs text-red-500">{errors.EMAIL_SENDER_ADDRESS}</p>}
              <p className="text-xs text-slate-500">
                  The "From" address for automated system emails (invoices, receipts, notifications).
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-slate-400" /> Reply-To Email
              </label>
              <Input 
                  value={cfg.EMAIL_REPLY_TO_ADDRESS || ""} 
                  onChange={e => set("EMAIL_REPLY_TO_ADDRESS", e.target.value)} 
                  placeholder="support@vent-guys.com"
                  className={errors.EMAIL_REPLY_TO_ADDRESS ? "border-red-500" : ""}
              />
              {errors.EMAIL_REPLY_TO_ADDRESS && <p className="text-xs text-red-500">{errors.EMAIL_REPLY_TO_ADDRESS}</p>}
              <p className="text-xs text-slate-500">
                  Where customer replies to automated emails will be directed.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
             <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-400" /> Admin Notification Email
              </label>
              <Input 
                  value={cfg.EMAIL_ADMIN_NOTIFICATION || ""} 
                  onChange={e => set("EMAIL_ADMIN_NOTIFICATION", e.target.value)} 
                  placeholder="admin@vent-guys.com"
                  className={errors.EMAIL_ADMIN_NOTIFICATION ? "border-red-500" : ""}
              />
              {errors.EMAIL_ADMIN_NOTIFICATION && <p className="text-xs text-red-500">{errors.EMAIL_ADMIN_NOTIFICATION}</p>}
              <p className="text-xs text-slate-500">
                  Receives critical system alerts, new lead notifications, and error reports.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-slate-400" /> Support Email
              </label>
              <Input 
                  value={cfg.EMAIL_SUPPORT_CONTACT || ""} 
                  onChange={e => set("EMAIL_SUPPORT_CONTACT", e.target.value)} 
                  placeholder="support@vent-guys.com"
                  className={errors.EMAIL_SUPPORT_CONTACT ? "border-red-500" : ""}
              />
              {errors.EMAIL_SUPPORT_CONTACT && <p className="text-xs text-red-500">{errors.EMAIL_SUPPORT_CONTACT}</p>}
              <p className="text-xs text-slate-500">
                  Displayed to customers for support inquiries.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Saving...</> : "Save Email Settings"}
        </Button>
      </div>
    </div>
  );
};

export default EmailSettings;
