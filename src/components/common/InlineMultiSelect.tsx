'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Option<T> {
  id: string;
  name: string;
  [key: string]: any;
}

interface InlineMultiSelectProps<T> {
  label: string;
  options: Option<T>[];
  value: string[];
  onChange: (value: string[]) => void;
  onSuccess?: () => void;
  fetchOptions?: () => Promise<Option<T>[]>;
  optionKey?: keyof Option<T>;
  placeholder?: string;
}

export function InlineMultiSelect<T>({
  label,
  options,
  value,
  onChange,
  onSuccess,
  fetchOptions,
  optionKey = 'name' as keyof Option<T>,
  placeholder = 'Select options'
}: InlineMultiSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localOptions, setLocalOptions] = useState<Option<T>[]>(options);
  const [newOptionName, setNewOptionName] = useState('');

  const fetchData = useCallback(async () => {
    if (!fetchOptions) return;
    
    try {
      setLoading(true);
      const fetchedOptions = await fetchOptions();
      setLocalOptions(fetchedOptions);
    } catch (error) {
      toast.error('Failed to fetch options');
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  const handleAddNewOption = async () => {
    const name = newOptionName.trim();
    if (!name) return;

    try {
      // This would typically call an API to create the new option
      // For now, we'll simulate it by adding to local options
      const newOption: Option<T> = {
        id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        [optionKey]: name,
      } as unknown as Option<T>;

      setLocalOptions(prev => [...prev, newOption]);
      setNewOptionName('');
      
      // Trigger onChange with updated value (would normally wait for API response)
      onChange([...value, newOption.id]);
      
      onSuccess?.();
      toast.success('Option added successfully');
    } catch (error) {
      toast.error('Failed to add option');
    }
  };

  const handleSelectChange = (selectedValues: string[]) => {
    onChange(selectedValues);
  };

  const handleNewOptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddNewOption();
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${label.toLowerCase().replace(/\s+/g, '-')}-select`}>
          {label}
        </Label>
        <div className="flex flex-col">
          <Select
            value={value[0] || ''}
            onValueChange={(val) => handleSelectChange(val as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {localOptions.map((option) => (
                <SelectItem
                  key={option.id}
                  value={option.id}
                >
                  {option[optionKey]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <Input
              id={`${label.toLowerCase().replace(/\s+/g, '-')}-input`}
              type="text"
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              onKeyDown={handleNewOptionKeyDown}
              placeholder="Type to add new option"
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddNewOption}
              disabled={!newOptionName.trim() || loading}
            >
              {loading ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      </div>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-[400px] max-w-[95vw] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 rounded-t-lg">
              <h2 className="text-sm font-semibold text-slate-800">{label} Management</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-200 rounded transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* Simplified management view - in practice would use ExcelGrid like InlineUnitManager */}
              <div className="p-4">
                <h3 className="text-lg font-medium mb-4">Manage {label.toLowerCase()}s</h3>
                <div className="space-y-2">
                  {localOptions.map((option) => (
                    <div key={option.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span>{option[optionKey]}</span>
                      <Button variant="ghost" size="icon" onClick={() => {
                        // Would implement delete functionality
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="m6 6 12 12"/></svg>
                      </Button>
                    </div>
                  ))}
                  {localOptions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No {label.toLowerCase()}s found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}