'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import {
    Command,
    CommandGroup,
    CommandItem,
    CommandInput,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command'
import { Check, CirclePlus } from 'lucide-react'

interface Option {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
    count?: number
}

interface DataTableFilterProps {
    title: string
    options: Option[]
    selectedValues: string[]
    onChange: (values: string[]) => void
}

export function DataTableFilter({
    title,
    options,
    selectedValues,
    onChange,
}: DataTableFilterProps) {
    const [open, setOpen] = useState(false)

    const toggleValue = (value: string) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter((v) => v !== value)
            : [...selectedValues, value]

        onChange(newValues)
    }

    const clearFilters = () => {
        onChange([])
    }

    const selectedOptions = options.filter((option) =>
        selectedValues.includes(option.value)
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-[32px] border-dashed gap-1.5"
                >
                    <CirclePlus className="h-4 w-4" />
                    {title}

                    {selectedValues.length > 0 && (
                        <>
                            <Separator orientation="vertical" className="mx-2 h-4" />

                            {/* Mobile */}
                            <Badge variant="secondary" className="lg:hidden">
                                {selectedValues.length}
                            </Badge>

                            {/* Desktop */}
                            <div className="hidden lg:flex gap-1">
                                {selectedOptions.length <= 2 ? (
                                    selectedOptions.map((option) => (
                                        <Badge key={option.value} variant="secondary">
                                            {option.label}
                                        </Badge>
                                    ))
                                ) : (
                                    <Badge variant="secondary">
                                        {selectedOptions.length} selected
                                    </Badge>
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-64 p-0" align="start">

                <Command loop shouldFilter>
                    <CommandInput placeholder={`Search ${title}`} />

                    <CommandList>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selectedValues.includes(option.value)

                                return (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label}
                                        onSelect={() => {
                                            toggleValue(option.value)
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <div
                                            className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${isSelected
                                                ? 'bg-primary border-primary text-primary-foreground'
                                                : 'border-input'
                                                }`}
                                        >
                                            <Check
                                                className={`h-3 w-3 ${isSelected ? '' : 'invisible'
                                                    }`}
                                            />
                                        </div>

                                        {/* Optional Icon */}
                                        {option.icon && (
                                            <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                        )}

                                        <span>{option.label}</span>

                                        {/* Count */}
                                        {option.count !== undefined && (
                                            <span className="ml-auto text-xs text-muted-foreground font-mono">
                                                {option.count}
                                            </span>
                                        )}
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>

                        {selectedValues.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem
                                        value="clear"
                                        onSelect={clearFilters}
                                        className="justify-center text-center"
                                    >
                                        Clear filters
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
