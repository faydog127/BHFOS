
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight } from 'lucide-react';

// Simple placeholder page for handling root / accesses where no tenant is specified
const SelectTenant = () => {
  const commonTenants = [
    { id: 'tvg', name: 'The Vent Guys (Main)' },
    { id: 'demo', name: 'Demo Environment' },
    { id: 'installworxs', name: 'InstallWorxs' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Select Workspace</CardTitle>
          <CardDescription>
            You visited the root domain. Please select a tenant workspace to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {commonTenants.map((tenant) => (
            <Button 
              key={tenant.id} 
              variant="outline" 
              className="w-full justify-between h-14" 
              asChild
            >
              <Link to={`/${tenant.id}/home`}>
                <span className="font-semibold">{tenant.name}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SelectTenant;
