"use client";

import { Field, FieldArray } from "formik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

export default function Expenses({
  values,
  touched,
  errors,
  disabled = false,
}: any) {
  return (
    <div className={disabled == true ? "hidden space-y-4" : "space-y-4"}>
      <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b flex items-center gap-2">
        Expenses
      </h3>
      <div className="rounded-md border overflow-hidden">
        <FieldArray name="expenses">
          {({ push, remove }) => (
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                    <th className="p-3 border-r font-bold w-[300px]">
                      Particular
                    </th>
                    <th className="p-3 border-r font-bold w-[150px]">Amount</th>
                    <th className="p-3 border-r font-bold w-[45px] text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {!values.expenses || values.expenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-8 text-center text-muted-foreground text-sm"
                      >
                        No expenses added. Click "Add Expense" to add one.
                      </td>
                    </tr>
                  ) : (
                    values.expenses?.map((exp: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-blue-50 transition-colors"
                      >
                        <td className="p-2 space-y-2 border-r">
                          <Field
                            as={Input}
                            name={`expenses.${index}.particular`}
                            placeholder="Enter particular"
                            className={`h-8 text-xs ${touched.expenses?.[index]?.particular && errors.expenses?.[index]?.particular ? "border-red-500 border-2" : ""}`}
                            disabled={disabled}
                          />
                          {touched.expenses?.[index]?.particular &&
                            errors.expenses?.[index]?.particular && (
                              <p className="text-xs text-red-500 mt-1">
                                {errors.expenses[index].particular}
                              </p>
                            )}
                        </td>
                        <td className="p-2 border-r">
                          <Field
                            as={Input}
                            type="number"
                            name={`expenses.${index}.amount`}
                            placeholder="0.00"
                            className={`h-8 text-xs ${touched.expenses?.[index]?.amount && errors.expenses?.[index]?.amount ? "border-red-500 border-2" : ""}`}
                            disabled={disabled}
                          />
                          {touched.expenses?.[index]?.amount &&
                            errors.expenses?.[index]?.amount && (
                              <p className="text-xs text-red-500 mt-1">
                                {errors.expenses[index].amount}
                              </p>
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
                  onClick={() => push({ particular: "", amount: "" })}
                  className="text-primary text-xs h-7"
                  disabled={disabled}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Expense
                </Button>
              </div>
            </div>
          )}
        </FieldArray>
      </div>
      {touched.expenses &&
        typeof errors.expenses === "string" &&
        errors.expenses && (
          <p className="text-xs text-red-500 mt-2 px-1">{errors.expenses}</p>
        )}
    </div>
  );
}
