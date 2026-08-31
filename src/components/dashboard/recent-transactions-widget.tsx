'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatIndianCurrency } from '@/lib/financial-year';

interface RecentTransaction {
  id: string;
  transaction_date: string;
  ledger: string;
  transaction_type: string;
  credit_amount: number;
  debit_amount: number;
  party?: { name: string };
}

interface RecentTransactionsWidgetProps {
  transactions: RecentTransaction[];
}

export function RecentTransactionsWidget({ transactions }: RecentTransactionsWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent transactions
          </p>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between pb-2 border-b last:border-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{tx.ledger}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(tx.transaction_date).toLocaleDateString()} • {tx.party?.name || '-'}
                  </span>
                </div>
                <div className="text-right">
                  {tx.debit_amount > 0 ? (
                    <span className="text-sm font-medium text-red-600">
                      -₹{formatIndianCurrency(tx.debit_amount)}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-green-600">
                      +₹{formatIndianCurrency(tx.credit_amount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
