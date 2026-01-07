import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, Calendar, Download, Maximize2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Sub-Components
import MarketingScoreboard from '@/components/crm/marketing/MarketingScoreboard';
import MarketingAnalytics from '@/components/crm/marketing/MarketingAnalytics';
import CampaignsManager from '@/components/crm/marketing/CampaignsManager';
import AutomationPlaybooks from '@/components/crm/marketing/AutomationPlaybooks';
import TemplateManager from '@/components/crm/marketing/TemplateManager';

const Marketing = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, [dateRange]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // Calculate date cutoff based on range (defaulting to 90 days max for performance on client-side filtering)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      
      const { data, error } = await supabase
        .from('leads')
        .select('id, created_at, marketing_source_detail, is_partner, source_kind, source, utm_source, utm_medium, utm_campaign')
        .gte('created_at', cutoff.toISOString());

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({ title: "Error", description: "Failed to load analytics data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      <Helmet>
        <title>Marketing Hub | CRM</title>
      </Helmet>

      <div className="flex-none p-8 pb-4 border-b bg-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#091e39] font-heading">Marketing Hub</h1>
            <p className="text-muted-foreground mt-1">Track sources, manage campaigns, and automate growth.</p>
          </div>
          <div className="flex items-center gap-2">
             {/* Shortcut to Console (Sidebar is read-only, so we add entry point here) */}
             <Button 
                variant="outline" 
                className="hidden md:flex border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => navigate('/crm/marketing/console')}
             >
                <ExternalLink className="w-4 h-4 mr-2" /> Open Console
             </Button>
             
             <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
             </Select>
             <Button variant="outline" size="icon" onClick={fetchLeads} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
             </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-4 bg-gray-100 p-1">
            <TabsTrigger value="overview">Overview & Analytics</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="automations">Automations</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <MarketingScoreboard leads={leads} dateRange={dateRange} loading={loading} />
              <MarketingAnalytics leads={leads} loading={loading} />
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="animate-in fade-in duration-500">
              <CampaignsManager />
            </div>
          )}

          {activeTab === 'automations' && (
            <div className="animate-in fade-in duration-500 space-y-4">
              <div className="flex justify-end">
                 <Button variant="secondary" size="sm" onClick={() => navigate('/crm/marketing/console')} className="text-xs">
                    <Maximize2 className="w-3 h-3 mr-2"/> Full Screen Console
                 </Button>
              </div>
              <AutomationPlaybooks />
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="animate-in fade-in duration-500">
              <TemplateManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Marketing;