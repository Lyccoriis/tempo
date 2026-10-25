import { useEffect, useState } from 'react';
import { ChevronDown, LogIn } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignedIn: () => void;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err);
}

export default function SignInDialog({ open, onOpenChange, onSignedIn }: SignInDialogProps) {
  const [browser, setBrowser] = useState<string | null | undefined>(undefined);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [header, setHeader] = useState('');
  const [error, setError] = useState<{ kind: 'browser' | 'paste'; text: string } | null>(null);
  const [busy, setBusy] = useState<'browser' | 'paste' | null>(null);

  useEffect(() => {
    if (!open) return;
    window.api.ytmusic
      .loginBrowser()
      .then(name => {
        setBrowser(name);
        if (!name) setPasteOpen(true);
      })
      .catch(err => {
        console.error('[music] loginBrowser failed', err);
        setBrowser(null);
        setPasteOpen(true);
      });
  }, [open]);

  async function signIn(kind: 'browser' | 'paste') {
    setBusy(kind);
    setError(null);
    try {
      const count = kind === 'browser' ? await window.api.ytmusic.signInWithBrowser() : await window.api.ytmusic.importCookies(header);
      toast.success(`Signed in to YouTube Music, ${count} cookies`);
      setHeader('');
      onOpenChange(false);
      onSignedIn();
    } catch (err) {
      setError({ kind, text: message(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sign in to YouTube Music</DialogTitle>
          <DialogDescription>
            Google does not allow signing in from inside this app, so the sign in happens in a browser and is copied
            over.
          </DialogDescription>
        </DialogHeader>

        {browser && (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
              <li>{browser} opens on a profile of its own, your usual one is not touched.</li>
              <li>Sign in and wait for YouTube Music to load.</li>
              <li>Close the window, the sign in comes over by itself.</li>
            </ol>
            {error?.kind === 'browser' && <p className="text-[12px] text-destructive">{error.text}</p>}
            <Button disabled={busy !== null} onClick={() => void signIn('browser')}>
              {busy === 'browser' ? <Spinner /> : <LogIn size={15} strokeWidth={1.6} />}
              {busy === 'browser' ? `Waiting for ${browser} to close` : `Sign in with ${browser}`}
            </Button>
            <Separator />
          </>
        )}

        <Collapsible open={pasteOpen} onOpenChange={setPasteOpen}>
          {browser && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <ChevronDown size={15} strokeWidth={1.6} className={pasteOpen ? 'rotate-180' : undefined} />
                Paste a cookie header instead
              </Button>
            </CollapsibleTrigger>
          )}
          <CollapsibleContent className="flex flex-col gap-4 pt-2">
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
              <li>Open a private window in Firefox and sign in at music.youtube.com.</li>
              <li>Press F12, open Network, reload the page and click any request to music.youtube.com.</li>
              <li>Under Request Headers, right click Cookie and copy its value.</li>
              <li>Paste it below, then close the private window without signing out.</li>
            </ol>

            <Field className="min-w-0" data-invalid={error?.kind === 'paste' ? true : undefined}>
              <FieldLabel htmlFor="ytmusic-cookie">Cookie header</FieldLabel>
              <Textarea
                id="ytmusic-cookie"
                value={header}
                onChange={e => setHeader(e.target.value)}
                placeholder="VISITOR_INFO1_LIVE=...; SAPISID=...; ..."
                className="h-32 min-w-0 resize-none break-all font-mono text-[12px] field-sizing-fixed"
                spellCheck={false}
              />
              {error?.kind === 'paste' ? (
                <FieldError>{error.text}</FieldError>
              ) : (
                <FieldDescription>It stays on this machine, in the app's own YouTube Music session.</FieldDescription>
              )}
            </Field>
          </CollapsibleContent>
        </Collapsible>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {pasteOpen && (
            <Button disabled={!header.trim() || busy !== null} onClick={() => void signIn('paste')}>
              {busy === 'paste' && <Spinner />} Sign in
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
