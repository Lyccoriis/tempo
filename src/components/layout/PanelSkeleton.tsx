import { Skeleton } from '@/components/ui/skeleton';

export default function PanelSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-busy="true">
      <header className="flex-none border-b border-border px-[22px] py-3">
        <Skeleton className="h-[15px] w-40" />
        <Skeleton className="mt-2 h-3 w-72" />
      </header>
      <div className="pad flex w-full flex-col gap-4">
        <Skeleton className="h-[70px] w-full" />
        <div className="split">
          <Skeleton className="h-[320px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    </div>
  );
}
