'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CirclePlus } from 'lucide-react';

interface EnumFilterOption {
  label: string;
  value: string;
}

interface EnumFilterProps {
  title: string;
  options: EnumFilterOption[];
  selectedValue?: string;
  onChange: (value: string | undefined) => void;
}

export function EnumFilter({
  title,
  options,
  selectedValue,
  onChange,
}: EnumFilterProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    onChange(value === selectedValue ? undefined : value);
    setOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === selectedValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-[32px] border-dashed gap-1.5">
          <CirclePlus className="h-4 w-4" />
          {title}

          {selectedOption && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="hidden lg:inline-flex">
                {selectedOption.label}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-48 p-3" align="start">
        <div className="space-y-1">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={selectedValue === option.value ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSelect(option.value)}
              className="w-full justify-start text-sm"
            >
              {option.label}
            </Button>
          ))}
        </div>

        {selectedValue && (
          <>
            <Separator className="my-2" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="w-full text-xs"
            >
              Clear selection
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}