import React, { useState, useEffect } from 'react';
import { Calendar, Video, CheckCircle2, XCircle, Search, MessageCircle } from 'lucide-react';
import { Booking, BookingStatus } from '../../types';
import { getStorageData, saveStorageData } from '../../lib/storage';

export const AdminBookings: React.FC = () => {
  const [data, setData] = useState(() => getStorageData());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleUpdate = () => setData(getStorageData());
    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, []);

  const handleUpdateStatus = (id: string, booking_status: BookingStatus) => {
    const currentData = getStorageData();
    currentData.bookings = currentData.bookings.map((b) => (b.id === id ? { ...b, booking_status } : b));
    saveStorageData(currentData);
  };

  const filteredBookings = data.bookings.filter((b) => {
    const term = searchTerm.toLowerCase();
    return (
      b.full_name.toLowerCase().includes(term) ||
      b.company_name.toLowerCase().includes(term) ||
      b.service_needed.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="font-heading font-extrabold text-2xl text-[#0A2E24] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#D4AF37]" /> Consultation Bookings Schedule
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">Manage scheduled technical consultation sessions and Google Meet links</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search bookings by proponent name, company, or session type..."
          className="w-full text-xs focus:outline-none"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A2E24] text-[#D4AF37] text-[11px] font-mono uppercase">
                <th className="p-3">Client / Company</th>
                <th className="p-3">Consultation Service</th>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Meeting Link</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                    No consultation bookings found.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-bold text-[#0A2E24]">
                      {b.full_name}
                      <p className="text-[10px] font-normal text-gray-500">{b.company_name}</p>
                    </td>
                    <td className="p-3 font-semibold">{b.service_needed}</td>
                    <td className="p-3 font-mono text-[11px]">
                      {b.preferred_date} @ {b.preferred_time}
                    </td>
                    <td className="p-3">
                      {b.meeting_link ? (
                        <a
                          href={b.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-mono text-[10px] underline inline-flex items-center gap-1"
                        >
                          <Video className="w-3 h-3 text-blue-600" /> Join Call
                        </a>
                      ) : (
                        <span className="text-gray-400 text-[10px]">In-Person Session</span>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={b.booking_status}
                        onChange={(e) => handleUpdateStatus(b.id, e.target.value as BookingStatus)}
                        className={`p-1 rounded text-[10px] font-mono font-bold border ${
                          b.booking_status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : b.booking_status === 'Completed'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Rescheduled">Rescheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      {b.whatsapp_number && (
                        <a
                          href={`https://wa.me/${b.whatsapp_number.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-700 text-white font-bold text-[10px] rounded hover:bg-emerald-800 inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
