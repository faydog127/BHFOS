import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Database, CheckCircle } from 'lucide-react';
import { seedDatabase } from '@/lib/seedHVACData';
import { useToast } from '@/components/ui/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const SeedDataButton = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [stats, setStats] = useState(null);

  const handleSeed = async () => {
    setLoading(true);
    setStats(null);
    try {
      const result = await seedDatabase(25);
      if (result.success) {
        setStats(result);
        toast({
          title: "Seeding Complete",
          description: `Successfully inserted ${result.inserted} records.`,
          className: "bg-green-50 border-green-200 text-green-800",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Seeding Failed",
          description: result.error || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error('Seeding error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred during seeding.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full border-slate-200 shadow-sm bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <Database className="h-4 w-4 text-indigo-500" />
          Data Seeding
        </CardTitle>
        <CardDescription className="text-xs">
          Generate realistic test records for HVAC partner prospects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleSeed} 
          disabled={loading}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white transition-all"
          size="sm"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Records...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Seed 25 Prospects
            </>
          )}
        </Button>
        {stats && (
          <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-md text-xs text-green-800 flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
            <div className="space-y-1">
              <p className="font-bold">Operation Successful</p>
              <p>Inserted: <span className="font-mono font-bold">{stats.inserted}</span></p>
              {stats.breakdown && (
                <div className="text-[10px] opacity-90 grid grid-cols-2 gap-x-4">
                  <span>Avg Score: {stats.breakdown.avgScore}</span>
                  <span>Counties: {Object.keys(stats.breakdown.byCounty).length}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SeedDataButton;