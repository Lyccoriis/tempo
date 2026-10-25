import type { ReactNode } from 'react';

import CometDial from '@/components/reactbits/CometDial';
import { cn } from '@/lib/utils';

export function Dials({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-5 px-5 py-4">{children}</div>;
}

export function Dial({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit = '',
  size = 104,
  disabled,
  footer,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  size?: number;
  disabled?: boolean;
  footer?: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex w-[124px] flex-col items-center gap-1 text-center">
      <CometDial
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        size={size}
        disabled={disabled}
        onChangeEnd={next => next !== value && onChange(next)}
      />
      <span className={cn('text-[12px] font-medium leading-tight', disabled && 'text-muted-foreground')}>{label}</span>
      {hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
      {footer}
    </div>
  );
}
