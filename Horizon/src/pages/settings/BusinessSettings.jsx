import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/customSupabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Building, MapPin, Clock, CreditCard, Calendar, Info, Palette } from "lucide-react";

/**
 * BusinessSettings Component
 * Manages core business configuration including operating hours, service areas, branding, and appointment defaults.
 */
const BusinessSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState(null);

  // Initial State matching the database schema
  const [formData, setFormData] = useState({
    business_name: "",
    email: "", // This is contact email
    business_email: "", // This is reply-to/automation email
    phone: "",
    website: "",
    address: "",
    logo_url: "",
    primary_brand_color: "#000000",
    service_area_radius: 25,
    service_zip_codes: [], // managed as string in UI, array in state
    operating_hours: {
      monday: { isOpen: true, start: "09:00", end: "17:00" },
      tuesday: { isOpen: true, start: "09:00", end: "17:00" },
      wednesday: { isOpen: true, start: "09:00", end: "17:00" },
      thursday: { isOpen: true, start: "09:00", end: "17:00" },
      friday: { isOpen: true, start: "09:00", end: "17:00" },
      saturday: { isOpen: false, start: "10:00", end: "14:00" },
      sunday: { isOpen: false, start: "10:00", end: "14:00" },
    },
    time_zone: "America/New_York",
    default_currency: "USD",
    tax_rate: 0, // Legacy field, keeping for compatibility if needed, but UI will use default_tax_rate
    default_tax_rate: 0,
    payment_terms: "Due on Receipt",
    appointment_slot_duration: 60,
    appointment_buffer_time: 15,
    appointment_lead_time_hours: 24,
    license_info: "",
    additional_notes: ""
  });

  // Derived state for ZIP codes input (comma separated string)
  const [zipCodesInput, setZipCodesInput] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch the first row. In a multi-tenant system, we'd filter by organization_id
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        setFormData(prev => ({ 
          ...prev, 
          ...data,
          // Ensure defaults if null
          operating_hours: data.operating_hours || prev.operating_hours,
          primary_brand_color: data.primary_brand_color || "#000000"
        }));
        setZipCodesInput(data.service_zip_codes ? data.service_zip_codes.join(", ") : "");
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({ variant: "destructive", title: "Failed to load settings", description: error.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleZipCodeChange = (e) => {
    setZipCodesInput(e.target.value);
    // Convert string to array for state
    const codes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, service_zip_codes: codes }));
  };

  const handleOperatingHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      operating_hours: {
        ...prev.operating_hours,
        [day]: {
          ...prev.operating_hours[day],
          [field]: value
        }
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Sync legacy tax_rate with new default_tax_rate for backward compatibility if needed
      const payload = { 
        ...formData, 
        tax_rate: formData.default_tax_rate,
        updated_at: new Date().toISOString() 
      };
      
      let error;
      if (settingsId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('business_settings')
          .update(payload)
          .eq('id', settingsId);
        error = updateError;
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('business_settings')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Settings Saved", description: "Business configuration has been updated successfully." });
      
      // Reload to ensure we have the ID if we just created it
      if (!settingsId) loadSettings();

    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ variant: "destructive", title: "Save Failed", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold tracking-tight">Business Configuration</h2>
           <p className="text-muted-foreground">Manage your core business details and operational settings.</p>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" onClick={() => loadSettings()}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
        </div>
      </div>

      {/* 1. Core Business Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-indigo-500"/> Core Business Details</CardTitle>
          <CardDescription>General information about your business entity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Business Name</label>
            <Input value={formData.business_name || ""} onChange={e => handleChange('business_name', e.target.value)} placeholder="e.g. The Vent Guys" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Primary Contact Email</label>
            <Input value={formData.email || ""} onChange={e => handleChange('email', e.target.value)} placeholder="contact@example.com" />
            <p className="text-xs text-muted-foreground">Used for account administration.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Automation Reply-To Email</label>
            <Input value={formData.business_email || ""} onChange={e => handleChange('business_email', e.target.value)} placeholder="notifications@example.com" />
            <p className="text-xs text-muted-foreground">The "Reply-To" address for automated system emails.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone Number</label>
            <Input value={formData.phone || ""} onChange={e => handleChange('phone', e.target.value)} placeholder="(555) 123-4567" />
          </div>
           <div className="space-y-2">
            <label className="text-sm font-medium">Website</label>
            <Input value={formData.website || ""} onChange={e => handleChange('website', e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Physical Address</label>
            <Input value={formData.address || ""} onChange={e => handleChange('address', e.target.value)} placeholder="123 Main St, City, State, ZIP" />
          </div>
        </CardContent>
      </Card>
      
      {/* 2. Branding Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-pink-500"/> Branding & Visuals</CardTitle>
          <CardDescription>Configure logos and colors for PDFs, emails, and client portals.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
             <label className="text-sm font-medium">Logo URL</label>
             <div className="flex gap-4 items-center">
                 <Input value={formData.logo_url || ""} onChange={e => handleChange('logo_url', e.target.value)} placeholder="https://example.com/logo.png" className="flex-1" />
                 {formData.logo_url && (
                    <div className="w-12 h-12 bg-slate-100 rounded border p-1 flex items-center justify-center shrink-0">
                        <img src={formData.logo_url} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                    </div>
                 )}
             </div>
             <p className="text-xs text-muted-foreground">Direct link to your logo image (PNG or JPG recommended).</p>
          </div>
          <div className="space-y-2">
             <label className="text-sm font-medium">Primary Brand Color</label>
             <div className="flex gap-2 items-center">
                 <div className="w-10 h-10 rounded border shrink-0" style={{ backgroundColor: formData.primary_brand_color }}></div>
                 <Input type="color" className="w-20 h-10 p-1" value={formData.primary_brand_color || "#000000"} onChange={e => handleChange('primary_brand_color', e.target.value)} />
                 <Input type="text" className="w-32" value={formData.primary_brand_color || ""} onChange={e => handleChange('primary_brand_color', e.target.value)} placeholder="#000000" />
             </div>
             <p className="text-xs text-muted-foreground">Used for buttons, headers, and accents in generated documents.</p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Financial Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-purple-500"/> Financial Configuration</CardTitle>
          <CardDescription>Default financial settings for invoices and estimates.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
             <div className="space-y-2">
                <label className="text-sm font-medium">Currency</label>
                <Input value={formData.default_currency || "USD"} onChange={e => handleChange('default_currency', e.target.value)} />
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium">Default Tax Rate (%)</label>
                <Input 
                    type="number" 
                    step="0.0001" 
                    value={formData.default_tax_rate || 0} 
                    onChange={e => handleChange('default_tax_rate', parseFloat(e.target.value))} 
                />
                <p className="text-xs text-muted-foreground">E.g., 7.5 for 7.5%. Applied to taxable line items.</p>
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium">Payment Terms</label>
                <Select value={formData.payment_terms || "Due on Receipt"} onValueChange={(val) => handleChange('payment_terms', val)}>
                    <SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 60">Net 60</SelectItem>
                    </SelectContent>
                </Select>
             </div>
        </CardContent>
      </Card>

      {/* 4. Service Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-emerald-500"/> Service Area</CardTitle>
          <CardDescription>Define where you operate to help with scheduling and lead qualification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Service Radius (miles)</label>
                <Input type="number" value={formData.service_area_radius || 25} onChange={e => handleChange('service_area_radius', parseInt(e.target.value))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Time Zone</label>
                <Select value={formData.time_zone || "America/New_York"} onValueChange={(val) => handleChange('time_zone', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    </SelectContent>
                </Select>
              </div>
           </div>
           <div className="space-y-2">
             <label className="text-sm font-medium">Service ZIP Codes</label>
             <Textarea 
                value={zipCodesInput} 
                onChange={handleZipCodeChange} 
                placeholder="32901, 32902, 32903..." 
                className="h-24"
             />
             <p className="text-xs text-muted-foreground">Enter ZIP codes separated by commas. These will be used for automated territory checks.</p>
           </div>
        </CardContent>
      </Card>

      {/* 5. Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-500"/> Operating Hours</CardTitle>
          <CardDescription>Set your standard business hours for availability.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {daysOfWeek.map(day => (
                    <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card/50">
                        <div className="flex items-center gap-4 w-40">
                             <Switch 
                                checked={formData.operating_hours[day]?.isOpen}
                                onCheckedChange={(checked) => handleOperatingHoursChange(day, 'isOpen', checked)}
                             />
                             <span className="capitalize font-medium">{day}</span>
                        </div>
                        {formData.operating_hours[day]?.isOpen ? (
                             <div className="flex items-center gap-4 mt-3 sm:mt-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground uppercase">Open</span>
                                    <Input 
                                        type="time" 
                                        className="w-32" 
                                        value={formData.operating_hours[day]?.start}
                                        onChange={(e) => handleOperatingHoursChange(day, 'start', e.target.value)}
                                    />
                                </div>
                                <span className="text-muted-foreground">-</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground uppercase">Close</span>
                                    <Input 
                                        type="time" 
                                        className="w-32" 
                                        value={formData.operating_hours[day]?.end}
                                        onChange={(e) => handleOperatingHoursChange(day, 'end', e.target.value)}
                                    />
                                </div>
                             </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic flex-1 text-center sm:text-left sm:pl-10 mt-2 sm:mt-0">
                                Closed
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>

      {/* 6. Appointment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-orange-500"/> Appointment Settings</CardTitle>
          <CardDescription>Configuration for scheduling logic and calendar blocks.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
             <div className="space-y-2">
                <label className="text-sm font-medium">Slot Duration (min)</label>
                <Input type="number" value={formData.appointment_slot_duration || 60} onChange={e => handleChange('appointment_slot_duration', parseInt(e.target.value))} />
                <p className="text-xs text-muted-foreground">Standard length of a service appointment.</p>
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium">Buffer Time (min)</label>
                <Input type="number" value={formData.appointment_buffer_time || 15} onChange={e => handleChange('appointment_buffer_time', parseInt(e.target.value))} />
                <p className="text-xs text-muted-foreground">Time added between appointments for travel/prep.</p>
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium">Min Lead Time (hours)</label>
                <Input type="number" value={formData.appointment_lead_time_hours || 24} onChange={e => handleChange('appointment_lead_time_hours', parseInt(e.target.value))} />
                <p className="text-xs text-muted-foreground">Minimum notice required before booking.</p>
             </div>
        </CardContent>
      </Card>

      {/* 7. Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-slate-500"/> Additional Information</CardTitle>
          <CardDescription>Legal and internal notes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium">License & Registration Info</label>
                <Textarea 
                    value={formData.license_info || ""} 
                    onChange={e => handleChange('license_info', e.target.value)} 
                    placeholder="Contractor License #..."
                    className="h-24"
                />
            </div>
             <div className="space-y-2">
                <label className="text-sm font-medium">Internal Notes</label>
                <Textarea 
                    value={formData.additional_notes || ""} 
                    onChange={e => handleChange('additional_notes', e.target.value)} 
                    placeholder="Notes about this location or configuration..."
                    className="h-24"
                />
            </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 sticky bottom-6">
            <Button variant="outline" size="lg" className="bg-white shadow-sm" onClick={() => loadSettings()}>Cancel</Button>
            <Button size="lg" className="shadow-lg" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Configuration</>}
            </Button>
      </div>

    </div>
  );
};

export default BusinessSettings;