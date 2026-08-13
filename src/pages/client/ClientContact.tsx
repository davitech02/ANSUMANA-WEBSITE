import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, MessageSquare, Clock, Building2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { CONTACT_INFO, sendEmailNotification } from '../../lib/notifications';

export const ClientContact: React.FC = () => {
  const { user, proponent } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    name: user?.full_name || '',
    email: user?.email || '',
    phone: proponent?.phone || '',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return;

    sendEmailNotification({
      to: CONTACT_INFO.email,
      subject: `[AEC Client Inquiry] ${form.subject || 'General Inquiry'} - ${form.name}`,
      body: `Direct inquiry from the client portal.\n\nName: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nSubject: ${form.subject}\n\nMessage:\n${form.message}`,
      notificationType: 'Service request',
      proponentId: proponent?.id,
    });

    setSubmitted(true);
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#D4AF37]" /> Contact Ansumana Environmental Consultancy
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Connect directly with our Monrovia head office for official statutory filings and site inspection scheduling
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Contact Info Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0A2E24] text-white p-6 rounded-2xl border border-[#D4AF37]/30 shadow-xl space-y-5">
            <div>
              <h2 className="font-heading font-extrabold text-lg text-white">Headquarters Details</h2>
              <p className="text-xs text-[#D4AF37] font-mono">AEC Liberia Consultancy Portal</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Office Address</p>
                  <p className="text-gray-300 leading-relaxed">{CONTACT_INFO.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Direct Phone Line</p>
                  <a href={`tel:${CONTACT_INFO.phone}`} className="text-[#D4AF37] hover:underline font-mono">
                    {CONTACT_INFO.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">WhatsApp Business</p>
                  <a href={`https://wa.me/${CONTACT_INFO.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-[#D4AF37] hover:underline font-mono">
                    {CONTACT_INFO.whatsapp}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Official Email</p>
                  <a href={`mailto:${CONTACT_INFO.email}`} className="text-[#D4AF37] hover:underline font-mono">
                    {CONTACT_INFO.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Operating Hours</p>
                  <p className="text-gray-300">Monday – Friday: 8:00 AM – 5:00 PM GMT</p>
                  <p className="text-gray-400 text-[10px]">24/7 Statutory Deadline Emergency Monitoring</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Panel */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2">
            <Send className="w-4 h-4 text-[#D4AF37]" /> Send Direct Inquiry Message
          </h2>

          {submitted ? (
            <div className="p-8 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="font-heading font-extrabold text-base text-[#0A2E24]">Message Sent Successfully!</h3>
              <p className="text-xs text-gray-600">
                Thank you for reaching out to Ansumana Environmental Consultancy Inc. We will respond to <strong>{form.email}</strong> within 1 business day.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-[#1A4A3A] transition-colors"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="e.g., EIA Report Verification Request"
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Inquiry Details *</label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="How can Ansumana Environmental Consultancy assist your project today?"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Direct Message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
