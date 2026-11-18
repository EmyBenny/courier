import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Bell, Menu, Package, Plus, Search, X } from 'lucide-react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { CourierDeviceView } from './components/CourierDeviceView';
import { CourierMapPanel } from './components/CourierMapPanel';
import { CustomerTrackerView } from './components/CustomerTrackerView';
import { LandingView } from './components/LandingView';
import { NewDeliveryModal } from './components/NewDeliveryModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import {
  StatusLabel,
  formatClockTime,
  formatDistanceKm,
  formatEtaText,
  formatPriorityLabel,
} from './components/StatusLabel';
import {
  FleetAndTasksView,
  SelectedParcelOperations,
} from './components/TaskAndFleetPanel';
import { useCourierSocket } from './hooks/useCourierSocket';
import {
  dispatchDevicePushNotification,
  loadPushPrefs,
  registerPushServiceWorker,
  requestDeviceNotificationPermission,
  savePushPrefs,
} from './services/pushNotifications';
import type {
  CourierNotification,
  PushSubscriptionPrefs,
} from './types/courier';

type WorkspaceTab = 'home' | 'dispatch' | 'customer' | 'admin' | 'courier';
type ParcelFilter =
  | 'all'
  | 'active'
  | 'out_for_delivery'
  | 'delayed'
  | 'delivered';

interface RouteState {
  isAdminPortal: boolean;
  tab: WorkspaceTab;
}

function parseRouteFromLocation(): RouteState {
  if (typeof window === 'undefined') {
    return { isAdminPortal: false, tab: 'home' };
  }
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path.startsWith('/admin') || hash.startsWith('#/admin') || hash === '#admin') {
    if (path.startsWith('/admin/dispatch') || hash.includes('/dispatch')) {
      return { isAdminPortal: true, tab: 'dispatch' };
    }
    if (path.startsWith('/admin/courier') || hash.includes('/courier')) {
      return { isAdminPortal: true, tab: 'courier' };
    }
    if (path.startsWith('/admin/customer') || hash.includes('/customer')) {
      return { isAdminPortal: true, tab: 'customer' };
    }
    return { isAdminPortal: true, tab: 'admin' };
  }

  if (path.startsWith('/track')) {
    return { isAdminPortal: false, tab: 'customer' };
  }

  return { isAdminPortal: false, tab: 'home' };
}

function pathForTab(tab: WorkspaceTab, isAdminPortal: boolean): string {
  if (isAdminPortal || tab === 'admin' || tab === 'dispatch' || tab === 'courier') {
    if (tab === 'dispatch') return '/admin/dispatch';
    if (tab === 'courier') return '/admin/courier';
    if (tab === 'customer') return '/admin/customer';
    return '/admin';
  }
  if (tab === 'customer') return '/track';
  return '/';
}

const ENV_GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';

export default function App() {
  const [mapsApiKey, setMapsApiKey] = useState(ENV_GOOGLE_MAPS_API_KEY);
  const [configReady, setConfigReady] = useState(Boolean(ENV_GOOGLE_MAPS_API_KEY));
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    if (ENV_GOOGLE_MAPS_API_KEY) return;
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { googleMapsApiKey?: string } | null) => {
        if (data?.googleMapsApiKey) {
          setMapsApiKey(data.googleMapsApiKey);
        }
      })
      .catch(() => {})
      .finally(() => setConfigReady(true));
  }, []);

  const [route, setRoute] = useState<RouteState>(() => parseRouteFromLocation());
  const { isAdminPortal, tab: activeTab } = route;

  const navigate = useCallback((nextPath: string, nextRoute?: RouteState) => {
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(nextRoute ?? parseRouteFromLocation());
  }, []);

  const navigateToTab = useCallback(
    (tab: WorkspaceTab, forceAdminPortal?: boolean) => {
      const admin =
        typeof forceAdminPortal === 'boolean'
          ? forceAdminPortal
          : tab === 'admin' || tab === 'dispatch' || tab === 'courier'
          ? true
          : tab === 'home'
          ? false
          : route.isAdminPortal;
      const targetPath = pathForTab(tab, admin);
      navigate(targetPath, { isAdminPortal: admin, tab });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate, route.isAdminPortal]
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleTrackParcelAction = useCallback(() => {
    if (isAdminPortal || activeTab !== 'home') {
      navigate('/', { isAdminPortal: false, tab: 'home' });
      window.setTimeout(() => {
        const input = document.getElementById('parcel-lookup-input');
        const section = document.getElementById('parcel-lookup');
        section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus();
      }, 60);
      return;
    }
    const input = document.getElementById('parcel-lookup-input');
    const section = document.getElementById('parcel-lookup');
    section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus();
  }, [activeTab, isAdminPortal, navigate]);

  const [parcelFilter, setParcelFilter] = useState<ParcelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pushPrefs, setPushPrefs] = useState<PushSubscriptionPrefs>(() =>
    loadPushPrefs()
  );
  const [liveToast, setLiveToast] = useState<CourierNotification | null>(null);

  const pushPrefsRef = useRef(pushPrefs);
  pushPrefsRef.current = pushPrefs;

  useEffect(() => {
    void registerPushServiceWorker();
  }, []);

  useEffect(() => {
    savePushPrefs(pushPrefs);
  }, [pushPrefs]);

  // Listen for Google Maps Platform quota exceeded events (Case A Demo Key Handling)
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  const handleIncomingNotification = useCallback(
    (notification: CourierNotification) => {
      setLiveToast(notification);
      void dispatchDevicePushNotification(notification, pushPrefsRef.current);
    },
    []
  );

  // Auto-dismiss live toast after 5.5s
  useEffect(() => {
    if (!liveToast) return;
    const timer = window.setTimeout(() => setLiveToast(null), 5500);
    return () => clearTimeout(timer);
  }, [liveToast]);

  const {
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
  } = useCourierSocket({ onNewNotification: handleIncomingNotification });

  useEffect(() => {
    if (!selectedParcelId && state.parcels.length > 0) {
      setSelectedParcelId(state.parcels[0].id);
    }
  }, [selectedParcelId, state.parcels]);

  const handleToggleDevicePush = async (watchedTrackingCode?: string) => {
    if (!pushPrefs.enabled) {
      const permission = await requestDeviceNotificationPermission();
      const next: PushSubscriptionPrefs = {
        ...pushPrefs,
        enabled: permission === 'granted' || typeof Notification === 'undefined',
        watchedTrackingCode: watchedTrackingCode ?? null,
      };
      setPushPrefs(next);
    } else {
      setPushPrefs({
        ...pushPrefs,
        enabled: false,
        watchedTrackingCode: null,
      });
    }
  };

  const filteredParcels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.parcels.filter((p) => {
      if (parcelFilter === 'active' && p.status === 'delivered') return false;
      if (
        parcelFilter === 'out_for_delivery' &&
        p.status !== 'out_for_delivery'
      )
        return false;
      if (parcelFilter === 'delayed' && p.status !== 'delayed') return false;
      if (parcelFilter === 'delivered' && p.status !== 'delivered') return false;

      if (!q) return true;
      const courier = state.couriers.find((c) => c.id === p.courierId);
      return (
        p.trackingCode.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.destinationAddress.toLowerCase().includes(q) ||
        (courier && courier.name.toLowerCase().includes(q))
      );
    });
  }, [state.parcels, state.couriers, parcelFilter, searchQuery]);

  const selectedParcel =
    state.parcels.find((p) => p.id === selectedParcelId) ??
    filteredParcels[0] ??
    state.parcels[0] ??
    null;

  const unreadAlertsCount = state.notifications.filter((n) => !n.read).length;
  const activeCount = state.parcels.filter((p) => p.status !== 'delivered').length;
  const delayedCount = state.parcels.filter((p) => p.status === 'delayed').length;
  const openTaskCount = state.tasks.filter((t) => !t.completed).length;

  const avgEtaMinutes = useMemo(() => {
    const active = state.parcels.filter(
      (p) => p.status !== 'delivered' && p.etaSeconds > 0
    );
    if (active.length === 0) return 0;
    const total = active.reduce((acc, p) => acc + p.etaSeconds, 0);
    return Math.round(total / active.length / 60);
  }, [state.parcels]);

  if (!configReady) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center text-sm text-[#6F4E37]">
        Initializing dispatch workspace...
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      libraries={['places', 'routes', 'marker']}
      language="en"
      region="US"
    >
      <div className="min-h-screen flex flex-col bg-[#FFF9F0] text-[#3B2A1F]">
        {/* Case A Required Quota Banner */}
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Header: Public pages show ONLY Company Name + Track Parcel; Admin Portal (/admin) hosts operational navigation separately */}
        {!isAdminPortal ? (
          <header className="sticky top-0 z-40 h-14 bg-[#EDE3D4]/95 backdrop-blur-sm border-b border-[#D4B996] px-4 sm:px-6 flex items-center justify-between gap-6">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateToTab('home', false);
              }}
              className="text-lg font-bold tracking-tight text-[#3B2A1F] whitespace-nowrap shrink-0"
            >
              Camber Dispatch
            </a>

            <button
              type="button"
              onClick={handleTrackParcelAction}
              className="text-sm font-medium text-[#3B2A1F] hover:text-[#6F4E37] transition-colors whitespace-nowrap shrink-0"
            >
              Track Parcel
            </button>
          </header>
        ) : (
          <header className="sticky top-0 z-40 h-14 bg-[#EDE3D4]/95 backdrop-blur-sm border-b border-[#D4B996] px-4 sm:px-6 flex items-center justify-between gap-8">
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                navigateToTab('admin', true);
              }}
              className="text-lg font-bold tracking-tight text-[#3B2A1F] whitespace-nowrap shrink-0"
            >
              Camber Dispatch
            </a>

            <nav
              aria-label="Admin portal navigation"
              className="hidden md:flex items-center gap-6 text-sm font-medium"
            >
              <button
                type="button"
                onClick={() => navigateToTab('admin', true)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  activeTab === 'admin'
                    ? 'text-[#3B2A1F] border-[#6F4E37]'
                    : 'text-[#6F4E37] border-transparent hover:text-[#3B2A1F]'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => navigateToTab('dispatch', true)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  activeTab === 'dispatch'
                    ? 'text-[#3B2A1F] border-[#6F4E37]'
                    : 'text-[#6F4E37] border-transparent hover:text-[#3B2A1F]'
                }`}
              >
                Dispatch
              </button>
              <button
                type="button"
                onClick={() => navigateToTab('courier', true)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  activeTab === 'courier'
                    ? 'text-[#3B2A1F] border-[#6F4E37]'
                    : 'text-[#6F4E37] border-transparent hover:text-[#3B2A1F]'
                }`}
              >
                Courier GPS
              </button>
              <button
                type="button"
                onClick={() => navigateToTab('customer', true)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  activeTab === 'customer'
                    ? 'text-[#3B2A1F] border-[#6F4E37]'
                    : 'text-[#6F4E37] border-transparent hover:text-[#3B2A1F]'
                }`}
              >
                Customer Tracker
              </button>
              <button
                type="button"
                onClick={() => setIsAlertsOpen(true)}
                className="whitespace-nowrap shrink-0 pb-0.5 text-[#6F4E37] hover:text-[#3B2A1F] transition-colors inline-flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Alerts</span>
                {unreadAlertsCount > 0 && (
                  <span className="font-mono text-xs font-semibold text-[#3B2A1F] tabular-nums">
                    ({unreadAlertsCount})
                  </span>
                )}
              </button>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToTab('home', false);
                }}
                className="whitespace-nowrap shrink-0 pb-0.5 text-[#6F4E37] hover:text-[#3B2A1F] transition-colors"
              >
                Track Parcel
              </a>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAlertsOpen(true)}
                className="md:hidden relative p-2 rounded-lg text-[#3B2A1F] hover:bg-[#D4B996]/40 min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Open alerts"
              >
                <Bell className="w-4 h-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute top-1 right-1 font-mono text-[10px] font-bold text-[#B91C1C]">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Delivery</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMobileNavOpen((v) => !v)}
                className="md:hidden p-2 rounded-lg text-[#3B2A1F] hover:bg-[#D4B996]/40 min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Toggle admin navigation menu"
              >
                {isMobileNavOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </header>
        )}

        {/* Admin Mobile Navigation Drawer */}
        {isAdminPortal && isMobileNavOpen && (
          <div className="md:hidden bg-[#EDE3D4] border-b border-[#D4B996] px-4 py-3 flex flex-col gap-2">
            {(
              [
                ['admin', 'Admin Dashboard'],
                ['dispatch', 'Dispatch Board'],
                ['courier', 'Courier GPS'],
                ['customer', 'Customer Tracker'],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  navigateToTab(tab, true);
                  setIsMobileNavOpen(false);
                }}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${
                  activeTab === tab
                    ? 'bg-[#3B2A1F] text-[#FFF9F0]'
                    : 'text-[#3B2A1F] hover:bg-[#D4B996]/40'
                }`}
              >
                {label}
              </button>
            ))}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateToTab('home', false);
                setIsMobileNavOpen(false);
              }}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-[#6F4E37] hover:bg-[#D4B996]/40"
            >
              Track Parcel (Public Site)
            </a>
          </div>
        )}

        {/* Real-time WebSocket Toast Notification */}
        {liveToast && (
          <div
            role="status"
            className="fixed bottom-4 right-4 z-50 max-w-sm bg-[#3B2A1F] text-[#FFF9F0] border border-[#B08968] rounded-xl px-4 py-3 shadow-lg flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#D4B996]">
                <span className="font-mono font-semibold">
                  {liveToast.trackingCode}
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatClockTime(liveToast.createdAt)}</span>
              </div>
              <p className="text-sm font-semibold mt-0.5">{liveToast.title}</p>
              <p className="text-xs text-[#EDE3D4] mt-0.5 line-clamp-2">
                {liveToast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="p-1 text-[#D4B996] hover:text-[#FFF9F0]"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Workspace Container */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-sm text-[#B91C1C]">
              Dispatch server connection issue: {error}
            </div>
          )}

          {/* Show Operational Summary KPI Strip Inside Admin Portal */}
          {isAdminPortal && (
            <section
              aria-label="Operational summary"
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div className="p-4 rounded-xl bg-[#EDE3D4]/65 border border-[#D4B996]">
                <div className="text-xs font-medium text-[#6F4E37]">
                  Active Deliveries
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-[#3B2A1F] tabular-nums">
                    {activeCount}
                  </span>
                  <span className="text-xs text-[#6F4E37] tabular-nums">
                    {delayedCount > 0 ? `${delayedCount} delayed` : 'On schedule'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#EDE3D4]/65 border border-[#D4B996]">
                <div className="text-xs font-medium text-[#6F4E37]">
                  Average Route ETA
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-[#3B2A1F] tabular-nums">
                    {avgEtaMinutes}m
                  </span>
                  <span className="text-xs text-[#6F4E37]">Live traffic</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#EDE3D4]/65 border border-[#D4B996]">
                <div className="text-xs font-medium text-[#6F4E37]">
                  Open Dispatch Tasks
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-[#3B2A1F] tabular-nums">
                    {openTaskCount}
                  </span>
                  <span className="text-xs text-[#6F4E37] tabular-nums">
                    {state.tasks.length} total
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#EDE3D4]/65 border border-[#D4B996]">
                <div className="text-xs font-medium text-[#6F4E37]">
                  Live Telemetry Sync
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-[#3B2A1F] tabular-nums">
                    {
                      state.couriers.filter(
                        (c) => c.status !== 'available' || c.liveStreamActive
                      ).length
                    }
                    /{state.couriers.length}
                  </span>
                  <span className="text-xs text-[#6F4E37] capitalize">
                    {connectionStatus}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Primary Views */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 h-[540px] rounded-xl bg-[#EDE3D4]/60 border border-[#D4B996] animate-pulse" />
              <div className="lg:col-span-7 h-[540px] rounded-xl bg-[#EDE3D4]/60 border border-[#D4B996] animate-pulse" />
            </div>
          ) : !isAdminPortal && activeTab === 'home' ? (
            <LandingView
              parcels={state.parcels}
              couriers={state.couriers}
              selectedParcelId={selectedParcel?.id ?? null}
              onSelectParcel={(id) => setSelectedParcelId(id)}
              onRouteComputed={(parcelId, routeData) => {
                void syncParcelRoute(parcelId, routeData);
              }}
              pushPrefs={pushPrefs}
              onEnablePushForParcel={(code) => handleToggleDevicePush(code)}
              onTriggerSamplePush={async (parcelId, evt) => {
                await triggerTestPushAlert(parcelId, evt);
              }}
              onOpenFullTracker={() => navigateToTab('customer', false)}
            />
          ) : activeTab === 'dispatch' ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Parcel Queue + Task Controls */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="rounded-xl border border-[#D4B996] bg-[#FFF9F0] overflow-hidden">
                    <div className="p-4 bg-[#EDE3D4]/65 border-b border-[#D4B996] space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#B08968] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search tracking code, customer, address, courier..."
                          className="w-full pl-9 pr-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
                        />
                      </div>

                      <div className="flex items-center gap-1 p-1 bg-[#EDE3D4] rounded-lg overflow-x-auto">
                        {(
                          [
                            ['all', 'All'],
                            ['active', 'Active'],
                            ['out_for_delivery', 'Arriving'],
                            ['delayed', 'Delayed'],
                            ['delivered', 'Delivered'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setParcelFilter(value)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                              parcelFilter === value
                                ? 'bg-[#FFF9F0] text-[#3B2A1F] shadow-sm'
                                : 'text-[#6F4E37] hover:text-[#3B2A1F]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-[#EDE3D4] max-h-[360px] overflow-y-auto">
                      {filteredParcels.length === 0 ? (
                        <div className="p-8 text-center">
                          <Package className="w-7 h-7 text-[#B08968] mx-auto mb-2" />
                          <p className="text-sm font-medium text-[#3B2A1F]">
                            No deliveries match your filter
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setParcelFilter('all');
                              setSearchQuery('');
                            }}
                            className="mt-2 text-xs font-medium text-[#6F4E37] underline"
                          >
                            Reset filters
                          </button>
                        </div>
                      ) : (
                        filteredParcels.map((parcel) => {
                          const isSelected = selectedParcel?.id === parcel.id;
                          const courier = state.couriers.find(
                            (c) => c.id === parcel.courierId
                          );
                          return (
                            <button
                              key={parcel.id}
                              type="button"
                              onClick={() => setSelectedParcelId(parcel.id)}
                              className={`w-full text-left px-4 py-3.5 transition-colors flex items-start justify-between gap-3 ${
                                isSelected
                                  ? 'bg-[#EDE3D4]/85'
                                  : 'bg-[#FFF9F0] hover:bg-[#EDE3D4]/40'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs text-[#6F4E37]">
                                  <span className="font-mono font-semibold text-[#3B2A1F]">
                                    {parcel.trackingCode}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatPriorityLabel(parcel.priority)}</span>
                                  {courier && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="truncate">{courier.name}</span>
                                    </>
                                  )}
                                </div>
                                <div className="text-sm font-semibold text-[#3B2A1F] truncate mt-0.5">
                                  {parcel.customerName}
                                </div>
                                <div className="text-xs text-[#6F4E37] truncate mt-0.5">
                                  {parcel.destinationAddress}
                                </div>
                              </div>

                              <div className="text-right shrink-0 space-y-1">
                                <StatusLabel status={parcel.status} />
                                <div className="font-mono text-xs text-[#6F4E37] tabular-nums">
                                  {formatEtaText(parcel.etaSeconds, parcel.status)} ·{' '}
                                  {formatDistanceKm(parcel.distanceMeters)}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {selectedParcel && (
                    <SelectedParcelOperations
                      parcel={selectedParcel}
                      couriers={state.couriers}
                      tasks={state.tasks}
                      onUpdateParcel={async (id, updates) => {
                        await updateParcel(id, updates);
                      }}
                      onDeleteParcel={async (id) => {
                        await deleteParcel(id);
                        setSelectedParcelId(null);
                      }}
                      onSendTelemetry={sendCourierTelemetry}
                      onCreateTask={createTask}
                      onToggleTask={toggleTask}
                    />
                  )}
                </div>

                {/* Right Column: Live Interactive Map */}
                <div className="lg:col-span-7 flex flex-col gap-3 lg:sticky lg:top-20">
                  <CourierMapPanel
                    parcels={state.parcels}
                    couriers={state.couriers}
                    selectedParcelId={selectedParcel?.id ?? null}
                    onSelectParcel={(id) => setSelectedParcelId(id)}
                    onRouteComputed={(parcelId, routeData) => {
                      void syncParcelRoute(parcelId, routeData);
                    }}
                    className="h-[460px] lg:h-[640px]"
                  />
                </div>
              </div>

              {/* Integrated Master Task Queue & Fleet Roster below the split */}
              <FleetAndTasksView
                parcels={state.parcels}
                couriers={state.couriers}
                tasks={state.tasks}
                onToggleTask={toggleTask}
                onSendTelemetry={sendCourierTelemetry}
                onSelectParcelOnMap={(parcelId) => {
                  setSelectedParcelId(parcelId);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          ) : activeTab === 'customer' ? (
            <CustomerTrackerView
              parcels={state.parcels}
              couriers={state.couriers}
              selectedParcelId={selectedParcel?.id ?? null}
              onSelectParcel={(id) => setSelectedParcelId(id)}
              onRouteComputed={(parcelId, routeData) => {
                void syncParcelRoute(parcelId, routeData);
              }}
              pushPrefs={pushPrefs}
              onUpdatePushPrefs={setPushPrefs}
              onToggleDevicePush={() => handleToggleDevicePush()}
              onTriggerSamplePush={async (parcelId, evt) => {
                await triggerTestPushAlert(parcelId, evt);
              }}
            />
          ) : activeTab === 'admin' ? (
            <AdminDashboardView
              parcels={state.parcels}
              couriers={state.couriers}
              tasks={state.tasks}
              onCreateCourier={createCourier}
              onDeleteCourier={deleteCourier}
              onAssignParcelCourier={async (parcelId, courierId) => {
                await updateParcel(parcelId, { courierId });
              }}
              onUpdateParcelStatus={async (parcelId, status) => {
                await updateParcel(parcelId, { status });
              }}
              onTriggerPushAlert={triggerTestPushAlert}
              onInspectParcel={(parcelId) => {
                setSelectedParcelId(parcelId);
                navigateToTab('dispatch', true);
              }}
              onOpenNewDelivery={() => setIsNewModalOpen(true)}
            />
          ) : (
            <CourierDeviceView
              couriers={state.couriers}
              parcels={state.parcels}
              onSendTelemetry={sendCourierTelemetry}
              onRouteComputed={(parcelId, routeData) => {
                void syncParcelRoute(parcelId, routeData);
              }}
            />
          )}
        </main>

        {/* Footer: Public pages show ONLY Company Name + Track Parcel; Admin Portal (/admin) hosts operational links separately */}
        {!isAdminPortal ? (
          <footer className="border-t border-[#D4B996] bg-[#EDE3D4]/40 px-4 sm:px-6 py-5">
            <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 text-xs text-[#3B2A1F]">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToTab('home', false);
                }}
                className="font-bold tracking-tight text-sm text-[#3B2A1F] whitespace-nowrap"
              >
                Camber Dispatch
              </a>
              <button
                type="button"
                onClick={handleTrackParcelAction}
                className="font-medium text-[#6F4E37] hover:text-[#3B2A1F] transition-colors whitespace-nowrap"
              >
                Track Parcel
              </button>
            </div>
          </footer>
        ) : (
          <footer className="border-t border-[#D4B996] bg-[#EDE3D4]/55 px-4 sm:px-6 py-5">
            <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#6F4E37]">
              <div>
                <span className="font-bold text-[#3B2A1F]">Camber Dispatch</span>
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                <span>Admin Portal</span>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => navigateToTab('admin', true)}
                  className="hover:text-[#3B2A1F] transition-colors"
                >
                  Admin Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => navigateToTab('dispatch', true)}
                  className="hover:text-[#3B2A1F] transition-colors"
                >
                  Dispatch Board
                </button>
                <button
                  type="button"
                  onClick={() => navigateToTab('courier', true)}
                  className="hover:text-[#3B2A1F] transition-colors"
                >
                  Courier Geolocation
                </button>
                <button
                  type="button"
                  onClick={() => navigateToTab('customer', true)}
                  className="hover:text-[#3B2A1F] transition-colors"
                >
                  Customer Tracker
                </button>
                <button
                  type="button"
                  onClick={() => setIsAlertsOpen(true)}
                  className="hover:text-[#3B2A1F] transition-colors"
                >
                  Alerts ({unreadAlertsCount})
                </button>
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToTab('home', false);
                  }}
                  className="font-medium text-[#3B2A1F] hover:text-[#6F4E37] transition-colors"
                >
                  Track Parcel
                </a>
              </div>
            </div>
          </footer>
        )}

        {/* Modals & Drawers */}
        <NewDeliveryModal
          isOpen={isNewModalOpen}
          couriers={state.couriers}
          onClose={() => setIsNewModalOpen(false)}
          onCreate={async (payload) => {
            const created = await createParcel(payload);
            setSelectedParcelId(created.id);
          }}
        />

        <NotificationDrawer
          isOpen={isAlertsOpen}
          notifications={state.notifications}
          onClose={() => setIsAlertsOpen(false)}
          onMarkRead={(id) => void markNotificationRead(id)}
          onMarkAllRead={() => void markAllNotificationsRead()}
          onInspectParcel={(parcelId) => {
            setSelectedParcelId(parcelId);
            navigateToTab('customer', true);
          }}
        />
      </div>
    </APIProvider>
  );
}
