import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { BookingService, Booking } from '../types';
import { getStorageData, saveStorageData } from '../lib/storage';
import { sendEmailNotification, AEC_ADMIN_EMAIL } from '../lib/notifications';

export const BookSession: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service') || '';

  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    serviceNeeded: (preselectedService as BookingService) || 'Free consultation call',
    preferredDate: '',
    preferredTime: '10:00 AM',
    projectLocation: '',
    message: '',
  });

  const [submitted, setSubmitted] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Default preferred date to 3 days from today
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const dateStr = d.toISOString().split('T')[0];
    setFormData((prev) => ({
      ...prev,
      preferredDate: dateStr,
      serviceNeeded: preselectedService ? (preselectedService as BookingService) : prev.serviceNeeded,
    }));
  }, [preselectedService]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      const data = getStorageData();

      const newBooking: Booking = {
        id: 'book-' + Math.random().toString(36).substring(2, 9),
        full_name: formData.fullName,
        company_name: formData.companyName || 'N/A',
        email: formData.email,
        phone: formData.phone,
        whatsapp_number: formData.whatsappNumber || formData.phone,
        service_needed: formData.serviceNeeded,
        preferred_date: formData.preferredDate,
        preferred_time: formData.preferredTime,
        project_location: formData.projectLocation || 'AEC Paynesville Office / Online',
        message: formData.message,
        booking_status: 'Confirmed',
        meeting_link: 'https://meet.google.com/aec-consultation-' + Math.floor(100 + Math.random() * 900),
        created_date: new Date().toISOString(),
      };

      data.bookings.unshift(newBooking);
      saveStorageData(data);

      // Email Client
      sendEmailNotification({
        to: formData.email,
        subject: `Booking Confirmed: ${formData.serviceNeeded} with AEC Consultants`,
        body: `Dear ${formData.fullName}, your consultation session (${formData.serviceNeeded}) is confirmed for ${formData.preferredDate} at ${formData.preferredTime}. Meeting Link: ${newBooking.meeting_link}`,
        notificationType: 'Booking confirmation',
      });

      // Email Admin
      sendEmailNotification({
        to: AEC_ADMIN_EMAIL,
        subject: `New Consultation Booking: ${formData.serviceNeeded} - ${formData.companyName || formData.fullName}`,
        body: `New booking received from ${formData.fullName} (${formData.companyName}). Date: ${formData.preferredDate} @ ${formData.preferredTime}. Contact: ${formData.phone}`,
        notificationType: 'Booking confirmation',
      });

      setLoading(false);
      setSubmitted(newBooking);
    }, 600);
  };

  return (
    <div className="space-y-16 py-10">
      {/* HERO BANNER */}
      <section className="bg-[#0A2E24] text-white py-14 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-3">
          <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
            Ansumana Environmental Consultancy Inc.
          </span>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-white">
            Book a Technical Consultation
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Schedule a planning call or in-person session with senior AEC environmental consultants to discuss EPA permit requirements, monitoring schedules, and audit preparation.
          </p>
        </div>
      </section>

      {/* FORM CONTAINER */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-6 sm:p-10 rounded-2xl border border-gray-200 shadow-xl">
          {submitted ? (
            <div className="text-center py-12 space-y-6 animate-fadeIn">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
                  Session Confirmed
                </span>
                <h3 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0A2E24]">
                  Consultation Booking Successfully Reserved!
                </h3>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-left max-w-lg mx-auto space-y-3">
                <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                  <span className="text-gray-500 font-mono">Service:</span>
                  <span className="font-bold text-[#0A2E24]">{submitted.service_needed}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                  <span className="text-gray-500 font-mono">Date & Time:</span>
                  <span className="font-bold text-[#0A2E24]">{submitted.preferred_date} @ {submitted.preferred_time}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2 text-xs">
                  <span className="text-gray-500 font-mono">Meeting Link:</span>
                  <a
                    href={submitted.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-blue-600 underline"
                  >
                    Open Google Meet
                  </a>
                </div>
              </div>

              <p className="text-xs text-gray-600 max-w-md mx-auto">
                A confirmation email and WhatsApp notification with calendar invite details have been dispatched to <strong className="text-[#0A2E24]">{submitted.email}</strong>.
              </p>

              <div className="pt-4 flex justify-center gap-4">
                <button
                  onClick={() => setSubmitted(null)}
                  className="px-6 py-2.5 rounded-xl bg-[#0A2E24] text-white font-bold text-xs"
                >
                  Book Another Session
                </button>
                <Link
                  to="/check-status"
                  className="px-6 py-2.5 rounded-xl bg-[#D4AF37] text-[#0A2E24] font-bold text-xs"
                >
                  Public Status Lookup
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
                <div>
                  <span className="text-[#D4AF37] font-mono text-[10px] tracking-widest uppercase font-bold block">
                    Schedule Slot
                  </span>
                  <h3 className="font-heading font-bold text-2xl text-[#0A2E24]">
                    Select Service & Preferred Time
                  </h3>
                </div>
                <ShieldCheck className="w-8 h-8 text-[#D4AF37]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g., Mohamed Sesay"
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Company / Proponent Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g., Liberia Gold Mining Ltd."
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@company.lr"
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+231 088 000 000"
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    placeholder="+231 077 000 000"
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Service Needed *</label>
                  <select
                    value={formData.serviceNeeded}
                    onChange={(e) => setFormData({ ...formData, serviceNeeded: e.target.value as BookingService })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="Free consultation call">Free Consultation Call</option>
                    <option value="Environmental audit planning session">Environmental Audit Planning Session</option>
                    <option value="Biannual monitoring planning session">Biannual Monitoring Planning Session</option>
                    <option value="Quarterly monitoring planning session">Quarterly Monitoring Planning Session</option>
                    <option value="ESIA/EMP/EPB consultation">ESIA / EMP / EPB Consultation</option>
                    <option value="Mining license support session">Mining License Support Session</option>
                    <option value="Compliance review session">Compliance Review Session</option>
                    <option value="Report planning session">Report Planning Session</option>
                    <option value="Site visit planning call">Site Visit Planning Call</option>
                    <option value="Corrective action support session">Corrective Action Support Session</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Preferred Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Preferred Time *</label>
                  <select
                    value={formData.preferredTime}
                    onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37] bg-white"
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
                <label className="block text-xs font-bold text-gray-700 mb-1">Location / Venue</label>
                <input
                  type="text"
                  value={formData.projectLocation}
                  onChange={(e) => setFormData({ ...formData, projectLocation: e.target.value })}
                  placeholder="e.g., AEC Paynesville Office / Online Google Meet Call"
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Additional Notes / Agenda</label>
                <textarea
                  rows={3}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Mention any specific EPA deadline, permit number, or site location details..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-sm hover:from-[#E5C964] hover:to-[#D4AF37] shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Processing Booking...</span>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" /> Confirm & Reserve Consultation Slot
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
