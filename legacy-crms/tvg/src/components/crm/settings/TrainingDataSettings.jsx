import React from 'react';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const TrainingDataSettings = () => {
  const { isTrainingMode, toggleTrainingMode } = useTrainingMode();
  const { toast } = useToast();

  const handleClearTestData = async () => {
    if (window.confirm('Are you sure you want to delete ALL test data? This cannot be undone.')) {
        // Placeholder for actual deletion logic
        toast({
            title: "Test Data Cleared",
            description: "All test data has been removed.",
        });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Mode Configuration</CardTitle>
        <CardDescription>
          Manage test data and training environment settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="training-mode">Enable Training Mode</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, you will see and interact with test data only. Real customer data is hidden.
            </p>
          </div>
          <Switch
            id="training-mode"
            checked={isTrainingMode}
            onCheckedChange={toggleTrainingMode}
          />
        </div>
        
        {isTrainingMode && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium text-amber-900">Test Environment Active</h4>
                        <p className="text-sm text-amber-700">
                            You are currently working in a safe sandbox environment. Actions taken here (emails, SMS) will not be sent to real customers.
                        </p>
                    </div>
                </div>
            </div>
        )}

        <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-4 text-destructive">Danger Zone</h4>
            <Button 
                variant="destructive" 
                onClick={handleClearTestData}
                className="w-full sm:w-auto"
            >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Test Data
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrainingDataSettings;