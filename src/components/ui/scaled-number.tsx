type Tag = 'p' | 'span';

interface ScaledNumberProps {
  value: string;
  className?: string;
  as?: Tag;
}

const SIZES: [number, string][] = [
  [8,  'text-2xl'],
  [11, 'text-xl'],
  [15, 'text-lg'],
  [19, 'text-base'],
];

function sizeClass(text: string): string {
  for (const [max, cls] of SIZES) {
    if (text.length <= max) return cls;
  }
  return 'text-sm';
}

export function ScaledNumber({ value, className = '', as: Tag = 'p' }: ScaledNumberProps) {
  return (
    <Tag className={`${sizeClass(value)} font-bold leading-tight ${className}`}>
      {value}
    </Tag>
  );
}
