import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  MapPin,
  Package,
  Plane,
  Search,
  ShieldCheck,
} from 'lucide-react';
import ParcelRouteMap from './ParcelRouteMap';
import {
  extractWaybillCode,
  findParcelInList,
  TRANSIT_STAGES,
  type TrackableParcel,
} from '../data/shipments';

interface TrackParcelPageProps {
  parcels: TrackableParcel[];
  initialCode?: string;
  onNavigateHome: (sectionId?: string) => void;
  onSyncWaybillUrl: (code?: string) => void;
}

export default function TrackParcelPage({
  parcels,
  initialCode,
  onNavigateHome,
  onSyncWaybillUrl,
}: TrackParcelPageProps) {
  const [waybillInput, setWaybillInput] = useState(() =>
    initialCode ? extractWaybillCode(initialCode) : ''
  );
  const [activeParcel, setActiveParcel] = useState<TrackableParcel | null>(() => {
    if (!initialCode) return null;
    return findParcelInList(parcels, initialCode) ?? null;
  });
  const [trackingError, setTrackingError] = useState<string | null>(() => {
    if (initialCode && !findParcelInList(parcels, initialCode)) {
      return `No consignment record was found for "${extractWaybillCode(initialCode)}". Please verify your tracking code and try again.`;
    }
    return null;
  });
  const [historyOrder, setHistoryOrder] = useState<'newest' | 'chronological'>('newest');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!initialCode) {
      setWaybillInput('');
      setActiveParcel(null);
      setTrackingError(null);
      return;
    }
    const cleaned = extractWaybillCode(initialCode);
    setWaybillInput(cleaned);
    const match = findParcelInList(parcels, cleaned);
    if (match) {
      setActiveParcel(match);
      setTrackingError(null);
    } else {
      setActiveParcel(null);
      setTrackingError(
        `No consignment record was found for "${cleaned}". Please verify your tracking code and try again.`
      );
    }
  }, [initialCode, parcels]);

  const resolveAndDisplay = (rawCode: string) => {
    const cleaned = extractWaybillCode(rawCode);
    if (!cleaned) {
      setActiveParcel(null);
      setTrackingError('Paste or enter a valid Global Courier tracking code.');
      onSyncWaybillUrl(undefined);
      return;
    }

    const match = findParcelInList(parcels, cleaned);
    if (!match) {
      setActiveParcel(null);
      setTrackingError(
        `No consignment record was found for "${cleaned}". Please verify your tracking code and try again.`
      );
      onSyncWaybillUrl(cleaned);
      return;
    }

    setTrackingError(null);
    setWaybillInput(match.waybill);
    setActiveParcel(match);
    onSyncWaybillUrl(match.waybill);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resolveAndDisplay(waybillInput);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWaybillInput(val);

    if (!val.trim()) {
      setActiveParcel(null);
      setTrackingError(null);
      onSyncWaybillUrl(undefined);
      return;
    }

    const exact = findParcelInList(parcels, val);
    if (exact) {
      setTrackingError(null);
      setWaybillInput(exact.waybill);
      setActiveParcel(exact);
      onSyncWaybillUrl(exact.waybill);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    const extracted = extractWaybillCode(pasted);
    if (extracted) {
      e.preventDefault();
      setWaybillInput(extracted);
      resolveAndDisplay(extracted);
    }
  };

  const handleCopyTrackingLink = async () => {
    if (!activeParcel) return;
    try {
      const url = new URL(window.location.href);
      url.pathname = '/track';
      url.searchParams.set('code', activeParcel.waybill);
      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      setCopiedLink(false);
    }
  };

  const displayedHistory = useMemo(() => {
    if (!activeParcel) return [];
    if (historyOrder === 'chronological') {
      return activeParcel.history;
    }
    return [...activeParcel.history].reverse();
  }, [activeParcel, historyOrder]);

  return (
    <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">
      {/* Top Breadcrumb & Title */}
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
              International Consignment Portal · Live Waybill Lookup
            </p>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight text-[#E3EED4]"
              style={{ textWrap: 'balance' }}
            >
              Track your parcel, map position, and full transit history.
            </h1>
          </div>
          <p className="text-sm text-[#AEC3B0] max-w-md leading-relaxed">
            Paste your Global Courier tracking code below to inspect live geographic coordinates,
            delivery route directions, bonded customs clearance status, and scan-by-scan custody
            history.
          </p>
        </div>
      </div>

      {/* Lookup Bar */}
      <section className="rounded-xl bg-[#0F2A1D] border border-[#6B9071]/45 p-5 sm:p-7 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="page-waybill-input" className="block text-xs font-medium text-[#AEC3B0]">
            Air Waybill / Tracking Code
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#AEC3B0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="page-waybill-input"
                type="text"
                value={waybillInput}
                onChange={handleInputChange}
                onPaste={handlePaste}
                placeholder="Paste tracking code"
                className="w-full pl-10 pr-4 py-3 text-sm sm:text-base font-mono rounded-lg bg-[#375534] border border-[#6B9071]/60 text-[#E3EED4] placeholder:text-[#AEC3B0]/65 focus:outline-none focus:border-[#E3EED4]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg bg-[#E3EED4] text-[#0F2A1D] hover:bg-[#AEC3B0] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Track Parcel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {trackingError && (
            <p className="text-xs font-medium text-[#E3EED4] bg-[#375534] border border-[#E3EED4]/55 rounded-lg px-4 py-2.5">
              {trackingError}
            </p>
          )}
        </form>
      </section>

      {!activeParcel ? (
        <section className="rounded-xl bg-[#0F2A1D] border border-[#6B9071]/40 p-8 sm:p-12 text-center space-y-3">
          <Package className="w-8 h-8 text-[#AEC3B0] mx-auto" />
          <h2 className="text-lg sm:text-xl font-semibold text-[#E3EED4]">
            Awaiting Tracking Code
          </h2>
          <p className="text-xs sm:text-sm text-[#AEC3B0] max-w-lg mx-auto leading-relaxed">
            Paste an authorized consignment waybill code in the lookup field above to reveal that
            shipment&rsquo;s live map position, delivery directions, customs status, and complete
            custody log.
          </p>
        </section>
      ) : (
        <>
          {/* Main Shipment Status + Plain-English Explanation */}
          <section className="rounded-xl bg-[#0F2A1D] border border-[#6B9071]/45 p-6 sm:p-8 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-[#6B9071]/35">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#AEC3B0]">
                  <span className="font-mono font-semibold text-[#E3EED4]">
                    {activeParcel.waybill}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeParcel.service}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{activeParcel.weight}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#E3EED4]">
                  {activeParcel.status}
                </h2>
                <p className="text-xs sm:text-sm text-[#AEC3B0]">
                  {activeParcel.originCity} ({activeParcel.originCode}) →{' '}
                  {activeParcel.destinationCity} ({activeParcel.destinationCode})
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 lg:text-right">
                <div>
                  <div className="text-xs text-[#AEC3B0]">Delivery Window</div>
                  <div className="font-mono text-base sm:text-lg font-bold text-[#E3EED4] mt-0.5 tabular-nums">
                    {activeParcel.estimatedDelivery}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyTrackingLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#6B9071]/60 text-[#E3EED4] hover:bg-[#375534] transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Tracking Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 5-Stage Border & Transit Progress */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-[#AEC3B0]">
                Transit &amp; Clearance Stage
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {TRANSIT_STAGES.map((stage, idx) => {
                  const isCompleted = idx <= activeParcel.currentStageIndex;
                  const isCurrent = idx === activeParcel.currentStageIndex;
                  return (
                    <div
                      key={stage}
                      className={`p-3 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'bg-[#375534] border-[#E3EED4]/75'
                          : isCompleted
                            ? 'bg-[#375534]/55 border-[#6B9071]/60'
                            : 'bg-[#0F2A1D] border-[#6B9071]/30 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#AEC3B0] mb-1">
                        <span>0{idx + 1}</span>
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#E3EED4]" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-[#AEC3B0]" />
                        )}
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          isCompleted ? 'text-[#E3EED4]' : 'text-[#AEC3B0]'
                        }`}
                      >
                        {stage}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Explanation & Next Scheduled Event */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 p-5 sm:p-6 rounded-xl bg-[#375534] border border-[#6B9071]/45 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#AEC3B0]">
                  <FileText className="w-4 h-4 text-[#E3EED4]" />
                  <span>Detailed Status Explanation</span>
                </div>
                <p className="text-sm sm:text-base text-[#E3EED4] leading-relaxed">
                  {activeParcel.statusExplanation}
                </p>
              </div>

              <div className="lg:col-span-5 p-5 sm:p-6 rounded-xl bg-[#375534]/75 border border-[#6B9071]/45 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#AEC3B0]">
                  <Plane className="w-4 h-4 text-[#E3EED4]" />
                  <span>Next Scheduled Operation</span>
                </div>
                <p className="text-sm text-[#E3EED4]/95 leading-relaxed">
                  {activeParcel.nextAction}
                </p>
                <div className="pt-2 text-xs text-[#AEC3B0] font-mono tabular-nums">
                  Flight / Corridor: {activeParcel.flightRef}
                </div>
              </div>
            </div>

            {/* Full Parcel & Customs Manifest Specifications */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#6B9071]/35 pb-3">
                <h3 className="text-base font-semibold text-[#E3EED4] flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#AEC3B0]" />
                  <span>Full Parcel &amp; Customs Specifications</span>
                </h3>
                <span className="text-xs font-mono text-[#AEC3B0] tabular-nums">
                  Dispatched {activeParcel.dispatchedDate}
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-lg bg-[#375534]/50 border border-[#6B9071]/35 space-y-1">
                  <dt className="text-[#AEC3B0]">Shipper / Origin Facility</dt>
                  <dd className="text-[#E3EED4] font-medium">{activeParcel.shipper}</dd>
                  <dd className="text-[#AEC3B0]">{activeParcel.originFacility}</dd>
                </div>
                <div className="p-4 rounded-lg bg-[#375534]/50 border border-[#6B9071]/35 space-y-1">
                  <dt className="text-[#AEC3B0]">Recipient &amp; Delivery Address</dt>
                  <dd className="text-[#E3EED4] font-medium">{activeParcel.recipient}</dd>
                  <dd className="text-[#AEC3B0]">{activeParcel.destinationAddress}</dd>
                </div>
                <div className="p-4 rounded-lg bg-[#375534]/50 border border-[#6B9071]/35 space-y-1">
                  <dt className="text-[#AEC3B0]">Cargo Dimensions &amp; Pieces</dt>
                  <dd className="text-[#E3EED4] font-medium font-mono tabular-nums">
                    {activeParcel.pieceCount}
                  </dd>
                  <dd className="text-[#AEC3B0] font-mono tabular-nums">
                    {activeParcel.weight} · {activeParcel.dimensions}
                  </dd>
                </div>
                <div className="p-4 rounded-lg bg-[#375534]/50 border border-[#6B9071]/35 space-y-1">
                  <dt className="text-[#AEC3B0]">Customs Entry &amp; Trade Terms</dt>
                  <dd className="text-[#E3EED4] font-medium font-mono tabular-nums">
                    {activeParcel.customsEntryRef}
                  </dd>
                  <dd className="text-[#AEC3B0]">{activeParcel.customsStatus}</dd>
                </div>
                <div className="p-4 rounded-lg bg-[#375534]/50 border border-[#6B9071]/35 space-y-1 sm:col-span-2">
                  <dt className="text-[#AEC3B0]">Security Seal &amp; Handling Protocol</dt>
                  <dd className="text-[#E3EED4] font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#AEC3B0] shrink-0" />
                    <span>{activeParcel.handlingProtocol}</span>
                  </dd>
                  <dd className="text-[#AEC3B0] font-mono tabular-nums">
                    Seal ID: {activeParcel.securitySeal}
                  </dd>
                </div>
                <div className="p-4 rounded-lg bg-[#375534]/50 border border-[#6B9071]/35 space-y-1 sm:col-span-2">
                  <dt className="text-[#AEC3B0]">Trade Incoterms &amp; Carrier</dt>
                  <dd className="text-[#E3EED4] font-medium">{activeParcel.incoterms}</dd>
                  <dd className="text-[#AEC3B0]">Operated end-to-end by Global Courier</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Interactive Google Map & Turn-by-Turn Directions */}
          <ParcelRouteMap parcel={activeParcel} />

          {/* Complete Scan & Chain-of-Custody History */}
          <section className="rounded-xl bg-[#0F2A1D] border border-[#6B9071]/45 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#6B9071]/35 pb-4">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#E3EED4]">
                  Complete Transit &amp; Chain-of-Custody History
                </h2>
                <p className="text-xs text-[#AEC3B0]">
                  {activeParcel.history.length} logged scan checkpoints for waybill{' '}
                  <span className="font-mono text-[#E3EED4]">{activeParcel.waybill}</span>
                </p>
              </div>

              <div
                role="group"
                aria-label="History sort order"
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#375534] border border-[#6B9071]/45 self-start"
              >
                <button
                  type="button"
                  onClick={() => setHistoryOrder('newest')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    historyOrder === 'newest'
                      ? 'bg-[#E3EED4] text-[#0F2A1D]'
                      : 'text-[#AEC3B0] hover:text-[#E3EED4]'
                  }`}
                >
                  Newest First
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOrder('chronological')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    historyOrder === 'chronological'
                      ? 'bg-[#E3EED4] text-[#0F2A1D]'
                      : 'text-[#AEC3B0] hover:text-[#E3EED4]'
                  }`}
                >
                  Origin to Delivery
                </button>
              </div>
            </div>

            <ol className="space-y-4">
              {displayedHistory.map((event) => (
                <li
                  key={event.id}
                  className={`p-4 sm:p-5 rounded-xl border transition-colors ${
                    event.isCurrent
                      ? 'bg-[#375534] border-[#E3EED4]/75'
                      : event.completed
                        ? 'bg-[#375534]/55 border-[#6B9071]/40'
                        : 'bg-[#0F2A1D] border-[#6B9071]/30 opacity-80'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          event.completed
                            ? 'bg-[#E3EED4] text-[#0F2A1D]'
                            : 'bg-[#0F2A1D] text-[#AEC3B0] border border-[#6B9071]/60'
                        }`}
                      >
                        {event.completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-sm text-[#E3EED4]">
                            {event.title}
                          </span>
                          {event.isCurrent && (
                            <span className="font-mono text-[11px] font-semibold text-[#E3EED4] underline underline-offset-4">
                              Current Milestone
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#AEC3B0] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {event.location} ·{' '}
                            <span className="font-mono text-[#E3EED4]/90">{event.hubCode}</span>
                          </span>
                        </p>
                        <p className="text-xs sm:text-sm text-[#E3EED4]/90 leading-relaxed pt-1">
                          {event.explanation}
                        </p>
                      </div>
                    </div>

                    <div className="md:text-right shrink-0 space-y-0.5 pl-9 md:pl-0 text-xs font-mono tabular-nums">
                      <div className="text-[#E3EED4] font-semibold">{event.date}</div>
                      <div className="text-[#AEC3B0]">{event.localTime}</div>
                      <div className="text-[#AEC3B0]/75 text-[11px]">
                        {event.utcTime} · {event.scanCode}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Dispatch Assistance Strip */}
          <section className="rounded-xl bg-[#0F2A1D] border border-[#6B9071]/45 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#E3EED4]">
                Need a customs amendment or urgent routing change on {activeParcel.waybill}?
              </h3>
              <p className="text-xs text-[#AEC3B0]">
                Contact our 24/7 multilingual dispatch desks in London, New York, or Singapore with
                your waybill code ready.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateHome('contact')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-lg bg-[#E3EED4] text-[#0F2A1D] hover:bg-[#AEC3B0] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Contact Dispatch Desk</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        </>
      )}
    </div>
  );
}
