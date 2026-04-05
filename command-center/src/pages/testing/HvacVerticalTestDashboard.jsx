import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Play, Download, ShieldAlert, Smartphone, Swords, Database, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';

const MODULES = {
    DEFENSE: {
        id: 'module_1',
        title: 'Module 1: Defense (Chaos Flags)',
        icon: ShieldAlert,
        description: 'Verifies automated and manual chaos flag triggers.',
        tests: [
            { id: 'd1', name: 'Hard Competitor Data', query: (s) => s.from('partner_prospects').select('*').eq('chaos_flag_type', 'HARD_COMPETITOR').limit(1), expected: 'At least 1 record' },
            { id: 'd2', name: 'Geo Vampire Data', query: (s) => s.from('partner_prospects').select('*').eq('chaos_flag_type', 'GEOGRAPHIC_VAMPIRE').limit(1), expected: 'At least 1 record' },
            { id: 'd3', name: 'Ethics Breach Data', query: (s) => s.from('partner_prospects').select('*').eq('chaos_flag_type', 'ETHICS_BREACH').limit(1), expected: 'At least 1 record' },
            { id: 'd4', name: 'Financial Black Hole', query: (s) => s.from('partner_prospects').select('*').eq('chaos_flag_type', 'FINANCIAL_BLACK_HOLE').limit(1), expected: 'At least 1 record' },
            { id: 'd5', name: 'Abuse Protocol', query: (s) => s.from('partner_prospects').select('*').eq('chaos_flag_type', 'ABUSE_PROTOCOL').limit(1), expected: 'At least 1 record' },
        ]
    },
    CONSOLE: {
        id: 'module_2',
        title: 'Module 2: Call Console',
        icon: Smartphone,
        description: 'Verifies UI state data conditions for the console.',
        tests: [
            { id: 'c1', name: 'Green State Candidates', query: (s) => s.from('partner_prospects').select('*').eq('chaos_flag', false).eq('invoice_overdue_days', 0).limit(1), expected: 'Clean records exist' },
            { id: 'c2', name: 'Yellow State (Credit)', query: (s) => s.from('partner_prospects').select('*').gt('invoice_overdue_days', 60).eq('chaos_flag', false).limit(1), expected: 'Overdue records exist' },
            { id: 'c3', name: 'Red State (Chaos)', query: (s) => s.from('partner_prospects').select('*').eq('chaos_flag', true).limit(1), expected: 'Chaos records exist' },
            { id: 'c4', name: 'Blacklist Registry', query: (s) => s.from('blacklist_identifiers').select('*').limit(1), expected: 'Blacklist table populated' },
        ]
    },
    OFFENSE: {
        id: 'module_3',
        title: 'Module 3: Offense',
        icon: Swords,
        description: 'Verifies partner lifecycle and engagement protocols.',
        tests: [
            { id: 'o1', name: 'Active Partners', query: (s) => s.from('partner_prospects').select('*').eq('partner_status', 'ACTIVE').limit(1), expected: 'Status: ACTIVE exists' },
            { id: 'o2', name: 'At-Risk Partners', query: (s) => s.from('partner_prospects').select('*').eq('partner_status', 'AT_RISK').limit(1), expected: 'Status: AT_RISK exists' },
            { id: 'o4', name: 'Dormant Partners', query: (s) => s.from('partner_prospects').select('*').eq('partner_status', 'DORMANT').limit(1), expected: 'Status: DORMANT exists' },
        ]
    },
    TECHNICAL: {
        id: 'module_4',
        title: 'Module 4: Technical',
        icon: Database,
        description: 'Verifies database schema and integrity.',
        tests: [
            { id: 't1', name: 'Prospects Table', query: (s) => s.from('partner_prospects').select('id').limit(1), expected: 'Table accessible' },
            { id: 't3', name: 'Tasks Table', query: (s) => s.from('crm_tasks').select('id').limit(1), expected: 'Table accessible' },
            { id: 't4', name: 'Column: Chaos Flag', query: (s) => s.from('partner_prospects').select('chaos_flag').limit(1), expected: 'Column exists' },
        ]
    }
};

const HvacVerticalTestDashboard = () => {
    const { toast } = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState({});
    const [overallStatus, setOverallStatus] = useState({ passed: 0, failed: 0, total: 0 });

    const runTest = async (test) => {
        try {
            const { data, error } = await test.query(supabase);
            const passed = !error && data && data.length > 0;
            return { id: test.id, name: test.name, passed, actual: error ? error.message : (passed ? 'Condition Met' : 'No Data Found'), timestamp: new Date().toISOString() };
        } catch (e) {
            return { id: test.id, name: test.name, passed: false, actual: e.message, timestamp: new Date().toISOString() };
        }
    };

    const handleRunAll = async () => {
        setIsRunning(true);
        setResults({});
        let passedCount = 0;
        let failedCount = 0;
        let totalCount = 0;
        const newResults = {};

        for (const moduleKey of Object.keys(MODULES)) {
            const module = MODULES[moduleKey];
            for (const test of module.tests) {
                const result = await runTest(test);
                newResults[test.id] = result;
                if (result.passed) passedCount++; else failedCount++;
                totalCount++;
                setResults(prev => ({ ...prev, [test.id]: result }));
                setOverallStatus({ passed: passedCount, failed: failedCount, total: totalCount });
            }
        }
        setIsRunning(false);
        toast({ title: "Test Suite Completed", description: `Passed: ${passedCount} | Failed: ${failedCount}` });
    };

    const calculateProgress = () => overallStatus.total === 0 ? 0 : Math.round((overallStatus.passed / overallStatus.total) * 100);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
            <Helmet><title>HVAC QA Dashboard</title></Helmet>
            <div className="flex justify-between items-center">
                <div><h1 className="text-3xl font-bold text-gray-900">HVAC QA Dashboard</h1></div>
                <div className="flex gap-3">
                    <Button onClick={handleRunAll} disabled={isRunning}>{isRunning ? "Running..." : "Run All Tests"}</Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Passed</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-green-600">{overallStatus.passed}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Failed</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-red-600">{overallStatus.failed}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pass Rate</CardTitle></CardHeader><CardContent><div className="flex items-end gap-2"><div className="text-3xl font-bold text-blue-600">{calculateProgress()}%</div><Progress value={calculateProgress()} className="mb-2 h-2 w-24" /></div></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 gap-8">
                {Object.values(MODULES).map((module) => (
                    <Card key={module.id}>
                        <CardHeader><CardTitle className="flex items-center gap-2"><module.icon className="h-5 w-5"/>{module.title}</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {module.tests.map((test) => {
                                    const result = results[test.id];
                                    return (
                                        <div key={test.id} className="grid grid-cols-12 gap-4 p-4 items-center">
                                            <div className="col-span-4 font-medium">{test.name}</div>
                                            <div className="col-span-4 text-sm text-gray-500">Exp: {test.expected}</div>
                                            <div className="col-span-4 flex justify-end">
                                                {result ? <Badge variant={result.passed ? "success" : "destructive"} className={result.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{result.passed ? "PASS" : "FAIL"}</Badge> : <Badge variant="outline">WAITING</Badge>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
export default HvacVerticalTestDashboard;