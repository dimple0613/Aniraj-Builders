'use client';

import { useState, useMemo, useEffect } from 'react';
import { Formik, Form, Field, FieldArray, useFormikContext } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { Loader2, Plus, Trash2, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';

interface AttendanceData {
  id: string;
  attendance_date: string;
  project_id: string | null;
  employees: Array<{
    id: string;
    employee_id: string;
    is_overtime: boolean;
    overtime_hours: string | null;
    wages: number;
    employee: {
      id: string;
      name: string;
    };
  }>;
}

interface Project {
  id: string;
  name: string;
  unique_name?: string | null;
}

interface Employee {
  id: string;
  name: string;
  currentSalary?: number;
  prices?: Array<{ start_date: string; expiry_date: string | null; price: number }>;
}

interface AttendanceFormProps {
  attendance?: AttendanceData | null;
  projects: Project[];
  employees: Employee[];
  onSuccess: () => void;
  onCancel: () => void;
  onProgress?: (progress: number) => void;
}

interface AttendanceEmployee {
  employee_id: string;
  employee_name: string;
  salary?: number;
  is_overtime: boolean;
  overtime_hours: string;
  ot_amount?: number;
}

const validationSchema = Yup.object({
  attendance_date: Yup.string().required('Date is required'),
  project_id: Yup.string().required('Project is required'),
  employees: Yup.array().of(
    Yup.object().shape({
      employee_id: Yup.string().required('Employee is required'),
    })
  ).min(1, 'At least one employee is required'),
});

function getSalaryForDate(emp: Employee, targetDate: string | null): number {
  if (!emp.prices || emp.prices.length === 0) {
    return Number(emp.currentSalary) || 0;
  }

  const target = targetDate ? new Date(targetDate) : new Date();

  const activePrice = emp.prices.find((p) => {
    const startDate = new Date(String(p.start_date));
    const expiryDate = p.expiry_date ? new Date(String(p.expiry_date)) : null;
    
    if (expiryDate === null) {
      return startDate <= target;
    }
    return startDate <= target && target <= expiryDate;
  });

  if (activePrice) {
    return Number(activePrice.price) || 0;
  }

  const sortedPrices = [...emp.prices].sort((a, b) => 
    new Date(String(b.start_date)).getTime() - new Date(String(a.start_date)).getTime()
  );

  const closestPrice = sortedPrices.find((p) => {
    const startDate = new Date(String(p.start_date));
    return startDate <= target;
  });

  return closestPrice ? Number(closestPrice.price) : Number(emp.currentSalary) || 0;
}

function calculateEmployeeSalary(emp: AttendanceEmployee): number {
  if (!emp.employee_id || !emp.salary) return 0;
  
  const baseSalary = Number(emp.salary);
  
  if (emp.is_overtime && emp.overtime_hours) {
    const otHours = parseFloat(emp.overtime_hours) || 0;
    const hourlyRate = baseSalary / 8;
    return baseSalary + (hourlyRate * otHours);
  }
  
  return baseSalary;
}

function FormProgressTracker({ onProgress }: { onProgress?: (progress: number) => void }) {
    const { values } = useFormikContext();
    useEffect(() => {
        let filled = 0;
        let total = 0;

        const stringFields = ['attendance_date', 'project_id'];
        stringFields.forEach(field => {
            total++;
            const val = (values as any)[field];
            if (val && val.toString().trim() !== '') filled++;
        });

        const employees = (values as any).employees || [];
        total++;
        const validEmployees = employees.filter((e: any) => e.employee_id);
        if (validEmployees.length > 0) filled++;

        const result = total > 0 ? Math.round((filled / total) * 100) : 0;
        onProgress?.(result);
    }, [values, onProgress]);
    return null;
}

export function AttendanceForm({
  attendance,
  projects,
  employees,
  onSuccess,
  onCancel,
  onProgress,
}: AttendanceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialEmployees = useMemo(() => {
    if (attendance?.id && attendance.employees && attendance.employees.length > 0) {
      return attendance.employees.map((ae) => {
        const emp = employees.find(e => e.id === ae.employee_id);
        const savedWages = Number(ae.wages) || 0;
        let baseSalary = savedWages;
        if (ae.is_overtime && ae.overtime_hours) {
          const otHours = Number(ae.overtime_hours) || 0;
          baseSalary = Math.round((savedWages * 8) / (8 + otHours));
        }
        return {
          employee_id: ae.employee_id,
          employee_name: emp?.name || ae.employee?.name || '',
          salary: baseSalary,
          is_overtime: ae.is_overtime,
          overtime_hours: ae.overtime_hours || '',
        };
      });
    }
    return [];
  }, [attendance, employees]);

  const initialValues = {
    attendance_date: attendance?.attendance_date
      ? new Date(attendance.attendance_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    project_id: attendance?.project_id || '',
    employees: initialEmployees,
  };

  const handleSubmit = async (values: typeof initialValues) => {
    setIsSubmitting(true);

    try {
      const employeesPayload = values.employees
        .filter((emp) => emp.employee_id)
        .map((emp) => ({
          employee_id: emp.employee_id,
          is_overtime: emp.is_overtime,
          overtime_hours: emp.overtime_hours ? parseFloat(emp.overtime_hours) : null,
          wages: calculateEmployeeSalary(emp),
        }));

      const payload = {
        attendance_date: values.attendance_date,
        project_id: values.project_id || null,
        employees: employeesPayload,
      };

      let response;
      if (attendance?.id) {
        response = await axios.put(`/api/attendance/${attendance.id}`, payload);
      } else {
        response = await axios.post('/api/attendance', payload);
      }

      if (response.data.success) {
        toast.success(
          attendance?.id
            ? 'Attendance updated successfully'
            : 'Attendance created successfully'
        );
        onSuccess();
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      toast.error(error.response?.data?.message || 'Failed to submit attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ values, errors, touched, setFieldValue, setFieldTouched }) => {
        
        const handleEmployeeSelect = (index: number, emp: Employee) => {
          const isAlreadySelected = values.employees.some(
            (e, i) => e.employee_id === emp.id && i !== index
          );
          if (isAlreadySelected) {
            toast.error('Employee already added');
            return;
          }
          const salary = getSalaryForDate(emp, values.attendance_date);
          setFieldValue(`employees.${index}.employee_id`, emp.id);
          setFieldValue(`employees.${index}.employee_name`, emp.name);
          setFieldValue(`employees.${index}.salary`, salary);
        };

        return (
        <>
          <FormProgressTracker onProgress={onProgress} />
          <Form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="attendance_date">Date *</Label>
              <Input
                id="attendance_date"
                type="date"
                name="attendance_date"
                value={values.attendance_date}
                onChange={(e) => setFieldValue('attendance_date', e.target.value)}
                required
              />
              {touched.attendance_date && errors.attendance_date && (
                <p className="text-sm text-red-500">{String(errors.attendance_date)}</p>
              )}
            </div>
 
            <div className="space-y-2 relative">
              <Label htmlFor="project">Project *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-between font-normal ${touched.project_id && errors.project_id ? 'border-red-500 border-2' : ''}`}
                  >
                    <span className="truncate !text-[11px] font-medium">
                      {projects.find(p => p.id === values.project_id)?.unique_name || projects.find(p => p.id === values.project_id)?.name || 'Select project'}
                    </span>
                    <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search projects..." className="h-9" />
                    <CommandEmpty>No project found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-auto">
                      {projects.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={project.unique_name?.toLowerCase() || project.name?.toLowerCase() || ''}
                          onSelect={() => {
                            setFieldValue('project_id', project.id);
                            setFieldTouched('project_id', true);
                          }}
                          className="cursor-pointer"
                        >
                          {project.unique_name || project.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {touched.project_id && errors.project_id && (
                <p className="text-sm text-red-500">{String(errors.project_id)}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b flex items-center gap-2">
              Employees
            </h3>
            <div className="rounded-md border overflow-hidden">
              <FieldArray name="employees">
                {({ push, remove }) => (
                  <div className="overflow-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100">
                        <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                          <th className="p-3 border-r font-bold w-[180px]">Employee Name</th>
                          <th className="p-3 border-r font-bold w-[80px]">Wages</th>
                          <th className="p-3 border-r font-bold w-[60px] text-center">Overtime</th>
                          <th className="p-3 border-r font-bold w-[70px]">OT Hours</th>
                          <th className="p-3 border-r font-bold w-[90px]">Subtotal</th>
                          <th className="p-3 border-r font-bold w-[40px] text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(!values.employees || values.employees.length === 0) ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                              No employees added. Click "Add Employee" to add one.
                            </td>
                          </tr>
                        ) : values.employees?.map((emp: AttendanceEmployee, index: number) => (
                          <tr key={index} className="hover:bg-blue-50 transition-colors">
                            <td className="p-2 space-y-2 border-r">
                              <Field name={`employees.${index}.employee_id`}>
                                {() => (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className={`whitespace-normal w-full justify-between font-normal h-8 text-xs ${(touched.employees as any)?.[index]?.employee_id && (errors.employees as any)?.[index]?.employee_id ? 'border-red-500 border-2' : ''}`}
                                      >
                                        <span className="max-w-[180px] truncate font-medium">
                                          {emp.employee_name || 'Select employee'}
                                        </span>
                                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                      <Command>
                                        <CommandInput placeholder="Search employees..." className="h-8" />
                                        <CommandEmpty>No employee found.</CommandEmpty>
                                        <CommandGroup className="max-h-60 overflow-auto">
                                          {employees.map((e: Employee) => (
                                            <CommandItem
                                              key={e.id}
                                              value={e.name?.toLowerCase() || ''}
                                              onSelect={() => handleEmployeeSelect(index, e)}
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
                              {(touched.employees as any)?.[index]?.employee_id && (errors.employees as any)?.[index]?.employee_id && (
                                <p className="text-xs text-red-500 mt-1">{(errors.employees as any)[index]?.employee_id}</p>
                              )}
                            </td>
                            <td className="p-2 border-r text-xs">
                              {emp.employee_id ? (
                                <span className="font-medium">₹{Number(emp.salary || 0).toLocaleString()}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-2 border-r text-center">
                              <Checkbox
                                checked={!!emp.is_overtime}
                                onCheckedChange={(checked) => {
                                  setFieldValue(`employees.${index}.is_overtime`, checked);
                                  if (checked && (!emp.overtime_hours || parseFloat(emp.overtime_hours) === 0)) {
                                    setFieldValue(`employees.${index}.overtime_hours`, '1');
                                  }
                                }}
                              />
                            </td>
                            <td className="p-1 border-r">
                              {emp.is_overtime ? (
                                <Field
                                  as={Input}
                                  type="number"
                                  name={`employees.${index}.overtime_hours`}
                                  placeholder="Hours"
                                  className="h-8 text-xs"
                                  min={1}
                                  max={16}
                                  onChange={(e: any) => {
                                    const val = parseFloat(e.target.value);
                                    if (val > 0 && val <= 16) {
                                      setFieldValue(`employees.${index}.overtime_hours`, val.toString());
                                    } else if (val > 16) {
                                      setFieldValue(`employees.${index}.overtime_hours`, '16');
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </td>
                            <td className="p-2 border-r text-xs">
                              {emp.employee_id ? (
                                <span className="font-medium text-primary">₹{calculateEmployeeSalary(emp).toLocaleString()}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-1 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-2 bg-muted/10 border-t flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => push({ employee_id: '', employee_name: '', salary: 0, is_overtime: false, overtime_hours: '' })}
                        className="text-primary text-xs h-7"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Employee
                      </Button>
                      <div className="text-sm font-semibold pr-2">
                        Total: <span className="text-primary">₹{values.employees
                          ?.filter((emp: AttendanceEmployee) => emp.employee_id)
                          .reduce((sum: number, emp: AttendanceEmployee) => sum + calculateEmployeeSalary(emp), 0)
                          .toLocaleString('en-IN') || '0'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </FieldArray>
            </div>
            {touched.employees && errors.employees && typeof errors.employees === 'string' && (
              <p className="text-xs text-red-500 mt-2 px-1">
                {errors.employees}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {attendance?.id ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
        </>
        );
      }}
    </Formik>
  );
}