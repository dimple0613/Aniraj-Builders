'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatIndianCurrency } from '@/lib/financial-year';

interface ReceivablesPayablesWidgetProps {
  receivable: number;
  payable: number;
  partyCount: number;
}

export function ReceivablesPayablesWidget({ 
  receivable, 
  payable, 
  partyCount 
}: ReceivablesPayablesWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Receivables & Payables</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Receivable</p>
            <p className="text-lg font-bold text-green-600">
              ₹{formatIndianCurrency(receivable)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Payable</p>
            <p className="text-lg font-bold text-red-600">
              ₹{formatIndianCurrency(payable)}
            </p>
          </div>
        </div>
        
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Balance</p>
          <p className={`text-2xl font-bold ${receivable - payable >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {receivable - payable >= 0 ? '+' : '-'}₹{formatIndianCurrency(Math.abs(receivable - payable))}
          </p>
        </div>
        
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{partyCount}</span> parties tracked
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
