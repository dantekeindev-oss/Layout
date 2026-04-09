import { clsx } from 'clsx';
import { forwardRef } from 'react';

export interface CardProps { children: React.ReactNode; className?: string; hover?: boolean; onClick?: () => void; }

export const Card = forwardRef<HTMLDivElement, CardProps>(({ children, className, hover, onClick }, ref) => (
  <div
    ref={ref}
    className={clsx(
      'bg-white rounded-xl border border-[#e8e8e8]',
      hover && 'hover:border-[#cccccc] hover:shadow-md transition-all cursor-pointer',
      className
    )}
    onClick={onClick}
  >
    {children}
  </div>
));
Card.displayName = 'Card';

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('px-4 py-3 border-b border-[#f0f0f0]', className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('px-4 py-3', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('px-4 py-3 border-t border-[#f0f0f0] bg-[#fafafa]', className)}>{children}</div>;
}
