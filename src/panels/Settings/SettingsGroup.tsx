import { Children, Fragment, type ReactNode } from 'react';

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemGroup, ItemSeparator } from '@/components/ui/item';

interface SettingsGroupProps {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export default function SettingsGroup({ title, description, action, footer, children }: SettingsGroupProps) {
  const rows = Children.toArray(children);

  return (
    <Card className="gap-0 overflow-hidden bg-card/40 py-0 shadow-none">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-[13px]">{title}</CardTitle>
        {description && <CardDescription className="text-[12px]">{description}</CardDescription>}
        {action && <CardAction className="flex items-center gap-2">{action}</CardAction>}
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          {rows.map((row, index) => (
            <Fragment key={index}>
              {index > 0 && <ItemSeparator />}
              {row}
            </Fragment>
          ))}
        </ItemGroup>
        {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
      </CardContent>
    </Card>
  );
}
