import React, { useState } from 'react';
import { Settings, Save, ShieldCheck, Mail, Phone, MapPin, Bell } from 'lucide-react';
import { AEC_ADMIN_EMAIL, AEC_PHONE_MAIN, AEC_WHATSAPP_MAIN } from '../../lib/notifications';
import { getStorageData, saveStorageData } from '../../lib/storage';

export const AdminSettings: React.FC = () => {
  const [initialSettings] = useState(() => getStorageData().companySettings);
  const [adminEmail, setAdminEmail] = useState(initialSettings.company_email || AEC_ADMIN_EMAIL);
  const [adminPhone, setAdminPhone] = useState(initialSettings.company_phone || AEC_PHONE_MAIN);
  const [adminWhatsApp, setAdminWhatsApp] = useState(initialSettings.company_whatsapp || AEC_WHATSAPP_MAIN);
  const [reminder30Days, setReminder30Days] = useState(initialSettings.reminder_30_enabled);
  const [reminder14Days, setReminder14Days] = useState(initialSettings.reminder_14_enabled);
  const [reminder7Days, setReminder7Days] = useState(initialSettings.reminder_7_enabled);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const currentData = getStorageData();
    currentData.companySettings = {
      ...currentData.companySettings,
      company_email: adminEmail,
      company_phone: adminPhone,
      company_whatsapp: adminWhatsApp,
      reminder_30_enabled: reminder30Days,
      reminder_14_enabled: reminder14Days,
      reminder_7_enabled: reminder7Days,
    };
    saveStorageData(currentData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 font-sans max-w-4xl">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#D4AF37]" /> AEC System & Portal Settings
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Configure notification dispatch parameters, admin recipient emails, and Liberia EPA compliance rules</p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> System Settings Updated & Saved Successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Contact Info Settings */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2 border-b border-gray-100 pb-2">
            <Mail className="w-4 h-4 text-[#D4AF37]" /> AEC Admin Contact Routing
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Primary Admin Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Office Hotline</label>
              <input
                type="text"
                required
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">WhatsApp Dispatch Line</label>
              <input
                type="text"
                required
                value={adminWhatsApp}
                onChange={(e) => setAdminWhatsApp(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>
        </div>

        {/* Reminder Threshold Settings */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-base text-[#0A2E24] flex items-center gap-2 border-b border-gray-100 pb-2">
            <Bell className="w-4 h-4 text-[#D4AF37]" /> Automated Statutory Report Reminder Engine
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={reminder30Days}
                onChange={(e) => setReminder30Days(e.target.checked)}
                className="w-4 h-4 accent-[#0A2E24]"
              />
              <div>
                <p className="font-bold text-[#0A2E24]">30-Day Early Warning Alert</p>
                <p className="text-[11px] text-gray-500">Dispatch email & WhatsApp notification 30 days prior to report due date</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={reminder14Days}
                onChange={(e) => setReminder14Days(e.target.checked)}
                className="w-4 h-4 accent-[#0A2E24]"
              />
              <div>
                <p className="font-bold text-[#0A2E24]">14-Day Priority Alert</p>
                <p className="text-[11px] text-gray-500">Dispatch email & WhatsApp notification 14 days prior to report due date</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={reminder7Days}
                onChange={(e) => setReminder7Days(e.target.checked)}
                className="w-4 h-4 accent-[#0A2E24]"
              />
              <div>
                <p className="font-bold text-[#0A2E24]">7-Day Urgent Deadline Warning</p>
                <p className="text-[11px] text-gray-500">Dispatch email & WhatsApp notification 7 days prior to report due date</p>
              </div>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-heading font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
        >
          <Save className="w-4 h-4" /> Save Configuration
        </button>
      </form>
    </div>
  );
};
