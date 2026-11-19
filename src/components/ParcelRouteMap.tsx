import React, { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Compass, Globe, MapPin, Navigation, Route as RouteIcon } from 'lucide-react';
import type { TrackableParcel } from '../data/shipments';

interface DirectionStepItem {
  id: string;
  instruction: string;
  distanceText: string;
  durationText: string;
}

interface ComputedRouteSummary {
  distanceText: string;
  durationText: string;
  steps: DirectionStepItem[];
}

type MapViewMode = 'directions' | 'corridor';

interface ParcelRouteMapProps {
  parcel: TrackableParcel;
}

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';

function RouteLayer({
  parcel,
  viewMode,
  onRouteComputed,
  onRouteError,
  onLoadingChange,
}: {
  parcel: TrackableParcel;
  viewMode: MapViewMode;
  onRouteComputed: (summary: ComputedRouteSummary) => void;
  onRouteError: (msg: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const mapsLib = useMapsLibrary('maps');
  const coreLib = useMapsLibrary('core');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map) return;

    // Cleanup previous polylines cleanly
    polylinesRef.current.forEach((poly) => poly.setMap(null));
    polylinesRef.current = [];

    if (viewMode === 'corridor') {
      onLoadingChange(false);
      onRouteError(null);
      if (!coreLib || !mapsLib) return;

      const flightPath = new mapsLib.Polyline({
        path: [parcel.originPosition, parcel.currentPosition, parcel.destinationPosition],
        geodesic: true,
        strokeColor: '#0F2A1D',
        strokeOpacity: 0.9,
        strokeWeight: 3,
        map,
      });
      polylinesRef.current = [flightPath];

      const bounds = new coreLib.LatLngBounds();
      bounds.extend(parcel.originPosition);
      bounds.extend(parcel.currentPosition);
      bounds.extend(parcel.destinationPosition);
      map.fitBounds(bounds, 48);

      return () => {
        polylinesRef.current.forEach((poly) => poly.setMap(null));
        polylinesRef.current = [];
      };
    }

    if (!routesLib || !coreLib) return;

    let cancelled = false;
    onLoadingChange(true);
    onRouteError(null);

    const request: google.maps.routes.ComputeRoutesRequest = {
      origin: parcel.activeGroundOrigin,
      destination: parcel.destinationPosition,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs', 'localizedValues'],
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    };

    routesLib.Route.computeRoutes(request)
      .then(({ routes }) => {
        if (cancelled) return;
        onLoadingChange(false);

        if (!routes || routes.length === 0) {
          onRouteError('Road directions are currently unavailable for this segment.');
          const bounds = new coreLib.LatLngBounds();
          bounds.extend(parcel.activeGroundOrigin);
          bounds.extend(parcel.destinationPosition);
          map.fitBounds(bounds, 60);
          return;
        }

        const primaryRoute = routes[0];
        const createdPolylines = primaryRoute.createPolylines();
        createdPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#0F2A1D',
            strokeOpacity: 0.95,
            strokeWeight: 5,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = createdPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, 48);
        } else {
          const bounds = new coreLib.LatLngBounds();
          bounds.extend(parcel.activeGroundOrigin);
          bounds.extend(parcel.destinationPosition);
          map.fitBounds(bounds, 48);
        }

        const leg = primaryRoute.legs?.[0];
        const steps: DirectionStepItem[] = (leg?.steps ?? [])
          .map((step, idx) => ({
            id: `${parcel.waybill}-step-${idx}`,
            instruction: step.instructions?.trim() || 'Continue along designated delivery route',
            distanceText:
              step.localizedValues?.distance ||
              (step.distanceMeters ? `${(step.distanceMeters / 1000).toFixed(2)} km` : ''),
            durationText: step.localizedValues?.staticDuration || '',
          }))
          .filter((item) => Boolean(item.instruction));

        const distanceText =
          primaryRoute.localizedValues?.distance ||
          (primaryRoute.distanceMeters
            ? `${(primaryRoute.distanceMeters / 1000).toFixed(1)} km`
            : 'N/A');
        const durationText =
          primaryRoute.localizedValues?.duration ||
          (primaryRoute.durationMillis
            ? `${Math.max(1, Math.round(primaryRoute.durationMillis / 60000))} mins`
            : 'N/A');

        onRouteComputed({
          distanceText,
          durationText,
          steps,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onLoadingChange(false);
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        console.error('Error computing parcel route:', err);
        onRouteError('Unable to load turn-by-turn road directions right now.');

        // Draw geodesic line between hub/courier and destination while keeping markers centered
        if (mapsLib) {
          const fallbackLine = new mapsLib.Polyline({
            path: [parcel.activeGroundOrigin, parcel.destinationPosition],
            geodesic: true,
            strokeColor: '#375534',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map,
          });
          polylinesRef.current = [fallbackLine];
        }

        const bounds = new coreLib.LatLngBounds();
        bounds.extend(parcel.activeGroundOrigin);
        bounds.extend(parcel.destinationPosition);
        map.fitBounds(bounds, 56);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((poly) => poly.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    map,
    routesLib,
    mapsLib,
    coreLib,
    parcel,
    viewMode,
    onRouteComputed,
    onRouteError,
    onLoadingChange,
  ]);

  return null;
}

function ParcelMarkers({
  parcel,
  viewMode,
}: {
  parcel: TrackableParcel;
  viewMode: MapViewMode;
}) {
  const [activeMarker, setActiveMarker] = useState<'origin' | 'current' | 'destination' | null>(
    'current'
  );
  const [originRef, originMarker] = useAdvancedMarkerRef();
  const [currentRef, currentMarker] = useAdvancedMarkerRef();
  const [destRef, destMarker] = useAdvancedMarkerRef();

  return (
    <>
      {viewMode === 'corridor' && (
        <>
          <AdvancedMarker
            ref={originRef}
            position={parcel.originPosition}
            title={`Origin: ${parcel.originFacility}`}
            onClick={() => setActiveMarker('origin')}
          >
            <Pin background="#6B9071" borderColor="#0F2A1D" glyphColor="#E3EED4" />
          </AdvancedMarker>
          {activeMarker === 'origin' && originMarker && (
            <InfoWindow anchor={originMarker} onCloseClick={() => setActiveMarker(null)}>
              <div className="p-1 text-xs text-[#0F2A1D] max-w-[220px]">
                <div className="font-bold">Origin · {parcel.originCode}</div>
                <div className="mt-0.5">{parcel.originFacility}</div>
              </div>
            </InfoWindow>
          )}
        </>
      )}

      {viewMode === 'directions' &&
        (parcel.activeGroundOrigin.lat !== parcel.currentPosition.lat ||
          parcel.activeGroundOrigin.lng !== parcel.currentPosition.lng) && (
          <>
            <AdvancedMarker
              ref={originRef}
              position={parcel.activeGroundOrigin}
              title={parcel.activeGroundOriginLabel}
              onClick={() => setActiveMarker('origin')}
            >
              <Pin background="#6B9071" borderColor="#0F2A1D" glyphColor="#E3EED4" />
            </AdvancedMarker>
            {activeMarker === 'origin' && originMarker && (
              <InfoWindow anchor={originMarker} onCloseClick={() => setActiveMarker(null)}>
                <div className="p-1 text-xs text-[#0F2A1D] max-w-[220px]">
                  <div className="font-bold">Dispatch Gate</div>
                  <div className="mt-0.5">{parcel.activeGroundOriginLabel}</div>
                </div>
              </InfoWindow>
            )}
          </>
        )}

      {/* Current Parcel Position */}
      <AdvancedMarker
        ref={currentRef}
        position={parcel.currentPosition}
        title={`Current Parcel Location: ${parcel.currentLocationLabel}`}
        onClick={() => setActiveMarker('current')}
      >
        <Pin background="#0F2A1D" borderColor="#E3EED4" glyphColor="#E3EED4" scale={1.15} />
      </AdvancedMarker>
      {activeMarker === 'current' && currentMarker && (
        <InfoWindow anchor={currentMarker} onCloseClick={() => setActiveMarker(null)}>
          <div className="p-1 text-xs text-[#0F2A1D] max-w-[230px]">
            <div className="font-bold">Parcel {parcel.waybill}</div>
            <div className="font-semibold mt-0.5">{parcel.currentLocationLabel}</div>
            <div className="text-[11px] opacity-80 mt-0.5">{parcel.currentLocationDetails}</div>
          </div>
        </InfoWindow>
      )}

      {/* Destination */}
      <AdvancedMarker
        ref={destRef}
        position={parcel.destinationPosition}
        title={`Destination: ${parcel.destinationAddress}`}
        onClick={() => setActiveMarker('destination')}
      >
        <Pin background="#375534" borderColor="#0F2A1D" glyphColor="#E3EED4" />
      </AdvancedMarker>
      {activeMarker === 'destination' && destMarker && (
        <InfoWindow anchor={destMarker} onCloseClick={() => setActiveMarker(null)}>
          <div className="p-1 text-xs text-[#0F2A1D] max-w-[220px]">
            <div className="font-bold">Destination · {parcel.destinationCode}</div>
            <div className="mt-0.5">{parcel.destinationAddress}</div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default function ParcelRouteMap({ parcel }: ParcelRouteMapProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>('directions');
  const [routeSummary, setRouteSummary] = useState<ComputedRouteSummary | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const isAirborne =
    parcel.activeGroundOrigin.lat !== parcel.currentPosition.lat ||
    parcel.activeGroundOrigin.lng !== parcel.currentPosition.lng;

  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${parcel.activeGroundOrigin.lat},${parcel.activeGroundOrigin.lng}&destination=${parcel.destinationPosition.lat},${parcel.destinationPosition.lng}&travelmode=driving`;

  return (
    <section className="rounded-xl bg-[#0F2A1D] border border-[#6B9071]/45 p-6 sm:p-8 space-y-6">
      {/* Header + View Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#6B9071]/35 pb-5">
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#AEC3B0] flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#E3EED4]" />
            <span>Live Location &amp; Delivery Route Directions</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#E3EED4]">
            {parcel.currentLocationLabel}
          </h3>
          <p className="text-xs sm:text-sm text-[#AEC3B0]">{parcel.currentLocationDetails}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Map view mode"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#375534] border border-[#6B9071]/45"
          >
            <button
              type="button"
              onClick={() => setViewMode('directions')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'directions'
                  ? 'bg-[#E3EED4] text-[#0F2A1D]'
                  : 'text-[#AEC3B0] hover:text-[#E3EED4]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Delivery Directions</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('corridor')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'corridor'
                  ? 'bg-[#E3EED4] text-[#0F2A1D]'
                  : 'text-[#AEC3B0] hover:text-[#E3EED4]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Global Corridor</span>
            </button>
          </div>

          <a
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#6B9071]/60 text-[#E3EED4] hover:bg-[#375534] transition-colors whitespace-nowrap"
          >
            <RouteIcon className="w-3.5 h-3.5" />
            <span>Open Directions</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Interactive Google Map */}
        <div className="lg:col-span-7 rounded-xl overflow-hidden border border-[#6B9071]/45 bg-[#375534] h-[380px] sm:h-[440px]">
          {MAPS_API_KEY ? (
            <APIProvider apiKey={MAPS_API_KEY} libraries={['marker', 'routes']} language="en">
              <GoogleMap
                mapId="DEMO_MAP_ID"
                defaultCenter={parcel.currentPosition}
                defaultZoom={viewMode === 'corridor' ? 3 : 12}
                gestureHandling="greedy"
                mapTypeControl={false}
                streetViewControl={false}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                className="w-full h-full"
              >
                <RouteLayer
                  parcel={parcel}
                  viewMode={viewMode}
                  onRouteComputed={setRouteSummary}
                  onRouteError={setRouteError}
                  onLoadingChange={setRouteLoading}
                />
                <ParcelMarkers parcel={parcel} viewMode={viewMode} />
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <MapPin className="w-8 h-8 text-[#E3EED4]" />
              <div className="space-y-1 max-w-sm">
                <div className="text-sm font-semibold text-[#E3EED4]">
                  {parcel.currentLocationLabel}
                </div>
                <p className="text-xs text-[#AEC3B0]">
                  Coordinates: {parcel.currentPosition.lat.toFixed(4)},{' '}
                  {parcel.currentPosition.lng.toFixed(4)} → Destination:{' '}
                  {parcel.destinationAddress}
                </p>
              </div>
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E3EED4] text-[#0F2A1D] hover:bg-[#AEC3B0] transition-colors"
              >
                Open Route Directions in Google Maps
              </a>
            </div>
          )}
        </div>

        {/* Turn-by-Turn Delivery Directions & Position Details */}
        <div className="lg:col-span-5 rounded-xl bg-[#375534] border border-[#6B9071]/45 p-5 flex flex-col justify-between h-[380px] sm:h-[440px]">
          <div className="space-y-4 overflow-hidden flex flex-col h-full">
            <div className="flex items-start justify-between gap-3 border-b border-[#6B9071]/35 pb-3 shrink-0">
              <div className="space-y-1">
                <div className="text-xs font-medium text-[#AEC3B0]">
                  {isAirborne
                    ? 'Scheduled Arrival-Hub Final-Mile Route'
                    : 'Active Final-Mile Road Directions'}
                </div>
                <div className="text-xs text-[#E3EED4] font-medium">
                  {parcel.activeGroundOriginLabel} → {parcel.destinationAddress}
                </div>
              </div>
              {routeSummary && viewMode === 'directions' && (
                <div className="text-right shrink-0 font-mono tabular-nums">
                  <div className="text-sm font-bold text-[#E3EED4]">
                    {routeSummary.distanceText}
                  </div>
                  <div className="text-[11px] text-[#AEC3B0]">{routeSummary.durationText}</div>
                </div>
              )}
            </div>

            {viewMode === 'corridor' ? (
              <div className="space-y-3 text-xs overflow-y-auto pr-1">
                <div className="p-3.5 rounded-lg bg-[#0F2A1D] border border-[#6B9071]/40 space-y-1">
                  <div className="text-[#AEC3B0]">01 · Origin Departure Hub</div>
                  <div className="font-semibold text-[#E3EED4]">
                    {parcel.originFacility} ({parcel.originCode})
                  </div>
                  <div className="font-mono text-[11px] text-[#AEC3B0] tabular-nums">
                    {parcel.originPosition.lat.toFixed(4)}, {parcel.originPosition.lng.toFixed(4)}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#0F2A1D] border border-[#E3EED4]/65 space-y-1">
                  <div className="text-[#AEC3B0]">02 · Current Parcel Position</div>
                  <div className="font-semibold text-[#E3EED4]">{parcel.currentLocationLabel}</div>
                  <div className="text-[#AEC3B0]">{parcel.currentLocationDetails}</div>
                  <div className="font-mono text-[11px] text-[#E3EED4]/90 tabular-nums">
                    {parcel.currentPosition.lat.toFixed(4)}, {parcel.currentPosition.lng.toFixed(4)}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#0F2A1D] border border-[#6B9071]/40 space-y-1">
                  <div className="text-[#AEC3B0]">03 · Final Delivery Destination</div>
                  <div className="font-semibold text-[#E3EED4]">
                    {parcel.destinationAddress} ({parcel.destinationCode})
                  </div>
                  <div className="font-mono text-[11px] text-[#AEC3B0] tabular-nums">
                    {parcel.destinationPosition.lat.toFixed(4)},{' '}
                    {parcel.destinationPosition.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            ) : routeLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[#AEC3B0]">
                Calculating ground route &amp; turn-by-turn directions...
              </div>
            ) : routeError ? (
              <div className="space-y-3 text-xs">
                <p className="p-3.5 rounded-lg bg-[#0F2A1D] border border-[#6B9071]/45 text-[#E3EED4]">
                  {routeError}
                </p>
                <div className="p-3.5 rounded-lg bg-[#0F2A1D]/70 border border-[#6B9071]/35 space-y-1.5">
                  <div className="font-semibold text-[#E3EED4]">Route Endpoints</div>
                  <div className="text-[#AEC3B0]">From: {parcel.activeGroundOriginLabel}</div>
                  <div className="text-[#AEC3B0]">To: {parcel.destinationAddress}</div>
                </div>
              </div>
            ) : routeSummary && routeSummary.steps.length > 0 ? (
              <ol className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {routeSummary.steps.map((step, index) => (
                  <li
                    key={step.id}
                    className="p-3 rounded-lg bg-[#0F2A1D]/85 border border-[#6B9071]/35 flex items-start gap-3 text-xs"
                  >
                    <span className="font-mono font-semibold text-[#AEC3B0] shrink-0 tabular-nums mt-0.5">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-[#E3EED4] leading-snug">{step.instruction}</div>
                      {(step.distanceText || step.durationText) && (
                        <div className="font-mono text-[11px] text-[#AEC3B0] tabular-nums">
                          {[step.distanceText, step.durationText].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#AEC3B0]">
                Select Delivery Directions to view street-level steps.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
