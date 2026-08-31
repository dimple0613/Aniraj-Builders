'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CirclePlus, X } from 'lucide-react';

interface NumberRangeFilterProps {
  title: string;
  minValue?: string;
  maxValue?: string;
  onChange: (min: string, max: string) => void;
  placeholder?: string;
}

export function NumberRangeFilter({
  title,
  minValue = '',
  maxValue = '',
  onChange,
  placeholder = '0',
}: NumberRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(minValue);
  const [max, setMax] = useState(maxValue);

  const handleApply = () => {
    onChange(min, max);
    setOpen(false);
  };

  const handleClear = () => {
    setMin('');
    setMax('');
    onChange('', '');
    setOpen(false);
  };

  const hasValues = min || max;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-[32px] border-dashed gap-1.5">
          <CirclePlus className="h-4 w-4" />
          {title}

          {hasValues && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="hidden lg:inline-flex">
                {min && max ? `${min} - ${max}` : min ? `> ${min}` : `< ${max}`}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-4" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">{title}</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder={placeholder}
                value={min}
                onChange={(e) => setMin(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder={placeholder}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleClear} className="flex-1">
              Clear
            </Button>
            <Button size="sm" onClick={handleApply} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}