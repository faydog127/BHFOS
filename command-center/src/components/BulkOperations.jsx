import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Download, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';

const BulkOperations = ({ tableName, label, onImportSuccess }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importStats, setImportStats] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;

      if (!data || data.length === 0) {
        toast({ title: "No data", description: "There is no data to export." });
        return;
      }

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(fieldName => {
            let val = row[fieldName] === null ? '' : row[fieldName];
            // Escape quotes and wrap in quotes
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${label.toLowerCase().replace(' ', '_')}_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Export Successful", description: `Downloaded ${data.length} records.` });

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Export Failed", description: error.message });
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      setImporting(true);
      try {
        const text = e.target.result;
        const [headerLine, ...lines] = text.split('\n');
        const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
        
        const records = lines
          .filter(line => line.trim())
          .map(line => {
             // Simple CSV split (note: doesn't handle commas inside quotes perfectly without regex)
             const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
             const record = {};
             headers.forEach((h, i) => {
                 if (values[i] !== undefined) record[h] = values[i] === '' ? null : values[i];
             });
             return record;
          });

        if (records.length === 0) throw new Error("No valid records found in file.");

        // Insert into Supabase
        const { error } = await supabase.from(tableName).insert(records);
        if (error) throw error;

        setImportStats({ total: records.length });
        toast({ title: "Import Successful", description: `Imported ${records.length} records.` });
        if (onImportSuccess) onImportSuccess();
        setTimeout(() => setIsImportOpen(false), 2000);

      } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Import Failed", description: error.message || "Invalid CSV format" });
      } finally {
        setImporting(false);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
        {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
        Export {label}
      </Button>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogTrigger asChild>
            <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" /> Import {label}
            </Button>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Import {label}</DialogTitle>
                <DialogDescription>Upload a CSV file to bulk import records.</DialogDescription>
            </DialogHeader>
            
            <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                 onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="w-10 h-10 text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-600">Click to upload CSV</p>
                <p className="text-xs text-slate-400 mt-1">Headers must match database columns exactly</p>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv" 
                    onChange={handleFileChange}
                />
            </div>

            {importing && (
                <div className="flex items-center gap-2 text-sm text-blue-600 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing records...
                </div>
            )}

            {importStats && (
                <div className="p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" /> Successfully imported {importStats.total} records!
                </div>
            )}

            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsImportOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BulkOperations;