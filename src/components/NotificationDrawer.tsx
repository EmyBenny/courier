import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Info,
  X,
} from 'lucide-react';
import type { AlertSeverity, CourierNotification } from '../types/courier';
import { formatClockTime } from './StatusLabel';

interface NotificationDrawerProps {
  isOpen: boolean;
  notifications: CourierNotification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onInspectParcel: (parcelId: string) => void;
}

function getSeverityMeta(severity: AlertSeverity) {
  switch (severity) {
    case 'warning':
      return {
        label: 'Delay Alert',
        color: 'text-[#B91C1C]',
        Icon: AlertTriangle,
      };
    case 'delivered':
      return {
        label: 'Delivered',
        color: 'text-[#15803D]',
        Icon: CheckCircle2,
      };
    case 'eta':
      return {
        label: 'ETA Update',
        color: 'text-[#6F4E37]',
        Icon: Clock,
      };
    default:
      return {
        label: 'Dispatch',
        color: 'text-[#3B2A1F]',
        Icon: Info,
      };
  }
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onInspectParcel,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const filtered =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#3B2A1F]/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Live Notification Alerts"
    >
      <div className="w-full max-w-md bg-[#FFF9F0] border-l border-[#D4B996] h-full flex flex-col shadow-2xl">
        <div className="px-5 py-4 bg-[#EDE3D4] border-b border-[#D4B996] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-[#6F4E37]" />
            <div>
              <h2 className="text-base font-semibold text-[#3B2A1F]">
                Live Notification Alerts
              </h2>
              <p className="text-xs text-[#6F4E37] tabular-nums">
                {unreadCount} unread alerts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6F4E37] hover:text-[#3B2A1F] hover:bg-[#D4B996]/40 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close alerts drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[#EDE3D4] flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#EDE3D4] rounded-lg">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-[#FFF9F0] text-[#3B2A1F] shadow-sm'
                  : 'text-[#6F4E37] hover:text-[#3B2A1F]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === 'unread'
                  ? 'bg-[#FFF9F0] text-[#3B2A1F] shadow-sm'
                  : 'text-[#6F4E37] hover:text-[#3B2A1F]'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6F4E37] hover:text-[#3B2A1F] transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#EDE3D4]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#6F4E37]">
              No notifications in this view.
            </div>
          ) : (
            filtered.map((notif) => {
              const meta = getSeverityMeta(notif.severity);
              const Icon = meta.Icon;
              return (
                <div
                  key={notif.id}
                  className={`px-5 py-4 transition-colors ${
                    notif.read ? 'bg-[#FFF9F0]' : 'bg-[#EDE3D4]/45'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{meta.label}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{notif.trackingCode}</span>
                    </span>
                    <span className="font-mono text-[11px] text-[#6F4E37] tabular-nums">
                      {formatClockTime(notif.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#3B2A1F] mt-1">
                    {notif.title}
                  </h3>
                  <p className="text-xs text-[#6F4E37] mt-0.5 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-4 mt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onInspectParcel(notif.parcelId);
                        if (!notif.read) onMarkRead(notif.id);
                        onClose();
                      }}
                      className="text-xs font-medium text-[#6F4E37] underline decoration-[#B08968] hover:text-[#3B2A1F]"
                    >
                      Inspect on map
                    </button>
                    {!notif.read && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(notif.id)}
                        className="text-xs text-[#B08968] hover:text-[#3B2A1F]"
                      >
                        Dismiss unread
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
