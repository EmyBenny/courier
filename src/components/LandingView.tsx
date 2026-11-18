import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
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
} from './StatusLabel';

interface LandingViewProps {
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
  onEnablePushForParcel: (trackingCode: string) => Promise<void>;
  onTriggerSamplePush: (parcelId: string, eventType: PushEventType) => Promise<void>;
  onOpenFullTracker: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  parcels,
  couriers,
  selectedParcelId,
  onSelectParcel,
  onRouteComputed,
  pushPrefs,
  onEnablePushForParcel,
  onTriggerSamplePush,
  onOpenFullTracker,
}) => {
  const [trackingInput, setTrackingInput] = useState('');
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [handoffImgFailed, setHandoffImgFailed] = useState(false);

  const trackedParcel =
    parcels.find((p) => p.id === selectedParcelId) ?? parcels[0] ?? null;
  const trackedCourier = trackedParcel?.courierId
    ? couriers.find((c) => c.id === trackedParcel.courierId)
    : undefined;

  const activeShipmentsCount = parcels.filter(
    (p) => p.status !== 'delivered'
  ).length;
  const deliveredCount = parcels.filter((p) => p.status === 'delivered').length;
  const onTimePercent =
    parcels.length > 0
      ? Math.round(
          ((parcels.length -
            parcels.filter((p) => p.status === 'delayed').length) /
            parcels.length) *
            100
        )
      : 100;

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = trackingInput.trim().toLowerCase();
    if (!query) {
      setLookupMessage('Enter a tracking ID such as CMB-4081.');
      return;
    }
    const found = parcels.find(
      (p) =>
        p.trackingCode.toLowerCase() === query ||
        p.trackingCode.toLowerCase().includes(query) ||
        p.customerName.toLowerCase().includes(query)
    );
    if (found) {
      onSelectParcel(found.id);
      setLookupMessage(null);
      const trackerEl = document.getElementById('visitor-live-tracker');
      trackerEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setLookupMessage(
        `No shipment matched "${trackingInput.trim()}". Try CMB-4081, CMB-4082, or CMB-4083.`
      );
    }
  };

  return (
    <div className="space-y-14 pb-8">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-2">
        <div className="lg:col-span-6 flex flex-col justify-between py-2 space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-medium text-[#6F4E37]">
              San Francisco Urban Courier Network · Live GPS Dispatch
            </p>
            <h1
              className="font-bold tracking-tight text-[#3B2A1F] leading-[1.08]"
              style={{
                fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
                textWrap: 'balance',
              }}
            >
              Track every parcel down to the street corner.
            </h1>
            <p className="text-base text-[#6F4E37] leading-relaxed max-w-xl">
              Follow your courier vehicle in real time, watch traffic-adjusted arrival
              windows update live, and receive instant alerts when your delivery
              is out for delivery, arriving soon, or at your door.
            </p>
          </div>

          {/* Visitor Parcel Tracking Input */}
          <div
            id="parcel-lookup"
            className="p-4 sm:p-5 rounded-xl bg-[#EDE3D4] border border-[#D4B996] space-y-3 scroll-mt-20"
          >
            <form
              onSubmit={handleTrackSubmit}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#B08968] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="parcel-lookup-input"
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="Enter tracking number (e.g. CMB-4081)"
                  aria-label="Tracking number"
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Track Parcel</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {lookupMessage && (
              <p className="text-xs text-[#B91C1C] font-medium">
                {lookupMessage}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6F4E37]">
              <span>Active sample shipments:</span>
              {parcels.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setTrackingInput(p.trackingCode);
                    onSelectParcel(p.id);
                    setLookupMessage(null);
                  }}
                  className="font-mono font-semibold text-[#3B2A1F] underline decoration-[#B08968] hover:text-[#6F4E37]"
                >
                  {p.trackingCode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hero Visual Asset */}
        <div className="lg:col-span-6 relative rounded-xl overflow-hidden border border-[#D4B996] bg-[#EDE3D4] min-h-[280px] lg:min-h-[420px]">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/hero_courier_dispatch_1795013935873.jpg"
              alt="Camber Dispatch electric courier van outside urban fulfillment studio"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover lg:h-full"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#EDE3D4]">
              <Truck className="w-10 h-10 text-[#6F4E37] mb-2" />
              <span className="text-sm font-semibold text-[#3B2A1F]">
                Camber Electric Urban Fleet
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-[#3B2A1F]/85 via-[#3B2A1F]/40 to-transparent text-[#FFF9F0]">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
              <span>Live Courier Telemetry · Real-Time Route ETAs</span>
              <span className="font-mono tabular-nums">
                {activeShipmentsCount} active · {onTimePercent}% on-time
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Visitor Tracking Result & Map */}
      {trackedParcel && (
        <section
          id="visitor-live-tracker"
          className="rounded-xl border border-[#D4B996] bg-[#FFF9F0] overflow-hidden"
        >
          <div className="px-5 py-4 bg-[#EDE3D4] border-b border-[#D4B996] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#6F4E37]">
                <span className="font-mono font-semibold text-[#3B2A1F]">
                  {trackedParcel.trackingCode}
                </span>
                <span aria-hidden="true">·</span>
                <span>Recipient: {trackedParcel.customerName}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{trackedParcel.weightKg} kg</span>
              </div>
              <h2 className="text-lg font-bold text-[#3B2A1F] mt-0.5">
                {trackedParcel.status === 'delivered'
                  ? 'Delivered to Destination'
                  : `Estimated Arrival: ${formatEtaText(
                      trackedParcel.etaSeconds,
                      trackedParcel.status
                    )} (${formatClockTime(trackedParcel.estimatedArrivalIso)})`}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <StatusLabel status={trackedParcel.status} />
              <button
                type="button"
                onClick={() =>
                  void onEnablePushForParcel(trackedParcel.trackingCode)
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  pushPrefs.enabled
                    ? 'bg-[#3B2A1F] text-[#FFF9F0] border-[#3B2A1F]'
                    : 'bg-[#FFF9F0] text-[#3B2A1F] border-[#6F4E37] hover:bg-[#EDE3D4]'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>
                  {pushPrefs.enabled
                    ? 'Device Alerts Enabled'
                    : 'Notify My Device'}
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenFullTracker}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F] transition-colors whitespace-nowrap"
              >
                Full Customer View
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Milestones & Courier Geolocation Details */}
            <div className="lg:col-span-5 p-5 space-y-5 border-b lg:border-b-0 lg:border-r border-[#EDE3D4]">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#B08968] block">Destination</span>
                  <span className="font-medium text-[#3B2A1F] mt-0.5 block">
                    {trackedParcel.destinationAddress}
                  </span>
                </div>
                <div>
                  <span className="text-[#B08968] block">Remaining Distance</span>
                  <span className="font-mono font-semibold text-[#3B2A1F] mt-0.5 block tabular-nums">
                    {formatDistanceKm(trackedParcel.distanceMeters)}
                  </span>
                </div>
              </div>

              {trackedCourier && (
                <div className="p-3.5 rounded-lg bg-[#EDE3D4]/65 border border-[#D4B996] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#3B2A1F] text-[#FFF9F0] flex items-center justify-center font-mono text-xs font-semibold shrink-0">
                      {trackedCourier.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#3B2A1F] truncate">
                        {trackedCourier.name} · {trackedCourier.vehicleType}
                      </div>
                      <div className="font-mono text-[11px] text-[#6F4E37] tabular-nums">
                        GPS {trackedCourier.location.lat.toFixed(4)},{' '}
                        {trackedCourier.location.lng.toFixed(4)} ·{' '}
                        {trackedCourier.speedKmh} km/h
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-[#6F4E37] shrink-0">
                    {formatClockTime(trackedCourier.lastPingIso)}
                  </span>
                </div>
              )}

              <ol className="space-y-3">
                {trackedParcel.milestones.map((m) => (
                  <li key={m.id} className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        m.completed
                          ? 'bg-[#6F4E37] text-[#FFF9F0]'
                          : 'bg-[#EDE3D4] text-[#B08968]'
                      }`}
                    >
                      {m.completed ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`font-medium ${
                            m.completed ? 'text-[#3B2A1F]' : 'text-[#B08968]'
                          }`}
                        >
                          {m.label}
                        </span>
                        <span className="font-mono text-[#6F4E37] tabular-nums">
                          {formatClockTime(m.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6F4E37] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{m.location}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Quick Demo Push Trigger for Visitor Testing */}
              <div className="pt-3 border-t border-[#EDE3D4] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#6F4E37]">Test instant push alert:</span>
                <div className="flex items-center gap-2">
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
                      onClick={() =>
                        void onTriggerSamplePush(trackedParcel.id, evt)
                      }
                      className="underline decoration-[#B08968] text-[#3B2A1F] hover:text-[#6F4E37]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Map */}
            <div className="lg:col-span-7 p-4 bg-[#EDE3D4]/30 min-h-[380px] lg:min-h-[460px]">
              <CourierMapPanel
                parcels={[trackedParcel]}
                couriers={trackedCourier ? [trackedCourier] : []}
                selectedParcelId={trackedParcel.id}
                onSelectParcel={onSelectParcel}
                onRouteComputed={onRouteComputed}
                className="h-full min-h-[360px]"
              />
            </div>
          </div>
        </section>
      )}

      {/* Asymmetric Capabilities & Proof Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex-1 p-6 rounded-xl bg-[#EDE3D4]/75 border border-[#D4B996] flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#3B2A1F]">
                01. Real-Time Courier Geolocation Stream
              </h2>
              <p className="text-sm text-[#6F4E37] mt-1.5 leading-relaxed">
                Courier devices capture GPS latitude, longitude, speed, and heading at
                regular intervals and broadcast coordinates immediately over WebSockets to
                the customer tracking map.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D4B996] flex items-center justify-between text-xs text-[#3B2A1F]">
              <span className="font-mono tabular-nums">
                {couriers.length} fleet couriers active
              </span>
              <span className="text-[#6F4E37]">5s GPS telemetry sync</span>
            </div>
          </div>

          <div className="flex-1 p-6 rounded-xl bg-[#FFF9F0] border border-[#D4B996] flex flex-col justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#3B2A1F]">
                02. Event-Driven Push Alerts
              </h3>
              <p className="text-sm text-[#6F4E37] mt-1.5 leading-relaxed">
                Customers subscribe once to receive immediate device notifications for Out
                for Delivery, Arriving Soon (&lt; 4 min), Traffic Delays, and Delivered.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#EDE3D4] flex items-center justify-between text-xs text-[#6F4E37]">
              <span>Service Worker + Browser Notification Alerts</span>
              <span className="font-mono tabular-nums text-[#3B2A1F]">Instant sync</span>
            </div>
          </div>
        </div>

        {/* Right Editorial Image + Proof Metric */}
        <div className="lg:col-span-5 rounded-xl border border-[#D4B996] bg-[#EDE3D4] overflow-hidden flex flex-col">
          <div className="relative h-56 sm:h-64 overflow-hidden">
            {!handoffImgFailed ? (
              <img
                src="/src/assets/images/courier_parcel_handoff_1795013937614.jpg"
                alt="Courier handing parcel directly to customer at doorstep"
                referrerPolicy="no-referrer"
                onError={() => setHandoffImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#EDE3D4]">
                <Package className="w-8 h-8 text-[#6F4E37]" />
              </div>
            )}
          </div>
          <div className="p-5 flex-1 flex flex-col justify-between bg-[#FFF9F0]">
            <div>
              <h3 className="text-base font-semibold text-[#3B2A1F]">
                03. Verified Doorstep Handoff
              </h3>
              <p className="text-xs text-[#6F4E37] mt-1 leading-relaxed">
                Every parcel carries time-stamped pickup, corridor transit, and delivery
                milestones synced between dispatchers, couriers, and recipients.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#EDE3D4] grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[#B08968] block">On-Time</span>
                <span className="font-mono font-bold text-[#3B2A1F] tabular-nums">
                  {onTimePercent}%
                </span>
              </div>
              <div>
                <span className="text-[#B08968] block">Active</span>
                <span className="font-mono font-bold text-[#3B2A1F] tabular-nums">
                  {activeShipmentsCount}
                </span>
              </div>
              <div>
                <span className="text-[#B08968] block">Delivered</span>
                <span className="font-mono font-bold text-[#3B2A1F] tabular-nums">
                  {deliveredCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
