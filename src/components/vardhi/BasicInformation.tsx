"use client";

import { Field } from "formik";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BasicInformation({
  setFieldValue,
  zones,
  touched,
  errors,
  workTypes,
  disabled = false,
}: any) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
        Basic Information
      </h3>
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <tbody className="divide-y">
              <tr className="hover:bg-blue-50 transition-colors">
                <td className="p-2 border-r bg-slate-100 font-bold text-xs">
                  Zone Number :
                </td>
                <td className="p-1 border-r">
                  <Field name="zone_id">
                    {({ field }: any) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) =>
                          setFieldValue("zone_id", value)
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-8 text-xs border-0 shadow-none focus-visible:ring-1">
                          <SelectValue placeholder="Select zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {zones.map((zone: any) => (
                            <SelectItem key={zone.id} value={zone.id}>
                              {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  {touched.zone_id && errors.zone_id && (
                    <p className="text-xs text-red-500">
                      {errors.zone_id as string}
                    </p>
                  )}
                </td>
                <td className="p-2 border-r bg-slate-100 font-bold text-xs">
                  તારીખ :
                </td>
                <td className="p-1 border-r">
                  <Field
                    as={Input}
                    type="date"
                    name="date"
                    className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                    disabled={disabled}
                  />
                  {touched.date && errors.date && (
                    <p className="text-xs text-red-500">
                      {errors.date as string}
                    </p>
                  )}
                </td>
              </tr>
              <tr className="hover:bg-blue-50 transition-colors">
                <td className="p-2 border-r bg-slate-100 font-bold text-xs">
                  વર્ધી કેવી રીતે મળી? :
                </td>
                <td className="p-1 border-r">
                  <Field
                    as={Input}
                    name="varshi_assign_by"
                    className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                    disabled={disabled}
                  />
                  {touched.varshi_assign_by && errors.varshi_assign_by && (
                    <p className="text-xs text-red-500">
                      {errors.varshi_assign_by as string}
                    </p>
                  )}
                </td>
                <td className="p-2 border-r bg-slate-100 font-bold text-xs">
                  Work Type :
                </td>
                <td className="p-1 border-r">
                  <Field name="work_type">
                    {({ field }: any) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) =>
                          setFieldValue("work_type", value)
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-8 text-xs border-0 shadow-none focus-visible:ring-1">
                          <SelectValue placeholder="Select work type" />
                        </SelectTrigger>
                        <SelectContent>
                          {workTypes.map((wt: any) => (
                            <SelectItem key={wt.id} value={wt.id}>
                              {wt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  {touched.work_type && errors.work_type && (
                    <p className="text-xs text-red-500">
                      {errors.work_type as string}
                    </p>
                  )}
                </td>
              </tr>
              <tr className="hover:bg-blue-50 transition-colors">
                <td className="p-2 border-r bg-slate-100 font-bold text-xs">
                  શરૂઆત તારીખ :
                </td>
                <td className="p-1 border-r">
                  <Field
                    as={Input}
                    type="date"
                    name="vardhi_start_date"
                    className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                    disabled={disabled}
                  />
                  {touched.vardhi_start_date && errors.vardhi_start_date && (
                    <p className="text-xs text-red-500">
                      {errors.vardhi_start_date as string}
                    </p>
                  )}
                </td>
                <td className="p-2 border-r bg-slate-100 font-bold text-xs">
                  અંત તારીખ :
                </td>
                <td className="p-1 border-r">
                  <Field
                    as={Input}
                    type="date"
                    name="vardhi_end_date"
                    className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                    disabled={disabled}
                  />
                  {touched.vardhi_end_date && errors.vardhi_end_date && (
                    <p className="text-xs text-red-500">
                      {errors.vardhi_end_date as string}
                    </p>
                  )}
                </td>
              </tr>
              <tr className="hover:bg-blue-50 transition-colors">
                <td className="p-2 border-r bg-slate-100 font-bold text-xs">
                  સરનામુ :
                </td>
                <td className="p-1 border-r" colSpan={3}>
                  <Field
                    as="textarea"
                    name="location"
                    className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg bg-transparent py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full text-xs border-0 shadow-none focus-visible:ring-1 !h-20"
                  />
                  {touched.location && errors.location && (
                    <p className="text-xs text-red-500">
                      {errors.location as string}
                    </p>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
