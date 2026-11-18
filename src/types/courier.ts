export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export type ParcelStatus =
  | 'queued'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delayed'
  | 'delivered';

export type TaskPriority = 'standard' | 'express' | 'same_day';

export type CourierStatus = 'available' | 'en_route' | 'delivering' | 'paused';

export type AlertSeverity = 'info' | 'eta' | 'warning' | 'delivered';

export type PushEventType =
  | 'out_for_delivery'
  | 'arriving_soon'
  | 'delivered'
  | 'delayed'
  | 'info';

export interface PushSubscriptionPrefs {
  enabled: boolean;
  outForDelivery: boolean;
  arrivingSoon: boolean;
  delays: boolean;
  delivered: boolean;
  soundEnabled: boolean;
  watchedTrackingCode: string | null;
}

export interface ParcelMilestone {
  id: string;
  label: string;
  location: string;
  timestamp: string;
  completed: boolean;
  detail?: string;
}

export interface DispatchTask {
  id: string;
  parcelId: string;
  title: string;
  assignee: string;
  completed: boolean;
  dueTime: string;
  category: 'pickup' | 'routing' | 'handoff' | 'pod';
}

export interface Parcel {
  id: string;
  trackingCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  itemDescription: string;
  weightKg: number;
  priority: TaskPriority;
  status: ParcelStatus;
  originAddress: string;
  originCoords: LatLngLiteral;
  destinationAddress: string;
  destinationCoords: LatLngLiteral;
  courierId: string | null;
  etaSeconds: number;
  estimatedArrivalIso: string;
  distanceMeters: number;
  delayReason?: string;
  deliveryNotes?: string;
  signatureConfirmed?: boolean;
  createdAt: string;
  updatedAt: string;
  milestones: ParcelMilestone[];
  routePath: LatLngLiteral[];
}

export interface Courier {
  id: string;
  name: string;
  initials: string;
  vehicleType: 'Electric Van' | 'Cargo E-Bike' | 'Compact Courier';
  vehiclePlate: string;
  phone: string;
  status: CourierStatus;
  location: LatLngLiteral;
  heading: number;
  speedKmh: number;
  accuracyMeters?: number;
  gpsSource?: 'device_gps' | 'route_stream' | 'manual';
  completedDeliveries?: number;
  activeParcelId: string | null;
  routeProgress: number;
  liveStreamActive: boolean;
  lastPingIso: string;
}

export interface CourierNotification {
  id: string;
  parcelId: string;
  trackingCode: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  eventType?: PushEventType;
  recipientType: 'customer' | 'dispatcher' | 'all';
  createdAt: string;
  read: boolean;
}

export interface CourierSystemState {
  parcels: Parcel[];
  couriers: Courier[];
  tasks: DispatchTask[];
  notifications: CourierNotification[];
  serverTime: string;
}

export type SocketEventPayload =
  | { type: 'init'; payload: CourierSystemState }
  | { type: 'parcel:created'; payload: Parcel }
  | { type: 'parcel:updated'; payload: Parcel }
  | { type: 'parcel:deleted'; payload: { id: string } }
  | { type: 'courier:created'; payload: Courier }
  | { type: 'courier:moved'; payload: Courier }
  | { type: 'courier:deleted'; payload: { id: string } }
  | { type: 'task:created'; payload: DispatchTask }
  | { type: 'task:updated'; payload: DispatchTask }
  | { type: 'notification:created'; payload: CourierNotification }
  | { type: 'notification:read'; payload: { id: string } }
  | { type: 'notifications:read_all'; payload: Record<string, never> };
