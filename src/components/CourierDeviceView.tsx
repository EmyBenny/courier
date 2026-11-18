import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Compass,
  LocateFixed,
  Pause,
  Play,
  Radio,
  SkipForward,
} from 'lucide-react';
import type { Courier, LatLngLiteral, Parcel } from '../types/courier';
import { CourierMapPanel } from './CourierMapPanel';
import {
  StatusLabel,
  formatClockTime,
  formatDistanceKm,
  formatEtaText,
} from './StatusLabel';

interface CourierDeviceViewProps {
  couriers: Courier[];
  parcels: Parcel[];
  onSendTelemetry: (
    courierId: string,
    payload: {
      action: 'start' | 'pause' | 'step' | 'ping' | 'gps_coords';
      stepDelta?: number;
      lat?: number;
      lng?: number;
      heading?: number;
      speedKmh?: number;
      accuracyMeters?: number;
    }
  ) => Promise<unknown>;
  onRouteComputed: (
    parcelId: string,
    data: {
      distanceMeters: number;
      durationSeconds: number;
      routePath: LatLngLiteral[];
    }
  ) => void;
}

export const CourierDeviceView: React.FC<CourierDeviceViewProps> = ({
  couriers,
  parcels,
  onSendTelemetry,
  onRouteComputed,
}) => {
  const [selectedCourierId, setSelectedCourierId] = useState<string>(
    couriers[0]?.id ?? ''
  );
  const [deviceGpsActive, setDeviceGpsActive] = useState(false);
  const [gpsStatusText, setGpsStatusText] = useState<string>(
    'Standby — enable live device GPS capture or start route-aligned telemetry.'
  );
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const latestCoordsRef = useRef<GeolocationCoordinates | null>(null);

  useEffect(() => {
    if (!selectedCourierId && couriers.length > 0) {
      setSelectedCourierId(couriers[0].id);
    }
  }, [selectedCourierId, couriers]);

  const activeCourier =
    couriers.find((c) => c.id === selectedCourierId) ?? couriers[0] ?? null;
  const activeParcel = activeCourier?.activeParcelId
    ? parcels.find((p) => p.id === activeCourier.activeParcelId) ?? null
    : null;

  const transmitCoords = useCallback(
    async (coords: GeolocationCoordinates, courierId: string) => {
      try {
        await onSendTelemetry(courierId, {
          action: 'gps_coords',
          lat: coords.latitude,
          lng: coords.longitude,
          heading: coords.heading ?? undefined,
          speedKmh:
            coords.speed !== null && coords.speed >= 0
              ? Math.round(coords.speed * 3.6)
              : undefined,
          accuracyMeters: coords.accuracy,
        });
        setPingCount((c) => c + 1);
        setGpsStatusText(
          `Transmitting live device GPS (${coords.latitude.toFixed(
            5
          )}, ${coords.longitude.toFixed(5)}) · ±${Math.round(
            coords.accuracy
          )}m accuracy`
        );
        setGpsError(null);
      } catch (err) {
        setGpsError(
          err instanceof Error ? err.message : 'Failed to transmit GPS ping.'
        );
      }
    },
    [onSendTelemetry]
  );

  const stopDeviceGps = useCallback(() => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDeviceGpsActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopDeviceGps();
    };
  }, [stopDeviceGps]);

  const toggleDeviceGps = () => {
    if (!activeCourier) return;
    if (deviceGpsActive) {
      stopDeviceGps();
      setGpsStatusText('Device geolocation capture paused.');
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Browser Geolocation API is unavailable in this environment.');
      return;
    }

    setGpsError(null);
    setDeviceGpsActive(true);
    setGpsStatusText('Acquiring satellite / network GPS fix...');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latestCoordsRef.current = pos.coords;
        void transmitCoords(pos.coords, activeCourier.id);
      },
      (err) => {
        setGpsError(
          `Geolocation permission or signal error: ${err.message}. You can still use Route-Aligned GPS Stream below.`
        );
        stopDeviceGps();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    // Periodic 5-second interval heartbeat to guarantee regular server telemetry pings
    intervalRef.current = window.setInterval(() => {
      if (latestCoordsRef.current) {
        void transmitCoords(latestCoordsRef.current, activeCourier.id);
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            latestCoordsRef.current = pos.coords;
            void transmitCoords(pos.coords, activeCourier.id);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    }, 5000);
  };

  if (!activeCourier) {
    return (
      <div className="p-8 text-center border border-[#D4B996] rounded-xl bg-[#EDE3D4]/50 text-sm text-[#6F4E37]">
        No couriers registered. Add a courier from the Admin Dashboard first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-[#EDE3D4] border border-[#D4B996] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#3B2A1F]">
            Courier Device Geolocation Console
          </h1>
          <p className="text-xs text-[#6F4E37] mt-0.5">
            Capture live GPS coordinates from a courier device every 5 seconds and broadcast directly to customer tracking maps
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label
            htmlFor="courier-device-select"
            className="text-xs font-medium text-[#6F4E37]"
          >
            Active Device:
          </label>
          <select
            id="courier-device-select"
            value={activeCourier.id}
            onChange={(e) => {
              stopDeviceGps();
              setSelectedCourierId(e.target.value);
            }}
            className="px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] focus:outline-none focus:border-[#6F4E37]"
          >
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.vehiclePlate}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Geolocation Capture Controls & Telemetry Readout */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-xl bg-[#FFF9F0] border border-[#D4B996] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LocateFixed className="w-4 h-4 text-[#6F4E37]" />
                <h2 className="text-base font-semibold text-[#3B2A1F]">
                  Hardware Geolocation Capture
                </h2>
              </div>
              <span className="font-mono text-xs text-[#6F4E37] tabular-nums">
                {pingCount} pings sent
              </span>
            </div>

            <p className="text-xs text-[#6F4E37] leading-relaxed">
              {gpsStatusText}
            </p>

            {gpsError && (
              <div className="px-3.5 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-xs text-[#B91C1C]">
                {gpsError}
              </div>
            )}

            <button
              type="button"
              onClick={toggleDeviceGps}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                deviceGpsActive
                  ? 'bg-[#3B2A1F] text-[#FFF9F0]'
                  : 'bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F]'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>
                {deviceGpsActive
                  ? 'Stop Device GPS Broadcast'
                  : 'Capture & Stream Device GPS'}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#EDE3D4] text-xs">
              <div>
                <span className="text-[#B08968] block">Latitude / Longitude</span>
                <span className="font-mono font-semibold text-[#3B2A1F] tabular-nums mt-0.5 block">
                  {activeCourier.location.lat.toFixed(5)},{' '}
                  {activeCourier.location.lng.toFixed(5)}
                </span>
              </div>
              <div>
                <span className="text-[#B08968] block">Heading & Speed</span>
                <span className="font-mono font-semibold text-[#3B2A1F] tabular-nums mt-0.5 inline-flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-[#6F4E37]" />
                  {activeCourier.heading}° · {activeCourier.speedKmh} km/h
                </span>
              </div>
              <div>
                <span className="text-[#B08968] block">GPS Accuracy</span>
                <span className="font-mono text-[#3B2A1F] tabular-nums mt-0.5 block">
                  ±{activeCourier.accuracyMeters ?? 6} m
                </span>
              </div>
              <div>
                <span className="text-[#B08968] block">Last Server Sync</span>
                <span className="font-mono text-[#3B2A1F] tabular-nums mt-0.5 block">
                  {formatClockTime(activeCourier.lastPingIso)}
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Delivery & Route-Aligned Telemetry Controls */}
          <div className="p-5 rounded-xl bg-[#FFF9F0] border border-[#D4B996] space-y-4">
            <h3 className="text-sm font-semibold text-[#3B2A1F]">
              Assigned Route & Stationary Test Stream
            </h3>

            {activeParcel ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-[#EDE3D4]/60 border border-[#D4B996]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#3B2A1F]">
                      {activeParcel.trackingCode}
                    </span>
                    <StatusLabel status={activeParcel.status} />
                  </div>
                  <p className="text-sm font-semibold text-[#3B2A1F] mt-1">
                    {activeParcel.customerName}
                  </p>
                  <p className="text-xs text-[#6F4E37] mt-0.5">
                    {activeParcel.destinationAddress}
                  </p>
                  <div className="mt-2 pt-2 border-t border-[#D4B996]/60 flex items-center justify-between text-xs font-mono text-[#3B2A1F] tabular-nums">
                    <span>
                      ETA {formatEtaText(activeParcel.etaSeconds, activeParcel.status)}
                    </span>
                    <span>{formatDistanceKm(activeParcel.distanceMeters)}</span>
                  </div>
                </div>

                {activeParcel.status !== 'delivered' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void onSendTelemetry(activeCourier.id, {
                          action: activeCourier.liveStreamActive
                            ? 'pause'
                            : 'start',
                        })
                      }
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                        activeCourier.liveStreamActive
                          ? 'bg-[#3B2A1F] text-[#FFF9F0]'
                          : 'bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F]'
                      }`}
                    >
                      {activeCourier.liveStreamActive ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Route Stream</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Stream Along Road Route</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void onSendTelemetry(activeCourier.id, {
                          action: 'step',
                          stepDelta: 0.15,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#D4B996] bg-[#EDE3D4] text-[#3B2A1F] hover:bg-[#D4B996]/50 transition-colors"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Step GPS</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#6F4E37]">
                This courier currently has no active parcel assigned. Assign a delivery from the Admin Dashboard.
              </p>
            )}
          </div>
        </div>

        {/* Right: Customer-Facing Live Map Preview */}
        <div className="lg:col-span-7 flex flex-col min-h-[420px] lg:min-h-[580px]">
          <CourierMapPanel
            parcels={activeParcel ? [activeParcel] : parcels}
            couriers={[activeCourier]}
            selectedParcelId={activeParcel?.id ?? null}
            onSelectParcel={() => {}}
            onRouteComputed={onRouteComputed}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
};
