import React, { useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Search, X } from 'lucide-react';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions';
import type { Courier, LatLngLiteral, Parcel, TaskPriority } from '../types/courier';

interface NewDeliveryModalProps {
  isOpen: boolean;
  couriers: Courier[];
  onClose: () => void;
  onCreate: (
    payload: Partial<Parcel> & {
      customerName: string;
      destinationAddress: string;
      taskTitle?: string;
    }
  ) => Promise<void>;
}

const PRESET_DESTINATIONS: Array<{ label: string; address: string; coords: LatLngLiteral }> = [
  {
    label: 'Salesforce Tower (SoMa)',
    address: '415 Mission St, San Francisco, CA',
    coords: { lat: 37.7897, lng: -122.3969 },
  },
  {
    label: 'Hayes Valley Studio',
    address: '450 Octavia St, San Francisco, CA',
    coords: { lat: 37.7765, lng: -122.4242 },
  },
  {
    label: 'North Beach Roastery',
    address: '1501 Grant Ave, San Francisco, CA',
    coords: { lat: 37.8007, lng: -122.4091 },
  },
];

export const NewDeliveryModal: React.FC<NewDeliveryModalProps> = ({
  isOpen,
  couriers,
  onClose,
  onCreate,
}) => {
  const placesLib = useMapsLibrary('places');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [weightKg, setWeightKg] = useState('2.5');
  const [priority, setPriority] = useState<TaskPriority>('express');
  const [courierId, setCourierId] = useState<string>(
    couriers.find((c) => c.status === 'available')?.id ?? ''
  );
  const [originAddress] = useState('650 Townsend St, San Francisco, CA');
  const [destinationInput, setDestinationInput] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<LatLngLiteral | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { suggestions, isLoading: searchingPlaces, resetSession } =
    useAutocompleteSuggestions(destinationInput);

  if (!isOpen) return null;

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['formattedAddress', 'location'],
      });
      const addressText =
        place.formattedAddress || suggestion.placePrediction.text.text;
      setDestinationInput(addressText);
      setSelectedAddress(addressText);
      if (place.location) {
        setSelectedCoords({
          lat: place.location.lat(),
          lng: place.location.lng(),
        });
      }
      resetSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      const fallbackText = suggestion.placePrediction.text.text;
      setDestinationInput(fallbackText);
      setSelectedAddress(fallbackText);
      resetSession();
    }
  };

  const handlePresetPick = (preset: (typeof PRESET_DESTINATIONS)[number]) => {
    setDestinationInput(preset.address);
    setSelectedAddress(preset.address);
    setSelectedCoords(preset.coords);
    resetSession();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAddress = (selectedAddress || destinationInput).trim();
    if (!customerName.trim() || !finalAddress) {
      setFormError('Recipient name and delivery address are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const fallbackCoords = selectedCoords ?? {
        lat: 37.7815 + (Math.random() - 0.5) * 0.025,
        lng: -122.4165 + (Math.random() - 0.5) * 0.025,
      };
      await onCreate({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || '+1 (415) 555-0148',
        customerEmail: customerEmail.trim() || 'recipient@example.com',
        itemDescription: itemDescription.trim() || 'Courier Parcel Dispatch',
        weightKg: Number(weightKg) || 2.5,
        priority,
        courierId: courierId || null,
        originAddress,
        originCoords: { lat: 37.7712, lng: -122.4024 },
        destinationAddress: finalAddress,
        destinationCoords: fallbackCoords,
        deliveryNotes: deliveryNotes.trim(),
        taskTitle: taskTitle.trim() || undefined,
      });

      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setItemDescription('');
      setDestinationInput('');
      setSelectedAddress('');
      setSelectedCoords(null);
      setDeliveryNotes('');
      setTaskTitle('');
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to schedule delivery.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B2A1F]/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-delivery-title"
    >
      <div className="w-full max-w-xl bg-[#FFF9F0] border border-[#D4B996] rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-[#EDE3D4] border-b border-[#D4B996]">
          <div>
            <h2
              id="new-delivery-title"
              className="text-lg font-semibold text-[#3B2A1F]"
            >
              Schedule New Delivery Task
            </h2>
            <p className="text-xs text-[#6F4E37] mt-0.5">
              Origin Hub: {originAddress}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6F4E37] hover:text-[#3B2A1F] hover:bg-[#D4B996]/40 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {formError && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-xs font-medium text-[#B91C1C]">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Jordan Reyes"
                className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                Customer Phone
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+1 (415) 555-0194"
                className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
              />
            </div>
          </div>

          {/* Places API New Address Search */}
          <div className="relative">
            <label className="block text-xs font-medium text-[#6F4E37] mb-1">
              Delivery Destination Address *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#B08968] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={destinationInput}
                onChange={(e) => {
                  setDestinationInput(e.target.value);
                  setSelectedAddress('');
                  setSelectedCoords(null);
                }}
                placeholder="Search street address via Google Places..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
              />
            </div>

            {searchingPlaces && (
              <p className="text-[11px] text-[#6F4E37] mt-1">
                Searching verified addresses...
              </p>
            )}

            {suggestions.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 bg-[#FFF9F0] border border-[#D4B996] rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-[#EDE3D4]">
                {suggestions.map((suggestion, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => void handleSelectSuggestion(suggestion)}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-[#3B2A1F] hover:bg-[#EDE3D4] flex items-start gap-2 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#6F4E37] shrink-0 mt-0.5" />
                      <span>{suggestion.placePrediction?.text.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Quick preset destinations for rapid dispatch testing */}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-[#6F4E37]">
              <span>Quick stops:</span>
              {PRESET_DESTINATIONS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetPick(preset)}
                  className="underline decoration-[#B08968] hover:text-[#3B2A1F] transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                Parcel Contents
              </label>
              <input
                type="text"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="e.g. Lab Instruments / Espresso Beans"
                className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] focus:outline-none focus:border-[#6F4E37]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                Service Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] focus:outline-none focus:border-[#6F4E37]"
              >
                <option value="same_day">Same-Day Priority</option>
                <option value="express">Express Courier</option>
                <option value="standard">Standard Route</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6F4E37] mb-1">
                Assign Courier
              </label>
              <select
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] focus:outline-none focus:border-[#6F4E37]"
              >
                <option value="">Leave Unassigned (Queued)</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.vehicleType} ({c.status.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6F4E37] mb-1">
              Initial Dispatch Task Checklist Item
            </label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Confirm loading dock access before arrival"
              className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6F4E37] mb-1">
              Customer Delivery Instructions
            </label>
            <textarea
              rows={2}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Gate code, concierge instructions, or signature requirements"
              className="w-full px-3 py-2 text-sm bg-[#FFF9F0] border border-[#D4B996] rounded-lg text-[#3B2A1F] placeholder:text-[#B08968] focus:outline-none focus:border-[#6F4E37]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EDE3D4]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#D4B996] bg-[#EDE3D4] text-[#3B2A1F] hover:bg-[#D4B996]/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-[#6F4E37] text-[#FFF9F0] hover:bg-[#3B2A1F] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Dispatching...' : 'Create Delivery Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
