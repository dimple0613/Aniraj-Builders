import * as React from "react"
import { Label } from "@/components/ui/label"

export interface FormTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  columns?: number
}

export function FormTable({ className, children, columns = 1, ...props }: FormTableProps) {
  return (
    <div
      className={`divide-y divide-border ${columns > 1 ? `grid grid-cols-1 md:grid-cols-${columns}` : ''} ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  )
}

export interface FormRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

export function FormRow({ label, required, error, children, className, ...props }: FormRowProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[250px_1fr] gap-4 py-3 ${className || ''}`}
      {...props}
    >
      <div className="flex items-center">
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      <div className="space-y-1">
        {children}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
