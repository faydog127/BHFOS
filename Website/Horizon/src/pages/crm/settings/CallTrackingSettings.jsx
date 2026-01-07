import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Save, Phone, Loader2, Key } from 'lucide-react';

const CallTrackingSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    provider: 'CallRail',
    tracking_number: '',
    api_key: '',
    recording_enabled: true,
    attribution_source: 'Google Ads'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('widget_settings')
        .select('value')
        .eq('key', 'call_tracking_config')
        .single();
      
      if (data) {
        setSettings({ ...settings, ...data.value });
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('widget_settings')
      .upsert({ 
        key: 'call_tracking_config', 
        value: settings,
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Success', description: 'Call tracking settings saved.' });
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Call Tracking</h1>
          <p className="text-gray-500">Configure your call tracking provider and attribution.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="w-5 h-5"/> Provider Configuration</CardTitle>
          <CardDescription>Select your provider and enter API details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={settings.provider} onValueChange={(val) => setSettings({...settings, provider: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CallRail">CallRail</SelectItem>
                  <SelectItem value="Twilio">Twilio</SelectItem>
                  <SelectItem value="Manual">Manual / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tracking Phone Number</Label>
              <Input 
                value={settings.tracking_number} 
                onChange={(e) => setSettings({...settings, tracking_number: e.target.value})} 
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                type="password"
                className="pl-9"
                value={settings.api_key} 
                onChange={(e) => setSettings({...settings, api_key: e.target.value})} 
                placeholder="Enter API Key securely"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features & Attribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">Call Recording</Label>
              <p className="text-sm text-gray-500">Automatically record inbound calls for quality assurance.</p>
            </div>
            <Switch 
              checked={settings.recording_enabled} 
              onCheckedChange={(checked) => setSettings({...settings, recording_enabled: checked})} 
            />
          </div>

          <div className="space-y-2">
            <Label>Default Attribution Source</Label>
            <Select value={settings.attribution_source} onValueChange={(val) => setSettings({...settings, attribution_source: val})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Google Ads">Google Ads</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
                <SelectItem value="Direct">Direct / Organic</SelectItem>
                <SelectItem value="Referral">Referral</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">Assign this source to calls that lack specific UTM data.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CallTrackingSettings;