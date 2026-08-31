'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Loader2, X } from 'lucide-react';

interface InlineSelectOption {
    label: string;
    value: string;
}

interface InlineSelectProps {
    value: string | string[];
    onChange: (value: string | string[]) => void;
    placeholder?: string;
    options: InlineSelectOption[];
    onAddNew?: (value: string) => Promise<{ id: string; label: string } | null>;
    addNewLabel?: string;
    onAddNewAction?: () => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    multiple?: boolean;
    onBlur?: (e: React.FocusEvent) => void;
    error?: boolean;
}

export function InlineSelect({
    value = '',
    onChange,
    placeholder = 'Select...',
    options = [],
    onAddNew,
    addNewLabel = 'Add New',
    onAddNewAction,
    disabled = false,
    loading = false,
    className,
    multiple = false,
    onBlur,
    error = false,
}: InlineSelectProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [newValue, setNewValue] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [selectedValues, setSelectedValues] = useState<string[]>(() => {
        if (Array.isArray(value)) return value;
        return value ? [value] : [];
    });

    useEffect(() => {
        if (Array.isArray(value)) {
            setSelectedValues(value);
        } else if (value) {
            setSelectedValues([value]);
        } else {
            setSelectedValues([]);
        }
    }, [value]);

    const handleAddNew = async () => {
        if (!newValue.trim() || !onAddNew) return;

        try {
            setAddLoading(true);
            const result = await onAddNew(newValue.trim());
            if (result) {
                const newSelectedValues = multiple
                    ? [...selectedValues, result.id]
                    : [result.id];

                setSelectedValues(newSelectedValues);
                onChange(multiple ? newSelectedValues : result.id);
                setNewValue('');
                setIsAdding(false);
                toast.success('Created successfully');
            }
        } catch (error: any) {
            console.error("error", error);
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create';
            toast.error(errorMessage);
        } finally {
            setAddLoading(false);
        }
    };

    const handleRemoveValue = (valueToRemove: string) => {
        if (!multiple) return;
        const newValues = selectedValues.filter(v => v !== valueToRemove);
        setSelectedValues(newValues);
        onChange(newValues);
    };

    const handleSelectValueChange = (newValue: string) => {
        if (newValue === '__clear__') {
            if (multiple) {
                setSelectedValues([]);
                onChange([]);
            } else {
                setSelectedValues([]);
                onChange('');
            }
            return;
        }

        if (multiple) {
            if (!selectedValues.includes(newValue)) {
                const newSelectedValues = [...selectedValues, newValue];
                setSelectedValues(newSelectedValues);
                onChange(newSelectedValues);
            }
        } else {
            setSelectedValues([newValue]);
            onChange(newValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddNew();
        } else if (e.key === 'Escape') {
            setIsAdding(false);
            setNewValue('');
        }
    };

    const isValueValid = multiple
        ? selectedValues.every(v => options.some(opt => opt.value === v))
        : (value === '' || options.some(opt => opt.value === value));

    const displayValue = multiple
        ? (selectedValues.length > 0 ? selectedValues[0] : '')
        : (Array.isArray(value) ? value[0] : value);

    const effectiveDisplayValue = isValueValid ? (displayValue || '') : (displayValue || '');

    const getSelectedLabels = () => {
        if (!multiple || selectedValues.length === 0) return '';

        const labels = selectedValues.map(val => {
            const option = options.find(opt => opt.value === val);
            return option?.label || val;
        });

        if (labels.length <= 3) {
            return labels.join(', ');
        }

        return `${labels.slice(0, 3).join(', ')} +${labels.length - 3} more...`;
    };

    const selectedLabelsDisplay = getSelectedLabels();

    return (
        <div className={`relative ${className}`}>
            {isAdding ? (
                <div className="flex items-center gap-2 relative">
                    <Input
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value.toUpperCase())}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter new value"
                        autoFocus
                        className="pr-16"
                    />
                    <div className="absolute right-1 flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive !text-[11px] hover:text-destructive"
                            onClick={() => {
                                setIsAdding(false);
                                setNewValue('');
                            }}
                            type="button"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="h-7 w-7"
                            onClick={handleAddNew}
                            disabled={addLoading || !newValue.trim()}
                        >
                            {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="relative">
                    <Select
                        value={effectiveDisplayValue}
                        onValueChange={(val) => {
                            handleSelectValueChange(val);
                            if (onBlur) onBlur({ target: { name: '' } } as any);
                        }}
                        disabled={disabled || loading}
                    >
                        <SelectTrigger className={`w-full ${error ? "border-red-500" : ""} ${placeholder == "Select group" && !onAddNew ? "p-2.5 text-[13px] h-7 bg-blue-500 text-white border !text-[11px] border-blue-500 font-bold  data-[placeholder]:text-white" : "!text-[11px]"} `} onBlur={onBlur}>
                            {multiple && selectedValues.length > 0 ? (
                                <span className=" text-sm">{selectedLabelsDisplay}</span>
                            ) : (
                                <SelectValue placeholder={placeholder} />
                            )}
                        </SelectTrigger>
                        <SelectContent>
                            {(onAddNew || onAddNewAction) && (
                                <div
                                    className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (onAddNewAction) {
                                            onAddNewAction();
                                        } else {
                                            setIsAdding(true);
                                        }
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    <span className="font-medium">{addNewLabel}</span>
                                </div>
                            )}
                            {!multiple && selectedValues.length > 0 && (
                                <SelectItem value="__clear__" className="text-muted-foreground">
                                    Clear Selection
                                </SelectItem>
                            )}
                            {options.map((option, index) => (
                                <SelectItem key={`${option.value || "fallback"}-${index}`} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {multiple && selectedValues.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto">
                            {selectedValues.map((val) => {
                                const option = options.find(opt => opt.value === val);
                                return (
                                    <span key={val} className="flex items-center bg-primary/20 text-primary rounded px-1.5 py-0.5 text-xs">
                                        {option?.label || val}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveValue(val);
                                            }}
                                            className="ml-1 h-3 w-3 text-destructive hover:bg-destructive/20 rounded flex items-center justify-center"
                                        >
                                            <X className="h-2 w-2" />
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface AsyncInlineSelectProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    apiEndpoint: string;
    labelKey?: string;
    valueKey?: string;
    onAddNew?: (value: string) => Promise<{ id: string; label: string } | null>;
    addNewLabel?: string;
    onAddNewAction?: () => void;
    disabled?: boolean;
    className?: string;
    onBlur?: (e: React.FocusEvent) => void;
}

export function AsyncInlineSelect({
    value,
    onChange,
    placeholder = 'Select...',
    apiEndpoint,
    labelKey = 'name',
    valueKey = 'id',
    onAddNew,
    addNewLabel = 'Add New',
    onAddNewAction,
    disabled = false,
    className,
    onBlur,
}: AsyncInlineSelectProps) {
    const [options, setOptions] = useState<InlineSelectOption[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOptions = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(apiEndpoint, {
                params: { limit: 9999 },
            });
            const data = response.data.data || response.data;
            const mappedOptions = (Array.isArray(data) ? data : []).map((item: Record<string, unknown>) => ({
                label: String(item[labelKey] || ''),
                value: String(item[valueKey] || ''),
            }));
            setOptions(mappedOptions);
        } catch (error) {
            console.error('Failed to fetch options:', error);
        } finally {
            setLoading(false);
        }
    }, [apiEndpoint, labelKey, valueKey]);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    return (
        <InlineSelect
            value={value}
            onChange={(val) => onChange(Array.isArray(val) ? val[0] || '' : val)}
            placeholder={placeholder}
            options={options}
            onAddNew={onAddNew}
            addNewLabel={addNewLabel}
            onAddNewAction={onAddNewAction}
            disabled={disabled}
            loading={loading}
            className={className}
            onBlur={onBlur}
        />
    );
}
