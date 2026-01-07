import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileDiff, Copy, Check, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export default function FixDiffModal({ open, onOpenChange, log }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  if (!log) return null;

  const fixPlan = log.doctor_response_jsonb?.recommendation?.fix_plan || log.doctor_response_jsonb?.fix_plan;
  const steps = fixPlan?.steps || [];

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "SQL code copied to clipboard.",
    });
  };

  const getCombinedSql = (type) => {
    return steps.map(step => {
      const sql = type === 'apply' ? step.sql : step.inverse_sql;
      return `-- Step ${step.step_index || steps.indexOf(step) + 1}: ${step.description}\n${sql}`;
    }).join('\n\n');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Fix vs. Rollback Diff</DialogTitle>
              <DialogDescription>
                Compare the applied fix SQL with the generated rollback strategy.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="split" className="flex-1 flex flex-col">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
                <TabsTrigger value="split">Split View</TabsTrigger>
                <TabsTrigger value="unified">Unified View</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="split" className="flex-1 flex min-h-0 p-6 gap-4 mt-0">
              {/* Applied Fix Column */}
              <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden bg-slate-50">
                <div className="p-2 border-b bg-white flex justify-between items-center">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Applied Fix (Forward)
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(getCombinedSql('apply'))}>
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap font-medium">
                    {getCombinedSql('apply') || '-- No SQL provided'}
                  </pre>
                </ScrollArea>
              </div>

              {/* Rollback Column */}
              <div className="flex-1 flex flex-col min-h-0 border rounded-md overflow-hidden bg-slate-50">
                <div className="p-2 border-b bg-white flex justify-between items-center">
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    Rollback Strategy (Inverse)
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(getCombinedSql('rollback'))}>
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap font-medium">
                    {getCombinedSql('rollback') || '-- No inverse SQL provided'}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="unified" className="flex-1 min-h-0 p-6 mt-0">
               <ScrollArea className="h-full border rounded-md bg-slate-950 p-4">
                 {steps.map((step, idx) => (
                   <div key={idx} className="mb-8 font-mono text-sm">
                     <div className="text-slate-500 mb-2 border-b border-slate-800 pb-1">
                       -- Step {idx + 1}: {step.description}
                     </div>
                     <div className="grid grid-cols-1 gap-4">
                       <div className="text-green-400 pl-4 border-l-2 border-green-900/50">
                         <span className="text-green-700 select-none mr-2">++</span>
                         {step.sql}
                       </div>
                       <div className="text-red-400 pl-4 border-l-2 border-red-900/50">
                         <span className="text-red-700 select-none mr-2">--</span>
                         {step.inverse_sql}
                       </div>
                     </div>
                   </div>
                 ))}
               </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 border-t bg-slate-50">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}