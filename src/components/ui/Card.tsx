import { clsx } from 'clsx';
import { forwardRef } from 'react';

export interface CardProps { children: React.ReactNode; className?: string; hover?: boolean; onClick?: () => void; }

export const Card = forwardRef<HTMLDivElement, CardProps>(({ children, className, hover, onClick }, ref) => (
  <div
    ref={ref}
    className={clsx(
      'bg-slate-800 rounded-xl border border-slate-700 shadow-lg',
      hover && 'hover:border-slate-500 hover:shadow-xl transition-all cursor-pointer',
      className
    )}
    onClick={onClick}
  >
    {children}
  </div>
));
Card.displayName = 'Card';

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('px-4 py-3 border-b border-slate-700', className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('px-4 py-3', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('px-4 py-3 border-t border-slate-700 bg-slate-900/50', className)}>{children}</div>;
}
