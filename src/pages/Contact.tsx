import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MapPin, Phone, Mail, MessageSquare, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { RequestService, ServiceRequest } from '../types';
import { getStorageData, saveStorageData } from '../lib/storage';
import { sendEmailNotification, AEC_ADMIN_EMAIL } from '../lib/notifications';

export const Contact: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service') || '';

  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    serviceNeeded: (preselectedService as RequestService) || 'Environmental Audit Report',
    projectLocation: '',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preselectedService) {
      setFormData((prev) => ({ ...prev, serviceNeeded: preselectedService as RequestService }));
    }
  }, [preselectedService]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      const data = getStorageData();

      const newRequest: ServiceRequest = {
        id: 'req-' + Math.random().toString(36).substring(2, 9),
        full_name: formData.fullName,
        company_name: formData.companyName || 'N/A',
        email: formData.email,
        phone: formData.phone,
        whatsapp_number: formData.whatsappNumber || formData.phone,
        service_needed: formData.serviceNeeded,
        project_location: formData.projectLocation || 'Liberia',
        message: formData.message,
        status: 'New',
        created_date: new Date().toISOString(),
      };

      data.requests.unshift(newRequest);
      saveStorageData(data);

      // Notify Admin
      sendEmailNotification({
        to: AEC_ADMIN_EMAIL,
        subject: `New Service Request: ${formData.serviceNeeded} - ${formData.companyName || formData.fullName}`,
        body: `New Environmental Service Request received from ${formData.fullName} (${formData.companyName}). Service Needed: ${formData.serviceNeeded}. Location: ${formData.projectLocation}. Message: ${formData.message}. Contact: ${formData.phone} / ${formData.email}`,
        notificationType: 'Service request',
      });

      setLoading(false);
      setSubmitted(true);
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
            Contact AEC & Request Service
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Have questions regarding EPA environmental permit regulations or need an official proposal for an environmental audit? Fill out the form below or reach our Paynesville team directly.
          </p>
        </div>
      </section>

      {/* MAIN CONTACT SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Contact Cards */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <span className="text-[#D4AF37] font-mono text-xs tracking-widest uppercase font-bold">
                Get In Touch
              </span>
              <h2 className="font-heading font-bold text-2xl text-[#0A2E24] mt-1">
                Paynesville Head Office
              </h2>
              <p className="text-gray-600 text-xs sm:text-sm mt-1">
                Our environmental engineering leads are available Monday through Saturday.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0A2E24] text-[#D4AF37] flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0A2E24]">Office Location</h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    72nd SKD Boulevard, Opposite Praise International Church Paynesville, Liberia
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0A2E24] text-[#D4AF37] flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0A2E24]">Phone Line</h4>
                  <p className="text-xs text-gray-600 mt-0.5">+231 088 125 2254</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0A2E24] text-[#D4AF37] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0A2E24]">WhatsApp Business</h4>
                  <p className="text-xs text-gray-600 mt-0.5">+231 077 530 1445</p>
                  <a
                    href="https://wa.me/2310775301445"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded transition-colors"
                  >
                    Open WhatsApp Chat
                  </a>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0A2E24] text-[#D4AF37] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0A2E24]">Official Email</h4>
                  <p className="text-xs text-gray-600 mt-0.5">info@ansumana.com</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Service Request Form */}
          <div className="lg:col-span-7">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-md">
              {submitted ? (
                <div className="text-center py-12 space-y-4 animate-fadeIn">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="font-heading font-extrabold text-2xl text-[#0A2E24]">
                    Service Request Received!
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">
                    Thank you, <strong className="text-[#0A2E24]">{formData.fullName}</strong>. An AEC environmental specialist will review your project requirements and contact you within 24 hours.
                  </p>
                  <div className="pt-4 flex justify-center gap-4">
                    <button
                      onClick={() => setSubmitted(false)}
                      className="px-6 py-2.5 rounded-xl bg-[#0A2E24] text-white font-bold text-xs"
                    >
                      Submit Another Request
                    </button>
                    <Link
                      to="/book"
                      className="px-6 py-2.5 rounded-xl bg-[#D4AF37] text-[#0A2E24] font-bold text-xs"
                    >
                      Book Session Directly
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="border-b border-gray-200 pb-4">
                    <span className="text-[#D4AF37] font-mono text-[10px] tracking-widest uppercase font-bold block">
                      Official Form
                    </span>
                    <h3 className="font-heading font-bold text-xl text-[#0A2E24]">
                      Request Environmental Service
                    </h3>
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Company / Organization</label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="e.g., Liberia Gold Mining Ltd."
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
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
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">WhatsApp Number</label>
                      <input
                        type="tel"
                        value={formData.whatsappNumber}
                        onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                        placeholder="+231 077 000 000"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Service Needed *</label>
                      <select
                        value={formData.serviceNeeded}
                        onChange={(e) => setFormData({ ...formData, serviceNeeded: e.target.value as RequestService })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37] bg-white"
                      >
                        <option value="Environmental Audit Report">Environmental Audit Report</option>
                        <option value="Biannual Monitoring Report">Biannual Monitoring Report</option>
                        <option value="Quarterly Monitoring Report">Quarterly Monitoring Report</option>
                        <option value="Environmental and Social Impact Assessment">Environmental & Social Impact Assessment (ESIA)</option>
                        <option value="Environmental Management Plan">Environmental Management Plan (EMP)</option>
                        <option value="Environmental Project Brief">Environmental Project Brief (EPB)</option>
                        <option value="Mining license support">Mining License Support</option>
                        <option value="Compliance advisory">Compliance Advisory</option>
                        <option value="Environmental monitoring">Environmental Monitoring</option>
                        <option value="Corrective action tracking">Corrective Action Tracking</option>
                        <option value="Other">Other Consulting Service</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Project Location *</label>
                      <input
                        type="text"
                        required
                        value={formData.projectLocation}
                        onChange={(e) => setFormData({ ...formData, projectLocation: e.target.value })}
                        placeholder="County / City in Liberia"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Project Details / Message *</label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Briefly describe your project, facility type, EPA status, and requested assistance..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E5C964] text-[#0A2E24] font-heading font-bold text-sm hover:from-[#E5C964] hover:to-[#D4AF37] shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span>Submitting Request...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Submit Service Request to AEC
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
