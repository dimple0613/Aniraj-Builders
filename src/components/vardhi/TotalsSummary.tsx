"use client";

export default function TotalsSummary({ values }: any) {
    const existingItemsTotal = (values.vardhiItems || [])
        .filter((item: any) => item.item_id || item.item_name)
        .reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);

    const additionalItemsTotal = (values.additionalItems || [])
        .filter((item: any) => item.item_id || item.item_name)
        .reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);

    const differenceTotal = additionalItemsTotal - existingItemsTotal;

    const employeesTotal = (values.employeeIds || [])
        .filter((emp: any) => emp.employee_id)
        .reduce((sum: number, emp: any) => {
            const baseSalary = parseFloat(emp.salary) || 0;
            const overtimeHours = parseFloat(emp.overtime_hours) || 0;
            const overtimeSalary = (emp.is_overtime && overtimeHours > 0) ? (baseSalary / 8) * overtimeHours : 0;
            return sum + baseSalary + overtimeSalary;
        }, 0);

    const expensesTotal = (values.expenses || [])
        .filter((exp: any) => exp.particular && exp.amount > 0)
        .reduce((sum: number, exp: any) => sum + (parseFloat(exp.amount) || 0), 0);

    const grandTotal = existingItemsTotal + additionalItemsTotal;

    return (
        <div className="">
            <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b mb-3">
                Totals Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Final Total</p>
                    <p className="text-xl font-bold text-primary">
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Existing Items</p>
                    <p className="text-lg font-semibold">
                        ₹{existingItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Additional Items</p>
                    <p className="text-lg font-semibold">
                        ₹{additionalItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                {/* <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Difference</p>
                    <p className={`text-lg font-semibold ${differenceTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {differenceTotal >= 0 ? '+' : ''}₹{differenceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div> */}
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Employees</p>
                    <p className="text-lg font-semibold">
                        ₹{employeesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Expenses</p>
                    <p className="text-lg font-semibold">
                        ₹{expensesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>
        </div>
    );
}
