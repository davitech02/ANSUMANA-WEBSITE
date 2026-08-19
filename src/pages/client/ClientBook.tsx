import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { publicApi } from '../../lib/api';
import type { BookingService } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

type SubmittedBooking = Awaited<ReturnType<typeof publicApi.submitPublicBooking>>;

export const ClientBook: React.FC = () => {
  const { user, proponent } = useAuth();

  const [form, setForm] = useState({
    service_needed: 'Environmental audit planning session' as BookingService,
    preferred_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    preferred_time: '10:00 AM',
    message: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<SubmittedBooking | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const booking = await publicApi.submitPublicBooking({
        full_name: user?.full_name || proponent?.contact_person || '',
        company_name: proponent?.company_name || '',
        email: user?.email || proponent?.email || '',
        phone: proponent?.phone || '',
        whatsapp_number: proponent?.whatsapp_number || undefined,
        service_needed: form.service_needed,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        project_location: proponent?.project_location || '',
        message: form.message,
      });
      setSubmitted(booking);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-3xl">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#D4AF37]" /> Schedule Technical Review Consultation
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Reserve a session with senior AEC environmental consultants for audit preparations and EPA license reviews
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="font-heading font-bold text-xl text-[#0A2E24]">Booking Request Submitted!</h3>
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-left max-w-lg mx-auto space-y-3">
              <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                <span className="text-gray-500 font-mono">Service:</span>
                <span className="font-bold text-[#0A2E24]">{submitted.service_needed}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                <span className="text-gray-500 font-mono">Preferred Date & Time:</span>
                <span className="font-bold text-[#0A2E24]">{submitted.preferred_date} @ {submitted.preferred_time}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                <span className="text-gray-500 font-mono">Email:</span>
                <span className="font-bold text-[#0A2E24]">{submitted.email}</span>
              </div>
              <div className="flex justify-between pb-2 text-xs">
                <span className="text-gray-500 font-mono">Status:</span>
                <span className="font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Pending
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 max-w-md mx-auto">
              Your booking has been received and is marked as <strong className="text-[#0A2E24]">Pending</strong> confirmation. AEC will review your request and confirm your consultation by email to <strong className="text-[#0A2E24]">{submitted.email}</strong>.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setSubmitted(null)}
                className="text-xs text-[#0A2E24] font-bold hover:underline"
              >
                Book Another Review Session
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}

            <div>
              <label className="block font-bold text-gray-700 mb-1">Consultation Service *</label>
              <select
                value={form.service_needed}
                onChange={(e) => setForm({ ...form, service_needed: e.target.value as BookingService })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
              >
                <option value="Environmental audit planning session">Environmental Audit Planning Session</option>
                <option value="Biannual monitoring planning session">Biannual Monitoring Planning Session</option>
                <option value="Quarterly monitoring planning session">Quarterly Monitoring Planning Session</option>
                <option value="ESIA/EMP/EPB consultation">ESIA / EMP / EPB Consultation</option>
                <option value="Corrective action support session">Corrective Action Review</option>
                <option value="Free consultation call">General Technical Advisory Call</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Preferred Date *</label>
                <input
                  type="date"
                  required
                  value={form.preferred_date}
                  onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Preferred Time *</label>
                <select
                  value={form.preferred_time}
                  onChange={(e) => setForm({ ...form, preferred_time: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  <option value="09:00 AM">09:00 AM GMT</option>
                  <option value="10:00 AM">10:00 AM GMT</option>
                  <option value="11:30 AM">11:30 AM GMT</option>
                  <option value="02:00 PM">02:00 PM GMT</option>
                  <option value="03:30 PM">03:30 PM GMT</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Agenda / Meeting Focus</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Mention specific EPA permit conditions or site audit findings to discuss..."
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />} {saving ? 'Submitting Booking...' : 'Confirm Consultation Booking'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};