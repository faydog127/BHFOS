
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import brandConfig from '@/config/bhf.config.json';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, 
  RotateCw, 
  Key, 
  History,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';

const SecretsManager = () => {
  const [integrations, setIntegrations] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [rotationHistory, setRotationHistory] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [isRotating, setIsRotating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // 1. Load Integrations Config
    setIntegrations(brandConfig.integrations || []);

    // 2. Load Overrides from DB
    const loadData = async () => {
      // Load current configs
      const { data: configData } = await supabase
        .from('service_configurations')
        .select('*');

      if (configData) {
        const overrideMap = {};
        configData.forEach(item => {
          overrideMap[item.service_key] = item;
        });
        setOverrides(overrideMap);
      }

      // Load Audit Log for history
      const { data: auditData } = await supabase
        .from('config_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setRotationHistory(auditData || []);
    };

    loadData();
  }, []);

  const handleRotate = async () => {
    if (!newKey.trim()) return;
    setIsRotating(true);

    try {
      const integration = selectedIntegration;
      
      // 1. Upsert service configuration
      const { data: config, error: configError } = await supabase
        .from('service_configurations')
        .upsert({
          service_key: integration.key_name,
          service_name: integration.service_name,
          credentials: { api_key: newKey },
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'service_key' })
        .select()
        .single();

      if (configError) throw configError;

      // 2. Log audit trail
      await supabase.from('config_audit_logs').insert({
        config_id: config.id,
        change_type: 'ROTATION',
        details: { 
          reason: 'Manual rotation via Admin Console',
          previous_version: overrides[integration.key_name]?.updated_at 
        }
      });

      // 3. Log to system audit log (for redundancy)
      await supabase.from('activity_log').insert({
        type: 'SECRET_ROTATION',
        note: `Rotated secret for ${integration.service_name}`
      });

      // Update local state
      setOverrides(prev => ({
        ...prev,
        [integration.key_name]: config
      }));

      toast({
        title: "Rotation Successful",
        description: `${integration.service_name} key has been updated.`,
      });

      setSelectedIntegration(null);
      setNewKey('');

    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Rotation Failed",
        description: err.message
      });
    } finally {
      setIsRotating(false);
    }
  };

  const getMaskedValue = (keyName) => {
    const override = overrides[keyName];
    if (override) return '•••••••••••••••• (Database Override)';
    return '•••••••••••••••• (Environment Variable)';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-green-100 text-green-700 rounded-lg">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Secrets & Integrations</h2>
          <p className="text-sm text-slate-500">Manage API keys and security rotation policies.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {integrations.map((integration) => {
          const override = overrides[integration.key_name];
          const lastRotated = override?.updated_at 
            ? format(new Date(override.updated_at), 'MMM d, yyyy HH:mm')
            : 'System Default';

          return (
            <Card key={integration.id}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-100 rounded-md">
                      <Key className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {integration.service_name}
                        {override && <Badge variant="outline" className="text-blue-600 border-blue-200">Overridden</Badge>}
                      </h3>
                      <div className="text-sm text-slate-500 font-mono mt-1">{integration.key_name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                        <History className="w-3 h-3" />
                        Last Rotated: {lastRotated}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Input 
                        readOnly 
                        value={getMaskedValue(integration.key_name)} 
                        className="w-64 font-mono text-xs bg-slate-50" 
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedIntegration(integration)}
                    >
                      <RotateCw className="w-4 h-4 mr-2" />
                      Rotate Secret
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-slate-50 border-slate-200 mt-8">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Rotation Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rotationHistory.length === 0 ? (
              <div className="text-sm text-slate-500 italic">No rotation events recorded.</div>
            ) : (
              rotationHistory.map((log) => (
                <div key={log.id} className="flex items-center gap-3 text-sm p-2 bg-white rounded border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-mono text-xs text-slate-400">
                    {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                  </span>
                  <span className="font-medium">Secret Rotation</span>
                  <span className="text-slate-500 text-xs">- {log.details?.reason || 'Manual update'}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rotation Modal */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate Secret for {selectedIntegration?.service_name}</DialogTitle>
            <DialogDescription>
              This will update the active credential used by the application. Ensure the new key is valid before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                <strong>Warning:</strong> Rotating a key will immediately affect all users. Old keys typically stop working depending on the provider's revocation policy.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">New API Secret</label>
              <Input 
                type="password" 
                placeholder="sk-..." 
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIntegration(null)}>Cancel</Button>
            <Button onClick={handleRotate} disabled={isRotating || !newKey}>
              {isRotating ? 'Rotating...' : 'Confirm Rotation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecretsManager;
