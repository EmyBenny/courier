import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Pause,
  Play,
  Plus,
  SkipForward,
  Square,
  Trash2,
  Truck,
} from 'lucide-react';
import type {
  Courier,
  DispatchTask,
  Parcel,
  ParcelStatus,
} from '../types/courier';
import {
  StatusLabel,
  formatClockTime,
  formatDistanceKm,
  formatEtaText,
  formatPriorityLabel,
} from './StatusLabel';

interface SelectedParcelOperationsProps {
  parcel: Parcel;
  couriers: Courier[];
  tasks: DispatchTask[];
  onUpdateParcel: (
    id: string,
    updates: Partial<{
      status: ParcelStatus;
      courierId: string | null;
      delayReason: string;
      etaSeconds: number;
    }>
  ) => Promise<void>;
  onDeleteParcel: (id: string) => Promise<void>;
  onSendTelemetry: (
    courierId: string,
    payload: { action: 'start' | 'pause' | 'step' | 'ping'; stepDelta?: number }
  ) => Promise<unknown>;
  onCreateTask: (payload: {
    parcelId: string;
    title: string;
    assignee?: string;
    category?: DispatchTask['category'];
  }) => Promise<unknown>;
  onToggleTask: (taskId: string, completed: boolean) => Promise<unknown>;
}

const NEXT_STAGE_MAP: Partial<Record<ParcelStatus, { status: ParcelStatus; label: string }>> = {
  queued: { status: 'picked_up', label: 'Mark Picked Up' },
  picked_up: { status: 'in_transit', label: 'Start Transit' },
  in_transit: { status: 'out_for_delivery', label: 'Out for Delivery' },
  delayed: { status: 'out_for_delivery', label: 'Resume Delivery' },
  out_for_delivery: { status: 'delivered', label: 'Confirm Delivered' },
};

export const SelectedParcelOperations: React.FC<SelectedParcelOperationsProps> = ({
  parcel,
  couriers,
  tasks,
  onUpdateParcel,
  onDeleteParcel,
  onSendTelemetry,
  onCreateTask,
  onToggleTask,
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [delayInputOpen, setDelayInputOpen] = useState(false);
  const [delayReason, setDelayReason] = useState(
    parcel.delayReason || 'Heavy corridor congestion (+10 min)'
  );
  const [busy, setBusy] = useState(false);

  const parcelTasks = tasks.filter((t) => t.parcelId === parcel.id);
  const assignedCourier = parcel.courierId
    ? couriers.find((c) => c.id === parcel.courierId)
    : undefined;
  const nextStage = NEXT_STAGE_MAP[parcel.status];

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setBusy(true);
    try {
      await onCreateTask({
        parcelId: parcel.id,
        title: newTaskTitle.trim(),
        assignee: assignedCourier?.name ?? 'Dispatch Desk',
      });
      setNewTaskTitle('');
    } finally {
      setBusy(false);
    }
  };

  const handleReportDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onUpdateParcel(parcel.id, {
        status: 'delayed',
        delayReason: delayReason.trim() || 'Traffic delay reported',
        etaSeconds: parcel.etaSeconds + 600,
      });
      setDelayInputOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#D4B996] bg-[#FFF9F0] divide-y divide-[#EDE3D4]">
      {/* Header & Courier Assignment */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#6F4E37]">
            <span className="font-mono font-semibold text-[#3B2A1F]">
              {parcel.trackingCode}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatPriorityLabel(parcel.priority)}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{parcel.weightKg} kg</span>
          </div>
          <h3 className="text-base font-semibold text-[#3B2A1F] truncate mt-0.5">
            {parcel.customerName} — {parcel.itemDescription}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            aria-label="Assign courier"
            value={parcel.courierId ?? ''}
            onChange={(e) =>
              void onUpdateParcel(parcel.id, {
                courierId: e.target.value || null,
              })
            }
            className="px-2.5 py-1.5 text-xs bg-[#EDE3D4] border border-[#D4B996] rounded-lg text-[#3B2A1F] focus:outline-none focus:border-[#6F4E37]"
          >
            <option value="">Unassigned</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.vehiclePlate})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void onDeleteParcel(parcel.id)}
            title="Cancel and remove delivery"
            className="p-2 rounded-lg text-[#6F4E37] hover:text-[#B91C1C] hover:bg-[#FEE2E2]/60 transition-colors"
            aria-label="Delete delivery"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Telemetry & Stage Controls */}
      <div className="p-4 bg-[#EDE3D4]/45 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-[#3B2A1F]">
            <StatusLabel status={parcel.status} />
            <span aria-hidden="true" className="text-[#B08968]">
              ·
            </span>
            <span className="font-mono tabular-nums">
              ETA {formatEtaText(parcel.etaSeconds, parcel.status)} (
              {formatClockTime(parcel.estimatedArrivalIso)})
            </span>
            <span aria-hidden="true" className="text-[#B08968]">
              ·
            </span>
            <span className="font-mono tabular-nums">
              {formatDistanceKm(parcel.distanceMeters)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {assignedCourier && parcel.status !== 'delivered' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void onSendTelemetry(assignedCourier.id, {
                      action: assignedCourier.liveStreamActive
                        ? 'pause'
                        : 'start',
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    assignedCourier.liveStreamActive
                      ? 'bg-[#3B2A1F] text-[#FFF9F0]'
                      : 'bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F]'
                  }`}
                >
                  {assignedCourier.liveStreamActive ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Live Transit</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Live Transit</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void onSendTelemetry(assignedCourier.id, {
                      action: 'step',
                      stepDelta: 0.2,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#D4B996] bg-[#FFF9F0] text-[#3B2A1F] hover:bg-[#EDE3D4] transition-colors whitespace-nowrap"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Advance GPS</span>
                </button>
              </>
            )}

            {nextStage && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onUpdateParcel(parcel.id, { status: nextStage.status })
                }
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#6F4E37] bg-[#FFF9F0] text-[#3B2A1F] hover:bg-[#6F4E37] hover:text-[#FFF9F0] transition-colors whitespace-nowrap"
              >
                {nextStage.label}
              </button>
            )}

            {parcel.status !== 'delivered' && parcel.status !== 'delayed' && (
              <button
                type="button"
                onClick={() => setDelayInputOpen((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#FECACA] bg-[#FFF9F0] text-[#B91C1C] hover:bg-[#FEE2E2]/60 transition-colors whitespace-nowrap"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Flag Delay</span>
              </button>
            )}
          </div>
        </div>

        {delayInputOpen && (
          <form
            onSubmit={handleReportDelay}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2"
          >
            <input
              type="text"
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              placeholder="Reason for delay (+10m customer alert)"
              className="flex-1 px-3 py-1.5 text-xs bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] focus:outline-none focus:border-[#B91C1C]"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#B91C1C] text-[#FFF9F0] hover:opacity-90 whitespace-nowrap"
              >
                Send Delay Alert
              </button>
              <button
                type="button"
                onClick={() => setDelayInputOpen(false)}
                className="px-2.5 py-1.5 text-xs text-[#6F4E37] hover:text-[#3B2A1F]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Dispatch Task Checklist */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[#6F4E37]">
            Parcel Dispatch Tasks ({parcelTasks.filter((t) => t.completed).length}/
            {parcelTasks.length})
          </h4>
        </div>

        <ul className="space-y-2">
          {parcelTasks.length === 0 ? (
            <li className="text-xs text-[#B08968]">
              No operational tasks logged for this parcel yet.
            </li>
          ) : (
            parcelTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start justify-between gap-3 text-xs py-1"
              >
                <button
                  type="button"
                  onClick={() => void onToggleTask(task.id, !task.completed)}
                  className="flex items-start gap-2 text-left group min-w-0"
                >
                  {task.completed ? (
                    <CheckSquare className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-[#B08968] group-hover:text-[#6F4E37] shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`${
                      task.completed
                        ? 'line-through text-[#B08968]'
                        : 'text-[#3B2A1F]'
                    }`}
                  >
                    {task.title}
                  </span>
                </button>
                <span className="font-mono text-[11px] text-[#6F4E37] shrink-0 tabular-nums">
                  {task.dueTime}
                </span>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={handleAddTask} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add operational handoff or verification task..."
            className="flex-1 px-3 py-1.5 text-xs bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
          />
          <button
            type="submit"
            disabled={busy || !newTaskTitle.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#EDE3D4] border border-[#D4B996] text-[#3B2A1F] hover:bg-[#D4B996]/50 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </form>
      </div>
    </div>
  );
};

interface FleetAndTasksViewProps {
  parcels: Parcel[];
  couriers: Courier[];
  tasks: DispatchTask[];
  onToggleTask: (taskId: string, completed: boolean) => Promise<unknown>;
  onSendTelemetry: (
    courierId: string,
    payload: { action: 'start' | 'pause' | 'step' | 'ping'; stepDelta?: number }
  ) => Promise<unknown>;
  onSelectParcelOnMap: (parcelId: string) => void;
}

export const FleetAndTasksView: React.FC<FleetAndTasksViewProps> = ({
  parcels,
  couriers,
  tasks,
  onToggleTask,
  onSendTelemetry,
  onSelectParcelOnMap,
}) => {
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'completed'>('all');

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'open') return !t.completed;
    if (taskFilter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Active Fleet Roster */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#3B2A1F]">
              Active Courier Fleet
            </h2>
            <p className="text-xs text-[#6F4E37]">
              Live vehicle telemetry, route progress, and dispatch stream controls
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#D4B996] bg-[#FFF9F0]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EDE3D4] border-b border-[#D4B996] text-xs font-semibold text-[#6F4E37]">
                <th className="py-3 px-4">Courier</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Active Parcel</th>
                <th className="py-3 px-4 text-right">Speed</th>
                <th className="py-3 px-4 text-right">Progress</th>
                <th className="py-3 px-4 text-right">Telemetry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE3D4] text-sm">
              {couriers.map((courier) => {
                const activeParcel = parcels.find(
                  (p) => p.id === courier.activeParcelId
                );
                return (
                  <tr
                    key={courier.id}
                    className="hover:bg-[#EDE3D4]/35 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#3B2A1F] text-[#FFF9F0] flex items-center justify-center font-mono text-xs font-semibold shrink-0">
                          {courier.initials}
                        </div>
                        <div>
                          <div className="font-medium text-[#3B2A1F]">
                            {courier.name}
                          </div>
                          <div className="text-xs text-[#6F4E37] font-mono">
                            {courier.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#3B2A1F]">
                      <div>{courier.vehicleType}</div>
                      <div className="font-mono text-[#6F4E37]">
                        {courier.vehiclePlate}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs capitalize text-[#3B2A1F]">
                      <span className="inline-flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-[#6F4E37]" />
                        <span>{courier.status.replace(/_/g, ' ')}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {activeParcel ? (
                        <button
                          type="button"
                          onClick={() => onSelectParcelOnMap(activeParcel.id)}
                          className="font-mono font-semibold text-[#6F4E37] underline decoration-[#B08968] hover:text-[#3B2A1F]"
                        >
                          {activeParcel.trackingCode}
                        </button>
                      ) : (
                        <span className="text-[#B08968]">Standby</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#3B2A1F]">
                      {courier.speedKmh} km/h
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#3B2A1F]">
                      {Math.round(courier.routeProgress * 100)}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      {activeParcel && activeParcel.status !== 'delivered' ? (
                        <button
                          type="button"
                          onClick={() =>
                            void onSendTelemetry(courier.id, {
                              action: courier.liveStreamActive
                                ? 'pause'
                                : 'start',
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            courier.liveStreamActive
                              ? 'bg-[#3B2A1F] text-[#FFF9F0]'
                              : 'bg-[#EDE3D4] border border-[#D4B996] text-[#3B2A1F] hover:bg-[#D4B996]/50'
                          }`}
                        >
                          {courier.liveStreamActive ? (
                            <>
                              <Pause className="w-3 h-3" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>Stream GPS</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-[#B08968]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Master Dispatch Task Management Queue */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#3B2A1F]">
              Master Task Queue
            </h2>
            <p className="text-xs text-[#6F4E37]">
              All pickup, routing, customer handoff, and proof-of-delivery tasks synced across dispatchers
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#EDE3D4] rounded-lg self-start">
            {(['all', 'open', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTaskFilter(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  taskFilter === tab
                    ? 'bg-[#FFF9F0] text-[#3B2A1F] shadow-sm'
                    : 'text-[#6F4E37] hover:text-[#3B2A1F]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#D4B996] bg-[#FFF9F0]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EDE3D4] border-b border-[#D4B996] text-xs font-semibold text-[#6F4E37]">
                <th className="py-3 px-4 w-10">Done</th>
                <th className="py-3 px-4">Task Description</th>
                <th className="py-3 px-4">Parcel</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-right">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE3D4] text-sm">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-[#6F4E37]"
                  >
                    No tasks match this filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const linkedParcel = parcels.find(
                    (p) => p.id === task.parcelId
                  );
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-[#EDE3D4]/35 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            void onToggleTask(task.id, !task.completed)
                          }
                          aria-label={
                            task.completed
                              ? 'Mark task incomplete'
                              : 'Mark task complete'
                          }
                          className="text-[#6F4E37] hover:text-[#3B2A1F]"
                        >
                          {task.completed ? (
                            <CheckSquare className="w-4 h-4 text-[#15803D]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td
                        className={`py-3 px-4 text-sm ${
                          task.completed
                            ? 'line-through text-[#B08968]'
                            : 'text-[#3B2A1F]'
                        }`}
                      >
                        {task.title}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {linkedParcel ? (
                          <button
                            type="button"
                            onClick={() => onSelectParcelOnMap(linkedParcel.id)}
                            className="font-mono font-semibold text-[#6F4E37] underline decoration-[#B08968] hover:text-[#3B2A1F]"
                          >
                            {linkedParcel.trackingCode}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#6F4E37]">
                        {task.assignee}
                      </td>
                      <td className="py-3 px-4 text-xs capitalize text-[#6F4E37]">
                        {task.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#3B2A1F]">
                        {task.dueTime}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
