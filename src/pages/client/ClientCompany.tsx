import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Save, MapPin, Mail, Phone, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { portalApi } from '../../lib/api';
import type { Proponent } from '../../types';

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed. Please try again.';
}

export const ClientCompany: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Proponent | null>(null);

  const loadCompany = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await portalApi.fetchClientMe();
      setForm(me.proponent);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const result = await portalApi.updateCompany({
        company_name: form.company_name,
        contact_person: form.contact_person,
        email: form.email,
        phone: form.phone,
        whatsapp_number: form.whatsapp_number,
        county: form.county,
        district: form.district,
        project_location: form.project_location,
        project_description: form.project_description,
      });
      setForm(result.proponent);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-4xl">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#D4AF37]" /> Proponent Company Profile
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Manage registered corporate information, contact personnel, and site location details</p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Company profile updated successfully!
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-100 border border-rose-300 text-rose-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37] mx-auto" />
          <p className="text-sm font-bold text-[#0A2E24]">Loading company profile...</p>
        </div>
      ) : !form ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">Unable to load company profile</p>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            onClick={loadCompany}
            className="px-4 py-2 bg-[#0A2E24] text-[#D4AF37] font-bold text-xs rounded-xl hover:bg-[#1A4A3A] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Company / Proponent Name *</label>
              <input
                type="text"
                required
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Primary Contact Person *</label>
              <input
                type="text"
                required
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Company Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">WhatsApp Number</label>
              <input
                type="tel"
                value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Project Sector</label>
              <input
                type="text"
                readOnly
                value={form.project_type}
                className="w-full p-2.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Province / Region</label>
              <input
                type="text"
                value={form.county}
                onChange={(e) => setForm({ ...form, county: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">District</label>
              <input
                type="text"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Project Site Location</label>
            <input
              type="text"
              value={form.project_location}
              onChange={(e) => setForm({ ...form, project_location: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Project Overview / Description</label>
            <textarea
              rows={4}
              value={form.project_description}
              onChange={(e) => setForm({ ...form, project_description: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-[#0A2E24] hover:bg-[#1A4A3A] text-[#D4AF37] font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Saving...' : 'Save Company Profile'}
          </button>
        </form>
      )}
    </div>
  );
};