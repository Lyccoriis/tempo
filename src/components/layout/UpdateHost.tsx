import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { Spinner } from '@/components/ui/spinner';
import { useUpdateStore } from '@/stores/useUpdateStore';

export default function UpdateHost() {
  const state = useUpdateStore(s => s.state);
  const previous = useRef(state.stage);

  useEffect(() => useUpdateStore.getState().start(), []);

  useEffect(() => {
    const was = previous.current;
    previous.current = state.stage;
    if (was === state.stage) return;

    const { announce } = useUpdateStore.getState();
    if (!announce || state.stage === 'checking' || state.stage === 'downloading') return;
    useUpdateStore.setState({ announce: false });
    if (state.stage === 'none') toast.success('This is the latest version');
    else if (state.stage === 'error') toast.error(state.message || 'Could not reach the update feed');
  }, [state]);

  if (state.stage !== 'restarting') return null;

  return (
    <div
      role="status"
      className="fixed inset-0 z-[100] flex cursor-wait items-center justify-center bg-background/60 backdrop-grayscale"
    >
      <div className="flex items-center gap-2 rounded-lg border border-border bg-popover px-4 py-3 text-[13px] text-popover-foreground">
        <Spinner />
        {`Installing ${state.version}`}
      </div>
    </div>
  );
}
