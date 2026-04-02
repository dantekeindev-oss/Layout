/**
 * Color palette for teams/segments
 * Colors chosen to be distinct and colorblind-friendly
 */
const TEAM_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#6366f1', // indigo-500
  '#d946ef', // fuchsia-500
];

const CBS_COLOR = '#0ea5e9'; // sky-500 - distinctive color for CBS segment

/**
 * Generate a consistent color for a team/segment based on name
 */
export function getTeamColor(name: string, isCbs = false): string {
  if (isCbs || name.toUpperCase() === 'CBS') {
    return CBS_COLOR;
  }

  // Simple hash function to get consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % TEAM_COLORS.length;
  return TEAM_COLORS[index];
}

/**
 * Generate a lighter version of a color for backgrounds
 */
export function getLightColor(hex: string, opacity = 0.1): string {
  // Convert hex to rgb
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get box status color
 */
export function getBoxStatusColor(status: string): string {
  const colors: Record<string, string> = {
    occupied: '#10b981', // green
    available: '#e5e7eb', // gray
    'available-from': '#fbbf24', // amber
    conflict: '#ef4444', // red
    locked: '#3b82f6', // blue
  };
  return colors[status] || '#e5e7eb';
}

/**
 * Get shift color for visual indicators
 */
export function getShiftColor(shift: string): string {
  const colors: Record<string, string> = {
    morning: '#fbbf24', // amber
    midday: '#10b981', // emerald
    afternoon: '#3b82f6', // blue
    full: '#8b5cf6', // violet
  };
  return colors[shift] || '#6b7280';
}

/**
 * Get zone colors for layout visualization
 */
export function getZoneColor(zoneName: string): string {
  const zoneColors: Record<string, string> = {
    'LID 1': '#dbeafe',
    'LID 2': '#d1fae5',
    'LID 3': '#fef3c7',
    'LID 4': '#fce7f3',
    'LID 5': '#ede9fe',
    'LID 6': '#ffedd5',
    'LID 7': '#e0f2fe',
    'CENTRAL': '#e0e7ff',
    'PERIMETRO': '#fce7f3',
  };
  return zoneColors[zoneName] || '#f3f4f6';
}

/**
 * Calculate text color based on background for readability
 */
export function getTextColor(background: string): string {
  // Convert to RGB and calculate luminance
  const hex = background.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
}

/**
 * Color palette for charts and metrics
 */
export const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  neutral: '#6b7280',
};

/**
 * Gradient definitions for visual elements
 */
export const GRADIENTS = {
  morning: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
  midday: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  afternoon: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  full: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
};
