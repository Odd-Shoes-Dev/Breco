'use client';

import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('px-6 py-4 border-b border-gray-100', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold text-gray-900', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-gray-500 mt-1', className)}
      {...props}
    />
  );
}

function CardBody({ className, ...props }: CardProps) {
  return <div className={cn('p-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl', className)}
      {...props}
    />
  );
}

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

function StatCard({ title, value, change, icon, trend, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardBody>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {change && (
              <p
                className={cn(
                  'text-sm mt-2',
                  trend === 'up' && 'text-green-600',
                  trend === 'down' && 'text-red-600',
                  trend === 'neutral' && 'text-gray-500'
                )}
              >
                {trend === 'up' && '↑ '}
                {trend === 'down' && '↓ '}
                {change.value > 0 ? '+' : ''}
                {change.value}% {change.label}
              </p>
            )}
          </div>
          {icon && (
            <div className="p-3 bg-navy-50 rounded-lg text-navy-600">
              {icon}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter, StatCard };

