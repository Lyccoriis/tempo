import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0]!.toUpperCase())
      .join('') || '?'
  );
}

interface ProfileAvatarProps {
  name: string;
  color?: string;
  picture?: string | null;
  className?: string;
  textClass?: string;
}

export default function ProfileAvatar({ name, color, picture, className, textClass = 'text-[10px]' }: ProfileAvatarProps) {
  return (
    <Avatar className={className} data-accent={color}>
      {picture && <AvatarImage src={picture} alt="" />}
      <AvatarFallback className={textClass}>{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );
}
