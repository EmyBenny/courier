import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
} from 'lucide-react';
import type { ParcelHistoryEvent, TrackableParcel } from '../data/shipments';

export interface AdminCourier {
  id: string;
  name: string;
  hub: string;
  routeCode: string;
}

interface AdminPortalPageProps {
  parcels: TrackableParcel[];
  couriers: AdminCourier[];
  onUpdateParcel: (waybill: string, updater: (prev: TrackableParcel) => TrackableParcel) => void;
  onAddParcel: (parcel: TrackableParcel) => void;
  onDeleteParcel: (waybill: string) => void;
  onResetParcels: () => void;
  onAddCourier: (courier: AdminCourier) => void;
  onRemoveCourier: (id: string) => void;
  onNavigateHome: (sectionId?: string) => void;
  onNavigateTrack: (code: string) => void;
}

const PRESET_CORRIDORS: Record<
  string,
  {
    originCity: string;
    originFacility: string;
    originCode: string;
    originPosition: { lat: number; lng: number };
    currentPosition: { lat: number; lng: number };
    activeGroundOrigin: { lat: number; lng: number };
    activeGroundOriginLabel: string;
    destinationCity: string;
    destinationCode: string;
    destinationPosition: { lat: number; lng: number };
  }
> = {
  'FRA-JFK': {
    originCity: 'Frankfurt, Germany',
    originFacility: 'Frankfurt CargoCity South',
    originCode: 'FRA',
    originPosition: { lat: 50.0379, lng: 8.5622 },
    currentPosition: { lat: 40.758, lng: -73.9855 },
    activeGroundOrigin: { lat: 40.758, lng: -73.9855 },
    activeGroundOriginLabel: 'Midtown West Dispatch Hub, New York',
    destinationCity: 'New York, United States',
    destinationCode: 'JFK',
    destinationPosition: { lat: 40.7529, lng: -73.9749 },
  },
  'LHR-SIN': {
    originCity: 'London, United Kingdom',
    originFacility: 'London Heathrow Bonded Hub',
    originCode: 'LHR',
    originPosition: { lat: 51.47, lng: -0.4543 },
    currentPosition: { lat: 1.3521, lng: 103.8198 },
    activeGroundOrigin: { lat: 1.3644, lng: 103.9915 },
    activeGroundOriginLabel: 'Singapore Changi Airfreight Centre',
    destinationCity: 'Singapore',
    destinationCode: 'SIN',
    destinationPosition: { lat: 1.2797, lng: 103.8545 },
  },
  'ZRH-YYZ': {
    originCity: 'Zurich, Switzerland',
    originFacility: 'Zurich Airport Pharma Dispatch Vault',
    originCode: 'ZRH',
    originPosition: { lat: 47.4647, lng: 8.5492 },
    currentPosition: { lat: 43.6596, lng: -79.3889 },
    activeGroundOrigin: { lat: 43.6777, lng: -79.6248 },
    activeGroundOriginLabel: 'Toronto Pearson Bonded Terminal',
    destinationCity: 'Toronto, Canada',
    destinationCode: 'YYZ',
    destinationPosition: { lat: 43.6596, lng: -79.3889 },
  },
};

export default function AdminPortalPage({
  parcels,
  couriers,
  onUpdateParcel,
  onAddParcel,
  onDeleteParcel,
  onResetParcels,
  onAddCourier,
  onRemoveCourier,
  onNavigateHome,
  onNavigateTrack,
}: AdminPortalPageProps) {
  const [selectedWaybill, setSelectedWaybill] = useState<string>(
    () => parcels[0]?.waybill ?? ''
  );
  const [copiedWaybill, setCopiedWaybill] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Checkpoint form state
  const [scanTitle, setScanTitle] = useState('');
  const [scanLocation, setScanLocation] = useState('');
  const [scanHubCode, setScanHubCode] = useState('');
  const [scanExplanation, setScanExplanation] = useState('');
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  // New parcel creation state
  const [newCode, setNewCode] = useState(
    () => `GLC-${Math.floor(100000 + Math.random() * 899999)}`
  );
  const [newCorridor, setNewCorridor] = useState<string>('FRA-JFK');
  const [newRecipient, setNewRecipient] = useState('');
  const [newDestinationAddress, setNewDestinationAddress] = useState('');
  const [newWeight, setNewWeight] = useState('5.0 kg');
  const [newService, setNewService] = useState('Air Express Priority');

  // New courier state
  const [courierName, setCourierName] = useState('');
  const [courierHub, setCourierHub] = useState('London Heathrow (LHR)');
  const [courierRoute, setCourierRoute] = useState('');

  const selectedParcel =
    parcels.find((p) => p.waybill === selectedWaybill) ?? parcels[0] ?? null;

  const deliveredCount = parcels.filter((p) =>
    p.status.toLowerCase().includes('delivered')
  ).length;
  const activeTransitCount = parcels.length - deliveredCount;

  const handleCopyCode = async (waybill: string) => {
    try {
      await navigator.clipboard.writeText(waybill);
      setCopiedWaybill(waybill);
      window.setTimeout(() => {
        setCopiedWaybill((cur) => (cur === waybill ? null : cur));
      }, 2000);
    } catch {
      setCopiedWaybill(null);
    }
  };

  const handleStatusChange = (waybill: string, nextStatus: string) => {
    const stageIndex =
      nextStatus.toLowerCase().includes('delivered') ||
      nextStatus.toLowerCase().includes('out for')
        ? 4
        : 2;

    onUpdateParcel(waybill, (prev) => ({
      ...prev,
      status: nextStatus,
      currentStageIndex: stageIndex,
    }));
    setScanNotice(`Status updated to "${nextStatus}" for ${waybill}.`);
  };

  const handleAppendCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParcel) return;
    const title = scanTitle.trim();
    const location = scanLocation.trim();
    const explanation = scanExplanation.trim();
    if (!title || !location || !explanation) {
      setScanNotice('Please enter checkpoint title, facility location, and explanation.');
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const utcStr = now.toISOString().slice(11, 16) + ' UTC';
    const eventId = `${selectedParcel.waybill}-${Date.now()}`;
    const newEvent: ParcelHistoryEvent = {
      id: eventId,
      date: dateStr,
      localTime: utcStr,
      utcTime: utcStr,
      hubCode: (scanHubCode.trim() || selectedParcel.destinationCode).toUpperCase(),
      location,
      title,
      explanation,
      scanCode: `ADM-${Math.floor(100 + Math.random() * 899)}`,
      completed: true,
      isCurrent: true,
    };

    onUpdateParcel(selectedParcel.waybill, (prev) => ({
      ...prev,
      currentLocationLabel: location,
      currentLocationDetails: explanation,
      history: [
        ...prev.history.map((h) => ({ ...h, isCurrent: false })),
        newEvent,
      ],
    }));

    setScanTitle('');
    setScanLocation('');
    setScanHubCode('');
    setScanExplanation('');
    setScanNotice(`Checkpoint added to ${selectedParcel.waybill} history.`);
  };

  const handleCreateParcel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = newCode.trim().toUpperCase();
    const corridor = PRESET_CORRIDORS[newCorridor] ?? PRESET_CORRIDORS['FRA-JFK'];
    if (!cleanedCode || !newRecipient.trim() || !newDestinationAddress.trim()) {
      return;
    }

    const created: TrackableParcel = {
      waybill: cleanedCode,
      status: 'In Transit · Customs Pre-Cleared',
      statusExplanation: `Consignment ${cleanedCode} (${newWeight}) is routed on Global Courier ${newService} from ${corridor.originCity} to ${corridor.destinationCity}. Electronic pre-clearance has been filed ahead of destination hub arrival.`,
      nextAction: `Scheduled for ground dispatch from ${corridor.activeGroundOriginLabel} to ${newDestinationAddress.trim()}.`,
      currentStageIndex: 2,
      originCity: corridor.originCity,
      originFacility: corridor.originFacility,
      originCode: corridor.originCode,
      originPosition: corridor.originPosition,
      currentPosition: corridor.currentPosition,
      currentLocationLabel: corridor.activeGroundOriginLabel,
      currentLocationDetails: `Active consignment handled under ${newService}.`,
      activeGroundOrigin: corridor.activeGroundOrigin,
      activeGroundOriginLabel: corridor.activeGroundOriginLabel,
      destinationCity: corridor.destinationCity,
      destinationAddress: newDestinationAddress.trim(),
      destinationCode: corridor.destinationCode,
      destinationPosition: corridor.destinationPosition,
      service: newService,
      incoterms: 'DDP · Duties Pre-Paid',
      weight: newWeight.trim() || '5.0 kg',
      dimensions: '40 × 30 × 20 cm',
      pieceCount: '1 Priority Parcel',
      flightRef: `Flight GC-${Math.floor(200 + Math.random() * 700)}`,
      customsEntryRef: `GLC-CUS-${Math.floor(10000 + Math.random() * 89999)}`,
      customsStatus: 'Pre-Cleared Electronic Manifest',
      securitySeal: `SEAL-${corridor.originCode}-${Math.floor(10000 + Math.random() * 89999)}`,
      handlingProtocol: 'Direct Chain-of-Custody Verification',
      shipper: 'Global Courier Commercial Dispatch',
      recipient: newRecipient.trim(),
      dispatchedDate: 'Today · Automated Intake',
      estimatedDelivery: 'Tomorrow · 14:00 Local',
      history: [
        {
          id: `${cleanedCode}-1`,
          date: 'Today',
          localTime: '09:00 UTC',
          utcTime: '09:00 UTC',
          hubCode: `${corridor.originCode}-HUB`,
          location: corridor.originFacility,
          title: 'Consignment Registered & Bonded Intake',
          explanation: `Waybill ${cleanedCode} created in Global Courier Admin Portal and verified for ${newService}.`,
          scanCode: 'COL-100',
          completed: true,
          isCurrent: true,
        },
      ],
    };

    onAddParcel(created);
    setSelectedWaybill(created.waybill);
    setNewCode(`GLC-${Math.floor(100000 + Math.random() * 899999)}`);
    setNewRecipient('');
    setNewDestinationAddress('');
    setShowCreateForm(false);
    setScanNotice(`Registered consignment ${created.waybill}.`);
  };

  const handleAddCourierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courierName.trim() || !courierRoute.trim()) return;
    onAddCourier({
      id: `cr-${Date.now()}`,
      name: courierName.trim(),
      hub: courierHub,
      routeCode: courierRoute.trim().toUpperCase(),
    });
    setCourierName('');
    setCourierRoute('');
  };

  return (
    <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">
      {/* Admin Top Header */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onNavigateHome()}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#AEC3B0] hover:text-[#E3EED4] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Global Courier Overview</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#6B9071]/35 pb-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-[#AEC3B0]">
              Global Courier · Dispatch Administration Console
            </p>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight text-[#E3EED4]"
              style={{ textWrap: 'balance' }}
            >
              Admin Portal &amp; Parcel Registry
            </h1>
            <p className="text-sm text-[#AEC3B0] leading-relaxed">
              Manage the three ready-to-track sample parcels and tracking codes below, log new
              customs or delivery checkpoints, or inspect any shipment on the public tracking
              portal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                onResetParcels();
                setScanNotice('Restored the 3 default sample parcels.');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg border border-[#6B9071]/60 text-[#E3EED4] hover:bg-[#0F2A1D] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset 3 Samples</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-lg bg-[#E3EED4] text-[#0F2A1D] hover:bg-[#AEC3B0] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{showCreateForm ? 'Close Form' : 'New Parcel'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#6B9071]/35 rounded-xl bg-[#0F2A1D] border border-[#6B9071]/45 overflow-hidden">
        {[
          { label: 'Parcel Records', value: String(parcels.length) },
          { label: 'Delivered & Signed', value: String(deliveredCount) },
          { label: 'In Transit / Final-Mile', value: String(activeTransitCount) },
          { label: 'Assigned Couriers', value: String(couriers.length) },
        ].map((metric) => (
          <div key={metric.label} className="p-5 sm:p-6">
            <div className="font-mono text-2xl sm:text-3xl font-bold text-[#E3EED4] tabular-nums">
              {metric.value}
            </div>
            <div className="text-xs text-[#AEC3B0] mt-1">{metric.label}</div>
          </div>
        ))}
      </section>

      {/* Optional Register New Parcel Form */}
      {showCreateForm && (
        <section className="rounded-xl bg-[#0F2A1D] border border-[#6B9071]/50 p-6 sm:p-8 space-y-5">
          <div className="border-b border-[#6B9071]/35 pb-3">
            <h2 className="text-lg font-bold text-[#E3EED4]">Register New Consignment</h2>
            <p className="text-xs text-[#AEC3B0]">
              Creates a live waybill record immediately resolvable on /track.
            </p>
          </div>

          <form onSubmit={handleCreateParcel} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#AEC3B0] mb-1.5">
                Tracking Code
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] focus:outline-none focus:border-[#E3EED4]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#AEC3B0] mb-1.5">
                Corridor Hub Pair
              </label>
              <select
                value={newCorridor}
                onChange={(e) => setNewCorridor(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] focus:outline-none focus:border-[#E3EED4]"
              >
                <option value="FRA-JFK">Frankfurt (FRA) → New York (JFK)</option>
                <option value="LHR-SIN">London (LHR) → Singapore (SIN)</option>
                <option value="ZRH-YYZ">Zurich (ZRH) → Toronto (YYZ)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#AEC3B0] mb-1.5">
                Service Tier
              </label>
              <select
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] focus:outline-none focus:border-[#E3EED4]"
              >
                <option>Air Express Priority</option>
                <option>Diplomatic &amp; Commercial Express</option>
                <option>Cold-Chain Biotech (+2°C to +8°C)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#AEC3B0] mb-1.5">
                Recipient Name / Desk
              </label>
              <input
                type="text"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="Recipient organization"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#AEC3B0] mb-1.5">
                Delivery Street Address
              </label>
              <input
                type="text"
                value={newDestinationAddress}
                onChange={(e) => setNewDestinationAddress(e.target.value)}
                placeholder="Street, suite, city"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#AEC3B0] mb-1.5">
                Weight
              </label>
              <input
                type="text"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] focus:outline-none focus:border-[#E3EED4]"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-lg bg-[#E3EED4] text-[#0F2A1D] hover:bg-[#AEC3B0] transition-colors"
              >
                Create &amp; Activate Tracking Code
              </button>
            </div>
          </form>
        </section>
      )}

      {scanNotice && (
        <div className="rounded-lg bg-[#0F2A1D] border border-[#E3EED4]/55 px-4 py-3 text-xs text-[#E3EED4] flex items-center justify-between gap-4">
          <span>{scanNotice}</span>
          <button
            type="button"
            onClick={() => setScanNotice(null)}
            className="text-[#AEC3B0] hover:text-[#E3EED4] font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3 Parcel Examples Directory */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#E3EED4]">
              Parcel Consignments &amp; Tracking Codes
            </h2>
            <p className="text-xs text-[#AEC3B0]">
              Copy any tracking code below to paste on the Track Parcel page, or select a parcel
              to log a new scan checkpoint.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {parcels.map((parcel) => {
            const isSelected = selectedParcel?.waybill === parcel.waybill;
            const isCopied = copiedWaybill === parcel.waybill;
            return (
              <article
                key={parcel.waybill}
                className={`rounded-xl bg-[#0F2A1D] border p-5 sm:p-6 flex flex-col justify-between space-y-5 transition-colors ${
                  isSelected ? 'border-[#E3EED4]/80' : 'border-[#6B9071]/45'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-lg font-bold text-[#E3EED4] tracking-tight">
                      {parcel.waybill}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(parcel.waybill)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] hover:bg-[#6B9071]/40 transition-colors"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-[#E3EED4]">{parcel.status}</div>
                    <div className="text-[#AEC3B0]">
                      {parcel.originCity} ({parcel.originCode}) → {parcel.destinationCity} (
                      {parcel.destinationCode})
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#6B9071]/30 space-y-1 text-xs text-[#AEC3B0]">
                    <div className="flex items-center gap-1.5 text-[#E3EED4]/90">
                      <Package className="w-3.5 h-3.5 shrink-0 text-[#AEC3B0]" />
                      <span className="truncate">{parcel.service}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{parcel.currentLocationLabel}</span>
                    </div>
                    <div className="font-mono text-[11px] tabular-nums">
                      {parcel.weight} · {parcel.history.length} checkpoints · {parcel.estimatedDelivery}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#6B9071]/30 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWaybill(parcel.waybill)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      isSelected
                        ? 'bg-[#E3EED4] text-[#0F2A1D]'
                        : 'border border-[#6B9071]/60 text-[#E3EED4] hover:bg-[#375534]'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Manage'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigateTrack(parcel.waybill)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-[#6B9071]/60 text-[#E3EED4] hover:bg-[#375534] transition-colors"
                    >
                      <span>Track</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    {parcels.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteParcel(parcel.waybill)}
                        aria-label={`Remove ${parcel.waybill}`}
                        className="p-1.5 rounded-md text-[#AEC3B0] hover:text-[#E3EED4] hover:bg-[#375534] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Selected Parcel Checkpoint Logger & Fleet Courier Roster */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Selected Parcel Checkpoint Logger */}
        {selectedParcel && (
          <div className="lg:col-span-7 rounded-xl bg-[#0F2A1D] border border-[#6B9071]/45 p-6 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#6B9071]/35 pb-4">
              <div>
                <div className="text-xs font-medium text-[#AEC3B0]">Selected Consignment</div>
                <h3 className="text-xl font-bold font-mono text-[#E3EED4]">
                  {selectedParcel.waybill}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="admin-status-select" className="text-xs text-[#AEC3B0]">
                  Status:
                </label>
                <select
                  id="admin-status-select"
                  value={selectedParcel.status}
                  onChange={(e) => handleStatusChange(selectedParcel.waybill, e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] focus:outline-none focus:border-[#E3EED4]"
                >
                  <option>In Transit · Customs Pre-Cleared</option>
                  <option>Out for Final-Mile Delivery</option>
                  <option>Delivered &amp; Signed</option>
                </select>
              </div>
            </div>

            <form onSubmit={handleAppendCheckpoint} className="space-y-4">
              <div className="text-xs font-semibold text-[#E3EED4]">
                Append Custody Scan Checkpoint
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={scanTitle}
                    onChange={(e) => setScanTitle(e.target.value)}
                    placeholder="Checkpoint title (e.g. Customs Cleared)"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={scanHubCode}
                    onChange={(e) => setScanHubCode(e.target.value)}
                    placeholder="Hub code (e.g. JFK-CBP)"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
                  />
                </div>
              </div>
              <input
                type="text"
                value={scanLocation}
                onChange={(e) => setScanLocation(e.target.value)}
                placeholder="Facility or street location"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
              />
              <textarea
                rows={2}
                value={scanExplanation}
                onChange={(e) => setScanExplanation(e.target.value)}
                placeholder="Operational explanation shown in parcel history..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#E3EED4] text-[#0F2A1D] hover:bg-[#AEC3B0] transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Log Checkpoint to History</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Fleet Courier Roster */}
        <div className="lg:col-span-5 rounded-xl bg-[#0F2A1D] border border-[#6B9071]/45 p-6 sm:p-7 space-y-5">
          <div className="border-b border-[#6B9071]/35 pb-4">
            <div className="text-xs font-medium text-[#AEC3B0] flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#E3EED4]" />
              <span>Regional Courier Roster</span>
            </div>
            <h3 className="text-lg font-bold text-[#E3EED4] mt-1">
              Active Hub &amp; Route Personnel
            </h3>
          </div>

          <ul className="divide-y divide-[#6B9071]/30">
            {couriers.map((courier) => (
              <li
                key={courier.id}
                className="py-3 first:pt-0 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-[#E3EED4]">{courier.name}</div>
                  <div className="text-[#AEC3B0] mt-0.5">
                    {courier.hub} · <span className="font-mono">{courier.routeCode}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveCourier(courier.id)}
                  aria-label={`Remove ${courier.name}`}
                  className="p-1.5 rounded-md text-[#AEC3B0] hover:text-[#E3EED4] hover:bg-[#375534] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddCourierSubmit} className="space-y-3 pt-2 border-t border-[#6B9071]/35">
            <div className="text-xs font-semibold text-[#E3EED4]">Add Fleet Courier</div>
            <input
              type="text"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              placeholder="Courier full name"
              className="w-full px-3.5 py-2 text-xs rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={courierHub}
                onChange={(e) => setCourierHub(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] focus:outline-none focus:border-[#E3EED4]"
              >
                <option>London Heathrow (LHR)</option>
                <option>New York JFK (JFK)</option>
                <option>Singapore Changi (SIN)</option>
                <option>Zurich Pharma (ZRH)</option>
              </select>
              <input
                type="text"
                value={courierRoute}
                onChange={(e) => setCourierRoute(e.target.value)}
                placeholder="Route ID (e.g. LHR-08)"
                className="px-3 py-2 text-xs font-mono rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-xs font-semibold rounded-lg bg-[#E3EED4] text-[#0F2A1D] hover:bg-[#AEC3B0] transition-colors"
            >
              Assign Courier
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
