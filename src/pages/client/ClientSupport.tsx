import React, { useState } from 'react';
import { HelpCircle, MessageSquare, Send, CheckCircle2, ShieldCheck, FileText, Phone, Mail, BookOpen } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { getStorageData, saveStorageData } from '../../lib/storage';
import { sendEmailNotification, sendWhatsAppNotification, AEC_ADMIN_EMAIL } from '../../lib/notifications';
import { ServiceRequest } from '../../types';

export const ClientSupport: React.FC = () => {
  const { user, proponent } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const [ticket, setTicket] = useState({
    subject: '',
    category: 'Permit Renewal Assistance',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket.subject.trim() || !ticket.message.trim()) return;

    // Persist the support ticket as a service request so it survives refresh
    const data = getStorageData();
    const newRequest: ServiceRequest = {
      id: 'req-' + Math.random().toString(36).substring(2, 9),
      full_name: user?.full_name || 'Portal User',
      company_name: proponent?.company_name || 'N/A',
      email: user?.email || '',
      phone: proponent?.phone || '',
      whatsapp_number: proponent?.whatsapp_number || '',
      service_needed: 'Compliance advisory',
      project_location: proponent?.project_location || 'Liberia',
      message: `[SUPPORT TICKET: ${ticket.category}] ${ticket.subject}\n\n${ticket.message}`,
      status: 'New',
      created_date: new Date().toISOString(),
    };
    data.requests.unshift(newRequest);
    saveStorageData(data);

    // Dispatch notifications to AEC Admin & Client
    sendEmailNotification({
      to: user?.email || 'compliance@liberiagold.lr',
      subject: `[AEC Support Ticket] ${ticket.subject}`,
      body: `Your support inquiry regarding "${ticket.category}" has been received by Ansumana Environmental Consultancy Inc. An EPA compliance specialist will respond within 24 hours.`,
      notificationType: 'Support Request',
    });

    sendEmailNotification({
      to: AEC_ADMIN_EMAIL,
      subject: `[AEC Support Ticket] ${ticket.subject} - ${proponent?.company_name || user?.full_name || 'Portal User'}`,
      body: `A new support ticket has been submitted via the client portal.\n\nCompany: ${proponent?.company_name || 'N/A'}\nContact: ${user?.full_name || ''} (${user?.email || ''})\nCategory: ${ticket.category}\nSubject: ${ticket.subject}\n\nMessage:\n${ticket.message}`,
      notificationType: 'Support Request',
      proponentId: proponent?.id,
    });

    sendWhatsAppNotification({
      to: proponent?.whatsapp_number || '+231 077 530 1445',
      subject: `Support Ticket: ${ticket.subject}`,
      body: `AEC Support Ticket Opened: "${ticket.subject}". An EPA consultant will reach out via WhatsApp/Phone shortly.`,
      notificationType: 'Support Request',
    });

    setSubmitted(true);
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-[#D4AF37]" /> EPA Statutory Support & Help Desk
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Get direct expert guidance on Liberia EPA permit renewals, EIA report audits, and corrective action plans
        </p>
      </div>

      {/* Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Phone className="w-5 h-5" />
          </div>
          <h3 className="font-heading font-bold text-sm text-[#0A2E24]">Hotline Advisory Desk</h3>
          <p className="text-xs text-gray-500">Call our Monrovia consultants for urgent permit deadline queries.</p>
          <a
            href="tel:+2310881252254"
            className="inline-block text-xs font-mono font-bold text-[#D4AF37] hover:underline"
          >
            +231 088 125 2254
          </a>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="font-heading font-bold text-sm text-[#0A2E24]">WhatsApp Direct Line</h3>
          <p className="text-xs text-gray-500">Send photos of field site conditions or document drafts.</p>
          <a
            href="https://wa.me/2310775301445"
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs font-mono font-bold text-emerald-700 hover:underline"
          >
            +231 077 530 1445
          </a>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="font-heading font-bold text-sm text-[#0A2E24]">Email Technical Support</h3>
          <p className="text-xs text-gray-500">Official correspondence for statutory audit filings.</p>
          <a
            href="mailto:info@ansumana.com"
            className="inline-block text-xs font-mono font-bold text-blue-800 hover:underline"
          >
            info@ansumana.com
          </a>
        </div>
      </div>

      {/* Ticket Submission Form & FAQs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2">
            <Send className="w-4 h-4 text-[#D4AF37]" /> Submit Compliance Support Ticket
          </h2>

          {submitted ? (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="font-heading font-extrabold text-base text-[#0A2E24]">Support Ticket Dispatched!</h3>
              <p className="text-xs text-gray-600">
                Your ticket has been logged with Ansumana Environmental Consultancy Inc. An assigned EPA lead consultant will contact you at <strong>{user?.email}</strong> shortly.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setTicket({ subject: '', category: 'Permit Renewal Assistance', message: '' });
                }}
                className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-[#1A4A3A] transition-colors"
              >
                Submit Another Request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Inquiry Category *</label>
                <select
                  value={ticket.category}
                  onChange={(e) => setTicket({ ...ticket, category: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37] bg-white"
                >
                  <option value="Permit Renewal Assistance">Permit Renewal Assistance</option>
                  <option value="EIA Audit Report Guidelines">EIA Audit Report Guidelines</option>
                  <option value="Non-Compliance Finding Clarification">Non-Compliance Finding Clarification</option>
                  <option value="Evidence Document Review">Evidence Document Review</option>
                  <option value="Advisory Booking Request">Advisory Booking Request</option>
                  <option value="Other Technical Query">Other Technical Query</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Subject / Summary *</label>
                <input
                  type="text"
                  required
                  value={ticket.subject}
                  onChange={(e) => setTicket({ ...ticket, subject: e.target.value })}
                  placeholder="e.g., Extension request for Q3 Water Monitoring EIA Report"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Detailed Message / Inquiry *</label>
                <textarea
                  rows={4}
                  required
                  value={ticket.message}
                  onChange={(e) => setTicket({ ...ticket, message: e.target.value })}
                  placeholder="Describe your site condition or compliance question in detail..."
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Ticket to AEC Team
              </button>
            </form>
          )}
        </div>

        {/* FAQs Sidebar */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-heading font-bold text-sm text-[#0A2E24] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#D4AF37]" /> EPA Liberia Statutory FAQ
            </h3>

            <div className="space-y-3 text-xs divide-y divide-gray-100">
              <div className="pt-2 space-y-1">
                <p className="font-bold text-[#0A2E24]">When is biannual monitoring required?</p>
                <p className="text-gray-600 leading-relaxed">
                  EPA Liberia regulations mandate submission every 6 months for Class A/B mining, logging, and heavy manufacturing permits.
                </p>
              </div>

              <div className="pt-3 space-y-1">
                <p className="font-bold text-[#0A2E24]">How early should permit renewals begin?</p>
                <p className="text-gray-600 leading-relaxed">
                  We recommend starting renewal applications at least 60 days before the recorded expiry date to prevent site shutdown warnings.
                </p>
              </div>

              <div className="pt-3 space-y-1">
                <p className="font-bold text-[#0A2E24]">What happens if a finding remains open?</p>
                <p className="text-gray-600 leading-relaxed">
                  Unaddressed environmental audit findings lead to formal EPA penalty notices or temporary permit suspension.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
