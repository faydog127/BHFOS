import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Database, Table as TableIcon, RefreshCw, Search, Server } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TableStructureViewer = ({ tableName, columns }) => (
  <Card className="mb-6 bg-slate-50 border-slate-200">
    <CardHeader className="pb-2">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-indigo-600" />
        <CardTitle className="text-sm font-mono font-bold text-indigo-900">{tableName}</CardTitle>
      </div>
      <CardDescription className="text-xs">Identified Table Structure</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-wrap gap-2">
        {columns.map((col) => (
          <Badge key={col} variant="outline" className="bg-white font-mono text-xs text-slate-600 border-slate-300">
            {col}
          </Badge>
        ))}
      </div>
    </CardContent>
  </Card>
);

const DataTools = () => {
  const [prospects, setProspects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProspects = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('partner_prospects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProspects(data || []);
    } catch (err) {
      console.error("Error fetching prospects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const filteredProspects = prospects.filter(p => 
    p.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <Helmet>
        <title>Data Inspector | CRM</title>
      </Helmet>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="h-6 w-6 text-indigo-600" />
            Data Inspector
          </h1>
          <p className="text-slate-500">Explore database tables and records.</p>
        </div>
        <Button variant="outline" onClick={fetchProspects} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="prospects">
        <TabsList>
          <TabsTrigger value="prospects">Partner Prospects (HVAC)</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="prospects" className="space-y-6">
          
          {/* Table Structure Visualization */}
          <TableStructureViewer 
            tableName="public.partner_prospects" 
            columns={[
              "id (uuid)", 
              "business_name (text)", 
              "contact_name (text)", 
              "phone (text)", 
              "email (text)", 
              "city (text)", 
              "county (text) [NEW]", 
              "service_type (text) [NEW]", 
              "score (int) [NEW]", 
              "status (text)", 
              "notes (text)"
            ]} 
          />

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-slate-500" />
                  Records: {prospects.length}
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search business or city..." 
                    className="pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">Loading data...</TableCell>
                      </TableRow>
                    ) : filteredProspects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">No records found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredProspects.map((prospect) => (
                        <TableRow key={prospect.id}>
                          <TableCell className="font-medium">{prospect.business_name}</TableCell>
                          <TableCell>{prospect.contact_name || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{prospect.phone}</TableCell>
                          <TableCell>{prospect.city}, {prospect.county}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{prospect.service_type || 'General'}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold ${prospect.score >= 80 ? 'text-green-600' : 'text-slate-600'}`}>
                              {prospect.score}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={prospect.status === 'new' ? 'default' : 'secondary'}>
                              {prospect.status}
                            </Badge>
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

        <TabsContent value="leads">
            <Card className="p-8 text-center text-slate-500">
                Leads inspector view not requested for this task.
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataTools;