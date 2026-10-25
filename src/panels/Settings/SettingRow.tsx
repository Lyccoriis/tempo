import type { ReactNode } from 'react';

import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';

interface SettingRowProps {
  title: string;
  description: ReactNode;
  htmlFor?: string;
  disabled?: boolean;
  children: ReactNode;
}

export default function SettingRow({ title, description, htmlFor, disabled, children }: SettingRowProps) {
  return (
    <Item
      size="sm"
      aria-disabled={disabled}
      className={`rounded-none px-5 py-3 last:rounded-b-xl ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <ItemContent>
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-[13.5px] font-medium">
            {title}
          </Label>
        ) : (
          <ItemTitle className="text-[13.5px]">{title}</ItemTitle>
        )}
        <ItemDescription className="text-[12px]">{description}</ItemDescription>
      </ItemContent>
      <ItemActions className="flex-wrap justify-end gap-2">{children}</ItemActions>
    </Item>
  );
}
