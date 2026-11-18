import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  LocateFixed,
  MapPin,
  Package,
  Phone,
  Search,
  Truck,
} from 'lucide-react';
import type {
  Courier,
  LatLngLiteral,
  Parcel,
  PushEventType,
  PushSubscriptionPrefs,
} from '../types/courier';
import { CourierMapPanel } from './CourierMapPanel';
import {
  StatusLabel,
  formatClockTime,
  formatDistanceKm,
  formatEtaText,
  formatPriorityLabel,
} from './StatusLabel';

interface CustomerTrackerViewProps {
  parcels: Parcel[];
  couriers: Courier[];
  selectedParcelId: string | null;
  onSelectParcel: (id: string) => void;
  onRouteComputed: (
    parcelId: string,
    data: {
      distanceMeters: number;
      durationSeconds: number;
      routePath: LatLngLiteral[];
    }
  ) => void;
  pushPrefs: PushSubscriptionPrefs;
  onUpdatePushPrefs: (next: PushSubscriptionPrefs) => void;
  onToggleDevicePush: () => Promise<void>;
  onTriggerSamplePush: (parcelId: string, eventType: PushEventType) => Promise<void>;
}

export const CustomerTrackerView: React.FC<CustomerTrackerViewProps> = ({
  parcels,
  couriers,
  selectedParcelId,
  onSelectParcel,
  onRouteComputed,
  pushPrefs,
  onUpdatePushPrefs,
  onToggleDevicePush,
  onTriggerSamplePush,
}) => {
  const [trackingQuery, setTrackingQuery] = useState('');

  const activeParcel =
    parcels.find((p) => p.id === selectedParcelId) ?? parcels[0] ?? null;
  const assignedCourier = activeParcel?.courierId
    ? couriers.find((c) => c.id === activeParcel.courierId)
    : undefined;

  const handleSearchTracking = (e: React.FormEvent) => {
    e.preventDefault();
    const q = trackingQuery.trim().toLowerCase();
    if (!q) return;
    const match = parcels.find(
      (p) =>
        p.trackingCode.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q)
    );
    if (match) {
      onSelectParcel(match.id);
    }
  };

  if (!activeParcel) {
    return (
      <div className="p-8 text-center border border-[#D4B996] rounded-xl bg-[#EDE3D4]/40">
        <Package className="w-8 h-8 text-[#6F4E37] mx-auto mb-2" />
        <h3 className="text-base font-semibold text-[#3B2A1F]">
          No Active Parcels Found
        </h3>
        <p className="text-sm text-[#6F4E37] mt-1">
          Create a delivery task from the Dispatch Board to preview customer tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tracking Code Lookup Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-[#EDE3D4] border border-[#D4B996]">
        <div>
          <h2 className="text-lg font-semibold text-[#3B2A1F]">
            Customer Live Parcel Portal
          </h2>
          <p className="text-xs text-[#6F4E37] mt-0.5">
            Real-time estimated arrival countdown, live courier GPS location, and instant device push alerts
          </p>
        </div>

        <form
          onSubmit={handleSearchTracking}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative">
            <Search className="w-4 h-4 text-[#B08968] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={trackingQuery}
              onChange={(e) => setTrackingQuery(e.target.value)}
              placeholder="Enter tracking ID (e.g. CMB-4081)"
              className="pl-9 pr-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37] w-60"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F] transition-colors whitespace-nowrap"
          >
            Track Parcel
          </button>
        </form>
      </div>

      {/* Quick Switcher across customer shipments */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {parcels.map((p) => {
          const isCurrent = p.id === activeParcel.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectParcel(p.id)}
              className={`px-3.5 py-2 rounded-lg border text-left transition-colors shrink-0 ${
                isCurrent
                  ? 'bg-[#3B2A1F] text-[#FFF9F0] border-[#3B2A1F]'
                  : 'bg-[#FFF9F0] text-[#3B2A1F] border-[#D4B996] hover:bg-[#EDE3D4]'
              }`}
            >
              <div className="font-mono text-xs font-semibold">
                {p.trackingCode}
              </div>
              <div
                className={`text-[11px] truncate max-w-[140px] ${
                  isCurrent ? 'text-[#D4B996]' : 'text-[#6F4E37]'
                }`}
              >
                {p.customerName}
              </div>
            </button>
          );
        })}
      </div>

      {/* Split Customer Map & Arrival Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: ETA, Milestones & Push Notification Preferences */}
        <div className="lg:col-span-5 space-y-5">
          {/* ETA Hero Panel */}
          <div className="p-5 rounded-xl bg-[#FFF9F0] border border-[#D4B996]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#6F4E37]">
                  <span className="font-mono font-semibold text-[#3B2A1F]">
                    {activeParcel.trackingCode}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatPriorityLabel(activeParcel.priority)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{activeParcel.weightKg} kg</span>
                </div>
                <h3 className="text-xl font-bold text-[#3B2A1F] mt-1">
                  {activeParcel.status === 'delivered'
                    ? 'Delivered to Recipient'
                    : `Arriving in ${formatEtaText(
                        activeParcel.etaSeconds,
                        activeParcel.status
                      )}`}
                </h3>
                <p className="text-xs text-[#6F4E37] mt-1 tabular-nums">
                  {activeParcel.status === 'delivered'
                    ? `Completed at ${formatClockTime(activeParcel.updatedAt)}`
                    : `Estimated arrival by ${formatClockTime(
                        activeParcel.estimatedArrivalIso
                      )} · ${formatDistanceKm(activeParcel.distanceMeters)} away`}
                </p>
              </div>
              <StatusLabel status={activeParcel.status} />
            </div>

            {activeParcel.delayReason && (
              <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-[#FEE2E2]/70 border border-[#FECACA] text-xs text-[#B91C1C]">
                Delay notice: {activeParcel.delayReason}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[#EDE3D4] grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#B08968] block">Destination</span>
                <span className="font-medium text-[#3B2A1F] mt-0.5 block">
                  {activeParcel.destinationAddress}
                </span>
              </div>
              <div>
                <span className="text-[#B08968] block">Parcel</span>
                <span className="font-medium text-[#3B2A1F] mt-0.5 block">
                  {activeParcel.itemDescription}
                </span>
              </div>
            </div>

            {assignedCourier && (
              <div className="mt-4 pt-4 border-t border-[#EDE3D4] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#3B2A1F] text-[#FFF9F0] flex items-center justify-center font-mono text-xs font-semibold shrink-0">
                      {assignedCourier.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#3B2A1F] truncate">
                        {assignedCourier.name}
                      </div>
                      <div className="text-xs text-[#6F4E37] truncate">
                        {assignedCourier.vehicleType} · {assignedCourier.vehiclePlate}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-[#6F4E37] shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{assignedCourier.phone}</span>
                  </div>
                </div>

                {/* Live Geolocation Readout */}
                <div className="px-3 py-2 rounded-lg bg-[#EDE3D4]/65 flex items-center justify-between gap-2 text-[11px] font-mono text-[#3B2A1F] tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <LocateFixed className="w-3.5 h-3.5 text-[#6F4E37]" />
                    <span>
                      {assignedCourier.location.lat.toFixed(5)},{' '}
                      {assignedCourier.location.lng.toFixed(5)}
                    </span>
                  </span>
                  <span className="text-[#6F4E37]">
                    {assignedCourier.speedKmh} km/h · Ping{' '}
                    {formatClockTime(assignedCourier.lastPingIso)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Delivery Milestone Timeline */}
          <div className="p-5 rounded-xl bg-[#FFF9F0] border border-[#D4B996]">
            <h4 className="text-sm font-semibold text-[#3B2A1F] mb-4">
              Live Delivery Timeline
            </h4>
            <ol className="space-y-4">
              {activeParcel.milestones.map((m, idx) => {
                const isLast = idx === activeParcel.milestones.length - 1;
                return (
                  <li key={m.id} className="relative flex gap-3">
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-[11px] top-6 bottom-[-16px] w-[1.5px] ${
                          m.completed ? 'bg-[#6F4E37]' : 'bg-[#D4B996]'
                        }`}
                      />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                        m.completed
                          ? 'bg-[#6F4E37] border-[#6F4E37] text-[#FFF9F0]'
                          : 'bg-[#EDE3D4] border-[#D4B996] text-[#B08968]'
                      }`}
                    >
                      {m.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-medium ${
                            m.completed ? 'text-[#3B2A1F]' : 'text-[#B08968]'
                          }`}
                        >
                          {m.label}
                        </span>
                        <span className="font-mono text-xs text-[#6F4E37] tabular-nums">
                          {formatClockTime(m.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-[#6F4E37] mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{m.location}</span>
                      </p>
                      {m.detail && (
                        <p className="text-xs text-[#B08968] mt-0.5">
                          {m.detail}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Customer Device Push Notification Configuration */}
          <div className="p-5 rounded-xl bg-[#EDE3D4]/60 border border-[#D4B996] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#6F4E37]" />
                <h4 className="text-sm font-semibold text-[#3B2A1F]">
                  Customer Device Push Alerts
                </h4>
              </div>
              <button
                type="button"
                onClick={() => void onToggleDevicePush()}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  pushPrefs.enabled
                    ? 'bg-[#3B2A1F] text-[#FFF9F0] border-[#3B2A1F]'
                    : 'bg-[#FFF9F0] text-[#3B2A1F] border-[#D4B996] hover:bg-[#EDE3D4]'
                }`}
              >
                {pushPrefs.enabled ? 'Push Alerts Active' : 'Enable Push Alerts'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs text-[#3B2A1F]">
              {(
                [
                  ['outForDelivery', 'Out for Delivery'],
                  ['arrivingSoon', 'Arriving Soon (< 4m)'],
                  ['delays', 'Route Delays'],
                  ['delivered', 'Delivered Proof'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={pushPrefs[key]}
                    onChange={(e) =>
                      onUpdatePushPrefs({
                        ...pushPrefs,
                        [key]: e.target.checked,
                      })
                    }
                    className="accent-[#6F4E37] w-3.5 h-3.5 rounded"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="pt-2.5 border-t border-[#D4B996]/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-2 text-[#6F4E37] cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushPrefs.soundEnabled}
                  onChange={(e) =>
                    onUpdatePushPrefs({
                      ...pushPrefs,
                      soundEnabled: e.target.checked,
                    })
                  }
                  className="accent-[#6F4E37] w-3.5 h-3.5 rounded"
                />
                <span>Audio chime</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[#6F4E37]">Test event:</span>
                {(
                  [
                    ['out_for_delivery', 'Out for Delivery'],
                    ['arriving_soon', 'Arriving Soon'],
                    ['delivered', 'Delivered'],
                  ] as const
                ).map(([evt, label]) => (
                  <button
                    key={evt}
                    type="button"
                    onClick={() => void onTriggerSamplePush(activeParcel.id, evt)}
                    className="underline decoration-[#B08968] text-[#3B2A1F] hover:text-[#6F4E37]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Map locked onto Customer Parcel */}
        <div className="lg:col-span-7 flex flex-col min-h-[440px] lg:min-h-[620px]">
          <CourierMapPanel
            parcels={[activeParcel]}
            couriers={assignedCourier ? [assignedCourier] : []}
            selectedParcelId={activeParcel.id}
            onSelectParcel={onSelectParcel}
            onRouteComputed={onRouteComputed}
            className="flex-1"
          />
          {activeParcel.deliveryNotes && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-[#EDE3D4]/70 border border-[#D4B996] flex items-center gap-2.5 text-xs text-[#3B2A1F]">
              <Truck className="w-4 h-4 text-[#6F4E37] shrink-0" />
              <span>
                <strong className="font-semibold">Delivery note:</strong>{' '}
                {activeParcel.deliveryNotes}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
