import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

import ProfileAvatar from '@/components/shared/ProfileAvatar';
import { Button } from '@/components/ui/button';
import { readPicture } from '@/lib/pictures';

interface PicturePickerProps {
  name: string;
  color?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

export default function PicturePicker({ name, color, value, onChange }: PicturePickerProps) {
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await readPicture(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that picture');
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label="choose a profile picture"
        onClick={() => input.current?.click()}
        className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ProfileAvatar
          name={name}
          color={color}
          picture={value}
          className="size-16 ring-2 ring-primary ring-offset-2 ring-offset-card"
          textClass="text-lg"
        />
      </button>
      <div className="flex flex-col items-start gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <ImagePlus size={15} strokeWidth={1.6} />
          {value ? 'Change picture' : 'Choose picture'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X size={15} strokeWidth={1.6} />
            Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
