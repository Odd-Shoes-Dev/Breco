'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-amber-100 text-amber-800',
        error: 'bg-red-100 text-red-800',
        info: 'bg-blue-100 text-blue-800',
        purple: 'bg-purple-100 text-purple-800',
        navy: 'bg-navy-100 text-navy-800',
        outline: 'border border-gray-300 bg-white text-gray-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Status-specific badges
export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    draft: 'default',
    pending: 'warning',
    sent: 'info',
    partial: 'purple',
    paid: 'success',
    overdue: 'error',
    void: 'default',
    active: 'success',
    inactive: 'default',
    approved: 'success',
    rejected: 'error',
  };

  const variant = variantMap[status.toLowerCase()] || 'default';

  return (
    <Badge variant={variant}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export { Badge, badgeVariants };

