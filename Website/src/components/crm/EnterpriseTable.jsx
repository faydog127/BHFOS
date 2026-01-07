
import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const EnterpriseTable = ({ headers, children, className }) => {
  return (
    <div className={cn("rounded-md border border-slate-200 overflow-hidden", className)}>
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow className="hover:bg-slate-50 border-slate-200">
            {headers.map((header, idx) => (
              <TableHead key={idx} className="font-semibold text-slate-700 h-10">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {children}
        </TableBody>
      </Table>
    </div>
  );
};

export const EnterpriseRow = ({ children, className, onClick }) => (
  <TableRow 
    className={cn(
      "hover:bg-slate-50/50 transition-colors border-slate-100", 
      onClick && "cursor-pointer",
      className
    )}
    onClick={onClick}
  >
    {children}
  </TableRow>
);

export const EnterpriseCell = ({ children, className }) => (
  <TableCell className={cn("py-3 text-slate-600", className)}>
    {children}
  </TableCell>
);
