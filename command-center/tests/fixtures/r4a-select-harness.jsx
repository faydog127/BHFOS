import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../src/index.css';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../src/components/ui/select.jsx';

const customers = Array.from(
  { length: 60 },
  (_, index) => ({
    id: `mock-customer-${String(index + 1).padStart(3, '0')}`,
    label: `Mock Customer ${String(index + 1).padStart(3, '0')}`,
  }),
);

const shortOptions = [
  { value: 'dryer_vent', label: 'Dryer Vent' },
  { value: 'air_duct', label: 'Air Duct' },
  { value: 'hvac', label: 'HVAC' },
];

function R4ASelectHarness() {
  const [customerId, setCustomerId] = useState('');
  const [inspectionType, setInspectionType] = useState('dryer_vent');
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  return (
    <main className="min-h-[200vh] bg-slate-50 p-6 text-slate-900">
      <section className="mx-auto max-w-md space-y-6 rounded-lg bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold">R4A Select Test Harness</h1>
          <p className="text-sm text-slate-600">Deterministic mock data only; no application services are loaded.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="r4a-customer-select">Customer (Lead)</label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger id="r4a-customer-select" aria-label="Customer (Lead)">
              <SelectValue placeholder="Select mock customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <output data-testid="selected-customer">
            Selected customer: {selectedCustomer?.label || 'None'}
          </output>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="r4a-inspection-type">Inspection Type</label>
          <Select value={inspectionType} onValueChange={setInspectionType}>
            <SelectTrigger id="r4a-inspection-type" aria-label="Inspection Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {shortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <output data-testid="selected-inspection-type">Selected type: {inspectionType}</output>
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<R4ASelectHarness />);
