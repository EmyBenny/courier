import type {
  Courier,
  CourierNotification,
  CourierSystemState,
  LatLngLiteral,
  Parcel,
  ParcelStatus,
  PushEventType,
} from '../types/courier';

const STORAGE_KEY = 'camber_dispatch_offline_state_v1';

export function haversineMetersClient(a: LatLngLiteral, b: LatLngLiteral): number {
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

export function buildFallbackSeedState(): CourierSystemState {
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
      location: { lat: 37.7812, lng: -122.4152 },
      heading: 318,
      speedKmh: 28,
      accuracyMeters: 5,
      gpsSource: 'route_stream',
      completedDeliveries: 14,
      activeParcelId: 'p-1',
      routeProgress: 0.62,
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
      accuracyMeters: 6,
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
      accuracyMeters: 5,
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
      customerPhone: '+1 (415) 901-4420',
      customerEmail: 'clara@atelierhendriks.com',
      itemDescription: 'Architectural Sample Kit (3 Boxes)',
      weightKg: 6.4,
      priority: 'express',
      status: 'out_for_delivery',
      originAddress: '650 Townsend St, San Francisco, CA',
      originCoords: { lat: 37.7712, lng: -122.4024 },
      destinationAddress: '2140 Fillmore St, San Francisco, CA',
      destinationCoords: { lat: 37.7896, lng: -122.4339 },
      courierId: 'c-1',
      etaSeconds: 540,
      estimatedArrivalIso: iso(540 * 1000),
      distanceMeters: 2450,
      deliveryNotes: 'Deliver to studio reception on Fillmore entrance.',
      createdAt: iso(-5400000),
      updatedAt: iso(-12000),
      routePath: [
        { lat: 37.7712, lng: -122.4024 },
        { lat: 37.7765, lng: -122.4098 },
        { lat: 37.7812, lng: -122.4152 },
        { lat: 37.7854, lng: -122.4258 },
        { lat: 37.7896, lng: -122.4339 },
      ],
      milestones: [
        {
          id: 'm-101',
          label: 'Order Confirmed',
          location: 'SoMa Fulfillment Hub',
          timestamp: iso(-5400000),
          completed: true,
        },
        {
          id: 'm-102',
          label: 'Courier Picked Up',
          location: '650 Townsend St',
          timestamp: iso(-3200000),
          completed: true,
        },
        {
          id: 'm-103',
          label: 'In Transit',
          location: 'Civic Center Corridor',
          timestamp: iso(-1500000),
          completed: true,
        },
        {
          id: 'm-104',
          label: 'Out for Delivery',
          location: 'Pacific Heights / Fillmore',
          timestamp: iso(-420000),
          completed: true,
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
      customerPhone: '+1 (415) 622-1190',
      customerEmail: 'j.mercer@ferryventures.io',
      itemDescription: 'Hardware Prototype Flight Case',
      weightKg: 4.1,
      priority: 'same_day',
      status: 'in_transit',
      originAddress: '2010 Mission St, San Francisco, CA',
      originCoords: { lat: 37.7647, lng: -122.4198 },
      destinationAddress: '1 Ferry Building, San Francisco, CA',
      destinationCoords: { lat: 37.7955, lng: -122.3937 },
      courierId: 'c-2',
      etaSeconds: 960,
      estimatedArrivalIso: iso(960 * 1000),
      distanceMeters: 4120,
      deliveryNotes: 'Call courier desk on arrival at Loading Dock B.',
      createdAt: iso(-4200000),
      updatedAt: iso(-28000),
      routePath: [
        { lat: 37.7647, lng: -122.4198 },
        { lat: 37.7715, lng: -122.4112 },
        { lat: 37.7819, lng: -122.4018 },
        { lat: 37.7892, lng: -122.3964 },
        { lat: 37.7955, lng: -122.3937 },
      ],
      milestones: [
        {
          id: 'm-201',
          label: 'Order Confirmed',
          location: 'Mission Dispatch Hub',
          timestamp: iso(-4200000),
          completed: true,
        },
        {
          id: 'm-202',
          label: 'Courier Picked Up',
          location: '2010 Mission St',
          timestamp: iso(-2100000),
          completed: true,
        },
        {
          id: 'm-203',
          label: 'In Transit',
          location: 'Market & Embarcadero Route',
          timestamp: iso(-600000),
          completed: true,
        },
        {
          id: 'm-204',
          label: 'Out for Delivery',
          location: 'Embarcadero Promenade',
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
      customerPhone: '+1 (415) 487-9932',
      customerEmail: 'nadia@presidiolabs.org',
      itemDescription: 'Sterile Diagnostics Reagent Pack',
      weightKg: 3.2,
      priority: 'express',
      status: 'delayed',
      originAddress: '900 Kearny St, San Francisco, CA',
      originCoords: { lat: 37.7964, lng: -122.4052 },
      destinationAddress: '103 Montgomery St, Presidio, San Francisco, CA',
      destinationCoords: { lat: 37.8012, lng: -122.4581 },
      courierId: 'c-3',
      etaSeconds: 1380,
      estimatedArrivalIso: iso(1380 * 1000),
      distanceMeters: 3150,
      delayReason: 'Intersection roadwork near Van Ness & Lombard (+12m reroute)',
      deliveryNotes: 'Temperature-controlled satchel; hand to lab coordinator.',
      createdAt: iso(-6800000),
      updatedAt: iso(-95000),
      routePath: [
        { lat: 37.7964, lng: -122.4052 },
        { lat: 37.7942, lng: -122.4218 },
        { lat: 37.7915, lng: -122.4352 },
        { lat: 37.7968, lng: -122.4481 },
        { lat: 37.8012, lng: -122.4581 },
      ],
      milestones: [
        {
          id: 'm-301',
          label: 'Order Confirmed',
          location: 'North Beach Micro-Hub',
          timestamp: iso(-6800000),
          completed: true,
        },
        {
          id: 'm-302',
          label: 'Courier Picked Up',
          location: '900 Kearny St',
          timestamp: iso(-4100000),
          completed: true,
        },
        {
          id: 'm-303',
          label: 'Traffic Delay Logged',
          location: 'Lombard & Van Ness Detour',
          timestamp: iso(-300000),
          completed: true,
          detail: 'Intersection roadwork near Van Ness & Lombard (+12m reroute)',
        },
        {
          id: 'm-304',
          label: 'Out for Delivery',
          location: 'Presidio Main Post',
          timestamp: '',
          completed: false,
        },
        {
          id: 'm-305',
          label: 'Delivered',
          location: '103 Montgomery St, Presidio',
          timestamp: '',
          completed: false,
        },
      ],
    },
    {
      id: 'p-4',
      trackingCode: 'CMB-4084',
      customerName: 'Theo Lindqvist',
      customerPhone: '+1 (415) 839-2204',
      customerEmail: 'theo@nordicroast.co',
      itemDescription: 'Single-Origin Roaster Calibration Drum',
      weightKg: 12.0,
      priority: 'standard',
      status: 'queued',
      originAddress: '650 Townsend St, San Francisco, CA',
      originCoords: { lat: 37.7712, lng: -122.4024 },
      destinationAddress: '3300 24th St, San Francisco, CA',
      destinationCoords: { lat: 37.7525, lng: -122.4184 },
      courierId: 'c-4',
      etaSeconds: 1920,
      estimatedArrivalIso: iso(1920 * 1000),
      distanceMeters: 2890,
      deliveryNotes: 'Side alley roll-up door open until 18:00.',
      createdAt: iso(-1800000),
      updatedAt: iso(-1800000),
      routePath: [
        { lat: 37.7712, lng: -122.4024 },
        { lat: 37.7621, lng: -122.4099 },
        { lat: 37.7525, lng: -122.4184 },
      ],
      milestones: [
        {
          id: 'm-401',
          label: 'Order Confirmed',
          location: 'SoMa Fulfillment Hub',
          timestamp: iso(-1800000),
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
      estimatedArrivalIso: iso(-3600000),
      distanceMeters: 5400,
      deliveryNotes: 'Signed at optical desk by E. Cho.',
      signatureConfirmed: true,
      createdAt: iso(-14400000),
      updatedAt: iso(-3600000),
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
          timestamp: iso(-14400000),
          completed: true,
        },
        {
          id: 'm-502',
          label: 'Courier Picked Up',
          location: '650 Townsend St',
          timestamp: iso(-10800000),
          completed: true,
        },
        {
          id: 'm-503',
          label: 'In Transit',
          location: 'Van Ness Northbound',
          timestamp: iso(-7200000),
          completed: true,
        },
        {
          id: 'm-504',
          label: 'Out for Delivery',
          location: 'Marina District',
          timestamp: iso(-4500000),
          completed: true,
        },
        {
          id: 'm-505',
          label: 'Delivered',
          location: '2055 Chestnut St',
          timestamp: iso(-3600000),
          completed: true,
          detail: 'Proof of delivery signed by Evelyn Cho',
        },
      ],
    },
  ];

  const tasks = [
    {
      id: 't-1',
      parcelId: 'p-1',
      title: 'Confirm courtyard gate code with Clara Hendriks prior to arrival',
      assignee: 'Elena Rostova',
      completed: true,
      dueTime: '15:10',
      category: 'handoff' as const,
    },
    {
      id: 't-2',
      parcelId: 'p-1',
      title: 'Collect recipient signature at 2140 Fillmore St',
      assignee: 'Elena Rostova',
      completed: false,
      dueTime: '15:25',
      category: 'pod' as const,
    },
    {
      id: 't-3',
      parcelId: 'p-3',
      title: 'Approve alternate Van Ness detour and push revised ETA alert',
      assignee: 'Dispatch Desk',
      completed: true,
      dueTime: '14:55',
      category: 'routing' as const,
    },
    {
      id: 't-4',
      parcelId: 'p-4',
      title: 'Verify 12 kg roast batch manifest and release dock bay #2',
      assignee: 'David Okafor',
      completed: false,
      dueTime: '15:40',
      category: 'pickup' as const,
    },
    {
      id: 't-5',
      parcelId: 'p-2',
      title: 'Coordinate Ferry Building Loading Dock B clearance',
      assignee: 'Marcus Vance',
      completed: false,
      dueTime: '15:35',
      category: 'handoff' as const,
    },
  ];

  const notifications: CourierNotification[] = [
    {
      id: 'n-1',
      parcelId: 'p-1',
      trackingCode: 'CMB-4081',
      title: 'Courier 9 Minutes Away',
      message: 'Elena Rostova is approaching 2140 Fillmore St. ETA updated to 9 mins.',
      severity: 'eta',
      eventType: 'arriving_soon',
      recipientType: 'all',
      createdAt: iso(-240000),
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
      createdAt: iso(-3600000),
      read: true,
    },
  ];

  return {
    parcels,
    couriers,
    tasks,
    notifications,
    serverTime: new Date(now).toISOString(),
  };
}

export function loadOfflineFallbackState(): CourierSystemState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CourierSystemState;
      if (parsed && Array.isArray(parsed.parcels) && Array.isArray(parsed.couriers)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read error
  }
  return buildFallbackSeedState();
}

export function saveOfflineFallbackState(state: CourierSystemState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota error
  }
}

export function buildPushTemplate(
  parcel: Parcel,
  eventType: PushEventType
): CourierNotification {
  const templates: Record<
    PushEventType,
    { title: string; message: string; severity: CourierNotification['severity'] }
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

  const chosen = templates[eventType];
  return {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    parcelId: parcel.id,
    trackingCode: parcel.trackingCode,
    title: chosen.title,
    message: chosen.message,
    severity: chosen.severity,
    eventType,
    recipientType: 'customer',
    createdAt: new Date().toISOString(),
    read: false,
  };
}

export function applyLocalStatusMilestones(
  parcel: Parcel,
  status: ParcelStatus,
  delayReason?: string
): Parcel {
  const nowIso = new Date().toISOString();
  const order: ParcelStatus[] = [
    'queued',
    'picked_up',
    'in_transit',
    'out_for_delivery',
    'delivered',
  ];
  const idx = status === 'delayed' ? 2 : order.indexOf(status);
  return {
    ...parcel,
    status,
    delayReason: status === 'delayed' ? delayReason || parcel.delayReason : undefined,
    etaSeconds: status === 'delivered' ? 0 : parcel.etaSeconds,
    distanceMeters: status === 'delivered' ? 0 : parcel.distanceMeters,
    updatedAt: nowIso,
    milestones: parcel.milestones.map((m, mIdx) => {
      if (mIdx <= idx) {
        return {
          ...m,
          completed: true,
          timestamp: m.timestamp || nowIso,
          detail: status === 'delayed' && mIdx === 2 ? delayReason : m.detail,
        };
      }
      return m;
    }),
  };
}
