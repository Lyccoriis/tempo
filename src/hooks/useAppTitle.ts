import { useEffect } from 'react';

import { APP_NAME } from '@/lib/appName';
import { useProfileStore } from '@/stores/useProfileStore';

export function useAppTitle(): void {
  const profile = useProfileStore(s => s.profiles.find(p => p.id === s.activeProfileId)?.name ?? null);

  useEffect(() => {
    const title = profile ? `${APP_NAME} | ${profile}` : APP_NAME;
    document.title = title;
    window.api.shell.setTitle(title);
  }, [profile]);
}
