import { clsx } from 'clsx';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'primary', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'badge',
        {
          'badge-primary': variant === 'primary',
          'badge-success': variant === 'success',
          'badge-warning': variant === 'warning',
          'badge-danger': variant === 'danger',
          'badge-gray': variant === 'gray',
          'text-xs px-2 py-0.5': size === 'sm',
          'text-sm px-2.5 py-1': size === 'md',
        },
        className
      )}
    >
      {children}
    </span>
  );
}

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    assigned: { variant: 'success', label: 'Asignado' },
    unassigned: { variant: 'gray', label: 'Sin asignar' },
    'manual-locked': { variant: 'primary', label: 'Fijado' },
    conflict: { variant: 'danger', label: 'Conflicto' },
  };

  const { variant, label } = config[status] || { variant: 'gray', label: status };

  return <Badge variant={variant} className={className}>{label}</Badge>;
}

export interface ShiftBadgeProps {
  shift: string;
  className?: string;
}

export function ShiftBadge({ shift, className }: ShiftBadgeProps) {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    morning: { variant: 'warning', label: 'Mañana' },
    midday: { variant: 'success', label: 'Medio día' },
    afternoon: { variant: 'primary', label: 'Tarde' },
    full: { variant: 'gray', label: 'Completo' },
  };

  const { variant, label } = config[shift] || { variant: 'gray', label: shift };

  return <Badge variant={variant} className={className}>{label}</Badge>;
}
