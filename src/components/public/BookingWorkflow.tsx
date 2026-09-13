import React, { useState, useEffect } from 'react';
import { ServiceItem, Appointment } from '../../types';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Calendar as CalendarIcon,
  Car,
  Wrench,
  Clock,
  User,
  MessageSquare,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface BookingWorkflowProps {
  services: ServiceItem[];
  preselectedServiceId?: string;
  onClose: () => void;
  onBookingSuccess: (appointment: Appointment) => void;
}

export const BookingWorkflow: React.FC<BookingWorkflowProps> = ({
  services,
  preselectedServiceId,
  onClose,
  onBookingSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Step 1: Vehicle state — every field starts EMPTY; the customer provides real facts.
  const [vehicleReg, setVehicleReg] = useState<string>('');
  const [vehicleMake, setVehicleMake] = useState<string>('');
  const [vehicleModel, setVehicleModel] = useState<string>('');
  const [vehicleYear, setVehicleYear] = useState<string>('');
  const [vehicleMileage, setVehicleMileage] = useState<string>('');

  // Step 2: Selected services
  // Only preselect what the customer actually chose (deep link / card action).
  // No fabricated default service.
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    preselectedServiceId ? [preselectedServiceId] : []
  );

  // Step 3: Date & Time availability
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // tomorrow by default
    return today.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState<string>('09:30');
  const [availableSlots, setAvailableSlots] = useState<string[]>([
    '08:30', '09:30', '10:30', '11:30', '14:00', '15:00', '16:00'
  ]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Step 4: Customer Details
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');

  // Step 5: Confirmed appointment state
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  // Stable idempotency key per booking attempt (survives retries & double clicks)
  const idempotencyKeyRef = React.useRef<string>(
    `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  );

  // Fetch real availability when date or selected services change
  useEffect(() => {
    const fetchAvailability = async () => {
      setLoadingSlots(true);
      try {
        const totalDuration = selectedServices.reduce((acc, s) => acc + (s.durationMinutes || 45), 0);
        const res = await fetch(`/api/v1/availability?date=${scheduledDate}&duration=${totalDuration}`);
        const data = await res.json();
        if (data.success && data.data.availableSlots) {
          setAvailableSlots(data.data.availableSlots);
          if (!data.data.availableSlots.includes(scheduledTime)) {
            setScheduledTime(data.data.availableSlots[0] || '09:30');
          }
        }
      } catch (err) {
        console.error('Failed to fetch availability', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailability();
  }, [scheduledDate, selectedServiceIds.length]);

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const totalEstimatedDuration = selectedServices.reduce((acc, s) => acc + (s.durationMinutes || 45), 0);
  const totalEstimatedPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);

  const toggleService = (id: string) => {
    if (selectedServiceIds.includes(id)) {
      if (selectedServiceIds.length > 1) {
        setSelectedServiceIds(selectedServiceIds.filter((item) => item !== id));
      }
    } else {
      setSelectedServiceIds([...selectedServiceIds, id]);
    }
  };

  const handleNextStep = () => {
    setErrorMsg('');
    if (currentStep === 1) {
      if (!vehicleReg.trim()) {
        setErrorMsg('Please enter your vehicle registration plate number (e.g. T 123 ABC).');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedServiceIds.length === 0) {
        setErrorMsg('Please select at least one service.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!scheduledDate || !scheduledTime) {
        setErrorMsg('Please select a date and an available time slot.');
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!customerName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 9) {
        setErrorMsg('Please enter a valid phone number (e.g. 0654 686 962).');
        return;
      }
      handleSubmitBooking();
    }
  };

  const handleSubmitBooking = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerWhatsapp: (customerWhatsapp || customerPhone).trim(),
        vehicleRegistration: vehicleReg.trim().toUpperCase(),
        vehicleMakeModel: `${vehicleMake} ${vehicleModel}`.trim(),
        // Only send facts the customer actually entered — never fabricated defaults.
        vehicleYear: vehicleYear ? parseInt(vehicleYear, 10) : undefined,
        vehicleMileage: vehicleMileage ? parseInt(vehicleMileage, 10) : undefined,
        serviceIds: selectedServiceIds,
        scheduledDate,
        scheduledTime,
        notes: customerNotes.trim(),
        // Duplicate-submission protection: same retry returns the same booking.
        idempotencyKey: idempotencyKeyRef.current
      };

      const res = await fetch('/api/v1/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit appointment');
      }

      setConfirmedAppointment(json.data);
      setCurrentStep(5);
      onBookingSuccess(json.data);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md"
      id="booking-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-[#00101F] border border-[#132038] w-full max-w-xl rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in fade-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
        id="booking-modal-container"
      >
        {/* Top Header & Progress Stepper */}
        <div className="bg-[#000000] p-4 sm:p-5 border-b border-[#132038] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono-telemetry font-bold text-[#159EF3] bg-[#002958]/50 px-2 py-0.5 rounded border border-[#159EF3]/30">
                BOOK A SERVICE
              </span>
              <span className="text-[11px] font-mono-telemetry text-slate-400">
                STEP {currentStep} OF 5
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-white uppercase mt-0.5">
              {currentStep === 1 && 'Tell Us About Your Vehicle'}
              {currentStep === 2 && 'Choose Your Services'}
              {currentStep === 3 && 'Pick a Date & Time'}
              {currentStep === 4 && 'Your Contact Details'}
              {currentStep === 5 && 'Booking Confirmed'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            id="booking-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Line */}
        <div className="w-full bg-[#132038] h-1">
          <div
            className="bg-gradient-to-r from-[#002958] via-[#159EF3] to-[#38B2FF] h-full transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          ></div>
        </div>

        {/* Body Content — Scrollable & Mobile Keyboard Safe */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-500/50 rounded flex items-center gap-2 text-xs text-red-200 font-mono-telemetry">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: VEHICLE INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-4" id="booking-step-1">
              <p className="text-xs text-slate-300">
                Enter your vehicle details to open a persistent service record in the Hunter digital registry.
              </p>

              <div>
                <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. T 123 ABC"
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                  className="w-full px-3.5 py-3 bg-[#000000] border border-[#132038] rounded text-base font-mono-telemetry text-white font-bold tracking-wider placeholder-slate-600 focus:border-[#159EF3] focus:outline-none uppercase"
                  id="booking-input-reg"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                    Make
                  </label>
                  <input
                    type="text"
                    placeholder="Toyota, BMW, Benz"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#000000] border border-[#132038] rounded text-xs text-white focus:border-[#159EF3] focus:outline-none"
                    id="booking-input-make"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    placeholder="RAV4, Harrier, X5"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#000000] border border-[#132038] rounded text-xs text-white focus:border-[#159EF3] focus:outline-none"
                    id="booking-input-model"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                    Year (Approx)
                  </label>
                  <input
                    type="number"
                    placeholder="2018"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#000000] border border-[#132038] rounded text-xs text-white focus:border-[#159EF3] focus:outline-none font-mono-telemetry"
                    id="booking-input-year"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                    Current Mileage (KM)
                  </label>
                  <input
                    type="number"
                    placeholder="124850"
                    value={vehicleMileage}
                    onChange={(e) => setVehicleMileage(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#000000] border border-[#132038] rounded text-xs text-white focus:border-[#159EF3] focus:outline-none font-mono-telemetry"
                    id="booking-input-mileage"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT MULTIPLE SERVICES */}
          {currentStep === 2 && (
            <div className="space-y-3" id="booking-step-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Select one or more services needed:</span>
                <span className="font-mono-telemetry text-[#159EF3]">
                  {selectedServiceIds.length} Selected
                </span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {services.map((s) => {
                  const isChecked = selectedServiceIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleService(s.id)}
                      className={`p-3 rounded border cursor-pointer flex items-center justify-between transition-all ${
                        isChecked
                          ? 'bg-[#002958]/50 border-[#159EF3]'
                          : 'bg-[#000000] border-[#132038] hover:border-slate-700'
                      }`}
                      id={`booking-service-${s.number}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            isChecked
                              ? 'bg-[#159EF3] border-[#159EF3] text-black'
                              : 'border-slate-600 bg-transparent'
                          }`}
                        >
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-telemetry text-[10px] text-[#8E9BAE]">
                              {s.number}
                            </span>
                            <span className="font-display font-bold text-xs sm:text-sm text-white uppercase">
                              {s.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono-telemetry">
                            {s.durationMinutes} mins
                          </span>
                        </div>
                      </div>

                      <span className="font-mono-telemetry text-xs font-semibold text-white">
                        {s.priceType === 'QUOTE_REQUIRED'
                          ? 'Quote'
                          : formatCurrency(s.price)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Running Tally */}
              <div className="p-3 bg-[#000000] border border-[#132038] rounded flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono-telemetry">
                  Est. Duration: <strong className="text-white">{totalEstimatedDuration} Mins</strong>
                </span>
                <span className="text-[#159EF3] font-bold font-mono-telemetry">
                  Est. Total: {formatCurrency(totalEstimatedPrice)}
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: AVAILABILITY & SLOTS */}
          {currentStep === 3 && (
            <div className="space-y-4" id="booking-step-3">
              <div>
                <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                  Select Service Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none"
                  id="booking-input-date"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono-telemetry text-[#8E9BAE] uppercase">
                    Available Workshop Arrival Slots
                  </label>
                  {loadingSlots && (
                    <span className="text-[10px] font-mono-telemetry text-[#159EF3] animate-pulse">
                      Checking bays...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((slot) => {
                    const isSelected = scheduledTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setScheduledTime(slot)}
                        className={`py-2 px-3 rounded font-mono-telemetry text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-[#159EF3] text-black border-[#159EF3] shadow-[0_0_10px_rgba(21,158,243,0.3)]'
                            : 'bg-[#000000] text-slate-300 border-[#132038] hover:border-[#159EF3]/50'
                        }`}
                        id={`slot-btn-${slot.replace(':', '-')}`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-[#002958]/30 border border-[#159EF3]/20 rounded text-xs text-slate-300 font-mono-telemetry">
                <div className="flex items-center gap-1.5 text-[#159EF3] mb-1 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  Workshop Policy
                </div>
                Allocated bay will be reserved for your vehicle at Kinondoni Morocco, Block 41. Please arrive 10 minutes prior to slot.
              </div>
            </div>
          )}

          {/* STEP 4: CUSTOMER CONTACT */}
          {currentStep === 4 && (
            <div className="space-y-4" id="booking-step-4">
              <p className="text-xs text-slate-300">
                Guest-first booking. We will send immediate confirmation and live status tracking via phone & WhatsApp.
              </p>

              <div>
                <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mohamed Bakari"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#132038] rounded text-sm text-white focus:border-[#159EF3] focus:outline-none"
                  id="booking-input-name"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="0654 686 962"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none"
                    id="booking-input-phone"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                    WhatsApp (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="Same as phone"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none"
                    id="booking-input-whatsapp"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                  Service Notes / Vehicle Symptoms (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. slight steering vibration, unusual sound over bumps..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white focus:border-[#159EF3] focus:outline-none resize-none"
                  id="booking-input-notes"
                />
              </div>
            </div>
          )}

          {/* STEP 5: CONFIRMATION VIEW */}
          {currentStep === 5 && confirmedAppointment && (
            <div className="space-y-4 text-center py-4" id="booking-step-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-display font-bold text-white uppercase">
                  APPOINTMENT CONFIRMED
                </h3>
                <p className="text-xs text-slate-300 mt-1 font-mono-telemetry">
                  Reference: <strong className="text-[#159EF3] text-sm">{confirmedAppointment.reference}</strong>
                </p>
              </div>

              {/* Details Summary Card */}
              <div className="p-4 bg-[#000000] border border-[#132038] rounded-lg text-left text-xs font-mono-telemetry space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between border-b border-[#132038] pb-2">
                  <span className="text-[#8E9BAE]">VEHICLE</span>
                  <span className="text-white font-bold">{confirmedAppointment.vehicleRegistration}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#132038] pb-2">
                  <span className="text-[#8E9BAE]">DATE & TIME</span>
                  <span className="text-white">{confirmedAppointment.scheduledDate} @ {confirmedAppointment.scheduledTime}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#132038] pb-2">
                  <span className="text-[#8E9BAE]">SERVICES</span>
                  <span className="text-[#159EF3]">{confirmedAppointment.serviceNames.join(', ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8E9BAE]">LOCATION</span>
                  <span className="text-slate-300">Kinondoni Morocco, Block 41</span>
                </div>
              </div>

              {/* Direct WhatsApp Confirmation Button */}
              <a
                href={`https://wa.me/255654686962?text=${encodeURIComponent(
                  `Hello Hunter Autoworks, I have confirmed booking ${confirmedAppointment.reference} for vehicle ${confirmedAppointment.vehicleRegistration} on ${confirmedAppointment.scheduledDate} at ${confirmedAppointment.scheduledTime}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs sm:text-sm px-5 py-3 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                id="booking-whatsapp-confirm-btn"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open in WhatsApp</span>
              </a>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar — Sticky on mobile with 44px min tap targets */}
        <div className="p-4 border-t border-[#132038] bg-[#000000] flex items-center justify-between shrink-0">
          {currentStep > 1 && currentStep < 5 ? (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="py-2.5 px-4 rounded text-xs font-mono-telemetry text-slate-300 hover:text-white border border-[#132038] flex items-center gap-1.5 transition-colors"
              id="booking-back-btn"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div></div>
          )}

          {currentStep < 4 ? (
            <button
              onClick={handleNextStep}
              className="py-3 px-6 bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-xs sm:text-sm rounded flex items-center gap-2 shadow-[0_0_15px_rgba(21,158,243,0.3)] transition-all active:scale-95"
              id="booking-next-btn"
            >
              <span>CONTINUE</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : currentStep === 4 ? (
            <button
              onClick={handleNextStep}
              disabled={submitting}
              className="py-3 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-display font-bold text-xs sm:text-sm rounded flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all disabled:opacity-50"
              id="booking-confirm-submit-btn"
            >
              {submitting ? (
                <span>CONFIRMING APPOINTMENT...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONFIRM BOOKING</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="py-2.5 px-6 bg-[#159EF3] text-black font-display font-bold text-xs sm:text-sm rounded transition-all"
              id="booking-done-btn"
            >
              DONE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
