import { useCallback, useEffect, useRef, useState } from 'react';
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
  const onNewNotifRef = useRef(options.onNewNotification);
  onNewNotifRef.current = options.onNewNotification;

  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  const applyEvent = useCallback((event: SocketEventPayload) => {
    switch (event.type) {
      case 'init': {
        event.payload.notifications.forEach((n) =>
          seenNotifIdsRef.current.add(n.id)
        );
        setState(event.payload);
        setLoading(false);
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

  const fetchFallbackState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CourierSystemState;
      data.notifications.forEach((n) => seenNotifIdsRef.current.add(n.id));
      setState(data);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reach dispatch server.'
      );
      setLoading(false);
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
        if (unmounted) return;
        fetchFallbackState();
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

    fetchFallbackState();
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
      const res = await fetch('/api/couriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add courier');
      }
      return (await res.json()) as Courier;
    },
    []
  );

  const deleteCourier = useCallback(async (id: string) => {
    const res = await fetch(`/api/couriers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove courier');
  }, []);

  const createParcel = useCallback(
    async (
      payload: Partial<Parcel> & {
        customerName: string;
        destinationAddress: string;
        taskTitle?: string;
      }
    ) => {
      const res = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create delivery task');
      }
      return (await res.json()) as Parcel;
    },
    []
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
      const res = await fetch(`/api/parcels/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        throw new Error('Failed to update parcel');
      }
      return (await res.json()) as Parcel;
    },
    []
  );

  const deleteParcel = useCallback(async (id: string) => {
    const res = await fetch(`/api/parcels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Failed to delete parcel');
    }
  }, []);

  const syncParcelRoute = useCallback(
    async (
      id: string,
      routeData: {
        distanceMeters: number;
        durationSeconds: number;
        routePath: LatLngLiteral[];
      }
    ) => {
      await fetch(`/api/parcels/${encodeURIComponent(id)}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });
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
      const res = await fetch(
        `/api/couriers/${encodeURIComponent(courierId)}/telemetry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        throw new Error('Failed to update courier telemetry');
      }
      return (await res.json()) as Courier;
    },
    []
  );

  const triggerTestPushAlert = useCallback(
    async (parcelId: string, eventType: PushEventType) => {
      const res = await fetch('/api/notifications/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId, eventType }),
      });
      if (!res.ok) throw new Error('Failed to trigger push alert');
      return (await res.json()) as CourierNotification;
    },
    []
  );

  const createTask = useCallback(
    async (payload: {
      parcelId: string;
      title: string;
      assignee?: string;
      dueTime?: string;
      category?: DispatchTask['category'];
    }) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return (await res.json()) as DispatchTask;
    },
    []
  );

  const toggleTask = useCallback(async (taskId: string, completed: boolean) => {
    const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new Error('Failed to update task');
    return (await res.json()) as DispatchTask;
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
  }, []);

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
