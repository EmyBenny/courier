import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Menu,
  Pause,
  Play,
  Search,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import AdminPortalPage, { type AdminCourier } from './components/AdminPortalPage';
import TrackParcelPage from './components/TrackParcelPage';
import {
  extractWaybillCode,
  INITIAL_PARCELS,
  type TrackableParcel,
} from './data/shipments';

const PARCELS_STORAGE_KEY = 'gc_parcels_v2';
const COURIERS_STORAGE_KEY = 'gc_couriers_v1';

const INITIAL_COURIERS: AdminCourier[] = [
  { id: 'cr-1', name: 'Marcus Vance', hub: 'New York JFK (JFK)', routeCode: 'NY-14' },
  { id: 'cr-2', name: 'Elena Rostova', hub: 'Singapore Changi (SIN)', routeCode: 'SIN-04' },
  { id: 'cr-3', name: 'Daniel Okafor', hub: 'Zurich / Toronto (YYZ)', routeCode: 'YYZ-09' },
];

type RegionKey = 'europe' | 'americas' | 'apac' | 'mena';

interface FilmChapter {
  id: string;
  index: string;
  title: string;
  location: string;
  timestampSec: number;
  summary: string;
}

interface CorridorRegion {
  key: RegionKey;
  label: string;
  primaryHubs: string;
  transitWindow: string;
  customsClearance: string;
  description: string;
  lanes: { route: string; cadence: string; transit: string }[];
}


const FILM_CHAPTERS: FilmChapter[] = [
  {
    id: 'tarmac',
    index: '01',
    title: 'Widebody Air Uplift',
    location: 'Frankfurt & London Heathrow Hubs',
    timestampSec: 0,
    summary:
      'Dedicated night-freighter capacity moves palletized air containers and priority satchels across major intercontinental runways without commercial passenger holds.',
  },
  {
    id: 'sorting',
    index: '02',
    title: 'Automated Hub & Customs Pre-Clearance',
    location: 'Zurich & Singapore Bonded Terminals',
    timestampSec: 3.6,
    summary:
      'Every parcel is scanned, weighed, and cleared against Harmonized System tariffs digitally while still in transit—eliminating border bottlenecks before wheels touch down.',
  },
  {
    id: 'corridor',
    index: '03',
    title: 'Intermodal Sea-Air Consolidation',
    location: 'Rotterdam, Hong Kong & Jebel Ali',
    timestampSec: 7.0,
    summary:
      'High-volume commercial freight transitions cleanly between ocean terminals and express tarmac corridors for balanced speed and unit cost worldwide.',
  },
  {
    id: 'handoff',
    index: '04',
    title: 'Verified Doorstep Handoff',
    location: '195+ Countries & Territories',
    timestampSec: 10.4,
    summary:
      'Uniformed local couriers complete chain-of-custody delivery directly to studio desks, laboratories, diplomatic offices, and regional distribution centers.',
  },
];

const CORRIDOR_REGIONS: Record<RegionKey, CorridorRegion> = {
  europe: {
    key: 'europe',
    label: 'Europe & UK',
    primaryHubs: 'London Heathrow · Frankfurt · Zurich · Paris CDG',
    transitWindow: '24–36 Hours',
    customsClearance: 'Pre-cleared electronic T1/AES filing',
    description:
      'Overnight intra-European air shuttles paired with same-morning bonded customs brokerage connecting UK, EU, and Nordic commercial centers.',
    lanes: [
      { route: 'London → Zurich / Frankfurt', cadence: '3x Daily Flights', transit: 'Next Morning' },
      { route: 'Frankfurt → New York JFK', cadence: 'Daily Night Freighter', transit: '24 Hours' },
      { route: 'Paris → Singapore Changi', cadence: 'Daily Widebody', transit: '36 Hours' },
    ],
  },
  americas: {
    key: 'americas',
    label: 'North & South America',
    primaryHubs: 'New York JFK · Miami · Chicago · Sao Paulo',
    transitWindow: '24–48 Hours',
    customsClearance: 'Automated CBP & Mercosur brokerage',
    description:
      'Direct transatlantic and pan-American air freight links engineered for aerospace spares, legal filings, and high-value commercial hardware.',
    lanes: [
      { route: 'New York → London Heathrow', cadence: '2x Daily Air Uplift', transit: '24 Hours' },
      { route: 'Miami → Sao Paulo / Santiago', cadence: 'Daily Priority Cargo', transit: '36–48 Hours' },
      { route: 'Chicago → Tokyo Haneda', cadence: 'Daily Transpacific', transit: '42 Hours' },
    ],
  },
  apac: {
    key: 'apac',
    label: 'Asia-Pacific',
    primaryHubs: 'Singapore · Hong Kong · Tokyo · Sydney',
    transitWindow: '24–48 Hours',
    customsClearance: 'Single-window ASEAN & APAC e-manifest',
    description:
      'Precision electronics, biotech specimens, and apparel prototypes cleared rapidly across East and Southeast Asia with climate-stabilized holds.',
    lanes: [
      { route: 'Singapore → London / Frankfurt', cadence: 'Daily Express', transit: '36 Hours' },
      { route: 'Hong Kong → Los Angeles LAX', cadence: 'Daily Transpacific', transit: '38 Hours' },
      { route: 'Tokyo → Sydney Kingsford Smith', cadence: 'Daily Corridor', transit: '24–30 Hours' },
    ],
  },
  mena: {
    key: 'mena',
    label: 'Middle East & Africa',
    primaryHubs: 'Dubai Jebel Ali · Doha · Nairobi · Johannesburg',
    transitWindow: '36–72 Hours',
    customsClearance: 'Bonded free-zone & port clearance',
    description:
      'Strategic East–West bridge corridors linking Gulf free-zone hubs directly with East, West, and Southern African capital cities.',
    lanes: [
      { route: 'Dubai → Johannesburg / Nairobi', cadence: 'Daily Air Shuttle', transit: '36 Hours' },
      { route: 'Frankfurt → Dubai / Riyadh', cadence: 'Daily Freighter', transit: '24–30 Hours' },
      { route: 'London → Lagos / Accra', cadence: '5x Weekly Priority', transit: '48 Hours' },
    ],
  },
};

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [activeChapterId, setActiveChapterId] = useState<string>('tarmac');
  const [activeRegion, setActiveRegion] = useState<RegionKey>('europe');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [hubImgFailed, setHubImgFailed] = useState(false);
  const [handoffImgFailed, setHandoffImgFailed] = useState(false);
  const [corridorImgFailed, setCorridorImgFailed] = useState(false);

  const getInitialRoute = (): { page: 'home' | 'track' | 'admin'; code?: string } => {
    if (typeof window === 'undefined') return { page: 'home' };
    if (window.location.pathname.startsWith('/admin')) {
      return { page: 'admin' };
    }
    const isTrack = window.location.pathname.startsWith('/track');
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') ?? undefined;
    return { page: isTrack ? 'track' : 'home', code };
  };

  const initialRoute = getInitialRoute();
  const [currentPage, setCurrentPage] = useState<'home' | 'track' | 'admin'>(initialRoute.page);
  const [trackQueryCode, setTrackQueryCode] = useState<string | undefined>(initialRoute.code);
  const [quickWaybill, setQuickWaybill] = useState('');
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const [parcels, setParcels] = useState<TrackableParcel[]>(() => {
    if (typeof window === 'undefined') return INITIAL_PARCELS;
    try {
      const saved = window.localStorage.getItem(PARCELS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TrackableParcel[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to default 3 parcels
    }
    return INITIAL_PARCELS;
  });

  const [couriers, setCouriers] = useState<AdminCourier[]>(() => {
    if (typeof window === 'undefined') return INITIAL_COURIERS;
    try {
      const saved = window.localStorage.getItem(COURIERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AdminCourier[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
    return INITIAL_COURIERS;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(PARCELS_STORAGE_KEY, JSON.stringify(parcels));
    } catch {
      // Ignore storage failures
    }
  }, [parcels]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COURIERS_STORAGE_KEY, JSON.stringify(couriers));
    } catch {
      // Ignore storage failures
    }
  }, [couriers]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/admin')) {
        setCurrentPage('admin');
        setTrackQueryCode(undefined);
        return;
      }
      const isTrack = window.location.pathname.startsWith('/track');
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code') ?? undefined;
      setCurrentPage(isTrack ? 'track' : 'home');
      setTrackQueryCode(code);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PARCELS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as TrackableParcel[];
          if (Array.isArray(parsed)) setParcels(parsed);
        } catch {
          // Ignore malformed storage updates
        }
      }
      if (e.key === COURIERS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as AdminCourier[];
          if (Array.isArray(parsed)) setCouriers(parsed);
        } catch {
          // Ignore malformed storage updates
        }
      }
    };
    const handleQuota = () => setMapsQuotaExceeded(true);

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
    };
  }, []);

  const navigateToTrack = (code?: string) => {
    const cleaned = code ? extractWaybillCode(code) : undefined;
    const targetUrl = cleaned ? `/track?code=${encodeURIComponent(cleaned)}` : '/track';
    window.history.pushState({}, '', targetUrl);
    setCurrentPage('track');
    setTrackQueryCode(cleaned);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const syncTrackUrl = (code?: string) => {
    const cleaned = code ? extractWaybillCode(code) : undefined;
    const targetUrl = cleaned ? `/track?code=${encodeURIComponent(cleaned)}` : '/track';
    window.history.replaceState({}, '', targetUrl);
    setTrackQueryCode(cleaned);
  };

  const handleUpdateParcel = (
    waybill: string,
    updater: (prev: TrackableParcel) => TrackableParcel
  ) => {
    setParcels((prev) => prev.map((p) => (p.waybill === waybill ? updater(p) : p)));
  };

  const handleAddParcel = (parcel: TrackableParcel) => {
    setParcels((prev) => [parcel, ...prev.filter((p) => p.waybill !== parcel.waybill)]);
  };

  const handleDeleteParcel = (waybill: string) => {
    setParcels((prev) => prev.filter((p) => p.waybill !== waybill));
  };

  const handleResetParcels = () => {
    setParcels(INITIAL_PARCELS);
  };

  const handleAddCourier = (courier: AdminCourier) => {
    setCouriers((prev) => [...prev, courier]);
  };

  const handleRemoveCourier = (id: string) => {
    setCouriers((prev) => prev.filter((c) => c.id !== id));
  };

  const navigateToHome = (sectionId?: string) => {
    const targetHash = sectionId ? `/#${sectionId}` : '/';
    if (currentPage !== 'home') {
      window.history.pushState({}, '', targetHash);
      setCurrentPage('home');
      setMobileMenuOpen(false);
      window.setTimeout(() => {
        if (sectionId) {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 60);
    } else {
      setMobileMenuOpen(false);
      if (sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  // Quote & contact inquiry form state
  const [originCountry, setOriginCountry] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [serviceTier, setServiceTier] = useState('Air Express Priority (24–48h)');
  const [weightKg, setWeightKg] = useState('12');
  const [contactEmail, setContactEmail] = useState('');
  const [shipmentNotes, setShipmentNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [quoteConfirmation, setQuoteConfirmation] = useState<{
    reference: string;
    route: string;
    tier: string;
    email: string;
  } | null>(null);

  const handleTogglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      void vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const handleToggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  const handleSelectChapter = (chapter: FilmChapter) => {
    setActiveChapterId(chapter.id);
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = chapter.timestampSec;
    if (vid.paused) {
      void vid.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime;
    if (t >= 10.0) {
      setActiveChapterId('handoff');
    } else if (t >= 6.6) {
      setActiveChapterId('corridor');
    } else if (t >= 3.2) {
      setActiveChapterId('sorting');
    } else {
      setActiveChapterId('tarmac');
    }
  };

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const o = originCountry.trim();
    const d = destinationCountry.trim();
    const em = contactEmail.trim();
    const w = Number(weightKg);

    if (!o || !d) {
      setFormError('Please specify both origin and destination countries or cities.');
      return;
    }
    if (!Number.isFinite(w) || w <= 0) {
      setFormError('Please enter a valid shipment weight in kilograms.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setFormError('Please enter a valid business email address for your rate card.');
      return;
    }

    setFormError(null);
    const refCode = `GLC-${Math.floor(100000 + Math.random() * 899999)}`;
    setQuoteConfirmation({
      reference: refCode,
      route: `${o} → ${d} (${w} kg)`,
      tier: serviceTier,
      email: em,
    });
  };

  const handleQuickTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = extractWaybillCode(quickWaybill);
    navigateToTrack(cleaned || undefined);
  };

  const handleQuickTrackPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    const cleaned = extractWaybillCode(pasted);
    if (cleaned) {
      e.preventDefault();
      setQuickWaybill(cleaned);
      navigateToTrack(cleaned);
    }
  };

  if (currentPage === 'admin') {
    return (
      <AdminPortalPage
        parcels={parcels}
        couriers={couriers}
        onUpdateParcel={handleUpdateParcel}
        onAddParcel={handleAddParcel}
        onDeleteParcel={handleDeleteParcel}
        onResetParcels={handleResetParcels}
        onAddCourier={handleAddCourier}
        onRemoveCourier={handleRemoveCourier}
      />
    );
  }

  const currentRegion = CORRIDOR_REGIONS[activeRegion];

  return (
    <div className="min-h-screen bg-[#474150] text-[#F5FFF4] flex flex-col">
      {mapsQuotaExceeded && (
        <div className="bg-[#FFBB00] border-b border-[#474150]/20 text-[#474150] px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 font-medium">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold text-[#474150]"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      {/* Top Bar Contract: 1-row, 3-zone header separated by gap-8 */}
      <header className="sticky top-0 z-40 h-16 bg-[#36313E]/95 backdrop-blur-md border-b border-[#9C99B8]/25 px-4 sm:px-8 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigateToHome();
          }}
          className="text-lg font-bold tracking-tight text-[#F5FFF4] whitespace-nowrap shrink-0"
        >
          Global Courier
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#9C99B8]"
        >
          <a
            href="/#about"
            onClick={(e) => {
              e.preventDefault();
              navigateToHome('about');
            }}
            className="hover:text-[#F5FFF4] transition-colors whitespace-nowrap shrink-0"
          >
            About Us
          </a>
          <a
            href="/#services"
            onClick={(e) => {
              e.preventDefault();
              navigateToHome('services');
            }}
            className="hover:text-[#F5FFF4] transition-colors whitespace-nowrap shrink-0"
          >
            Services
          </a>
          <a
            href="/#network"
            onClick={(e) => {
              e.preventDefault();
              navigateToHome('network');
            }}
            className="hover:text-[#F5FFF4] transition-colors whitespace-nowrap shrink-0"
          >
            Global Network
          </a>
          <a
            href="/track"
            onClick={(e) => {
              e.preventDefault();
              navigateToTrack(trackQueryCode);
            }}
            aria-current={currentPage === 'track' ? 'page' : undefined}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              currentPage === 'track'
                ? 'text-[#FFBB00] underline decoration-[#FFBB00] underline-offset-4'
                : 'hover:text-[#F5FFF4]'
            }`}
          >
            Track Parcel
          </a>
          <a
            href="/#contact"
            onClick={(e) => {
              e.preventDefault();
              navigateToHome('contact');
            }}
            className="hover:text-[#F5FFF4] transition-colors whitespace-nowrap shrink-0"
          >
            Contact Us
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/#quote"
            onClick={(e) => {
              e.preventDefault();
              navigateToHome('quote');
            }}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-[#FFBB00] text-[#474150] hover:bg-[#F5FFF4] transition-colors whitespace-nowrap shrink-0"
          >
            Request Quote
          </a>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg text-[#F5FFF4] hover:bg-[#474150] min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#36313E] border-b border-[#9C99B8]/30 px-4 py-3 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => navigateToHome('about')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#F5FFF4] hover:bg-[#474150] transition-colors"
          >
            About Us
          </button>
          <button
            type="button"
            onClick={() => navigateToHome('services')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#F5FFF4] hover:bg-[#474150] transition-colors"
          >
            Services
          </button>
          <button
            type="button"
            onClick={() => navigateToHome('network')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#F5FFF4] hover:bg-[#474150] transition-colors"
          >
            Global Network
          </button>
          <button
            type="button"
            onClick={() => navigateToTrack(trackQueryCode)}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#FFBB00] hover:bg-[#474150] transition-colors"
          >
            Track Parcel
          </button>
          <button
            type="button"
            onClick={() => navigateToHome('contact')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#F5FFF4] hover:bg-[#474150] transition-colors"
          >
            Contact Us
          </button>
          <button
            type="button"
            onClick={() => navigateToHome('quote')}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#474150] bg-[#FFBB00] hover:bg-[#F5FFF4] transition-colors mt-1"
          >
            Request Quote
          </button>
        </div>
      )}

      {currentPage === 'track' ? (
        <TrackParcelPage
          parcels={parcels}
          initialCode={trackQueryCode}
          onNavigateHome={navigateToHome}
          onSyncWaybillUrl={syncTrackUrl}
        />
      ) : (
        /* Main Editorial Content */
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-20">
        {/* 1. HERO / PROPOSITION */}
        <section id="overview" className="space-y-8 scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left Copy Column */}
            <div className="lg:col-span-6 flex flex-col justify-between py-1 space-y-6">
              <div className="space-y-5">
                <p className="text-xs font-medium tracking-wide text-[#FFBB00]">
                  International Express Courier · 195+ Countries &amp; Territories
                </p>
                <h1
                  className="font-bold tracking-tight text-[#F5FFF4] leading-[1.07]"
                  style={{
                    fontSize: 'clamp(2.25rem, 4vw, 3.6rem)',
                    textWrap: 'balance',
                  }}
                >
                  Express cargo across every border, delivered door to door.
                </h1>
                <p className="text-base text-[#F5FFF4]/85 leading-relaxed max-w-xl tracking-[0.005em]">
                  Global Courier operates dedicated widebody air corridors, bonded
                  customs terminals, and final-mile courier fleets connecting commercial
                  capitals across Europe, the Americas, Asia-Pacific, the Middle East,
                  and Africa. From time-critical legal dossiers to multi-pallet hardware
                  freight, every consignment moves on verified schedules with direct
                  chain-of-custody accountability.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-2">
                <a
                  href="#quote"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg bg-[#FFBB00] text-[#474150] hover:bg-[#F5FFF4] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Request International Quote</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#film"
                  className="text-sm font-medium text-[#F5FFF4] underline decoration-[#9C99B8] underline-offset-4 hover:text-[#FFBB00] hover:decoration-[#FFBB00] transition-colors whitespace-nowrap shrink-0"
                >
                  Watch Worldwide Film
                </a>
              </div>
            </div>

            {/* Right Dominant Hero Visual */}
            <div className="lg:col-span-6 relative rounded-xl overflow-hidden border border-[#9C99B8]/35 bg-[#36313E] min-h-[300px] lg:min-h-[440px]">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_global_air_courier_1795093406333.jpg"
                  alt="Global Courier widebody international air freighter and express dispatch vehicles staged on airport tarmac"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover lg:h-full"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#36313E]">
                  <Globe className="w-10 h-10 text-[#FFBB00] mb-3" />
                  <p className="text-sm font-semibold text-[#F5FFF4]">
                    Global Air Express &amp; Intercontinental Fleet
                  </p>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 bg-gradient-to-t from-[#36313E]/95 via-[#36313E]/65 to-transparent">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#F5FFF4]">
                  <span>Dedicated Air Fleet · Nightly Intercontinental Uplift</span>
                  <span className="font-mono font-semibold text-[#FFBB00] tabular-nums">
                    LHR · FRA · SIN · JFK · DXB
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Quantitative Proof Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#9C99B8]/25 rounded-xl bg-[#36313E] border border-[#9C99B8]/30 overflow-hidden">
            {[
              { value: '195+', label: 'Countries & Territories Served' },
              { value: '24–48h', label: 'Major Global Hub Transit' },
              { value: '99.4%', label: 'First-Pass Customs Clearance' },
              { value: '6 Hubs', label: 'Bonded Intercontinental Gateways' },
            ].map((item) => (
              <div key={item.label} className="p-5 sm:p-6">
                <div className="font-mono text-2xl sm:text-3xl font-bold text-[#FFBB00] tabular-nums">
                  {item.value}
                </div>
                <div className="text-xs sm:text-sm text-[#9C99B8] mt-1">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPACT WAYBILL LAUNCHER TO DEDICATED /track PAGE */}
        <section
          aria-label="Quick parcel tracking"
          className="rounded-xl bg-[#36313E] border border-[#9C99B8]/30 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        >
          <div className="space-y-1.5 max-w-xl">
            <p className="text-xs font-medium text-[#FFBB00]">
              Dedicated Tracking Portal
            </p>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5FFF4]">
              Paste your waybill code to open full parcel details, map &amp; history.
            </h2>
            <p className="text-xs sm:text-sm text-[#9C99B8]">
              View live shipment position, turn-by-turn delivery directions, customs status,
              and complete custody records.
            </p>
          </div>

          <form onSubmit={handleQuickTrackSubmit} className="flex flex-col sm:flex-row gap-2.5 lg:w-[460px] shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9C99B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={quickWaybill}
                onChange={(e) => setQuickWaybill(e.target.value)}
                onPaste={handleQuickTrackPaste}
                placeholder="Paste tracking code"
                aria-label="Quick parcel waybill lookup"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono rounded-lg bg-[#474150] border border-[#9C99B8]/45 text-[#F5FFF4] placeholder:text-[#9C99B8]/70 focus:outline-none focus:border-[#FFBB00] focus:ring-1 focus:ring-[#FFBB00]/50"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#FFBB00] text-[#474150] hover:bg-[#F5FFF4] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Track Parcel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </section>

        {/* ABOUT US SECTION */}
        <section id="about" className="space-y-8 scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-4">
              <p className="text-xs font-medium text-[#FFBB00]">
                About Global Courier
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5FFF4]"
                style={{ textWrap: 'balance' }}
              >
                An independent international carrier built around border reliability.
              </h2>
              <p className="text-sm sm:text-base text-[#F5FFF4]/85 leading-relaxed">
                Founded to give commercial exporters, design houses, legal practices, and
                medical laboratories direct control over cross-border freight, Global
                Courier bridges six bonded airport terminals with local courier teams on
                five continents. Rather than handing consignments across disconnected
                regional brokers, our dispatchers own every scan from origin collection to
                signed international handoff.
              </p>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  index: '01',
                  title: 'In-House Customs Brokerage',
                  text: 'Licensed trade compliance officers verify tariff codes, commercial invoices, and bonded transit paperwork before flights depart.',
                },
                {
                  index: '02',
                  title: 'Dedicated Charter Uplift',
                  text: 'Reserved widebody cargo allocations guarantee space on nightly trunk routes even during peak seasonal shipping windows.',
                },
                {
                  index: '03',
                  title: 'Single Chain of Custody',
                  text: 'Every satchel and pallet carries continuous barcoded custody handoffs without transferring to unverified third-party lockers.',
                },
                {
                  index: '04',
                  title: '24/7 Multilingual Dispatch',
                  text: 'Routing desks in London, New York, Frankfurt, and Singapore coordinate customs exceptions and urgent schedule changes in real time.',
                },
              ].map((item) => (
                <div
                  key={item.index}
                  className="p-5 rounded-xl bg-[#36313E] border border-[#9C99B8]/30 space-y-2 hover:border-[#FFBB00]/55 transition-colors"
                >
                  <div className="font-mono text-xs font-semibold text-[#FFBB00]">
                    {item.index}
                  </div>
                  <h3 className="text-base font-semibold text-[#F5FFF4]">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#9C99B8] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. GLOBAL OPERATIONS VIDEO & EDITORIAL WRITEUP */}
        <section id="film" className="space-y-8 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#9C99B8]/25 pb-5">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-medium text-[#FFBB00]">
                Worldwide Operations Reel
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5FFF4]"
                style={{ textWrap: 'balance' }}
              >
                Inside our cross-border air, port, and doorstep network.
              </h2>
            </div>
            <p className="text-sm text-[#9C99B8] max-w-md leading-relaxed">
              Watch how a priority international parcel moves from departure tarmac
              loading through bonded customs inspection to final recipient signature.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* HTML5 Video Player Container */}
            <div className="lg:col-span-7 rounded-xl overflow-hidden border border-[#9C99B8]/30 bg-[#36313E] flex flex-col">
              <div className="relative aspect-video bg-[#36313E]">
                <video
                  ref={videoRef}
                  src="/assets/worldwide_courier_reel.mp4"
                  poster="/src/assets/images/hero_global_air_courier_1795093406333.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-cover"
                >
                  Your browser does not support embedded MP4 playback.
                </video>
              </div>

              <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#9C99B8]/25 bg-[#36313E]">
                <div className="text-xs text-[#9C99B8]">
                  <span className="font-semibold text-[#F5FFF4]">
                    Global Corridor Film
                  </span>
                  <span className="mx-2" aria-hidden="true">
                    ·
                  </span>
                  <span>Air Freight · Customs Hub · Last-Mile Delivery</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#9C99B8]/45 text-[#F5FFF4] hover:border-[#FFBB00] hover:text-[#FFBB00] transition-colors"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Play</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#9C99B8]/45 text-[#F5FFF4] hover:border-[#FFBB00] hover:text-[#FFBB00] transition-colors"
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Muted</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Sound On</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Chapter Writeups */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3">
              {FILM_CHAPTERS.map((chapter) => {
                const isActive = activeChapterId === chapter.id;
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => handleSelectChapter(chapter)}
                    className={`w-full text-left p-5 rounded-xl border transition-colors ${
                      isActive
                        ? 'bg-[#36313E] border-[#FFBB00]'
                        : 'bg-[#36313E]/65 border-[#9C99B8]/25 hover:bg-[#36313E] hover:border-[#9C99B8]/55'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-[#9C99B8]">
                      <span
                        className={`font-mono font-semibold ${
                          isActive ? 'text-[#FFBB00]' : 'text-[#F5FFF4]'
                        }`}
                      >
                        {chapter.index}. {chapter.title}
                      </span>
                      <span className="truncate">{chapter.location}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#F5FFF4]/85 mt-2 leading-relaxed">
                      {chapter.summary}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. WORLDWIDE SERVICES & EDITORIAL PHOTOGRAPHY */}
        <section id="services" className="space-y-8 scroll-mt-24">
          <div className="space-y-2 max-w-2xl border-b border-[#9C99B8]/25 pb-5">
            <p className="text-xs font-medium text-[#FFBB00]">
              Core International Capabilities
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5FFF4]"
              style={{ textWrap: 'balance' }}
            >
              Built for border velocity, regulatory clarity, and fragile cargo.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* 01. Customs & Automated Sorting (7 cols) */}
            <article className="lg:col-span-7 rounded-xl overflow-hidden border border-[#9C99B8]/30 bg-[#36313E] flex flex-col">
              <div className="aspect-[16/10] overflow-hidden bg-[#36313E]">
                {!hubImgFailed ? (
                  <img
                    src="/src/assets/images/customs_hub_sorting_1795093406671.jpg"
                    alt="Automated international courier sorting facility and customs clearance floor"
                    referrerPolicy="no-referrer"
                    onError={() => setHubImgFailed(true)}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#36313E] text-xs text-[#9C99B8]">
                    Automated Customs Hub
                  </div>
                )}
              </div>
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="text-xs text-[#FFBB00] font-medium">
                    Bonded Clearing · HS-Code Validation · Zero Paperwork Delays
                  </div>
                  <h3 className="text-xl font-semibold text-[#F5FFF4]">
                    01. Pre-Cleared International Express &amp; Customs Brokerage
                  </h3>
                  <p className="text-sm text-[#F5FFF4]/85 leading-relaxed">
                    International delays rarely happen in the air—they happen at customs
                    desks. Our licensed brokerage specialists validate commercial invoices,
                    origin certificates, and Harmonized System duty schedules prior to
                    aircraft departure, allowing high-priority parcels to clear international
                    gates within minutes of arrival.
                  </p>
                </div>
                <div className="pt-4 border-t border-[#9C99B8]/25 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9C99B8] font-mono tabular-nums">
                  <span>DDP &amp; DDU Trade Terms Supported</span>
                  <span>24/7 Bonded Hub Processing</span>
                </div>
              </div>
            </article>

            {/* 02. Executive & Diplomatic Doorstep Delivery (5 cols) */}
            <article className="lg:col-span-5 rounded-xl overflow-hidden border border-[#9C99B8]/30 bg-[#36313E] flex flex-col">
              <div className="aspect-[4/3] overflow-hidden bg-[#36313E]">
                {!handoffImgFailed ? (
                  <img
                    src="/src/assets/images/courier_global_handoff_1795093407503.jpg"
                    alt="Global Courier uniformed international courier completing signature handoff in London"
                    referrerPolicy="no-referrer"
                    onError={() => setHandoffImgFailed(true)}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#36313E] text-xs text-[#9C99B8]">
                    Doorstep Signature Delivery
                  </div>
                )}
              </div>
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="text-xs text-[#FFBB00] font-medium">
                    Hand-Carry · Architectural &amp; Legal · Named Recipient
                  </div>
                  <h3 className="text-xl font-semibold text-[#F5FFF4]">
                    02. White-Glove Doorstep &amp; Diplomatic Handoff
                  </h3>
                  <p className="text-sm text-[#F5FFF4]/85 leading-relaxed">
                    Sensitive contracts, luxury retail allocations, and engineering prototypes
                    never pass into unverified third-party lockers. Our dedicated courier
                    personnel collect verifiable digital signatures and photographic chain-of-custody
                    records across 420+ metropolitan centers.
                  </p>
                </div>
                <div className="pt-4 border-t border-[#9C99B8]/25 flex items-center justify-between text-xs text-[#9C99B8] font-mono tabular-nums">
                  <span>Named-Signer Verification</span>
                  <span>Tamper-Evident Seals</span>
                </div>
              </div>
            </article>

            {/* 03. Full-Width Intermodal Air-Sea & Cold Chain Feature (12 cols) */}
            <article className="lg:col-span-12 rounded-xl overflow-hidden border border-[#9C99B8]/30 bg-[#36313E] grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-6 min-h-[260px] overflow-hidden bg-[#36313E]">
                {!corridorImgFailed ? (
                  <img
                    src="/src/assets/images/maritime_air_corridor_1795093406240.jpg"
                    alt="International deep-water port and airport cargo interchange at twilight"
                    referrerPolicy="no-referrer"
                    onError={() => setCorridorImgFailed(true)}
                    className="w-full h-full object-cover lg:h-full transition-transform duration-300 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#36313E] text-xs text-[#9C99B8]">
                    Intermodal Global Freight Corridor
                  </div>
                )}
              </div>
              <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="text-xs text-[#FFBB00] font-medium">
                    Cold-Chain +2°C to +8°C · Heavy Pallet Freight · Scheduled Lanes
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-[#F5FFF4]">
                    03. Intermodal Air-Sea Corridors &amp; Cold-Chain Freight
                  </h3>
                  <p className="text-sm text-[#F5FFF4]/85 leading-relaxed">
                    When businesses scale beyond single parcels into recurring international
                    inventory replenishment, Global Courier synchronizes ocean-port consolidation
                    with priority air bridges. Medical reagents, clinical diagnostics, and
                    precision components travel in active thermal enclosures monitored continuously
                    from origin warehouse to overseas hospital or factory floor.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#9C99B8]/25">
                  <div>
                    <div className="font-mono text-lg font-bold text-[#FFBB00] tabular-nums">
                      +2° / +8°C
                    </div>
                    <div className="text-xs text-[#9C99B8]">Validated Cold Holds</div>
                  </div>
                  <div>
                    <div className="font-mono text-lg font-bold text-[#FFBB00] tabular-nums">
                      2,500 kg
                    </div>
                    <div className="text-xs text-[#9C99B8]">Max Pallet Uplift</div>
                  </div>
                  <div>
                    <div className="font-mono text-lg font-bold text-[#FFBB00] tabular-nums">
                      100%
                    </div>
                    <div className="text-xs text-[#9C99B8]">Carbon Offset Program</div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* 4. GLOBAL NETWORK CORRIDORS & CLIENT PROOF */}
        <section id="network" className="space-y-10 scroll-mt-24">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#9C99B8]/25 pb-5">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-medium text-[#FFBB00]">
                Regional Transit Schedules
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5FFF4]"
                style={{ textWrap: 'balance' }}
              >
                Direct global lanes operating on fixed departure clocks.
              </h2>
            </div>

            {/* Interactive Corridor Region Tabs */}
            <div
              role="tablist"
              aria-label="Global shipping regions"
              className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#36313E] border border-[#9C99B8]/30"
            >
              {(Object.keys(CORRIDOR_REGIONS) as RegionKey[]).map((key) => {
                const region = CORRIDOR_REGIONS[key];
                const active = activeRegion === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveRegion(key)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#FFBB00] text-[#474150]'
                        : 'text-[#9C99B8] hover:text-[#F5FFF4]'
                    }`}
                  >
                    {region.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-[#36313E] border border-[#9C99B8]/30 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-xl font-bold text-[#F5FFF4]">
                {currentRegion.label} Corridor Operations
              </h3>
              <p className="text-sm text-[#F5FFF4]/85 leading-relaxed">
                {currentRegion.description}
              </p>
              <dl className="space-y-3 pt-2 text-xs">
                <div>
                  <dt className="text-[#9C99B8]">Primary Gateways</dt>
                  <dd className="text-[#F5FFF4] font-medium mt-0.5">
                    {currentRegion.primaryHubs}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#9C99B8]">Door-to-Door Window</dt>
                  <dd className="font-mono text-[#FFBB00] font-semibold mt-0.5 tabular-nums">
                    {currentRegion.transitWindow}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#9C99B8]">Customs Protocol</dt>
                  <dd className="text-[#F5FFF4] font-medium mt-0.5">
                    {currentRegion.customsClearance}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-7 divide-y divide-[#9C99B8]/25">
              {currentRegion.lanes.map((lane) => (
                <div
                  key={lane.route}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#F5FFF4]">
                      {lane.route}
                    </div>
                    <div className="text-xs text-[#9C99B8] mt-0.5">
                      {lane.cadence}
                    </div>
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-semibold text-[#FFBB00] tabular-nums shrink-0">
                    {lane.transit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Client Proof / Testimonials Adjacent to Network Claims */}
          <div id="proof" className="grid grid-cols-1 md:grid-cols-2 gap-6 scroll-mt-24">
            <blockquote className="p-6 sm:p-7 rounded-xl bg-[#36313E] border border-[#9C99B8]/30 flex flex-col justify-between space-y-5">
              <p className="text-sm sm:text-base text-[#F5FFF4]/90 leading-relaxed">
                &ldquo;Moving seasonal hardware samples from Shenzhen to retail studios in
                London and Paris used to stall for four days at customs. With Global
                Courier&rsquo;s pre-cleared air corridors, our clearance release dropped by
                38% and every showroom launch hit its morning window.&rdquo;
              </p>
              <footer className="pt-4 border-t border-[#9C99B8]/25 text-xs">
                <div className="font-semibold text-[#F5FFF4]">Henrik Lindholm</div>
                <div className="text-[#9C99B8] mt-0.5">
                  VP Global Logistics, Nordholm Acoustics · Stockholm &amp; London
                </div>
              </footer>
            </blockquote>

            <blockquote className="p-6 sm:p-7 rounded-xl bg-[#36313E] border border-[#9C99B8]/30 flex flex-col justify-between space-y-5">
              <p className="text-sm sm:text-base text-[#F5FFF4]/90 leading-relaxed">
                &ldquo;Our clinical diagnostic kits require strict +2°C to +8°C continuity
                between Zurich, Singapore, and Toronto. Over 18 months and 1,400+ cross-border
                consignments, Global Courier maintained 99.7% on-schedule arrival with zero
                thermal excursions.&rdquo;
              </p>
              <footer className="pt-4 border-t border-[#9C99B8]/25 text-xs">
                <div className="font-semibold text-[#F5FFF4]">Dr. Amara Osei-Mensah</div>
                <div className="text-[#9C99B8] mt-0.5">
                  Director of Supply Operations, Helvetia BioSystems · Zurich
                </div>
              </footer>
            </blockquote>
          </div>
        </section>

        {/* 5. CONTACT US & INTERNATIONAL QUOTE DESK */}
        <section
          id="contact"
          className="rounded-xl bg-[#36313E] border border-[#9C99B8]/30 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start scroll-mt-24"
        >
          <div id="quote" className="lg:col-span-5 space-y-4 scroll-mt-24">
            <p className="text-xs font-medium text-[#FFBB00]">
              Contact Us · International Dispatch Desks
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5FFF4]"
              style={{ textWrap: 'balance' }}
            >
              Speak with our global routing team or request a rate card.
            </h2>
            <p className="text-sm text-[#F5FFF4]/85 leading-relaxed">
              Reach our regional operations desks directly or share your origin,
              destination, and shipment weight. We respond with exact flight-window
              options, inclusive customs brokerage fees, and door-to-door transit
              commitments.
            </p>
            <div className="pt-2 space-y-2 text-xs text-[#9C99B8] border-t border-[#9C99B8]/25">
              <div className="text-[#F5FFF4] font-medium">
                Email: dispatch@globalcourier.com
              </div>
              <div>London Hub: 14 Cargo Terminal Rd, Heathrow · +44 20 7946 0821</div>
              <div>New York Hub: JFK Building 78, Jamaica, NY · +1 212 555 0148</div>
              <div>Singapore Hub: 9 Airline Rd, Changi · +65 6555 0194</div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {quoteConfirmation ? (
              <div className="p-6 rounded-xl bg-[#474150] border border-[#FFBB00]/75 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#FFBB00] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[#F5FFF4]">
                      International Rate Inquiry Logged ({quoteConfirmation.reference})
                    </h3>
                    <p className="text-sm text-[#F5FFF4]/90">
                      Corridor: {quoteConfirmation.route} · {quoteConfirmation.tier}
                    </p>
                    <p className="text-xs text-[#9C99B8]">
                      Our cross-border routing desk has queued your commercial rate card and
                      HS-code pre-clearance instructions for {quoteConfirmation.email}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuoteConfirmation(null);
                    setOriginCountry('');
                    setDestinationCountry('');
                    setShipmentNotes('');
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#FFBB00] text-[#474150] hover:bg-[#F5FFF4] transition-colors"
                >
                  Submit Another Route
                </button>
              </div>
            ) : (
              <form onSubmit={handleQuoteSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="origin-country"
                      className="block text-xs font-medium text-[#9C99B8] mb-1.5"
                    >
                      Origin City / Country
                    </label>
                    <input
                      id="origin-country"
                      type="text"
                      value={originCountry}
                      onChange={(e) => setOriginCountry(e.target.value)}
                      placeholder="e.g. London, United Kingdom"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#474150] border border-[#9C99B8]/45 text-[#F5FFF4] placeholder:text-[#9C99B8]/70 focus:outline-none focus:border-[#FFBB00] focus:ring-1 focus:ring-[#FFBB00]/50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dest-country"
                      className="block text-xs font-medium text-[#9C99B8] mb-1.5"
                    >
                      Destination City / Country
                    </label>
                    <input
                      id="dest-country"
                      type="text"
                      value={destinationCountry}
                      onChange={(e) => setDestinationCountry(e.target.value)}
                      placeholder="e.g. Singapore"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#474150] border border-[#9C99B8]/45 text-[#F5FFF4] placeholder:text-[#9C99B8]/70 focus:outline-none focus:border-[#FFBB00] focus:ring-1 focus:ring-[#FFBB00]/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="service-tier"
                      className="block text-xs font-medium text-[#9C99B8] mb-1.5"
                    >
                      International Service Tier
                    </label>
                    <select
                      id="service-tier"
                      value={serviceTier}
                      onChange={(e) => setServiceTier(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#474150] border border-[#9C99B8]/45 text-[#F5FFF4] focus:outline-none focus:border-[#FFBB00] focus:ring-1 focus:ring-[#FFBB00]/50"
                    >
                      <option>Air Express Priority (24–48h)</option>
                      <option>Diplomatic &amp; Hand-Carry Courier</option>
                      <option>Cold-Chain Biotech (+2°C to +8°C)</option>
                      <option>Intermodal Pallet Freight (3–6 Days)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="weight-kg"
                      className="block text-xs font-medium text-[#9C99B8] mb-1.5"
                    >
                      Est. Weight (kg)
                    </label>
                    <input
                      id="weight-kg"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg bg-[#474150] border border-[#9C99B8]/45 text-[#F5FFF4] focus:outline-none focus:border-[#FFBB00] focus:ring-1 focus:ring-[#FFBB00]/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-medium text-[#9C99B8] mb-1.5"
                    >
                      Business Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="logistics@company.com"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#474150] border border-[#9C99B8]/45 text-[#F5FFF4] placeholder:text-[#9C99B8]/70 focus:outline-none focus:border-[#FFBB00] focus:ring-1 focus:ring-[#FFBB00]/50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="shipment-notes"
                      className="block text-xs font-medium text-[#9C99B8] mb-1.5"
                    >
                      Cargo Notes (Optional)
                    </label>
                    <input
                      id="shipment-notes"
                      type="text"
                      value={shipmentNotes}
                      onChange={(e) => setShipmentNotes(e.target.value)}
                      placeholder="Customs HS code, dimensions, or temp range"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#474150] border border-[#9C99B8]/45 text-[#F5FFF4] placeholder:text-[#9C99B8]/70 focus:outline-none focus:border-[#FFBB00] focus:ring-1 focus:ring-[#FFBB00]/50"
                    />
                  </div>
                </div>

                {formError && (
                  <p className="text-xs font-medium text-[#F5FFF4] bg-[#474150] border border-[#FFBB00]/70 rounded-lg px-3.5 py-2">
                    {formError}
                  </p>
                )}

                <div className="pt-1 flex flex-wrap items-center justify-between gap-4">
                  <span className="text-xs text-[#9C99B8]">
                    Includes customs pre-clearance review and lane pricing.
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#FFBB00] text-[#474150] hover:bg-[#F5FFF4] transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Calculate Worldwide Quote</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>
      )}

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#9C99B8]/25 bg-[#36313E] px-4 sm:px-8 py-8">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#9C99B8]">
          <div className="space-y-1">
            <div className="font-bold text-sm text-[#F5FFF4]">Global Courier</div>
            <div>
              Worldwide International Courier &amp; Bonded Air Express · London · New York ·
              Singapore · Frankfurt
            </div>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6">
            <a
              href="/#about"
              onClick={(e) => {
                e.preventDefault();
                navigateToHome('about');
              }}
              className="hover:text-[#FFBB00] transition-colors"
            >
              About Us
            </a>
            <a
              href="/#services"
              onClick={(e) => {
                e.preventDefault();
                navigateToHome('services');
              }}
              className="hover:text-[#FFBB00] transition-colors"
            >
              Services
            </a>
            <a
              href="/#network"
              onClick={(e) => {
                e.preventDefault();
                navigateToHome('network');
              }}
              className="hover:text-[#FFBB00] transition-colors"
            >
              Global Network
            </a>
            <a
              href="/track"
              onClick={(e) => {
                e.preventDefault();
                navigateToTrack(trackQueryCode);
              }}
              className="hover:text-[#FFBB00] transition-colors"
            >
              Track Parcel
            </a>
            <a
              href="/#contact"
              onClick={(e) => {
                e.preventDefault();
                navigateToHome('contact');
              }}
              className="hover:text-[#FFBB00] transition-colors"
            >
              Contact Us
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
