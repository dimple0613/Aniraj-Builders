import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface SelectFieldOption {
  label: string
  value: string
}

export interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: SelectFieldOption[]
  placeholder?: string
  disabled?: boolean
  error?: boolean
  className?: string
  onBlur?: (e: React.FocusEvent) => void
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  error = false,
  className,
  onBlur,
}: SelectFieldProps) {
  return (
    <Select
      value={value || ""}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger
        className={`w-full ${error ? "border-destructive" : ""} ${className || ""}`}
        onBlur={onBlur}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
