import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, User } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { cn } from '@/lib/utils';

export interface ComboOption<T = any> {
  value: string;
  label: string;
  meta?: T;
}

interface ComboboxProps<T = any> {
  value: string | undefined;
  onChange: (value: string | undefined, meta?: T) => void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  options: ComboOption<T>[];
  icon?: React.ReactNode;
  className?: string;
}

export function Combobox<T = any>({ value, onChange, placeholder = 'Buscar…', emptyText = 'Sin resultados', loading, options, icon, className }: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);
  useEffect(() => { if (!open) return; }, [open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn('w-full justify-between', className)}>
          <span className="flex items-center gap-2 truncate">
            {icon ?? <User className="h-4 w-4" />}
            {selected ? selected.label : (placeholder || 'Seleccionar…')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            {loading ? (
              <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((o) => (
                    <CommandItem key={o.value} value={`${o.label} ${o.value}`}
                      onSelect={() => { onChange(o.value, o.meta); setOpen(false); }}
                      className="flex items-center gap-2"
                    >
                      <Check className={cn('h-4 w-4', o.value === value ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
