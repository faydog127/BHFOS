import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Briefcase, CheckCircle2, Clock, AlertTriangle, 
  Calendar, Phone, DollarSign, TrendingUp, Users,
  PlusCircle, Search, ArrowRight, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// Components
import ActionHub from './ActionHub';
import IndustryNewsTicker from '@/components/crm/solo/IndustryNewsTicker'; // Added

const SoloDashboard = () => {
  const { user } = useSupabaseAuth();
  const { isTrainingMode } = useTrainingMode();
  const [stats, setStats] = useState({
    todayRevenue: 0,
    monthRevenue: 0,
    pendingJobs: 0,
    activeLeads: 0,
    urgentTasks: 0
  });

  useEffect(() => {
    fetchQuickStats();
  }, [isTrainingMode]);

  const fetchQuickStats = async () => {
    try {
      // Mock data for demo/training, real queries for production would go here
      // For now we simulate the "Solo" feel with static data or simple counts
      
      const { count: leadCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'New');

      const { count: jobCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'scheduled');

      setStats({
        todayRevenue: 450,
        monthRevenue: 12500,
        pendingJobs: jobCount || 0,
        activeLeads: leadCount || 0,
        urgentTasks: 3
      });

    } catch (e) {
      console.error(e);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Header / Status Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {getGreeting()}, {user?.user_metadata?.first_name || 'Partner'}
            {isTrainingMode && <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Training Mode</Badge>}
          </h1>
          <p className="text-sm text-slate-500">Here's what's happening in your business today.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button size="sm" className="hidden md:flex bg-blue-600 hover:bg-blue-700">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Lead
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100">
            <Wallet className="w-4 h-4" />
            <span>${stats.monthRevenue.toLocaleString()} <span className="text-green-600/70 font-normal">this month</span></span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - News & Quick Links */}
        <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto hidden lg:flex">
          <div className="p-4 space-y-4">
            
            {/* Industry News Ticker */}
            <IndustryNewsTicker />

            {/* Quick Actions Card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-bold text-slate-800">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" className="h-auto py-3 flex flex-col gap-2 hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <span className="text-xs font-medium">Calendar</span>
                  </Button>
                  <Button variant="ghost" className="h-auto py-3 flex flex-col gap-2 hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <Users className="w-5 h-5 text-purple-500" />
                    <span className="text-xs font-medium">Contacts</span>
                  </Button>
                  <Button variant="ghost" className="h-auto py-3 flex flex-col gap-2 hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    <span className="text-xs font-medium">Invoices</span>
                  </Button>
                  <Button variant="ghost" className="h-auto py-3 flex flex-col gap-2 hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                    <span className="text-xs font-medium">Reports</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card className="border-slate-200 shadow-sm bg-slate-50/50">
               <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-medium text-slate-600">Pipeline Health</span>
                     <span className="text-xs font-bold text-green-600">92%</span>
                  </div>
                  <Progress value={92} className="h-1.5 bg-slate-200" indicatorClassName="bg-green-500" />
                  <p className="text-[10px] text-slate-400 mt-2">
                     3 leads require attention in the next 4 hours.
                  </p>
               </CardContent>
            </Card>

          </div>
        </div>

        {/* Main Content - Action Hub */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
           {/* Primary Workspace */}
           <ActionHub />
        </div>
      </div>
    </div>
  );
};

export default SoloDashboard;