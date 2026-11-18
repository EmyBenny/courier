import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation,
  Package,
  Truck,
} from 'lucide-react';
import type { ParcelStatus, TaskPriority } from '../types/courier';

const STATUS_CONFIG: Record<
  ParcelStatus,
  { label: string; colorClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  queued: {
    label: 'Queued',
    colorClass: 'text-[#6F4E37]',
    Icon: Clock,
  },
  picked_up: {
    label: 'Picked Up',
    colorClass: 'text-[#6F4E37]',
    Icon: Package,
  },
  in_transit: {
    label: 'In Transit',
    colorClass: 'text-[#9A5B13]',
    Icon: Truck,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    colorClass: 'text-[#3B2A1F]',
    Icon: Navigation,
  },
  delayed: {
    label: 'Delayed',
    colorClass: 'text-[#B91C1C]',
    Icon: AlertTriangle,
  },
  delivered: {
    label: 'Delivered',
    colorClass: 'text-[#15803D]',
    Icon: CheckCircle2,
  },
};

export const StatusLabel: React.FC<{ status: ParcelStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${cfg.colorClass} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{cfg.label}</span>
    </span>
  );
};

export function formatPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'same_day':
      return 'Same-Day';
    case 'express':
      return 'Express';
    case 'standard':
      return 'Standard';
  }
}

export function formatEtaText(seconds: number, status: ParcelStatus): string {
  if (status === 'delivered') return 'Arrived';
  if (seconds <= 60) return '< 1 min';
  const mins = Math.ceil(seconds / 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  }
  return `${mins} min`;
}

export function formatClockTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDistanceKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}
