import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff, Save, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const ApiKeys = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [qbConfig, setQbConfig] = useState({
    client_id: '',
    client_secret: '',
    realm_id: '9341455925184224', // Default Sandbox
    environment: 'sandbox'
  });
  const [qbStatus, setQbStatus] = useState(null); // 'connected' | 'disconnected'
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetchConfig();
    checkConnectionStatus();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('global_config')
        .select('value')
        .eq('key', 'quickbooks_config')
        .maybeSingle();

      if (data?.value) {
        setQbConfig(prev => ({ ...prev, ...data.value }));
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const checkConnectionStatus = async () => {
    const { data } = await supabase
      .from('integration_tokens')
      .select('expires_at')
      .eq('service_name', 'quickbooks')
      .maybeSingle();

    if (data && new Date(data.expires_at) > new Date()) {
      setQbStatus('connected');
    } else {
      setQbStatus('disconnected');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('global_config')
        .upsert({
          key: 'quickbooks_config',
          value: qbConfig,
          description: 'QuickBooks OAuth Credentials'
        }, { onConflict: 'key' });

      if (error) throw error;
      toast({ title: "Settings Saved", description: "QuickBooks configuration updated." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    if (!qbConfig.client_id) {
      toast({ variant: "destructive", title: "Missing Client ID", description: "Please save your Client ID first." });
      return;
    }
    
    // Construct OAuth URL
    const redirectUri = `${window.location.origin}/crm/settings/api-keys/callback`; // We need to handle this route or just handle it here if using popup
    // For simplicity in this constraints, we'll assume the user sets the Redirect URI in QB to this page URL
    // And we'll verify the 'code' query param on mount if present.

    const scope = 'com.intuit.quickbooks.accounting';
    const state = 'security_token'; // Should be random in prod
    
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${qbConfig.client_id}&response_type=code&scope=${scope}&redirect_uri=${window.location.href}&state=${state}`;
    
    window.location.href = authUrl;
  };

  // Handle OAuth Callback check
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const realmId = params.get('realmId');

    if (code && realmId) {
      handleAuthExchange(code, realmId);
    }
  }, []);

  const handleAuthExchange = async (code, realmId) => {
    toast({ title: "Connecting...", description: "Exchanging tokens with QuickBooks..." });
    try {
      const { data, error } = await supabase.functions.invoke('quickbooks-auth', {
        body: {
          action: 'exchange',
          code,
          redirectUri: window.location.href.split('?')[0], // Base URL without query params
          clientId: qbConfig.client_id,
          clientSecret: qbConfig.client_secret
        }
      });

      if (error || !data.success) throw new Error(error?.message || 'Exchange failed');

      // Also save the realm ID if it came back from redirect
      if (realmId) {
         setQbConfig(prev => ({ ...prev, realm_id: realmId }));
         // Update config in background
         await supabase.from('global_config').upsert({
            key: 'quickbooks_config',
            value: { ...qbConfig, realm_id: realmId }
         });
      }

      setQbStatus('connected');
      toast({ title: "Connected!", description: "QuickBooks integration is active." });
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Connection Failed", description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">API & Integrations</h2>
        <p className="text-muted-foreground">Manage external service connections.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            QuickBooks Online Integration
            {qbStatus === 'connected' ? (
              <span className="flex items-center text-xs font-normal text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
              </span>
            ) : (
              <span className="flex items-center text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">
                <AlertCircle className="w-3 h-3 mr-1" /> Disconnected
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Sync invoices, customers, and payments to QuickBooks Online.
            <br />
            Sandbox Realm ID: <span className="font-mono text-xs bg-slate-100 px-1 rounded">9341455925184224</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input 
                value={qbConfig.client_id} 
                onChange={e => setQbConfig({...qbConfig, client_id: e.target.value})}
                placeholder="AB..."
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <div className="relative">
                <Input 
                  type={showSecret ? "text" : "password"} 
                  value={qbConfig.client_secret} 
                  onChange={e => setQbConfig({...qbConfig, client_secret: e.target.value})}
                  placeholder="Create a secret in Intuit Developer Portal"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Realm ID (Company ID)</Label>
              <Input 
                value={qbConfig.realm_id} 
                onChange={e => setQbConfig({...qbConfig, realm_id: e.target.value})}
                placeholder="9341455925184224"
              />
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Input value="Sandbox" disabled className="bg-slate-50" />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t">
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4 mr-2" /> Save Configuration
            </Button>
            
            {qbStatus !== 'connected' ? (
              <Button variant="outline" onClick={handleConnect} disabled={!qbConfig.client_id}>
                <RefreshCw className="w-4 h-4 mr-2" /> Connect to QuickBooks
              </Button>
            ) : (
               <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {/* handle disconnect logic */}}>
                 Disconnect
               </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Other API Keys (Placeholder) */}
      <Card className="opacity-50">
        <CardHeader>
            <CardTitle>Google Maps API</CardTitle>
            <CardDescription>Managed via Environment Variables (Read Only)</CardDescription>
        </CardHeader>
        <CardContent>
            <Input value="**********************" disabled />
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiKeys;