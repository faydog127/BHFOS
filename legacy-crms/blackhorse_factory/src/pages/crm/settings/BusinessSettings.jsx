import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Building, MapPin, Phone, DollarSign } from 'lucide-react';

const BusinessSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    business_name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    logo_url: '',
    tax_rate: 0,
    default_currency: 'USD',
    service_area_radius: 25,
    license_info: '',
    operating_hours: {},
    additional_notes: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('business_settings').select('*').single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) setSettings(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load business settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert logic based on single row constraint usually, or assume ID 1 exists or create new
      // For simplicity, we check if we have an ID, if not, insert, else update.
      const { data: existing } = await supabase.from('business_settings').select('id').single();
      
      let result;
      if (existing) {
        result = await supabase.from('business_settings').update(settings).eq('id', existing.id);
      } else {
        result = await supabase.from('business_settings').insert([settings]);
      }

      if (result.error) throw result.error;

      toast({ title: 'Saved', description: 'Business settings updated successfully.' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Business Profile</h1>
            <p className="text-gray-500">Manage your company details and defaults.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General Info</TabsTrigger>
          <TabsTrigger value="location">Location & Contact</TabsTrigger>
          <TabsTrigger value="financials">Financials & Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5"/> Company Identity</CardTitle>
              <CardDescription>These details appear on invoices and quotes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input name="business_name" value={settings.business_name} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>License / Tax ID</Label>
                  <Input name="license_info" value={settings.license_info} onChange={handleChange} placeholder="e.g. LIC-12345" />
                </div>
                <div className="space-y-2">
                  <Label>Website URL</Label>
                  <Input name="website" value={settings.website} onChange={handleChange} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input name="logo_url" value={settings.logo_url} onChange={handleChange} placeholder="https://..." />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5"/> Location & Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Physical Address</Label>
                <Input name="address" value={settings.address} onChange={handleChange} placeholder="123 Main St, City, State, Zip" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                    <Input name="phone" value={settings.phone} onChange={handleChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input name="email" value={settings.email} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                 <Label>Service Area Radius (miles)</Label>
                 <Input type="number" name="service_area_radius" value={settings.service_area_radius} onChange={handleChange} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5"/> Financials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Tax Rate (%)</Label>
                  <Input type="number" step="0.01" name="tax_rate" value={settings.tax_rate} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input name="default_currency" value={settings.default_currency} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Operating Hours / Notes</Label>
                <Textarea 
                    name="additional_notes" 
                    value={settings.additional_notes} 
                    onChange={handleChange} 
                    placeholder="Mon-Fri: 8am - 5pm..." 
                    rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessSettings;