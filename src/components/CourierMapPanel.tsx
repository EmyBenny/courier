import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  AdvancedMarkerProps,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Navigation, Package, Truck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Courier, LatLngLiteral, Parcel } from '../types/courier';

type AdvancedMarkerInstance = google.maps.marker.AdvancedMarkerElement;

interface AdvancedMarkerWithRefProps extends AdvancedMarkerProps {
  onMarkerClick: (marker: AdvancedMarkerInstance) => void;
}

const AdvancedMarkerWithRef: React.FC<AdvancedMarkerWithRefProps> = ({
  children,
  onMarkerClick,
  ...advancedMarkerProps
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      onClick={() => {
        if (marker) {
          onMarkerClick(marker);
        }
      }}
      {...advancedMarkerProps}
    >
      {children}
    </AdvancedMarker>
  );
};

interface RouteOverlayProps {
  parcel: Parcel;
  onRouteComputed?: (
    parcelId: string,
    data: {
      distanceMeters: number;
      durationSeconds: number;
      routePath: LatLngLiteral[];
    }
  ) => void;
}

const ActiveRouteOverlay: React.FC<RouteOverlayProps> = ({
  parcel,
  onRouteComputed,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const lastComputedKeyRef = useRef<string>('');
  const fittedParcelIdRef = useRef<string>('');
  const onRouteComputedRef = useRef(onRouteComputed);
  onRouteComputedRef.current = onRouteComputed;

  useEffect(() => {
    if (!map) return;

    const cleanupPolylines = () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };

    const drawFallbackPath = () => {
      cleanupPolylines();
      if (parcel.routePath.length < 2) return;
      const fallbackPolyline = new google.maps.Polyline({
        path: parcel.routePath,
        geodesic: true,
        strokeColor: parcel.status === 'delayed' ? '#B91C1C' : '#6F4E37',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });
      polylinesRef.current = [fallbackPolyline];

      if (fittedParcelIdRef.current !== parcel.id) {
        const bounds = new google.maps.LatLngBounds();
        parcel.routePath.forEach((pt) => bounds.extend(pt));
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
        fittedParcelIdRef.current = parcel.id;
      }
    };

    const routeKey = `${parcel.id}:${parcel.originCoords.lat.toFixed(
      4
    )},${parcel.originCoords.lng.toFixed(4)}->${parcel.destinationCoords.lat.toFixed(
      4
    )},${parcel.destinationCoords.lng.toFixed(4)}`;

    if (!routesLib || lastComputedKeyRef.current === routeKey) {
      drawFallbackPath();
      return cleanupPolylines;
    }

    let cancelled = false;

    const request = {
      origin: parcel.originCoords,
      destination: parcel.destinationCoords,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    const RouteClass = routesLib.Route as unknown as {
      computeRoutes: (req: unknown) => Promise<{ routes: any[] }>;
    };

    RouteClass.computeRoutes(request)
      .then(({ routes }) => {
        if (cancelled) return;
        if (!routes || routes.length === 0) {
          drawFallbackPath();
          return;
        }

        const primaryRoute = routes[0];
        cleanupPolylines();

        const createdPolylines: google.maps.Polyline[] =
          typeof primaryRoute.createPolylines === 'function'
            ? primaryRoute.createPolylines()
            : [];

        const strokeColor =
          parcel.status === 'delayed'
            ? '#B91C1C'
            : parcel.status === 'delivered'
              ? '#15803D'
              : '#6F4E37';

        const extractedPoints: LatLngLiteral[] = [];

        if (createdPolylines.length > 0) {
          createdPolylines.forEach((polyline) => {
            polyline.setOptions({
              strokeColor,
              strokeOpacity: 0.92,
              strokeWeight: 5,
            });
            polyline.setMap(map);
            const pathArr = polyline.getPath().getArray();
            pathArr.forEach((ll) =>
              extractedPoints.push({ lat: ll.lat(), lng: ll.lng() })
            );
          });
          polylinesRef.current = createdPolylines;
        } else {
          drawFallbackPath();
        }

        if (primaryRoute.viewport && fittedParcelIdRef.current !== parcel.id) {
          map.fitBounds(primaryRoute.viewport, {
            top: 48,
            right: 48,
            bottom: 48,
            left: 48,
          });
          fittedParcelIdRef.current = parcel.id;
        }

        lastComputedKeyRef.current = routeKey;

        const distanceMeters = Number(primaryRoute.distanceMeters ?? 0);
        const durationSeconds = Math.round(
          Number(primaryRoute.durationMillis ?? 0) / 1000
        );

        if (
          extractedPoints.length >= 2 &&
          distanceMeters > 0 &&
          durationSeconds > 0 &&
          onRouteComputedRef.current
        ) {
          onRouteComputedRef.current(parcel.id, {
            distanceMeters,
            durationSeconds,
            routePath: extractedPoints,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        drawFallbackPath();
      });

    return () => {
      cancelled = true;
      cleanupPolylines();
    };
  }, [
    map,
    routesLib,
    parcel.id,
    parcel.status,
    parcel.originCoords.lat,
    parcel.originCoords.lng,
    parcel.destinationCoords.lat,
    parcel.destinationCoords.lng,
  ]);

  return null;
};

interface CourierMapPanelProps {
  parcels: Parcel[];
  couriers: Courier[];
  selectedParcelId: string | null;
  onSelectParcel: (parcelId: string) => void;
  onRouteComputed?: (
    parcelId: string,
    data: {
      distanceMeters: number;
      durationSeconds: number;
      routePath: LatLngLiteral[];
    }
  ) => void;
  className?: string;
}

function formatEta(seconds: number, status: Parcel['status']): string {
  if (status === 'delivered') return 'Delivered';
  if (seconds <= 60) return '< 1 min';
  const mins = Math.ceil(seconds / 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  }
  return `${mins} min`;
}

export const CourierMapPanel: React.FC<CourierMapPanelProps> = ({
  parcels,
  couriers,
  selectedParcelId,
  onSelectParcel,
  onRouteComputed,
  className = '',
}) => {
  const apiStatus = useApiLoadingStatus();
  const selectedParcel =
    parcels.find((p) => p.id === selectedParcelId) ?? parcels[0] ?? null;

  const [infoTarget, setInfoTarget] = useState<{
    type: 'parcel' | 'courier';
    id: string;
    anchor: AdvancedMarkerInstance;
  } | null>(null);

  const handleMarkerClick = useCallback(
    (
      type: 'parcel' | 'courier',
      id: string,
      marker: AdvancedMarkerInstance,
      linkedParcelId?: string | null
    ) => {
      setInfoTarget({ type, id, anchor: marker });
      if (type === 'parcel') {
        onSelectParcel(id);
      } else if (linkedParcelId) {
        onSelectParcel(linkedParcelId);
      }
    },
    [onSelectParcel]
  );

  const infoParcel =
    infoTarget?.type === 'parcel'
      ? parcels.find((p) => p.id === infoTarget.id)
      : null;
  const infoCourier =
    infoTarget?.type === 'courier'
      ? couriers.find((c) => c.id === infoTarget.id)
      : null;

  const isMapError =
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE;

  return (
    <div
      className={`relative w-full h-full min-h-[380px] rounded-xl overflow-hidden border border-[#D4B996] bg-[#EDE3D4] ${className}`}
    >
      {isMapError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#EDE3D4] text-[#3B2A1F]">
          <AlertTriangle className="w-8 h-8 text-[#6F4E37] mb-3" />
          <h3 className="text-base font-semibold">
            Google Maps Unavailable
          </h3>
          <p className="text-sm text-[#6F4E37] max-w-md mt-1">
            Unable to load map tiles or authenticate with Google Maps Platform.
            Real-time parcel task tracking and WebSocket alerts remain active.
          </p>
        </div>
      ) : (
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: 37.7785, lng: -122.4185 }}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          mapTypeControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {selectedParcel && (
            <ActiveRouteOverlay
              parcel={selectedParcel}
              onRouteComputed={onRouteComputed}
            />
          )}

          {/* Origin Hub Pin for Selected Parcel */}
          {selectedParcel && (
            <AdvancedMarker
              position={selectedParcel.originCoords}
              title={`Pickup: ${selectedParcel.originAddress}`}
              zIndex={10}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#EDE3D4] border-2 border-[#3B2A1F] text-[#3B2A1F] shadow-sm">
                <Package className="w-3.5 h-3.5" />
              </div>
            </AdvancedMarker>
          )}

          {/* Destination Parcel Pins */}
          {parcels.map((parcel) => {
            const isSelected = selectedParcel?.id === parcel.id;
            const pinBg =
              parcel.status === 'delivered'
                ? '#15803D'
                : parcel.status === 'delayed'
                  ? '#B91C1C'
                  : isSelected
                    ? '#3B2A1F'
                    : '#B08968';
            return (
              <AdvancedMarkerWithRef
                key={parcel.id}
                position={parcel.destinationCoords}
                zIndex={isSelected ? 950 : 50}
                title={`${parcel.trackingCode} — ${parcel.customerName}`}
                onMarkerClick={(marker) =>
                  handleMarkerClick('parcel', parcel.id, marker)
                }
              >
                <Pin
                  background={pinBg}
                  borderColor="#FFF9F0"
                  glyphColor="#FFF9F0"
                  scale={isSelected ? 1.15 : 0.92}
                />
              </AdvancedMarkerWithRef>
            );
          })}

          {/* Live Courier Vehicle Markers */}
          {couriers.map((courier) => {
            const isSelectedCourier =
              selectedParcel?.courierId === courier.id;
            return (
              <AdvancedMarkerWithRef
                key={courier.id}
                position={courier.location}
                zIndex={isSelectedCourier ? 1000 : 200}
                title={`${courier.name} (${courier.vehicleType})`}
                onMarkerClick={(marker) =>
                  handleMarkerClick(
                    'courier',
                    courier.id,
                    marker,
                    courier.activeParcelId
                  )
                }
              >
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shadow-md transition-transform ${
                    isSelectedCourier
                      ? 'bg-[#3B2A1F] text-[#FFF9F0] border-[#D4B996] scale-105'
                      : 'bg-[#FFF9F0] text-[#3B2A1F] border-[#6F4E37]'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono text-[11px] font-semibold whitespace-nowrap">
                    {courier.initials}
                  </span>
                  <Navigation
                    className="w-3 h-3 shrink-0 opacity-80"
                    style={{ transform: `rotate(${courier.heading}deg)` }}
                  />
                </div>
              </AdvancedMarkerWithRef>
            );
          })}

          {/* Anchored InfoWindow */}
          {infoTarget && (infoParcel || infoCourier) && (
            <InfoWindow
              anchor={infoTarget.anchor}
              pixelOffset={[0, -6]}
              onCloseClick={() => setInfoTarget(null)}
            >
              {infoParcel ? (
                <div className="p-1 min-w-[210px] text-[#3B2A1F]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-semibold text-[#6F4E37]">
                      {infoParcel.trackingCode}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      {formatEta(infoParcel.etaSeconds, infoParcel.status)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mt-1">
                    {infoParcel.customerName}
                  </p>
                  <p className="text-xs text-[#6F4E37] mt-0.5">
                    {infoParcel.destinationAddress}
                  </p>
                  <div className="mt-2 pt-2 border-t border-[#EDE3D4] flex items-center justify-between text-xs text-[#6F4E37] tabular-nums">
                    <span className="capitalize">
                      {infoParcel.status.replace(/_/g, ' ')}
                    </span>
                    <span>{(infoParcel.distanceMeters / 1000).toFixed(1)} km</span>
                  </div>
                </div>
              ) : infoCourier ? (
                <div className="p-1 min-w-[200px] text-[#3B2A1F]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {infoCourier.name}
                    </span>
                    <span className="font-mono text-[11px] text-[#6F4E37]">
                      {infoCourier.vehiclePlate}
                    </span>
                  </div>
                  <p className="text-xs text-[#6F4E37] mt-0.5">
                    {infoCourier.vehicleType} · {infoCourier.speedKmh} km/h
                  </p>
                  <div className="mt-2 pt-2 border-t border-[#EDE3D4] flex items-center justify-between text-xs">
                    <span className="capitalize text-[#3B2A1F]">
                      {infoCourier.status.replace(/_/g, ' ')}
                    </span>
                    {infoCourier.liveStreamActive && (
                      <span className="flex items-center gap-1 text-[#15803D] font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Live GPS
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </InfoWindow>
          )}
        </GoogleMap>
      )}

      {/* Selected Route Summary Overlay */}
      {selectedParcel && !isMapError && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm bg-[#FFF9F0]/95 backdrop-blur-sm border border-[#D4B996] rounded-lg px-3.5 py-2.5 shadow-sm pointer-events-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#6F4E37]">
                <span className="font-mono font-semibold text-[#3B2A1F]">
                  {selectedParcel.trackingCode}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{selectedParcel.customerName}</span>
              </div>
              <p className="text-xs text-[#6F4E37] truncate mt-0.5">
                {selectedParcel.destinationAddress}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-sm font-semibold text-[#3B2A1F] tabular-nums">
                {formatEta(selectedParcel.etaSeconds, selectedParcel.status)}
              </div>
              <div className="font-mono text-[11px] text-[#6F4E37] tabular-nums">
                {(selectedParcel.distanceMeters / 1000).toFixed(1)} km left
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
