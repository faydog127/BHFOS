import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const EnterpriseCard = ({ children, className, ...props }) => (
  <Card className={cn("border-slate-200 shadow-sm bg-white", className)} {...props}>
    {children}
  </Card>
);

export const EnterpriseCardHeader = ({ title, subtitle, action, className, ...props }) => (
  <CardHeader className={cn("border-b border-slate-100 py-4 px-6", className)} {...props}>
    <div className="flex items-center justify-between">
      <div>
        {title && <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>}
        {subtitle && <CardDescription className="mt-1 text-slate-500">{subtitle}</CardDescription>}
      </div>
      {action && <div>{action}</div>}
    </div>
  </CardHeader>
);

export const EnterpriseCardContent = ({ children, className, ...props }) => (
  <CardContent className={cn("p-6", className)} {...props}>
    {children}
  </CardContent>
);

export const EnterpriseCardFooter = ({ children, className, ...props }) => (
  <CardFooter className={cn("bg-slate-50 border-t border-slate-100 p-4", className)} {...props}>
    {children}
  </CardFooter>
);