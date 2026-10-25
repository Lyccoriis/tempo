import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ChoiceProps {
  value: string;
  onChange: (value: string) => void;
  options: [value: string, label: string][];
  label: string;
}

export default function Choice({ value, onChange, options, label }: ChoiceProps) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      aria-label={label}
      value={value}
      onValueChange={next => next && onChange(next)}
    >
      {options.map(([val, text]) => (
        <ToggleGroupItem
          key={val}
          value={val}
          className="px-3 text-[12.5px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {text}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
