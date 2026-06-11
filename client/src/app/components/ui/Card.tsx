import { forwardRef, HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          'rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-300',
          hoverable && 'hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5 hover:border-primary/20',
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';
