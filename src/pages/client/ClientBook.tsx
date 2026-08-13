import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle2, Video } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { getStorageData, saveStorageData } from '../../lib/storage';
import { Booking, BookingService } from '../../types';
import { sendEmailNotification, AEC_ADMIN_EMAIL } from '../../lib/notifications';

export const ClientBook: React.FC = () => {
  const { user } = useAuth();
  const [data] = useState(() => getStorageData());

  const proponent = data.proponents.find(
    (p) => p.email.toLowerCase() === (user?.email || '').toLowerCase()
  ) || data.proponents[0];

  const [form, setForm] = useState({
    service_needed: 'Environmental audit planning session' as BookingService,
    preferred_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    preferred_time: '10:00 AM',
    message: '',
  });

  const [submitted, setSubmitted] = useState<Booking | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentData = getStorageData();

    const newBooking: Booking = {
      id: 'book-' + Math.random().toString(36).substring(2, 9),
      full_name: user?.name || proponent?.contact_person || 'Proponent Contact',
      company_name: proponent?.company_name || 'Proponent Company',
      email: user?.email || proponent?.email || 'client@company.lr',
      phone: proponent?.phone || '+231 088 000 000',
      whatsapp_number: proponent?.whatsapp_number || '+231 077 000 000',
      service_needed: form.service_needed,
      preferred_date: form.preferred_date,
      preferred_time: form.preferred_time,
      project_location: 'AEC Paynesville Office / Google Meet',
      message: form.message,
      booking_status: 'Confirmed',
      meeting_link: 'https://meet.google.com/aec-client-session-' + Math.floor(100 + Math.random() * 900),
      created_date: new Date().toISOString(),
    };

    currentData.bookings.unshift(newBooking);
    saveStorageData(currentData);

    // Notify
    sendEmailNotification({
      to: AEC_ADMIN_EMAIL,
      subject: `New Portal Booking: ${form.service_needed} - ${proponent?.company_name}`,
      body: `Client ${proponent?.company_name} booked ${form.service_needed} on ${form.preferred_date} @ ${form.preferred_time}.`,
      notificationType: 'Booking confirmation',
    });

    setSubmitted(newBooking);
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
            <h3 className="font-heading font-bold text-xl text-[#0A2E24]">Session Reserved!</h3>
            <p className="text-xs text-gray-600">
              Confirmed for <strong>{submitted.preferred_date} @ {submitted.preferred_time}</strong>
            </p>
            <div className="pt-2">
              <a
                href={submitted.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
              >
                <Video className="w-4 h-4" /> Open Google Meet Link
              </a>
            </div>
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
              className="px-6 py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" /> Confirm Consultation Booking
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
