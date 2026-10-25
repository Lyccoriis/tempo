import { useState } from 'react';
import { toast } from 'sonner';

import PicturePicker from '@/components/shared/PicturePicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ACCENTS } from '@/lib/accents';
import { APP_NAME } from '@/lib/appName';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { useProfileStore } from '@/stores/useProfileStore';

export default function CreateProfileScreen() {
  const createProfile = useProfileStore(s => s.createProfile);

  const [name, setName] = useState('');
  const [accent, setAccent] = useState('blue');
  const [picture, setPicture] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createProfile({ name: name.trim(), color: accent, picture });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create profile');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-6" data-accent={accent}>
      <Card className={cn('w-full max-w-md gap-5', GLASS)}>
        <CardHeader>
          <CardTitle className="text-lg">Welcome to {APP_NAME}</CardTitle>
          <CardDescription>
            Make a profile to start. It keeps your settings, keystrokes and listening history.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <PicturePicker name={name} color={accent} value={picture} onChange={setPicture} />

          <Field>
            <FieldLabel htmlFor="first-profile-name">Name</FieldLabel>
            <Input
              id="first-profile-name"
              value={name}
              autoFocus
              placeholder="Your name"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void create();
              }}
            />
            <FieldDescription>You can add more profiles later and switch between them.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Accent color</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map(a => (
                <button
                  key={a}
                  type="button"
                  data-accent={a}
                  aria-label={a}
                  aria-pressed={accent === a}
                  onClick={() => setAccent(a)}
                  style={{ background: 'var(--primary)' }}
                  className={`size-6 rounded-full border-2 transition-transform duration-150 hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                    accent === a ? 'border-foreground' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </Field>
        </CardContent>

        <CardFooter className="justify-end">
          <Button disabled={busy || !name.trim()} onClick={() => void create()}>
            Create profile
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
