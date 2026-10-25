import type { ReactNode } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function Shelf({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <ScrollArea orientation="horizontal">
      <div className={cn('pb-3', className)}>{children}</div>
    </ScrollArea>
  );
}
