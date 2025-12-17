import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, Database, Loader2, AlertTriangle, GraduationCap, 
  Beaker, Archive, CheckCircle2, ShieldAlert 
} from 'lucide-react';
import { format } from 'date-fns';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { applyTrainingFilter } from '@/lib/trainingUtils';
import TrainingModeToggle from '@/components/TrainingModeToggle';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AuditInspector() {
  const [leads, setLeads] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [error, setError] = useState(null);
  
  const { isTrainingMode, toggleTrainingMode } = useTrainingMode();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Leads
      let leadsQuery = supabase
        .from('leads')
        .select(`
          id,
          status,
          source,
          created_at,
          notes,
          is_test_data,
          contact:contacts(first_name, last_name, email),
          property:properties(address1, city, state)
        `)
        .order('created_at', { ascending: false });
      
      leadsQuery = applyTrainingFilter(leadsQuery, isTrainingMode);
      const { data: leadsData, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

      // 2. Fetch Accounts
      let accountsQuery = supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });

      accountsQuery = applyTrainingFilter(accountsQuery, isTrainingMode);
      const { data: accountsData, error: accountsError } = await accountsQuery;
      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

    } catch (err) {
      console.error('Audit Fetch Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isTrainingMode]);

  const handleSeedData = async () => {
    if (!isTrainingMode) {
        toast({ variant: "destructive", title: "Safety Lock", description: "You must be in Training Mode to generate test data." });
        return;
    }
    setSeeding(true);
    try {
        const { error } = await supabase.rpc('seed_training_data');
        if (error) throw error;
        toast({ title: "Success", description: "Generated 30+ test records successfully." });
        fetchData();
    } catch (err) {
        toast({ variant: "destructive", title: "Seeding Failed", description: err.message });
    } finally {
        setSeeding(false);
    }
  };

  const handleMigration = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const { data, error } = await supabase.rpc('migrate_production_to_testbed');
      
      if (error) throw error;
      
      if (data.success) {
        setMigrationResult(data.summary);
        toast({ 
          title: "Migration Complete", 
          description: `Migrated ${data.summary.total_records_affected} records to Testbed.`,
          className: "bg-green-50 border-green-200"
        });
        
        // Auto-switch to Training Mode if not already there, so user can see the migrated data
        if (!isTrainingMode) {
            toggleTrainingMode();
        } else {
            fetchData();
        }
      } else {
        throw new Error(data.error || 'Unknown migration error');
      }
    } catch (err) {
      console.error("Migration failed:", err);
      toast({ variant: "destructive", title: "Migration Failed", description: err.message });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <Helmet>
        <title>Data Audit Inspector | CRM</title>
      </Helmet>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="h-6 w-6 text-indigo-600" />
            Data Audit Inspector
          </h1>
          <p className="text-gray-500 text-sm">
            {isTrainingMode 
                ? "Viewing TEST ENVIRONMENT. These records are isolated from production." 
                : "Viewing LIVE PRODUCTION DATA. Exercise caution."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TrainingModeToggle />
          <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {isTrainingMode && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-md flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-amber-600" />
            <div>
                <p className="text-amber-800 font-bold">Training Mode Active</p>
                <p className="text-amber-700 text-sm">
                    You are seeing simulated/test data.
                </p>
            </div>
        </div>
      )}

      {/* Migration & Tools Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seeder Card */}
          <Card className={isTrainingMode ? "border-amber-200 bg-amber-50/30" : "opacity-50 grayscale"}>
              <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                      <Beaker className="h-5 w-5 text-indigo-500"/> Test Data Generator
                  </CardTitle>
                  <CardDescription>Creates realistic fake data for testing.</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                  <p className="text-sm text-gray-500 mb-4">
                      Generates residential/B2B accounts, properties, leads, and jobs. 
                      Only works when Training Mode is active.
                  </p>
              </CardContent>
              <CardFooter>
                  <Button 
                    onClick={handleSeedData} 
                    disabled={seeding || !isTrainingMode} 
                    variant="secondary"
                    className="w-full bg-white border shadow-sm hover:bg-gray-50"
                  >
                     {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Generate New Test Data"}
                  </Button>
              </CardFooter>
          </Card>

          {/* Migration Card */}
          <Card className="border-red-100 bg-red-50/30">
              <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-red-900">
                      <Archive className="h-5 w-5 text-red-600"/> Production Migration
                  </CardTitle>
                  <CardDescription>Converts LIVE data into TEST data.</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                  <p className="text-sm text-gray-500 mb-4">
                      This will flag ALL current production records as 'Test Data'. 
                      Useful for converting a staging DB into a sandbox.
                  </p>
                  
                  {migrationResult && (
                      <div className="mt-2 bg-white p-3 rounded border text-sm space-y-1">
                          <p className="font-bold text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4"/> Migration Successful
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-600 mt-2">
                              <span>Accounts: <b>{migrationResult.accounts_migrated}</b></span>
                              <span>Properties: <b>{migrationResult.properties_migrated}</b></span>
                              <span>Contacts: <b>{migrationResult.contacts_migrated}</b></span>
                              <span>Leads: <b>{migrationResult.leads_migrated}</b></span>
                              <span>Jobs: <b>{migrationResult.jobs_migrated}</b></span>
                              <span>Addresses Fixed: <b>{migrationResult.addresses_fixed}</b></span>
                          </div>
                      </div>
                  )}
              </CardContent>
              <CardFooter>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                            variant="destructive" 
                            className="w-full bg-red-600 hover:bg-red-700"
                            disabled={migrating}
                        >
                            {migrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Migrate All to Testbed"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                  <ShieldAlert className="h-6 w-6"/> Warning: Irreversible Action
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                  This will modify EVERY record in the database. 
                                  It will fix missing addresses with placeholders and mark ALL data as "is_test_data = true".
                                  <br/><br/>
                                  This effectively wipes the "Production" view. Are you sure you want to proceed?
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleMigration} className="bg-red-600 hover:bg-red-700">
                                  Yes, Migrate Database
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </CardFooter>
          </Card>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center gap-2 mt-6">
          <AlertTriangle className="h-5 w-5" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Tables Section */}
      <Tabs defaultValue="leads" className="w-full mt-6">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <Card className={isTrainingMode ? "border-amber-200" : ""}>
            <CardHeader>
              <CardTitle>Leads Table Audit</CardTitle>
              <CardDescription>
                Showing joins with Contacts and Properties.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className={isTrainingMode ? "bg-amber-50" : "bg-slate-50"}>
                      <TableHead className="w-[100px]">ID / Date</TableHead>
                      <TableHead>Status / Source</TableHead>
                      <TableHead>Primary Contact</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Environment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Loading...</TableCell>
                      </TableRow>
                    ) : leads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                            {isTrainingMode ? "No test data found. Click 'Generate Test Data' to seed." : "No leads found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-mono text-xs">
                            <div className="text-indigo-600 font-bold mb-1 truncate w-24" title={lead.id}>
                              {lead.id.split('-')[0]}...
                            </div>
                            <div className="text-slate-500">
                              {format(new Date(lead.created_at), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="mb-1 bg-white">
                              {lead.status || 'UNKNOWN'}
                            </Badge>
                            <div className="text-xs text-slate-500 font-medium">
                              {lead.source || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.contact ? (
                              <div className="text-sm">
                                <div className="font-medium">
                                  {lead.contact.first_name} {lead.contact.last_name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {lead.contact.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No linked contact</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.property ? (
                              <div className="text-sm">
                                <div className="font-medium text-slate-700">
                                  {lead.property.address1}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {lead.property.city}, {lead.property.state}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No linked property</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.is_test_data ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Test Data</Badge>
                            ) : (
                                <Badge variant="outline" className="text-slate-500">Production</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <Card className={isTrainingMode ? "border-amber-200" : ""}>
            <CardHeader>
              <CardTitle>Accounts Table Audit</CardTitle>
              <CardDescription>
                Checking for Residential vs B2B types.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className={isTrainingMode ? "bg-amber-50" : "bg-slate-50"}>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead className="text-right">Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                       <TableRow>
                         <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Loading...</TableCell>
                       </TableRow>
                    ) : accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No accounts found.</TableCell>
                      </TableRow>
                    ) : (
                      accounts.map((acc) => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">
                            {acc.name}
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{acc.id}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              (acc.type || '').toLowerCase().includes('residential') 
                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200' 
                                : 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200'
                            }>
                              {acc.type || 'Unspecified'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                             <span className="text-sm text-slate-600">{acc.partner_status || 'N/A'}</span>
                          </TableCell>
                          <TableCell>
                             {acc.is_test_data ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Test Data</Badge>
                            ) : (
                                <Badge variant="outline" className="text-slate-500">Production</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-500">
                            {format(new Date(acc.created_at), 'MMM d, yyyy h:mm a')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}