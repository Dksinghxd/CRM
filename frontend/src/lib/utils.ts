import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function formatDate(date: string | Date | null): string {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeDate(date: string | Date | null): string {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    DRAFT: 'badge-info',
    SCHEDULED: 'badge-warning',
    RUNNING: 'badge-purple',
    COMPLETED: 'badge-success',
    FAILED: 'badge-error',
    PAUSED: 'badge-warning',
    PENDING: 'badge-info',
    SENT: 'badge-info',
    DELIVERED: 'badge-success',
    OPENED: 'badge-purple',
    READ: 'badge-purple',
    CLICKED: 'badge-warning',
    CONVERTED: 'badge-success',
    ACTIVE: 'badge-success',
    INACTIVE: 'badge-error',
  };
  return statusMap[status?.toUpperCase()] || 'badge-info';
}

export function getChannelIcon(channel: string): string {
  const icons: Record<string, string> = {
    EMAIL: '📧',
    SMS: '💬',
    WHATSAPP: '💚',
    PUSH: '🔔',
    ONLINE: '🌐',
    OFFLINE: '🏪',
    MOBILE_APP: '📱',
  };
  return icons[channel?.toUpperCase()] || '📢';
}

export function getRandomColor(index: number): string {
  const colors = [
    'hsl(217 91% 60%)',
    'hsl(256 91% 65%)',
    'hsl(142 76% 45%)',
    'hsl(38 92% 50%)',
    'hsl(0 72% 51%)',
    'hsl(199 89% 48%)',
    'hsl(326 78% 60%)',
    'hsl(171 77% 41%)',
  ];
  return colors[index % colors.length];
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}
