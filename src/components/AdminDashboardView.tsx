import React, { useMemo, useState } from 'react';
import {
  Bell,
  Plus,
  Search,
  Trash2,
  Truck,
  UserPlus,
} from 'lucide-react';
import type {
  Courier,
  DispatchTask,
  Parcel,
  ParcelStatus,
  PushEventType,
} from '../types/courier';
import {
  StatusLabel,
  formatClockTime,
  formatDistanceKm,
  formatEtaText,
} from './StatusLabel';

interface AdminDashboardViewProps {
  parcels: Parcel[];
  couriers: Courier[];
  tasks: DispatchTask[];
  onCreateCourier: (payload: {
    name: string;
    vehicleType: Courier['vehicleType'];
    vehiclePlate: string;
    phone?: string;
  }) => Promise<unknown>;
  onDeleteCourier: (id: string) => Promise<void>;
  onAssignParcelCourier: (parcelId: string, courierId: string | null) => Promise<unknown>;
  onUpdateParcelStatus: (parcelId: string, status: ParcelStatus) => Promise<unknown>;
  onTriggerPushAlert: (parcelId: string, eventType: PushEventType) => Promise<unknown>;
  onInspectParcel: (parcelId: string) => void;
  onOpenNewDelivery: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  parcels,
  couriers,
  tasks,
  onCreateCourier,
  onDeleteCourier,
  onAssignParcelCourier,
  onUpdateParcelStatus,
  onTriggerPushAlert,
  onInspectParcel,
  onOpenNewDelivery,
}) => {
  const [courierName, setCourierName] = useState('');
  const [vehicleType, setVehicleType] =
    useState<Courier['vehicleType']>('Electric Van');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  const [addingCourier, setAddingCourier] = useState(false);
  const [courierError, setCourierError] = useState<string | null>(null);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const total = parcels.length;
    const active = parcels.filter((p) => p.status !== 'delivered').length;
    const delivered = parcels.filter((p) => p.status === 'delivered').length;
    const delayed = parcels.filter((p) => p.status === 'delayed').length;
    const onTimeRate =
      total > 0 ? Math.round(((total - delayed) / total) * 100) : 100;
    const activeWithEta = parcels.filter(
      (p) => p.status !== 'delivered' && p.etaSeconds > 0
    );
    const avgEtaMin =
      activeWithEta.length > 0
        ? Math.round(
            activeWithEta.reduce((sum, p) => sum + p.etaSeconds, 0) /
              activeWithEta.length /
              60
          )
        : 0;
    const utilizedCouriers = couriers.filter(
      (c) => c.activeParcelId !== null || c.status !== 'available'
    ).length;
    const utilizationPct =
      couriers.length > 0
        ? Math.round((utilizedCouriers / couriers.length) * 100)
        : 0;
    const completedTasks = tasks.filter((t) => t.completed).length;

    const statusCounts: Record<ParcelStatus, number> = {
      queued: 0,
      picked_up: 0,
      in_transit: 0,
      out_for_delivery: 0,
      delayed: 0,
      delivered: 0,
    };
    for (const p of parcels) {
      statusCounts[p.status] += 1;
    }

    return {
      total,
      active,
      delivered,
      delayed,
      onTimeRate,
      avgEtaMin,
      utilizationPct,
      completedTasks,
      statusCounts,
    };
  }, [parcels, couriers, tasks]);

  const filteredParcels = useMemo(() => {
    const q = shipmentSearch.trim().toLowerCase();
    if (!q) return parcels;
    return parcels.filter(
      (p) =>
        p.trackingCode.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.destinationAddress.toLowerCase().includes(q)
    );
  }, [parcels, shipmentSearch]);

  const handleAddCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courierName.trim() || !vehiclePlate.trim()) {
      setCourierError('Courier name and vehicle plate are required.');
      return;
    }
    setAddingCourier(true);
    setCourierError(null);
    try {
      await onCreateCourier({
        name: courierName.trim(),
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        phone: courierPhone.trim() || undefined,
      });
      setCourierName('');
      setVehiclePlate('');
      setCourierPhone('');
    } catch (err) {
      setCourierError(
        err instanceof Error ? err.message : 'Unable to add courier.'
      );
    } finally {
      setAddingCourier(false);
    }
  };

  const handleSendPush = async (parcelId: string, evt: PushEventType) => {
    await onTriggerPushAlert(parcelId, evt);
    setPushFeedback(`Broadcasted "${evt.replace(/_/g, ' ')}" push notification.`);
    window.setTimeout(() => setPushFeedback(null), 3500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#3B2A1F]">
            Operations & Fleet Administration
          </h1>
          <p className="text-sm text-[#6F4E37] mt-0.5">
            Manage courier personnel, assign deliveries, audit delivery performance, and dispatch push alerts
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewDelivery}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F] transition-colors self-start whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Delivery</span>
        </button>
      </div>

      {/* Performance KPI Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#FFF9F0] border border-[#D4B996]">
          <span className="text-xs text-[#6F4E37]">On-Time Performance</span>
          <div className="font-mono text-2xl font-bold text-[#3B2A1F] tabular-nums mt-1">
            {metrics.onTimeRate}%
          </div>
          <span className="text-xs text-[#6F4E37] tabular-nums">
            {metrics.delayed} delayed of {metrics.total} shipments
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFF9F0] border border-[#D4B996]">
          <span className="text-xs text-[#6F4E37]">Fleet Utilization</span>
          <div className="font-mono text-2xl font-bold text-[#3B2A1F] tabular-nums mt-1">
            {metrics.utilizationPct}%
          </div>
          <span className="text-xs text-[#6F4E37] tabular-nums">
            {couriers.length} total couriers
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFF9F0] border border-[#D4B996]">
          <span className="text-xs text-[#6F4E37]">Completed Today</span>
          <div className="font-mono text-2xl font-bold text-[#15803D] tabular-nums mt-1">
            {metrics.delivered}
          </div>
          <span className="text-xs text-[#6F4E37] tabular-nums">
            {metrics.active} active en route
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#FFF9F0] border border-[#D4B996]">
          <span className="text-xs text-[#6F4E37]">Tasks Completed</span>
          <div className="font-mono text-2xl font-bold text-[#3B2A1F] tabular-nums mt-1">
            {metrics.completedTasks}/{tasks.length}
          </div>
          <span className="text-xs text-[#6F4E37] tabular-nums">
            Avg ETA {metrics.avgEtaMin} mins
          </span>
        </div>
      </section>

      {/* Shipment Pipeline Breakdown */}
      <section className="p-5 rounded-xl bg-[#EDE3D4]/65 border border-[#D4B996] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#3B2A1F]">
            Active Shipment Distribution
          </h2>
          <span className="font-mono text-xs text-[#6F4E37] tabular-nums">
            {metrics.total} total parcels
          </span>
        </div>

        <div className="h-3 w-full rounded-full overflow-hidden bg-[#FFF9F0] border border-[#D4B996] flex">
          {(
            [
              ['delivered', '#15803D'],
              ['out_for_delivery', '#3B2A1F'],
              ['in_transit', '#6F4E37'],
              ['picked_up', '#B08968'],
              ['queued', '#D4B996'],
              ['delayed', '#B91C1C'],
            ] as const
          ).map(([status, color]) => {
            const count = metrics.statusCounts[status];
            if (count === 0 || metrics.total === 0) return null;
            const pct = (count / metrics.total) * 100;
            return (
              <div
                key={status}
                style={{ width: `${pct}%`, backgroundColor: color }}
                title={`${status.replace(/_/g, ' ')}: ${count}`}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          {(
            [
              ['queued', 'Queued'],
              ['picked_up', 'Picked Up'],
              ['in_transit', 'In Transit'],
              ['out_for_delivery', 'Out for Delivery'],
              ['delayed', 'Delayed'],
              ['delivered', 'Delivered'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#FFF9F0] border border-[#D4B996]">
              <span className="text-[#6F4E37]">{label}</span>
              <span className="font-mono font-bold text-[#3B2A1F] tabular-nums">
                {metrics.statusCounts[key]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Courier Management: Add & Remove Couriers */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 p-5 rounded-xl bg-[#FFF9F0] border border-[#D4B996] space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#6F4E37]" />
            <h2 className="text-base font-semibold text-[#3B2A1F]">
              Add Courier to Fleet
            </h2>
          </div>

          {courierError && (
            <div className="px-3 py-2 rounded-lg bg-[#FEE2E2] text-xs text-[#B91C1C]">
              {courierError}
            </div>
          )}

          <form onSubmit={handleAddCourier} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                Courier Full Name *
              </label>
              <input
                type="text"
                required
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. Liam Kowalski"
                className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) =>
                    setVehicleType(e.target.value as Courier['vehicleType'])
                  }
                  className="w-full px-2.5 py-2 text-xs bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] focus:outline-none focus:border-[#6F4E37]"
                >
                  <option value="Electric Van">Electric Van</option>
                  <option value="Cargo E-Bike">Cargo E-Bike</option>
                  <option value="Compact Courier">Compact Courier</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                  Plate / ID *
                </label>
                <input
                  type="text"
                  required
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="EV-9104"
                  className="w-full px-3 py-2 text-sm font-mono bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={courierPhone}
                onChange={(e) => setCourierPhone(e.target.value)}
                placeholder="+1 (415) 555-0137"
                className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
              />
            </div>

            <button
              type="submit"
              disabled={addingCourier}
              className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F] disabled:opacity-60 transition-colors"
            >
              {addingCourier ? 'Registering...' : 'Add Courier'}
            </button>
          </form>
        </div>

        {/* Courier Fleet Roster Table */}
        <div className="lg:col-span-8 rounded-xl border border-[#D4B996] bg-[#FFF9F0] overflow-hidden">
          <div className="px-5 py-3.5 bg-[#EDE3D4] border-b border-[#D4B996] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#3B2A1F]">
              Courier Personnel & Performance ({couriers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EDE3D4] text-xs font-semibold text-[#6F4E37]">
                  <th className="py-3 px-4">Courier</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">GPS Source</th>
                  <th className="py-3 px-4 text-right">Delivered</th>
                  <th className="py-3 px-4 text-right">Last Ping</th>
                  <th className="py-3 px-4 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE3D4] text-sm">
                {couriers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#EDE3D4]/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#3B2A1F] text-[#FFF9F0] flex items-center justify-center font-mono text-xs font-semibold shrink-0">
                          {c.initials}
                        </div>
                        <div>
                          <div className="font-medium text-[#3B2A1F]">
                            {c.name}
                          </div>
                          <div className="text-xs font-mono text-[#6F4E37]">
                            {c.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#3B2A1F]">
                      <div>{c.vehicleType}</div>
                      <div className="font-mono text-[#6F4E37]">
                        {c.vehiclePlate}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#6F4E37]">
                      <span className="inline-flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        <span>
                          {c.gpsSource === 'device_gps'
                            ? 'Device GPS'
                            : c.gpsSource === 'route_stream'
                              ? 'Route Stream'
                              : 'Standby'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#3B2A1F]">
                      {c.completedDeliveries ?? 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#6F4E37]">
                      {formatClockTime(c.lastPingIso)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => void onDeleteCourier(c.id)}
                        title={`Remove ${c.name}`}
                        className="p-2 rounded-lg text-[#6F4E37] hover:text-[#B91C1C] hover:bg-[#FEE2E2]/60 transition-colors"
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Active Shipments Assignment & Push Trigger Table */}
      <section className="rounded-xl border border-[#D4B996] bg-[#FFF9F0] overflow-hidden">
        <div className="px-5 py-4 bg-[#EDE3D4] border-b border-[#D4B996] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#3B2A1F]">
              Shipment Assignment & Push Alert Dispatch
            </h2>
            {pushFeedback && (
              <p className="text-xs font-medium text-[#15803D] mt-0.5">
                {pushFeedback}
              </p>
            )}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-[#B08968] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={shipmentSearch}
              onChange={(e) => setShipmentSearch(e.target.value)}
              placeholder="Filter tracking code or customer..."
              className="pl-9 pr-3 py-1.5 text-xs bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37] w-60"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EDE3D4] text-xs font-semibold text-[#6F4E37]">
                <th className="py-3 px-4">Tracking</th>
                <th className="py-3 px-4">Customer & Destination</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Courier</th>
                <th className="py-3 px-4 text-right">ETA / Dist</th>
                <th className="py-3 px-4 text-right">Customer Push</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE3D4] text-sm">
              {filteredParcels.map((parcel) => (
                <tr key={parcel.id} className="hover:bg-[#EDE3D4]/30">
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onInspectParcel(parcel.id)}
                      className="font-mono text-xs font-semibold text-[#6F4E37] underline decoration-[#B08968] hover:text-[#3B2A1F]"
                    >
                      {parcel.trackingCode}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-semibold text-[#3B2A1F]">
                      {parcel.customerName}
                    </div>
                    <div className="text-xs text-[#6F4E37] truncate max-w-[240px]">
                      {parcel.destinationAddress}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      aria-label={`Status for ${parcel.trackingCode}`}
                      value={parcel.status}
                      onChange={(e) =>
                        void onUpdateParcelStatus(
                          parcel.id,
                          e.target.value as ParcelStatus
                        )
                      }
                      className="px-2 py-1 text-xs bg-[#EDE3D4] border border-[#D4B996] rounded-md text-[#3B2A1F]"
                    >
                      <option value="queued">Queued</option>
                      <option value="picked_up">Picked Up</option>
                      <option value="in_transit">In Transit</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delayed">Delayed</option>
                      <option value="delivered">Delivered</option>
                    </select>
                    <div className="mt-1">
                      <StatusLabel status={parcel.status} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      aria-label={`Assign courier to ${parcel.trackingCode}`}
                      value={parcel.courierId ?? ''}
                      onChange={(e) =>
                        void onAssignParcelCourier(
                          parcel.id,
                          e.target.value || null
                        )
                      }
                      className="px-2.5 py-1.5 text-xs bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F]"
                    >
                      <option value="">Unassigned</option>
                      {couriers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.vehiclePlate})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#3B2A1F]">
                    <div>{formatEtaText(parcel.etaSeconds, parcel.status)}</div>
                    <div className="text-[#6F4E37]">
                      {formatDistanceKm(parcel.distanceMeters)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          void handleSendPush(parcel.id, 'arriving_soon')
                        }
                        title="Send Arriving Soon push notification"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#D4B996] bg-[#EDE3D4] text-[#3B2A1F] hover:bg-[#D4B996]/50 whitespace-nowrap"
                      >
                        <Bell className="w-3 h-3" />
                        <span>Ping Customer</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
