"use client";

import { Field, FieldArray } from "formik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";

export default function Employees({
  values,
  allEmployees,
  setFieldValue,
  createdAtDate,
  touched,
  errors,
  disabled = false,
}: any) {
  const getSalaryForDate = (emp: any, targetDate: string | null) => {
    if (!emp.prices || emp.prices.length === 0) {
      return emp.currentSalary || 0;
    }

    const target = targetDate ? new Date(targetDate) : new Date();

    const activePrice = emp.prices.find((p: any) => {
      const startDate = new Date(p.start_date);
      const expiryDate = p.expiry_date ? new Date(p.expiry_date) : null;

      if (expiryDate === null) {
        return startDate <= target;
      }
      return startDate <= target && target <= expiryDate;
    });

    if (activePrice) {
      return parseFloat(activePrice.price) || 0;
    }

    const sortedPrices = [...emp.prices].sort(
      (a: any, b: any) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );

    const closestPrice = sortedPrices.find((p: any) => {
      const startDate = new Date(p.start_date);
      return startDate <= target;
    });

    return closestPrice
      ? parseFloat(closestPrice.price)
      : parseFloat(emp.currentSalary) || 0;
  };

  const handleEmployeeSelect = (index: number, emp: any) => {
    const salary = getSalaryForDate(emp, createdAtDate);
    setFieldValue(`employeeIds.${index}.employee_id`, emp.id);
    setFieldValue(`employeeIds.${index}.employee_name`, emp.name);
    setFieldValue(`employeeIds.${index}.salary`, salary);
  };

  return (
    <div className={disabled == true ? "hidden space-y-4" : "space-y-4"}>
      <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b flex items-center gap-2">
        Employees
      </h3>
      <div className="rounded-md border overflow-hidden">
        <FieldArray name="employeeIds">
          {({ push, remove }) => (
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                    <th className="p-3 border-r font-bold w-[200px]">
                      Employee Name
                    </th>
                    <th className="p-3 border-r font-bold w-[100px]">Salary</th>
                    <th className="p-3 border-r font-bold w-[80px] text-center">
                      Overtime
                    </th>
                    <th className="p-3 border-r font-bold w-[100px]">
                      OT Hours
                    </th>
                    <th className="p-3 border-r font-bold w-[45px] text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {!values.employeeIds || values.employeeIds.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-muted-foreground text-sm"
                      >
                        No employees added. Click "Add Employee" to add one.
                      </td>
                    </tr>
                  ) : (
                    values.employeeIds?.map((emp: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-blue-50 transition-colors"
                      >
                        <td className="p-2 space-y-2 border-r">
                          <Field name={`employeeIds.${index}.employee_id`}>
                            {() => (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`whitespace-normal w-full justify-between font-normal h-8 text-xs ${touched.employeeIds?.[index]?.employee_id && errors.employeeIds?.[index]?.employee_id ? "border-red-500 border-2" : ""}`}
                                    disabled={disabled}
                                  >
                                    <span className="max-w-[180px] truncate font-medium">
                                      {emp.employee_name || "Select employee"}
                                    </span>
                                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-[300px] p-0"
                                  align="start"
                                >
                                  <Command>
                                    <CommandInput
                                      placeholder="Search employees..."
                                      className="h-8"
                                    />
                                    <CommandEmpty>
                                      No employee found.
                                    </CommandEmpty>
                                    <CommandGroup className="max-h-60 overflow-auto">
                                      {allEmployees?.map((e: any) => (
                                        <CommandItem
                                          key={e.id}
                                          value={e.name?.toLowerCase() || ""}
                                          onSelect={() =>
                                            handleEmployeeSelect(index, e)
                                          }
                                          className="cursor-pointer text-xs"
                                        >
                                          {e.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            )}
                          </Field>
                          {touched.employeeIds?.[index]?.employee_id &&
                            errors.employeeIds?.[index]?.employee_id && (
                              <p className="text-xs text-red-500 mt-1">
                                {errors.employeeIds[index].employee_id}
                              </p>
                            )}
                        </td>
                        <td className="p-2 border-r text-xs">
                          {emp.employee_id ? (
                            <span className="font-medium">
                              ₹{emp.salary?.toLocaleString() || "0"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2 border-r text-center">
                          <Checkbox
                            checked={emp.is_overtime}
                            onCheckedChange={(checked) => {
                              setFieldValue(
                                `employeeIds.${index}.is_overtime`,
                                checked,
                              );
                              if (
                                checked &&
                                (!emp.overtime_hours ||
                                  parseFloat(emp.overtime_hours) === 0)
                              ) {
                                setFieldValue(
                                  `employeeIds.${index}.overtime_hours`,
                                  "1",
                                );
                              }
                            }}
                            disabled={disabled}
                          />
                        </td>
                        <td className="p-1 border-r">
                          {emp.is_overtime ? (
                            <Field
                              as={Input}
                              type="number"
                              name={`employeeIds.${index}.overtime_hours`}
                              placeholder="Hours"
                              className="h-8 text-xs"
                              min={1}
                              max={16}
                              onChange={(e: any) => {
                                const val = parseFloat(e.target.value);
                                if (val > 0 && val <= 16) {
                                  setFieldValue(
                                    `employeeIds.${index}.overtime_hours`,
                                    val.toString(),
                                  );
                                } else if (val > 16) {
                                  setFieldValue(
                                    `employeeIds.${index}.overtime_hours`,
                                    "16",
                                  );
                                }
                              }}
                              disabled={disabled}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </td>
                        <td className="p-1 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => remove(index)}
                            disabled={disabled}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-2 bg-muted/10 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    push({
                      employee_id: "",
                      employee_name: "",
                      salary: 0,
                      is_overtime: false,
                      overtime_hours: "",
                    })
                  }
                  className="text-primary text-xs h-7"
                  disabled={disabled}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Employee
                </Button>
              </div>
            </div>
          )}
        </FieldArray>
      </div>
      {touched.employeeIds &&
        errors.employeeIds &&
        typeof errors.employeeIds === "string" && (
          <p className="text-xs text-red-500 mt-2 px-1">{errors.employeeIds}</p>
        )}
    </div>
  );
}
