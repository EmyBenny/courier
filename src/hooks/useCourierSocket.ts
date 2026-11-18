import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyLocalStatusMilestones,
  buildPushTemplate,
  haversineMetersClient,
  loadOfflineFallbackState,
  saveOfflineFallbackState,
} from '../services/fallbackSeed';
import type {
  Courier,
  CourierNotification,
  CourierSystemState,
  DispatchTask,
  LatLngLiteral,
  Parcel,
  ParcelStatus,
  PushEventType,
  SocketEventPayload,
} from '../types/courier';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

interface UseCourierSocketOptions {
  onNewNotification?: (notification: CourierNotification) => void;
}

export function useCourierSocket(options: UseCourierSocketOptions = {}) {
  const [state, setState] = useState<CourierSystemState>({
    parcels: [],
    couriers: [],
    tasks: [],
    notifications: [],
    serverTime: '',
  });
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const hasLiveServerRef = useRef(false);
  const offlineFallbackRef = useRef(false);
  const onNewNotifRef = useRef(options.onNewNotification);
  onNewNotifRef.current = options.onNewNotification;

  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  const updateOfflineState = useCallback(
    (updater: (prev: CourierSystemState) => CourierSystemState) => {
      setState((prev) => {
        const next = updater(prev);
        if (offlineFallbackRef.current) {
          saveOfflineFallbackState(next);
        }
        return next;
      });
    },
    []
  );

  const applyEvent = useCallback((event: SocketEventPayload) => {
    switch (event.type) {
      case 'init': {
        hasLiveServerRef.current = true;
        offlineFallbackRef.current = false;
        event.payload.notifications.forEach((n) =>
          seenNotifIdsRef.current.add(n.id)
        );
        setState(event.payload);
        setLoading(false);
        setError(null);
        break;
      }
      case 'parcel:created': {
        setState((prev) => {
          if (prev.parcels.some((p) => p.id === event.payload.id)) return prev;
          return { ...prev, parcels: [event.payload, ...prev.parcels] };
        });
        break;
      }
      case 'parcel:updated': {
        setState((prev) => ({
          ...prev,
          parcels: prev.parcels.map((p) =>
            p.id === event.payload.id ? event.payload : p
          ),
        }));
        break;
      }
      case 'parcel:deleted': {
        setState((prev) => ({
          ...prev,
          parcels: prev.parcels.filter((p) => p.id !== event.payload.id),
          tasks: prev.tasks.filter((t) => t.parcelId !== event.payload.id),
        }));
        break;
      }
      case 'courier:created': {
        setState((prev) => {
          if (prev.couriers.some((c) => c.id === event.payload.id)) return prev;
          return { ...prev, couriers: [...prev.couriers, event.payload] };
        });
        break;
      }
      case 'courier:moved': {
        setState((prev) => ({
          ...prev,
          couriers: prev.couriers.map((c) =>
            c.id === event.payload.id ? event.payload : c
          ),
        }));
        break;
      }
      case 'courier:deleted': {
        setState((prev) => ({
          ...prev,
          couriers: prev.couriers.filter((c) => c.id !== event.payload.id),
        }));
        break;
      }
      case 'task:created': {
        setState((prev) => {
          if (prev.tasks.some((t) => t.id === event.payload.id)) return prev;
          return { ...prev, tasks: [event.payload, ...prev.tasks] };
        });
        break;
      }
      case 'task:updated': {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === event.payload.id ? event.payload : t
          ),
        }));
        break;
      }
      case 'notification:created': {
        const isNew = !seenNotifIdsRef.current.has(event.payload.id);
        seenNotifIdsRef.current.add(event.payload.id);
        setState((prev) => {
          if (prev.notifications.some((n) => n.id === event.payload.id)) {
            return prev;
          }
          return {
            ...prev,
            notifications: [event.payload, ...prev.notifications].slice(0, 60),
          };
        });
        if (isNew) {
          onNewNotifRef.current?.(event.payload);
        }
        break;
      }
      case 'notification:read': {
        setState((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === event.payload.id ? { ...n, read: true } : n
          ),
        }));
        break;
      }
      case 'notifications:read_all': {
        setState((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        }));
        break;
      }
    }
  }, []);

  const fetchFallbackState = useCallback(async (maxRetries = 2) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (hasLiveServerRef.current) return;
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (hasLiveServerRef.current) return;

        if (res.ok) {
          const data = (await res.json()) as CourierSystemState;
          hasLiveServerRef.current = true;
          offlineFallbackRef.current = false;
          data.notifications.forEach((n) => seenNotifIdsRef.current.add(n.id));
          setState(data);
          setLoading(false);
          setError(null);
          return;
        }

        // Transient proxy/boot 404/502/503: retry briefly before deciding
        if (attempt < maxRetries && [404, 502, 503, 504].includes(res.status)) {
          await new Promise((r) => window.setTimeout(r, 650 * (attempt + 1)));
          continue;
        }

        if (res.status === 404) {
          // Static hosting without API server: activate persistent local fallback cleanly
          const fallback = loadOfflineFallbackState();
          offlineFallbackRef.current = true;
          fallback.notifications.forEach((n) => seenNotifIdsRef.current.add(n.id));
          setState(fallback);
          setLoading(false);
          setError(null);
          return;
        }

        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (hasLiveServerRef.current) return;
        if (attempt < maxRetries) {
          await new Promise((r) => window.setTimeout(r, 650 * (attempt + 1)));
          continue;
        }
        // Only surface an error if WebSocket hasn't already connected with live state
        if (!offlineFallbackRef.current && !hasLiveServerRef.current) {
          setError(
            err instanceof Error ? err.message : 'Unable to reach dispatch server.'
          );
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        reconnectAttemptRef.current = 0;
        setConnectionStatus('connected');
        setError(null);
      };

      ws.onmessage = (msg) => {
        if (unmounted) return;
        try {
          const parsed = JSON.parse(msg.data) as SocketEventPayload;
          if (parsed && typeof parsed.type === 'string') {
            applyEvent(parsed);
          }
        } catch {
          // Ignore non-event frames
        }
      };

      ws.onerror = () => {
        if (unmounted || hasLiveServerRef.current) return;
        void fetchFallbackState(1);
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnectionStatus('reconnecting');
        const delay = Math.min(
          8000,
          1000 * Math.pow(1.5, reconnectAttemptRef.current)
        );
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    void fetchFallbackState(2);
    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [applyEvent, fetchFallbackState]);

  const createCourier = useCallback(
    async (payload: {
      name: string;
      vehicleType: Courier['vehicleType'];
      vehiclePlate: string;
      phone?: string;
      location?: LatLngLiteral;
    }) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch('/api/couriers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return (await res.json()) as Courier;
        if (res.status !== 404) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to add courier');
        }
        offlineFallbackRef.current = true;
      }

      const now = Date.now();
      const initials = payload.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('');
      const courier: Courier = {
        id: `c-${now}`,
        name: payload.name.trim(),
        initials: initials || 'CR',
        vehicleType: payload.vehicleType,
        vehiclePlate: payload.vehiclePlate.trim().toUpperCase(),
        phone: payload.phone?.trim() || '+1 (415) 555-0180',
        status: 'available',
        location: payload.location ?? { lat: 37.7725, lng: -122.4041 },
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
      updateOfflineState((prev) => ({
        ...prev,
        couriers: [...prev.couriers, courier],
      }));
      return courier;
    },
    [updateOfflineState]
  );

  const deleteCourier = useCallback(
    async (id: string) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch(`/api/couriers/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (res.ok) return;
        if (res.status !== 404) throw new Error('Failed to remove courier');
        offlineFallbackRef.current = true;
      }

      updateOfflineState((prev) => ({
        ...prev,
        couriers: prev.couriers.filter((c) => c.id !== id),
        parcels: prev.parcels.map((p) =>
          p.courierId === id
            ? {
                ...p,
                courierId: null,
                status: p.status === 'delivered' ? 'delivered' : 'queued',
              }
            : p
        ),
      }));
    },
    [updateOfflineState]
  );

  const createParcel = useCallback(
    async (
      payload: Partial<Parcel> & {
        customerName: string;
        destinationAddress: string;
        taskTitle?: string;
      }
    ) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch('/api/parcels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return (await res.json()) as Parcel;
        if (res.status !== 404) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create delivery task');
        }
        offlineFallbackRef.current = true;
      }

      const now = Date.now();
      const originCoords = payload.originCoords ?? { lat: 37.7712, lng: -122.4024 };
      const destinationCoords =
        payload.destinationCoords ?? { lat: 37.7849, lng: -122.4194 };
      const distanceMeters = Math.max(
        400,
        Math.round(
          payload.distanceMeters ||
            haversineMetersClient(originCoords, destinationCoords) * 1.25
        )
      );
      const etaSeconds = Math.max(
        300,
        Math.round(payload.etaSeconds || distanceMeters / 8.5)
      );
      const trackingCode = payload.trackingCode || `CMB-${4085 + state.parcels.length}`;
      const parcel: Parcel = {
        id: `p-${now}`,
        trackingCode,
        customerName: payload.customerName.trim(),
        customerPhone: payload.customerPhone?.trim() || '+1 (415) 555-0192',
        customerEmail: payload.customerEmail?.trim() || 'customer@example.com',
        itemDescription: payload.itemDescription?.trim() || 'Priority Courier Parcel',
        weightKg: Number(payload.weightKg) || 2.5,
        priority: payload.priority || 'express',
        status: payload.courierId ? 'picked_up' : 'queued',
        originAddress: payload.originAddress?.trim() || '650 Townsend St, San Francisco, CA',
        originCoords,
        destinationAddress: payload.destinationAddress.trim(),
        destinationCoords,
        courierId: payload.courierId || null,
        etaSeconds,
        estimatedArrivalIso: new Date(now + etaSeconds * 1000).toISOString(),
        distanceMeters,
        deliveryNotes: payload.deliveryNotes?.trim() || '',
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        routePath: [originCoords, destinationCoords],
        milestones: [
          {
            id: `m-${now}-1`,
            label: 'Order Confirmed',
            location: 'SoMa Fulfillment Hub',
            timestamp: new Date(now).toISOString(),
            completed: true,
          },
          {
            id: `m-${now}-2`,
            label: 'Courier Picked Up',
            location: '650 Townsend St',
            timestamp: payload.courierId ? new Date(now).toISOString() : '',
            completed: Boolean(payload.courierId),
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
            location: payload.destinationAddress.trim(),
            timestamp: '',
            completed: false,
          },
        ],
      };

      updateOfflineState((prev) => ({
        ...prev,
        parcels: [parcel, ...prev.parcels],
      }));
      return parcel;
    },
    [state.parcels.length, updateOfflineState]
  );

  const updateParcel = useCallback(
    async (
      id: string,
      updates: Partial<{
        status: ParcelStatus;
        courierId: string | null;
        delayReason: string;
        etaSeconds: number;
        deliveryNotes: string;
      }>
    ) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch(`/api/parcels/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (res.ok) return (await res.json()) as Parcel;
        if (res.status !== 404) throw new Error('Failed to update parcel');
        offlineFallbackRef.current = true;
      }

      let updatedParcel: Parcel | undefined;
      updateOfflineState((prev) => ({
        ...prev,
        parcels: prev.parcels.map((p) => {
          if (p.id !== id) return p;
          let next: Parcel = { ...p, ...updates };
          if (updates.status) {
            next = applyLocalStatusMilestones(next, updates.status, updates.delayReason);
          }
          updatedParcel = next;
          return next;
        }),
      }));
      if (!updatedParcel) throw new Error('Parcel not found');
      return updatedParcel;
    },
    [updateOfflineState]
  );

  const deleteParcel = useCallback(
    async (id: string) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch(`/api/parcels/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (res.ok) return;
        if (res.status !== 404) throw new Error('Failed to delete parcel');
        offlineFallbackRef.current = true;
      }

      updateOfflineState((prev) => ({
        ...prev,
        parcels: prev.parcels.filter((p) => p.id !== id),
        tasks: prev.tasks.filter((t) => t.parcelId !== id),
      }));
    },
    [updateOfflineState]
  );

  const syncParcelRoute = useCallback(
    async (
      id: string,
      routeData: {
        distanceMeters: number;
        durationSeconds: number;
        routePath: LatLngLiteral[];
      }
    ) => {
      if (offlineFallbackRef.current) return;
      await fetch(`/api/parcels/${encodeURIComponent(id)}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      }).catch(() => {});
    },
    []
  );

  const sendCourierTelemetry = useCallback(
    async (
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
    ) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch(
          `/api/couriers/${encodeURIComponent(courierId)}/telemetry`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) return (await res.json()) as Courier;
        if (res.status !== 404) throw new Error('Failed to update courier telemetry');
        offlineFallbackRef.current = true;
      }

      let updatedCourier: Courier | undefined;
      updateOfflineState((prev) => ({
        ...prev,
        couriers: prev.couriers.map((c) => {
          if (c.id !== courierId) return c;
          const next: Courier = {
            ...c,
            lastPingIso: new Date().toISOString(),
            location:
              typeof payload.lat === 'number' && typeof payload.lng === 'number'
                ? { lat: payload.lat, lng: payload.lng }
                : c.location,
            speedKmh:
              typeof payload.speedKmh === 'number' ? Math.round(payload.speedKmh) : c.speedKmh,
            heading:
              typeof payload.heading === 'number' ? Math.round(payload.heading) : c.heading,
            status:
              payload.action === 'pause'
                ? 'paused'
                : payload.action === 'start'
                ? 'en_route'
                : c.status,
            liveStreamActive: payload.action === 'start',
          };
          updatedCourier = next;
          return next;
        }),
      }));
      if (!updatedCourier) throw new Error('Courier not found');
      return updatedCourier;
    },
    [updateOfflineState]
  );

  const triggerTestPushAlert = useCallback(
    async (parcelId: string, eventType: PushEventType) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch('/api/notifications/test-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcelId, eventType }),
        });
        if (res.ok) return (await res.json()) as CourierNotification;
        if (res.status !== 404) throw new Error('Failed to trigger push alert');
        offlineFallbackRef.current = true;
      }

      const parcel =
        state.parcels.find((p) => p.id === parcelId) ?? state.parcels[0];
      if (!parcel) throw new Error('No parcel available');
      const created = buildPushTemplate(parcel, eventType);
      seenNotifIdsRef.current.add(created.id);
      updateOfflineState((prev) => ({
        ...prev,
        notifications: [created, ...prev.notifications].slice(0, 60),
      }));
      onNewNotifRef.current?.(created);
      return created;
    },
    [state.parcels, updateOfflineState]
  );

  const createTask = useCallback(
    async (payload: {
      parcelId: string;
      title: string;
      assignee?: string;
      dueTime?: string;
      category?: DispatchTask['category'];
    }) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return (await res.json()) as DispatchTask;
        if (res.status !== 404) throw new Error('Failed to create task');
        offlineFallbackRef.current = true;
      }

      const task: DispatchTask = {
        id: `t-${Date.now()}`,
        parcelId: payload.parcelId,
        title: payload.title.trim(),
        assignee: payload.assignee?.trim() || 'Dispatch Desk',
        completed: false,
        dueTime: payload.dueTime || '16:00',
        category: payload.category || 'handoff',
      };
      updateOfflineState((prev) => ({
        ...prev,
        tasks: [task, ...prev.tasks],
      }));
      return task;
    },
    [updateOfflineState]
  );

  const toggleTask = useCallback(
    async (taskId: string, completed: boolean) => {
      if (!offlineFallbackRef.current) {
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed }),
        });
        if (res.ok) return (await res.json()) as DispatchTask;
        if (res.status !== 404) throw new Error('Failed to update task');
        offlineFallbackRef.current = true;
      }

      let updated: DispatchTask | undefined;
      updateOfflineState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => {
          if (t.id !== taskId) return t;
          updated = { ...t, completed };
          return updated;
        }),
      }));
      if (!updated) throw new Error('Task not found');
      return updated;
    },
    [updateOfflineState]
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (offlineFallbackRef.current) {
        updateOfflineState((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
        return;
      }
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
      }).catch(() => {});
    },
    [updateOfflineState]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (offlineFallbackRef.current) {
      updateOfflineState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      }));
      return;
    }
    await fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  }, [updateOfflineState]);

  return {
    state,
    loading,
    error,
    connectionStatus,
    createCourier,
    deleteCourier,
    createParcel,
    updateParcel,
    deleteParcel,
    syncParcelRoute,
    sendCourierTelemetry,
    triggerTestPushAlert,
    createTask,
    toggleTask,
    markNotificationRead,
    markAllNotificationsRead,
  };
}
