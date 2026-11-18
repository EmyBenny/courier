import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import type {
  AlertSeverity,
  Courier,
  CourierNotification,
  CourierSystemState,
  DispatchTask,
  LatLngLiteral,
  Parcel,
  ParcelStatus,
  PushEventType,
  SocketEventPayload,
} from './src/types/courier.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'courier-state.json');

function haversineMeters(a: LatLngLiteral, b: LatLngLiteral): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function computeBearing(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function interpolatePath(
  routePath: LatLngLiteral[],
  progress: number
): { point: LatLngLiteral; heading: number; remainingMeters: number } {
  if (routePath.length === 0) {
    return {
      point: { lat: 37.7749, lng: -122.4194 },
      heading: 0,
      remainingMeters: 0,
    };
  }
  if (routePath.length === 1) {
    return { point: routePath[0], heading: 0, remainingMeters: 0 };
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const segLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < routePath.length - 1; i++) {
    const len = haversineMeters(routePath[i], routePath[i + 1]);
    segLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) {
    return { point: routePath[0], heading: 0, remainingMeters: 0 };
  }

  const targetDist = clamped * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accumulated + segLen >= targetDist || i === segLengths.length - 1) {
      const segProgress =
        segLen > 0 ? Math.min(1, Math.max(0, (targetDist - accumulated) / segLen)) : 0;
      const start = routePath[i];
      const end = routePath[i + 1];
      const point = {
        lat: start.lat + (end.lat - start.lat) * segProgress,
        lng: start.lng + (end.lng - start.lng) * segProgress,
      };
      return {
        point,
        heading: computeBearing(start, end),
        remainingMeters: Math.max(0, Math.round(totalLength - targetDist)),
      };
    }
    accumulated += segLen;
  }

  return {
    point: routePath[routePath.length - 1],
    heading: 0,
    remainingMeters: 0,
  };
}

function buildInitialState(): CourierSystemState {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

  const couriers: Courier[] = [
    {
      id: 'c-1',
      name: 'Elena Rostova',
      initials: 'ER',
      vehicleType: 'Electric Van',
      vehiclePlate: 'EV-4920',
      phone: '+1 (415) 890-3312',
      status: 'delivering',
      location: { lat: 37.7798, lng: -122.4112 },
      heading: 245,
      speedKmh: 34,
      accuracyMeters: 6,
      gpsSource: 'route_stream',
      completedDeliveries: 14,
      activeParcelId: 'p-1',
      routeProgress: 0.42,
      liveStreamActive: false,
      lastPingIso: iso(-12000),
    },
    {
      id: 'c-2',
      name: 'Marcus Vance',
      initials: 'MV',
      vehicleType: 'Cargo E-Bike',
      vehiclePlate: 'BK-1184',
      phone: '+1 (415) 742-9018',
      status: 'en_route',
      location: { lat: 37.7642, lng: -122.4235 },
      heading: 18,
      speedKmh: 24,
      accuracyMeters: 8,
      gpsSource: 'route_stream',
      completedDeliveries: 11,
      activeParcelId: 'p-2',
      routeProgress: 0.25,
      liveStreamActive: false,
      lastPingIso: iso(-28000),
    },
    {
      id: 'c-3',
      name: 'Sora Takahashi',
      initials: 'ST',
      vehicleType: 'Compact Courier',
      vehiclePlate: 'CC-7741',
      phone: '+1 (415) 619-4405',
      status: 'paused',
      location: { lat: 37.7915, lng: -122.4352 },
      heading: 112,
      speedKmh: 0,
      accuracyMeters: 10,
      gpsSource: 'route_stream',
      completedDeliveries: 9,
      activeParcelId: 'p-3',
      routeProgress: 0.55,
      liveStreamActive: false,
      lastPingIso: iso(-95000),
    },
    {
      id: 'c-4',
      name: 'David Okafor',
      initials: 'DO',
      vehicleType: 'Electric Van',
      vehiclePlate: 'EV-8832',
      phone: '+1 (415) 503-2177',
      status: 'available',
      location: { lat: 37.7725, lng: -122.4041 },
      heading: 90,
      speedKmh: 0,
      accuracyMeters: 5,
      gpsSource: 'manual',
      completedDeliveries: 16,
      activeParcelId: null,
      routeProgress: 0,
      liveStreamActive: false,
      lastPingIso: iso(-5000),
    },
  ];

  const parcels: Parcel[] = [
    {
      id: 'p-1',
      trackingCode: 'CMB-4081',
      customerName: 'Clara Hendriks',
      customerPhone: '+1 (415) 392-8810',
      customerEmail: 'clara.hendriks@ateliernorth.com',
      itemDescription: 'Precision Espresso Calibration Kit',
      weightKg: 4.2,
      priority: 'express',
      status: 'out_for_delivery',
      originAddress: '650 Townsend St, San Francisco, CA',
      originCoords: { lat: 37.7712, lng: -122.4024 },
      destinationAddress: '2140 Fillmore St, San Francisco, CA',
      destinationCoords: { lat: 37.7894, lng: -122.4339 },
      courierId: 'c-1',
      etaSeconds: 540,
      estimatedArrivalIso: iso(540 * 1000),
      distanceMeters: 3180,
      deliveryNotes: 'Call on arrival at glass courtyard gate; signature required.',
      createdAt: iso(-5400 * 1000),
      updatedAt: iso(-12000),
      routePath: [
        { lat: 37.7712, lng: -122.4024 },
        { lat: 37.7755, lng: -122.4068 },
        { lat: 37.7798, lng: -122.4112 },
        { lat: 37.7841, lng: -122.4215 },
        { lat: 37.7872, lng: -122.4288 },
        { lat: 37.7894, lng: -122.4339 },
      ],
      milestones: [
        {
          id: 'm-101',
          label: 'Order Confirmed',
          location: 'SoMa Fulfillment Hub',
          timestamp: iso(-5400 * 1000),
          completed: true,
          detail: 'Label printed and parcel weighed (4.2 kg)',
        },
        {
          id: 'm-102',
          label: 'Courier Picked Up',
          location: '650 Townsend St',
          timestamp: iso(-2700 * 1000),
          completed: true,
          detail: 'Assigned to Elena Rostova (Electric Van EV-4920)',
        },
        {
          id: 'm-103',
          label: 'In Transit',
          location: 'Civic Center Corridor',
          timestamp: iso(-1200 * 1000),
          completed: true,
          detail: 'Cleared Market St junction ahead of schedule',
        },
        {
          id: 'm-104',
          label: 'Out for Delivery',
          location: 'Pacific Heights Approach',
          timestamp: iso(-240 * 1000),
          completed: true,
          detail: 'Final approach along Fillmore corridor',
        },
        {
          id: 'm-105',
          label: 'Delivered',
          location: '2140 Fillmore St',
          timestamp: '',
          completed: false,
        },
      ],
    },
    {
      id: 'p-2',
      trackingCode: 'CMB-4082',
      customerName: 'Julian Mercer',
      customerPhone: '+1 (415) 621-4490',
      customerEmail: 'j.mercer@studioforma.io',
      itemDescription: 'Architectural Lighting Fixtures (Box 1/2)',
      weightKg: 6.8,
      priority: 'same_day',
      status: 'in_transit',
      originAddress: '2500 Mission St, San Francisco, CA',
      originCoords: { lat: 37.7571, lng: -122.4189 },
      destinationAddress: '1 Ferry Building, San Francisco, CA',
      destinationCoords: { lat: 37.7955, lng: -122.3937 },
      courierId: 'c-2',
      etaSeconds: 960,
      estimatedArrivalIso: iso(960 * 1000),
      distanceMeters: 4820,
      deliveryNotes: 'Deliver to Loading Dock B near Embarcadero entrance.',
      createdAt: iso(-7200 * 1000),
      updatedAt: iso(-28000),
      routePath: [
        { lat: 37.7571, lng: -122.4189 },
        { lat: 37.7642, lng: -122.4235 },
        { lat: 37.7745, lng: -122.4148 },
        { lat: 37.7852, lng: -122.4038 },
        { lat: 37.7955, lng: -122.3937 },
      ],
      milestones: [
        {
          id: 'm-201',
          label: 'Order Confirmed',
          location: 'Mission Dispatch Dock',
          timestamp: iso(-7200 * 1000),
          completed: true,
        },
        {
          id: 'm-202',
          label: 'Courier Picked Up',
          location: '2500 Mission St',
          timestamp: iso(-3000 * 1000),
          completed: true,
          detail: 'Picked up by Marcus Vance (Cargo E-Bike BK-1184)',
        },
        {
          id: 'm-203',
          label: 'In Transit',
          location: 'Valencia St Bike Corridor',
          timestamp: iso(-900 * 1000),
          completed: true,
        },
        {
          id: 'm-204',
          label: 'Out for Delivery',
          location: 'Embarcadero Waterfront',
          timestamp: '',
          completed: false,
        },
        {
          id: 'm-205',
          label: 'Delivered',
          location: '1 Ferry Building',
          timestamp: '',
          completed: false,
        },
      ],
    },
    {
      id: 'p-3',
      trackingCode: 'CMB-4083',
      customerName: 'Nadia Al-Mansoor',
      customerPhone: '+1 (415) 904-1129',
      customerEmail: 'nadia@verveclinical.org',
      itemDescription: 'Temperature-Monitored Diagnostic Samples',
      weightKg: 1.9,
      priority: 'express',
      status: 'delayed',
      originAddress: '505 Parnassus Ave, San Francisco, CA',
      originCoords: { lat: 37.7631, lng: -122.4586 },
      destinationAddress: '1100 Van Ness Ave, San Francisco, CA',
      destinationCoords: { lat: 37.7859, lng: -122.4212 },
      courierId: 'c-3',
      etaSeconds: 1380,
      estimatedArrivalIso: iso(1380 * 1000),
      distanceMeters: 3890,
      delayReason: 'Road closure near Lombard & Presidio intersection (+12 min detour)',
      deliveryNotes: 'Hand directly to Lab Reception on 3rd Floor.',
      createdAt: iso(-9000 * 1000),
      updatedAt: iso(-95000),
      routePath: [
        { lat: 37.7631, lng: -122.4586 },
        { lat: 37.7752, lng: -122.4488 },
        { lat: 37.7915, lng: -122.4352 },
        { lat: 37.7885, lng: -122.4272 },
        { lat: 37.7859, lng: -122.4212 },
      ],
      milestones: [
        {
          id: 'm-301',
          label: 'Order Confirmed',
          location: 'Parnassus Medical Hub',
          timestamp: iso(-9000 * 1000),
          completed: true,
        },
        {
          id: 'm-302',
          label: 'Courier Picked Up',
          location: '505 Parnassus Ave',
          timestamp: iso(-4200 * 1000),
          completed: true,
          detail: 'Picked up by Sora Takahashi (Compact Courier CC-7741)',
        },
        {
          id: 'm-303',
          label: 'In Transit',
          location: 'Presidio Detour',
          timestamp: iso(-1500 * 1000),
          completed: true,
          detail: 'Traffic reroute logged; customer notified of +12m adjustment',
        },
        {
          id: 'm-304',
          label: 'Out for Delivery',
          location: 'Van Ness Medical Wing',
          timestamp: '',
          completed: false,
        },
        {
          id: 'm-305',
          label: 'Delivered',
          location: '1100 Van Ness Ave',
          timestamp: '',
          completed: false,
        },
      ],
    },
    {
      id: 'p-4',
      trackingCode: 'CMB-4084',
      customerName: 'Hector Alvarez',
      customerPhone: '+1 (415) 441-7203',
      customerEmail: 'halvarez@oaklandroasters.co',
      itemDescription: 'Single-Origin Reserve Bags (12 kg)',
      weightKg: 12.0,
      priority: 'standard',
      status: 'queued',
      originAddress: '650 Townsend St, San Francisco, CA',
      originCoords: { lat: 37.7712, lng: -122.4024 },
      destinationAddress: '3300 24th St, San Francisco, CA',
      destinationCoords: { lat: 37.7524, lng: -122.4184 },
      courierId: 'c-4',
      etaSeconds: 1800,
      estimatedArrivalIso: iso(1800 * 1000),
      distanceMeters: 2950,
      deliveryNotes: 'Front counter drop-off before 17:00.',
      createdAt: iso(-1800 * 1000),
      updatedAt: iso(-1800 * 1000),
      routePath: [
        { lat: 37.7712, lng: -122.4024 },
        { lat: 37.7645, lng: -122.4095 },
        { lat: 37.7582, lng: -122.4148 },
        { lat: 37.7524, lng: -122.4184 },
      ],
      milestones: [
        {
          id: 'm-401',
          label: 'Order Confirmed',
          location: 'SoMa Fulfillment Hub',
          timestamp: iso(-1800 * 1000),
          completed: true,
        },
        {
          id: 'm-402',
          label: 'Courier Picked Up',
          location: '650 Townsend St',
          timestamp: '',
          completed: false,
        },
        {
          id: 'm-403',
          label: 'In Transit',
          location: 'Potrero / Mission Corridor',
          timestamp: '',
          completed: false,
        },
        {
          id: 'm-404',
          label: 'Out for Delivery',
          location: '24th St Commercial Row',
          timestamp: '',
          completed: false,
        },
        {
          id: 'm-405',
          label: 'Delivered',
          location: '3300 24th St',
          timestamp: '',
          completed: false,
        },
      ],
    },
    {
      id: 'p-5',
      trackingCode: 'CMB-4079',
      customerName: 'Evelyn Cho',
      customerPhone: '+1 (415) 318-5561',
      customerEmail: 'evelyn@marinaoptics.com',
      itemDescription: 'Custom Optical Lenses Case',
      weightKg: 1.4,
      priority: 'express',
      status: 'delivered',
      originAddress: '650 Townsend St, San Francisco, CA',
      originCoords: { lat: 37.7712, lng: -122.4024 },
      destinationAddress: '2055 Chestnut St, San Francisco, CA',
      destinationCoords: { lat: 37.8006, lng: -122.4372 },
      courierId: 'c-1',
      etaSeconds: 0,
      estimatedArrivalIso: iso(-3600 * 1000),
      distanceMeters: 5400,
      deliveryNotes: 'Signed at optical desk by E. Cho.',
      signatureConfirmed: true,
      createdAt: iso(-14400 * 1000),
      updatedAt: iso(-3600 * 1000),
      routePath: [
        { lat: 37.7712, lng: -122.4024 },
        { lat: 37.7881, lng: -122.4211 },
        { lat: 37.8006, lng: -122.4372 },
      ],
      milestones: [
        {
          id: 'm-501',
          label: 'Order Confirmed',
          location: 'SoMa Fulfillment Hub',
          timestamp: iso(-14400 * 1000),
          completed: true,
        },
        {
          id: 'm-502',
          label: 'Courier Picked Up',
          location: '650 Townsend St',
          timestamp: iso(-10800 * 1000),
          completed: true,
        },
        {
          id: 'm-503',
          label: 'In Transit',
          location: 'Van Ness Northbound',
          timestamp: iso(-7200 * 1000),
          completed: true,
        },
        {
          id: 'm-504',
          label: 'Out for Delivery',
          location: 'Marina District',
          timestamp: iso(-4500 * 1000),
          completed: true,
        },
        {
          id: 'm-505',
          label: 'Delivered',
          location: '2055 Chestnut St',
          timestamp: iso(-3600 * 1000),
          completed: true,
          detail: 'Proof of delivery signed by Evelyn Cho',
        },
      ],
    },
  ];

  const tasks: DispatchTask[] = [
    {
      id: 't-1',
      parcelId: 'p-1',
      title: 'Confirm courtyard gate code with Clara Hendriks prior to arrival',
      assignee: 'Elena Rostova',
      completed: true,
      dueTime: '15:10',
      category: 'handoff',
    },
    {
      id: 't-2',
      parcelId: 'p-1',
      title: 'Collect recipient signature at 2140 Fillmore St',
      assignee: 'Elena Rostova',
      completed: false,
      dueTime: '15:25',
      category: 'pod',
    },
    {
      id: 't-3',
      parcelId: 'p-3',
      title: 'Approve alternate Van Ness detour and push revised ETA alert',
      assignee: 'Dispatch Desk',
      completed: true,
      dueTime: '14:55',
      category: 'routing',
    },
    {
      id: 't-4',
      parcelId: 'p-4',
      title: 'Verify 12 kg roast batch manifest and release dock bay #2',
      assignee: 'David Okafor',
      completed: false,
      dueTime: '15:40',
      category: 'pickup',
    },
    {
      id: 't-5',
      parcelId: 'p-2',
      title: 'Coordinate Ferry Building Loading Dock B clearance',
      assignee: 'Marcus Vance',
      completed: false,
      dueTime: '15:35',
      category: 'handoff',
    },
  ];

  const notifications: CourierNotification[] = [
    {
      id: 'n-1',
      parcelId: 'p-1',
      trackingCode: 'CMB-4081',
      title: 'Out for Delivery',
      message: 'Elena Rostova is approaching 2140 Fillmore St. ETA updated to 9 mins.',
      severity: 'eta',
      eventType: 'out_for_delivery',
      recipientType: 'all',
      createdAt: iso(-240 * 1000),
      read: false,
    },
    {
      id: 'n-2',
      parcelId: 'p-3',
      trackingCode: 'CMB-4083',
      title: 'Traffic Reroute Delay (+12 min)',
      message:
        'Presidio intersection closure detected. Courier Sora Takahashi rerouted; new ETA 23 mins.',
      severity: 'warning',
      eventType: 'delayed',
      recipientType: 'all',
      createdAt: iso(-95000),
      read: false,
    },
    {
      id: 'n-3',
      parcelId: 'p-5',
      trackingCode: 'CMB-4079',
      title: 'Parcel Delivered & Signed',
      message: 'CMB-4079 delivered to 2055 Chestnut St. Signature captured by E. Cho.',
      severity: 'delivered',
      eventType: 'delivered',
      recipientType: 'customer',
      createdAt: iso(-3600 * 1000),
      read: true,
    },
  ];

  return {
    parcels,
    couriers,
    tasks,
    notifications,
    serverTime: new Date().toISOString(),
  };
}

function loadState(): CourierSystemState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as CourierSystemState;
      if (parsed && Array.isArray(parsed.parcels) && Array.isArray(parsed.couriers)) {
        return {
          ...parsed,
          couriers: parsed.couriers.map((c) => ({ ...c, liveStreamActive: false })),
          serverTime: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.error('Failed to read saved courier state, initializing fresh seed:', err);
  }
  return buildInitialState();
}

let state: CourierSystemState = loadState();
let persistTimer: NodeJS.Timeout | null = null;

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist courier state:', err);
    }
  }, 300);
}

const clients = new Set<WebSocket>();

function broadcast(event: SocketEventPayload) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function createNotification(params: {
  parcelId: string;
  trackingCode: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  eventType?: PushEventType;
  recipientType?: 'customer' | 'dispatcher' | 'all';
}): CourierNotification {
  const notification: CourierNotification = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    parcelId: params.parcelId,
    trackingCode: params.trackingCode,
    title: params.title,
    message: params.message,
    severity: params.severity,
    eventType: params.eventType ?? 'info',
    recipientType: params.recipientType ?? 'all',
    createdAt: new Date().toISOString(),
    read: false,
  };
  state.notifications = [notification, ...state.notifications].slice(0, 60);
  broadcast({ type: 'notification:created', payload: notification });
  return notification;
}

function syncParcelMilestones(parcel: Parcel, status: ParcelStatus, detail?: string) {
  const nowIso = new Date().toISOString();
  const stageOrder: Record<ParcelStatus, number> = {
    queued: 0,
    picked_up: 1,
    in_transit: 2,
    delayed: 2,
    out_for_delivery: 3,
    delivered: 4,
  };
  const reachedIndex = stageOrder[status];
  parcel.milestones = parcel.milestones.map((m, idx) => {
    if (idx <= reachedIndex) {
      return {
        ...m,
        completed: true,
        timestamp: m.timestamp || nowIso,
        detail: idx === reachedIndex && detail ? detail : m.detail,
      };
    }
    return { ...m, completed: false, timestamp: '' };
  });
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

const proximityAlertSent = new Set<string>();

function completeParcelDelivery(parcel: Parcel, courier: Courier) {
  parcel.status = 'delivered';
  parcel.etaSeconds = 0;
  parcel.distanceMeters = 0;
  parcel.signatureConfirmed = true;
  syncParcelMilestones(
    parcel,
    'delivered',
    `Delivered by ${courier.name} (${courier.vehiclePlate})`
  );
  courier.liveStreamActive = false;
  courier.speedKmh = 0;
  courier.status = 'available';
  courier.completedDeliveries = (courier.completedDeliveries ?? 0) + 1;
  createNotification({
    parcelId: parcel.id,
    trackingCode: parcel.trackingCode,
    title: 'Delivered',
    message: `${parcel.trackingCode} for ${parcel.customerName} has been delivered to ${parcel.destinationAddress}.`,
    severity: 'delivered',
    eventType: 'delivered',
    recipientType: 'all',
  });
}

// Server-authoritative live transit engine for couriers with active route stream
setInterval(() => {
  const nowMs = Date.now();
  let mutated = false;

  for (const courier of state.couriers) {
    if (!courier.liveStreamActive || !courier.activeParcelId) continue;

    const parcel = state.parcels.find((p) => p.id === courier.activeParcelId);
    if (!parcel || parcel.status === 'delivered') {
      courier.liveStreamActive = false;
      courier.speedKmh = 0;
      courier.status = 'available';
      broadcast({ type: 'courier:moved', payload: { ...courier } });
      mutated = true;
      continue;
    }

    const nextProgress = Math.min(1, courier.routeProgress + 0.045);
    const { point, heading, remainingMeters } = interpolatePath(
      parcel.routePath,
      nextProgress
    );

    const speedMetersPerSec = courier.vehicleType === 'Cargo E-Bike' ? 6.8 : 9.6;
    const etaSeconds =
      nextProgress >= 1 ? 0 : Math.max(15, Math.round(remainingMeters / speedMetersPerSec));

    courier.routeProgress = Number(nextProgress.toFixed(4));
    courier.location = point;
    courier.heading = Math.round(heading);
    courier.speedKmh = Math.round(speedMetersPerSec * 3.6);
    courier.gpsSource = 'route_stream';
    courier.lastPingIso = new Date(nowMs).toISOString();
    courier.status = nextProgress >= 0.65 ? 'delivering' : 'en_route';

    parcel.distanceMeters = remainingMeters;
    parcel.etaSeconds = etaSeconds;
    parcel.estimatedArrivalIso = new Date(nowMs + etaSeconds * 1000).toISOString();
    parcel.updatedAt = new Date(nowMs).toISOString();

    if (nextProgress >= 1) {
      completeParcelDelivery(parcel, courier);
    } else if (nextProgress >= 0.65 && parcel.status !== 'out_for_delivery') {
      parcel.status = 'out_for_delivery';
      parcel.delayReason = undefined;
      syncParcelMilestones(
        parcel,
        'out_for_delivery',
        `${courier.name} is on final street approach`
      );
      createNotification({
        parcelId: parcel.id,
        trackingCode: parcel.trackingCode,
        title: 'Out for Delivery',
        message: `${parcel.trackingCode} is now out for delivery. Estimated arrival in ${Math.max(
          1,
          Math.ceil(etaSeconds / 60)
        )} min.`,
        severity: 'eta',
        eventType: 'out_for_delivery',
      });
    } else if (parcel.status === 'queued' || parcel.status === 'picked_up') {
      parcel.status = 'in_transit';
      syncParcelMilestones(parcel, 'in_transit', 'Live GPS telemetry active');
    }

    if (etaSeconds > 0 && etaSeconds <= 240 && !proximityAlertSent.has(parcel.id)) {
      proximityAlertSent.add(parcel.id);
      createNotification({
        parcelId: parcel.id,
        trackingCode: parcel.trackingCode,
        title: 'Arriving Soon',
        message: `${courier.name} is less than 4 minutes from ${parcel.destinationAddress}.`,
        severity: 'eta',
        eventType: 'arriving_soon',
      });
    }

    broadcast({ type: 'courier:moved', payload: { ...courier } });
    broadcast({ type: 'parcel:updated', payload: { ...parcel } });
    mutated = true;
  }

  if (mutated) {
    state.serverTime = new Date().toISOString();
    schedulePersist();
  }
}, 2000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    state.serverTime = new Date().toISOString();
    ws.send(JSON.stringify({ type: 'init', payload: state } satisfies SocketEventPayload));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string };
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }));
        }
      } catch {
        // Ignore malformed payloads
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, clients: clients.size, serverTime: new Date().toISOString() });
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      googleMapsApiKey:
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        '',
    });
  });

  app.get('/api/state', (_req, res) => {
    state.serverTime = new Date().toISOString();
    res.json(state);
  });

  // Admin: Add Courier
  app.post('/api/couriers', (req, res) => {
    const body = req.body as Partial<Courier>;
    if (!body.name || !body.vehiclePlate) {
      res.status(400).json({ error: 'Courier name and vehiclePlate are required' });
      return;
    }

    const now = Date.now();
    const courier: Courier = {
      id: `c-${now}`,
      name: body.name.trim(),
      initials: makeInitials(body.name),
      vehicleType: body.vehicleType || 'Electric Van',
      vehiclePlate: body.vehiclePlate.trim().toUpperCase(),
      phone: body.phone?.trim() || '+1 (415) 555-0180',
      status: 'available',
      location: body.location ?? { lat: 37.7725, lng: -122.4041 },
      heading: 0,
      speedKmh: 0,
      accuracyMeters: 5,
      gpsSource: 'manual',
      completedDeliveries: 0,
      activeParcelId: null,
      routeProgress: 0,
      liveStreamActive: false,
      lastPingIso: new Date(now).toISOString(),
    };

    state.couriers = [...state.couriers, courier];
    broadcast({ type: 'courier:created', payload: courier });
    schedulePersist();
    res.status(201).json(courier);
  });

  // Admin: Remove Courier
  app.delete('/api/couriers/:id', (req, res) => {
    const idx = state.couriers.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Courier not found' });
      return;
    }
    const [removed] = state.couriers.splice(idx, 1);

    for (const parcel of state.parcels) {
      if (parcel.courierId === removed.id) {
        parcel.courierId = null;
        if (parcel.status !== 'delivered') {
          parcel.status = 'queued';
          syncParcelMilestones(parcel, 'queued');
        }
        parcel.updatedAt = new Date().toISOString();
        broadcast({ type: 'parcel:updated', payload: { ...parcel } });
      }
    }

    broadcast({ type: 'courier:deleted', payload: { id: removed.id } });
    schedulePersist();
    res.json({ deleted: removed.id });
  });

  app.post('/api/parcels', (req, res) => {
    const body = req.body as Partial<Parcel> & { taskTitle?: string };
    if (!body.customerName || !body.destinationAddress) {
      res.status(400).json({ error: 'customerName and destinationAddress are required' });
      return;
    }

    const now = Date.now();
    const num = 4085 + state.parcels.length;
    const id = `p-${now}`;
    const trackingCode = body.trackingCode || `CMB-${num}`;
    const originCoords = body.originCoords ?? { lat: 37.7712, lng: -122.4024 };
    const destinationCoords = body.destinationCoords ?? { lat: 37.7849, lng: -122.4194 };
    const distanceMeters = Math.max(
      400,
      Math.round(body.distanceMeters || haversineMeters(originCoords, destinationCoords) * 1.25)
    );
    const etaSeconds = Math.max(300, Math.round(body.etaSeconds || distanceMeters / 8.5));

    const assignedCourierId = body.courierId || null;
    const assignedCourier = assignedCourierId
      ? state.couriers.find((c) => c.id === assignedCourierId)
      : undefined;

    const parcel: Parcel = {
      id,
      trackingCode,
      customerName: body.customerName.trim(),
      customerPhone: body.customerPhone?.trim() || '+1 (415) 555-0192',
      customerEmail: body.customerEmail?.trim() || 'customer@example.com',
      itemDescription: body.itemDescription?.trim() || 'Priority Courier Parcel',
      weightKg: Number(body.weightKg) || 2.5,
      priority: body.priority || 'express',
      status: assignedCourier ? 'picked_up' : 'queued',
      originAddress: body.originAddress?.trim() || '650 Townsend St, San Francisco, CA',
      originCoords,
      destinationAddress: body.destinationAddress.trim(),
      destinationCoords,
      courierId: assignedCourierId,
      etaSeconds,
      estimatedArrivalIso: new Date(now + etaSeconds * 1000).toISOString(),
      distanceMeters,
      deliveryNotes: body.deliveryNotes?.trim() || '',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      routePath:
        Array.isArray(body.routePath) && body.routePath.length >= 2
          ? body.routePath
          : [originCoords, destinationCoords],
      milestones: [
        {
          id: `m-${now}-1`,
          label: 'Order Confirmed',
          location: 'SoMa Fulfillment Hub',
          timestamp: new Date(now).toISOString(),
          completed: true,
          detail: 'Task logged in dispatch queue',
        },
        {
          id: `m-${now}-2`,
          label: 'Courier Picked Up',
          location: body.originAddress?.trim() || '650 Townsend St',
          timestamp: assignedCourier ? new Date(now).toISOString() : '',
          completed: Boolean(assignedCourier),
          detail: assignedCourier ? `Assigned to ${assignedCourier.name}` : undefined,
        },
        {
          id: `m-${now}-3`,
          label: 'In Transit',
          location: 'En Route',
          timestamp: '',
          completed: false,
        },
        {
          id: `m-${now}-4`,
          label: 'Out for Delivery',
          location: 'Destination Neighborhood',
          timestamp: '',
          completed: false,
        },
        {
          id: `m-${now}-5`,
          label: 'Delivered',
          location: body.destinationAddress.trim(),
          timestamp: '',
          completed: false,
        },
      ],
    };

    state.parcels = [parcel, ...state.parcels];

    if (assignedCourier) {
      assignedCourier.activeParcelId = parcel.id;
      assignedCourier.routeProgress = 0;
      assignedCourier.location = originCoords;
      assignedCourier.status = 'en_route';
      assignedCourier.lastPingIso = new Date(now).toISOString();
      broadcast({ type: 'courier:moved', payload: { ...assignedCourier } });
    }

    const initialTask: DispatchTask = {
      id: `t-${now}`,
      parcelId: parcel.id,
      title: body.taskTitle?.trim() || `Verify dispatch & customer handoff for ${trackingCode}`,
      assignee: assignedCourier ? assignedCourier.name : 'Dispatch Desk',
      completed: false,
      dueTime: new Date(now + etaSeconds * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      category: 'handoff',
    };
    state.tasks = [initialTask, ...state.tasks];

    broadcast({ type: 'parcel:created', payload: parcel });
    broadcast({ type: 'task:created', payload: initialTask });
    createNotification({
      parcelId: parcel.id,
      trackingCode: parcel.trackingCode,
      title: 'New Delivery Dispatched',
      message: `${trackingCode} created for ${parcel.customerName} (${parcel.destinationAddress}).`,
      severity: 'info',
      eventType: 'info',
    });

    schedulePersist();
    res.status(201).json(parcel);
  });

  app.patch('/api/parcels/:id', (req, res) => {
    const parcel = state.parcels.find((p) => p.id === req.params.id);
    if (!parcel) {
      res.status(404).json({ error: 'Parcel not found' });
      return;
    }

    const updates = req.body as Partial<Parcel>;
    const prevStatus = parcel.status;
    const prevCourierId = parcel.courierId;
    const now = Date.now();

    if (updates.status && updates.status !== prevStatus) {
      parcel.status = updates.status;
      if (updates.status !== 'delayed') {
        parcel.delayReason = undefined;
      }
      if (updates.status === 'delivered') {
        parcel.etaSeconds = 0;
        parcel.distanceMeters = 0;
        parcel.signatureConfirmed = true;
        if (parcel.courierId) {
          const courier = state.couriers.find((c) => c.id === parcel.courierId);
          if (courier) {
            courier.completedDeliveries = (courier.completedDeliveries ?? 0) + 1;
            courier.liveStreamActive = false;
            courier.speedKmh = 0;
            courier.status = 'available';
            broadcast({ type: 'courier:moved', payload: { ...courier } });
          }
        }
      }
      syncParcelMilestones(parcel, updates.status, updates.delayReason);
    }

    if (updates.delayReason !== undefined) {
      parcel.delayReason = updates.delayReason;
    }
    if (updates.etaSeconds !== undefined) {
      parcel.etaSeconds = Math.max(0, Math.round(updates.etaSeconds));
      parcel.estimatedArrivalIso = new Date(now + parcel.etaSeconds * 1000).toISOString();
    }
    if (updates.distanceMeters !== undefined) {
      parcel.distanceMeters = Math.max(0, Math.round(updates.distanceMeters));
    }
    if (updates.deliveryNotes !== undefined) {
      parcel.deliveryNotes = updates.deliveryNotes;
    }
    if (updates.courierId !== undefined && updates.courierId !== prevCourierId) {
      if (prevCourierId) {
        const oldCourier = state.couriers.find((c) => c.id === prevCourierId);
        if (oldCourier && oldCourier.activeParcelId === parcel.id) {
          oldCourier.activeParcelId = null;
          oldCourier.liveStreamActive = false;
          oldCourier.speedKmh = 0;
          oldCourier.status = 'available';
          broadcast({ type: 'courier:moved', payload: { ...oldCourier } });
        }
      }
      parcel.courierId = updates.courierId;
      if (updates.courierId) {
        const nextCourier = state.couriers.find((c) => c.id === updates.courierId);
        if (nextCourier) {
          nextCourier.activeParcelId = parcel.id;
          nextCourier.routeProgress = 0;
          nextCourier.status = 'en_route';
          nextCourier.lastPingIso = new Date(now).toISOString();
          if (parcel.status === 'queued') {
            parcel.status = 'picked_up';
            syncParcelMilestones(parcel, 'picked_up', `Assigned to ${nextCourier.name}`);
          }
          broadcast({ type: 'courier:moved', payload: { ...nextCourier } });
        }
      }
    }

    parcel.updatedAt = new Date(now).toISOString();
    broadcast({ type: 'parcel:updated', payload: { ...parcel } });

    if (updates.status && updates.status !== prevStatus) {
      const statusLabelMap: Record<
        ParcelStatus,
        { title: string; severity: AlertSeverity; eventType: PushEventType }
      > = {
        queued: { title: 'Parcel Queued', severity: 'info', eventType: 'info' },
        picked_up: {
          title: 'Courier Picked Up Parcel',
          severity: 'info',
          eventType: 'info',
        },
        in_transit: {
          title: 'Parcel In Transit',
          severity: 'eta',
          eventType: 'info',
        },
        out_for_delivery: {
          title: 'Out for Delivery',
          severity: 'eta',
          eventType: 'out_for_delivery',
        },
        delayed: {
          title: 'Delivery Delay Alert',
          severity: 'warning',
          eventType: 'delayed',
        },
        delivered: {
          title: 'Delivered',
          severity: 'delivered',
          eventType: 'delivered',
        },
      };
      const meta = statusLabelMap[updates.status];
      const etaMin = Math.max(1, Math.ceil(parcel.etaSeconds / 60));
      const msgText =
        updates.status === 'delayed'
          ? `${parcel.trackingCode}: ${parcel.delayReason || 'Traffic delay encountered.'} New ETA ~${etaMin} mins.`
          : updates.status === 'delivered'
            ? `${parcel.trackingCode} successfully handed off at ${parcel.destinationAddress}.`
            : `${parcel.trackingCode} is now ${updates.status.replace(/_/g, ' ')}. Estimated arrival in ${etaMin} mins.`;

      createNotification({
        parcelId: parcel.id,
        trackingCode: parcel.trackingCode,
        title: meta.title,
        message: msgText,
        severity: meta.severity,
        eventType: meta.eventType,
      });
    }

    schedulePersist();
    res.json(parcel);
  });

  app.post('/api/parcels/:id/route', (req, res) => {
    const parcel = state.parcels.find((p) => p.id === req.params.id);
    if (!parcel) {
      res.status(404).json({ error: 'Parcel not found' });
      return;
    }

    const { distanceMeters, durationSeconds, routePath } = req.body as {
      distanceMeters?: number;
      durationSeconds?: number;
      routePath?: LatLngLiteral[];
    };

    if (Array.isArray(routePath) && routePath.length >= 2) {
      parcel.routePath = routePath;
    }

    const courier = parcel.courierId
      ? state.couriers.find((c) => c.id === parcel.courierId)
      : undefined;
    const progress = courier && courier.activeParcelId === parcel.id ? courier.routeProgress : 0;

    if (typeof distanceMeters === 'number' && distanceMeters > 0) {
      parcel.distanceMeters = Math.round(distanceMeters * (1 - progress));
    }
    if (typeof durationSeconds === 'number' && durationSeconds > 0 && parcel.status !== 'delivered') {
      const remainingSec = Math.max(60, Math.round(durationSeconds * (1 - progress)));
      parcel.etaSeconds = remainingSec;
      parcel.estimatedArrivalIso = new Date(Date.now() + remainingSec * 1000).toISOString();
    }
    parcel.updatedAt = new Date().toISOString();

    broadcast({ type: 'parcel:updated', payload: { ...parcel } });
    schedulePersist();
    res.json(parcel);
  });

  app.delete('/api/parcels/:id', (req, res) => {
    const idx = state.parcels.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Parcel not found' });
      return;
    }
    const [removed] = state.parcels.splice(idx, 1);
    state.tasks = state.tasks.filter((t) => t.parcelId !== removed.id);
    for (const courier of state.couriers) {
      if (courier.activeParcelId === removed.id) {
        courier.activeParcelId = null;
        courier.liveStreamActive = false;
        courier.speedKmh = 0;
        courier.status = 'available';
        broadcast({ type: 'courier:moved', payload: { ...courier } });
      }
    }
    broadcast({ type: 'parcel:deleted', payload: { id: removed.id } });
    schedulePersist();
    res.json({ deleted: removed.id });
  });

  // Real-time Courier Geolocation & Route Telemetry
  app.post('/api/couriers/:id/telemetry', (req, res) => {
    const courier = state.couriers.find((c) => c.id === req.params.id);
    if (!courier) {
      res.status(404).json({ error: 'Courier not found' });
      return;
    }

    const { action, lat, lng, heading, speedKmh, accuracyMeters, stepDelta } = req.body as {
      action?: 'start' | 'pause' | 'step' | 'ping' | 'gps_coords';
      lat?: number;
      lng?: number;
      heading?: number;
      speedKmh?: number;
      accuracyMeters?: number;
      stepDelta?: number;
    };

    const nowMs = Date.now();

    if (action === 'start') {
      courier.liveStreamActive = true;
      courier.gpsSource = 'route_stream';
      courier.status = 'en_route';
    } else if (action === 'pause') {
      courier.liveStreamActive = false;
      courier.speedKmh = 0;
      courier.status = 'paused';
    } else if (action === 'step' && courier.activeParcelId) {
      const parcel = state.parcels.find((p) => p.id === courier.activeParcelId);
      if (parcel) {
        const nextProgress = Math.min(1, courier.routeProgress + (stepDelta ?? 0.15));
        const { point, heading: segHeading, remainingMeters } = interpolatePath(
          parcel.routePath,
          nextProgress
        );
        courier.routeProgress = Number(nextProgress.toFixed(4));
        courier.location = point;
        courier.heading = Math.round(segHeading);
        courier.speedKmh = 32;
        courier.gpsSource = 'route_stream';
        courier.lastPingIso = new Date(nowMs).toISOString();
        parcel.distanceMeters = remainingMeters;
        parcel.etaSeconds =
          nextProgress >= 1 ? 0 : Math.max(30, Math.round(remainingMeters / 9.2));
        parcel.estimatedArrivalIso = new Date(
          nowMs + parcel.etaSeconds * 1000
        ).toISOString();
        if (nextProgress >= 1) {
          completeParcelDelivery(parcel, courier);
        } else if (nextProgress >= 0.65 && parcel.status !== 'out_for_delivery') {
          parcel.status = 'out_for_delivery';
          syncParcelMilestones(parcel, 'out_for_delivery');
          createNotification({
            parcelId: parcel.id,
            trackingCode: parcel.trackingCode,
            title: 'Out for Delivery',
            message: `${parcel.trackingCode} is on final approach (${Math.max(
              1,
              Math.ceil(parcel.etaSeconds / 60)
            )} min ETA).`,
            severity: 'eta',
            eventType: 'out_for_delivery',
          });
        }
        broadcast({ type: 'parcel:updated', payload: { ...parcel } });
      }
    } else if (
      (action === 'gps_coords' || action === 'ping') &&
      typeof lat === 'number' &&
      typeof lng === 'number'
    ) {
      const prevLocation = courier.location;
      courier.location = { lat, lng };
      courier.gpsSource = 'device_gps';
      courier.liveStreamActive = false;
      if (typeof accuracyMeters === 'number') {
        courier.accuracyMeters = Math.round(accuracyMeters);
      }
      courier.heading =
        typeof heading === 'number' && !Number.isNaN(heading)
          ? Math.round(heading)
          : Math.round(computeBearing(prevLocation, { lat, lng }));
      courier.speedKmh =
        typeof speedKmh === 'number' && !Number.isNaN(speedKmh)
          ? Math.round(speedKmh)
          : 28;
      courier.lastPingIso = new Date(nowMs).toISOString();

      if (courier.activeParcelId) {
        const parcel = state.parcels.find((p) => p.id === courier.activeParcelId);
        if (parcel && parcel.status !== 'delivered') {
          const totalDist = Math.max(
            400,
            haversineMeters(parcel.originCoords, parcel.destinationCoords) * 1.2
          );
          const remaining = Math.round(
            haversineMeters({ lat, lng }, parcel.destinationCoords) * 1.18
          );
          const etaSeconds = Math.max(30, Math.round(remaining / 8.8));
          courier.routeProgress = Number(
            Math.max(0, Math.min(0.98, 1 - remaining / totalDist)).toFixed(4)
          );
          courier.status = remaining <= 1600 ? 'delivering' : 'en_route';
          parcel.distanceMeters = remaining;
          parcel.etaSeconds = etaSeconds;
          parcel.estimatedArrivalIso = new Date(nowMs + etaSeconds * 1000).toISOString();
          parcel.updatedAt = new Date(nowMs).toISOString();

          if (parcel.status === 'queued' || parcel.status === 'picked_up') {
            parcel.status = 'in_transit';
            syncParcelMilestones(parcel, 'in_transit', 'Live courier device GPS streaming');
          }

          if (etaSeconds <= 300 && !proximityAlertSent.has(parcel.id)) {
            proximityAlertSent.add(parcel.id);
            createNotification({
              parcelId: parcel.id,
              trackingCode: parcel.trackingCode,
              title: 'Arriving Soon',
              message: `${courier.name} is ${Math.max(
                1,
                Math.ceil(etaSeconds / 60)
              )} min away from ${parcel.destinationAddress}.`,
              severity: 'eta',
              eventType: 'arriving_soon',
            });
          }

          broadcast({ type: 'parcel:updated', payload: { ...parcel } });
        }
      }
    }

    broadcast({ type: 'courier:moved', payload: { ...courier } });
    schedulePersist();
    res.json(courier);
  });

  // Trigger a real server-broadcast Push Notification for testing or manual alerts
  app.post('/api/notifications/test-push', (req, res) => {
    const { parcelId, eventType } = req.body as {
      parcelId?: string;
      eventType?: PushEventType;
    };
    const parcel =
      state.parcels.find((p) => p.id === parcelId) ?? state.parcels[0];
    if (!parcel) {
      res.status(404).json({ error: 'No parcel available for push notification' });
      return;
    }

    const evt = eventType ?? 'arriving_soon';
    const templates: Record<
      PushEventType,
      { title: string; message: string; severity: AlertSeverity }
    > = {
      out_for_delivery: {
        title: 'Out for Delivery',
        message: `${parcel.trackingCode} is on the courier vehicle heading to ${parcel.destinationAddress}.`,
        severity: 'eta',
      },
      arriving_soon: {
        title: 'Arriving Soon',
        message: `Your courier for ${parcel.trackingCode} is less than 4 minutes away.`,
        severity: 'eta',
      },
      delivered: {
        title: 'Delivered',
        message: `${parcel.trackingCode} has been delivered to ${parcel.destinationAddress}.`,
        severity: 'delivered',
      },
      delayed: {
        title: 'Route Delay Alert',
        message: `${parcel.trackingCode} encountered corridor congestion; ETA updated.`,
        severity: 'warning',
      },
      info: {
        title: 'Shipment Update',
        message: `Live status check confirmed for ${parcel.trackingCode}.`,
        severity: 'info',
      },
    };

    const chosen = templates[evt];
    const created = createNotification({
      parcelId: parcel.id,
      trackingCode: parcel.trackingCode,
      title: chosen.title,
      message: chosen.message,
      severity: chosen.severity,
      eventType: evt,
      recipientType: 'customer',
    });

    schedulePersist();
    res.status(201).json(created);
  });

  app.post('/api/tasks', (req, res) => {
    const { parcelId, title, assignee, dueTime, category } = req.body as Partial<DispatchTask>;
    if (!parcelId || !title) {
      res.status(400).json({ error: 'parcelId and title are required' });
      return;
    }
    const task: DispatchTask = {
      id: `t-${Date.now()}`,
      parcelId,
      title: title.trim(),
      assignee: assignee?.trim() || 'Dispatch Desk',
      completed: false,
      dueTime: dueTime || '16:00',
      category: category || 'handoff',
    };
    state.tasks = [task, ...state.tasks];
    broadcast({ type: 'task:created', payload: task });
    schedulePersist();
    res.status(201).json(task);
  });

  app.patch('/api/tasks/:id', (req, res) => {
    const task = state.tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const { completed, title, assignee } = req.body as Partial<DispatchTask>;
    if (typeof completed === 'boolean') task.completed = completed;
    if (typeof title === 'string') task.title = title;
    if (typeof assignee === 'string') task.assignee = assignee;
    broadcast({ type: 'task:updated', payload: { ...task } });
    schedulePersist();
    res.json(task);
  });

  app.patch('/api/notifications/:id/read', (req, res) => {
    const notif = state.notifications.find((n) => n.id === req.params.id);
    if (!notif) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    notif.read = true;
    broadcast({ type: 'notification:read', payload: { id: notif.id } });
    schedulePersist();
    res.json(notif);
  });

  app.post('/api/notifications/read-all', (_req, res) => {
    state.notifications = state.notifications.map((n) => ({ ...n, read: true }));
    broadcast({ type: 'notifications:read_all', payload: {} });
    schedulePersist();
    res.json({ ok: true });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Camber Dispatch server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
