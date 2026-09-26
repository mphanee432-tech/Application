"use client";
import { useState, useEffect } from "react";
import { 
  createBrowserSupabaseClient, 
  fetchProfessionalAvailability, 
  upsertProfessionalAvailability, 
  updateBlockoutDates 
} from "@repo/db";
import Link from "next/link";
import { ArrowLeft, Save, Calendar, Clock, Trash2, Loader2, AlertCircle } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Slot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export default function SchedulePage() {
  const [slots, setSlots] = useState<Slot[]>(
    DAYS.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: false }))
  );
  const [blockoutDates, setBlockoutDates] = useState<string[]>([]);
  const [newBlockout, setNewBlockout] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const data = await fetchProfessionalAvailability(user.id);
        if (data && Array.isArray(data)) {
          // Merge existing availability with defaults
          const updatedSlots = [...slots];
          data.forEach((slot: any) => {
            const index = updatedSlots.findIndex((s) => s.day_of_week === slot.day_of_week);
            if (index !== -1) updatedSlots[index] = { ...updatedSlots[index], ...slot };
          });
          setSlots(updatedSlots);
        }
      } catch (error) {
        console.error("Failed to load availability", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSlotChange = (index: number, field: keyof Slot, value: any) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value } as Slot;
    setSlots(newSlots);
  };

  const handleAddBlockout = () => {
    if (newBlockout && !blockoutDates.includes(newBlockout)) {
      setBlockoutDates([...blockoutDates, newBlockout].sort());
      setNewBlockout("");
    }
  };

  const handleRemoveBlockout = (dateToRemove: string) => {
    setBlockoutDates(blockoutDates.filter((date) => date !== dateToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      await upsertProfessionalAvailability(user.id, slots);
      await updateBlockoutDates(user.id, blockoutDates);
      setMessage({ type: "success", text: "Schedule updated successfully!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save schedule" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading schedule...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition p-2 rounded-lg hover:bg-slate-800">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-400" />
            Working Hours & Calendar
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-8">
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-medium ${message.type === 'success' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' : 'bg-rose-950/50 text-rose-400 border border-rose-900'}`}>
            <AlertCircle className="h-4 w-4" />
            {message.text}
          </div>
        )}

        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-base font-bold text-white">Weekly Availability</h2>
            <p className="text-xs text-slate-400 mt-1">Set your standard working hours for incoming bookings.</p>
          </div>
          <div className="divide-y divide-slate-800/50">
            {slots.map((slot, i) => (
              <div key={i} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                <div className="flex items-center gap-4 w-40">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={slot.is_active} 
                      onChange={(e) => handleSlotChange(i, "is_active", e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                  <span className={`font-medium text-sm ${slot.is_active ? 'text-white' : 'text-slate-500'}`}>{DAYS[i]}</span>
                </div>

                <div className="flex items-center gap-3 opacity-100 transition-opacity" style={{ opacity: slot.is_active ? 1 : 0.4, pointerEvents: slot.is_active ? 'auto' : 'none' }}>
                  <input
                    type="time"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    value={slot.start_time}
                    onChange={(e) => handleSlotChange(i, "start_time", e.target.value)}
                  />
                  <span className="text-slate-500 text-sm">to</span>
                  <input
                    type="time"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    value={slot.end_time}
                    onChange={(e) => handleSlotChange(i, "end_time", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Block-Out Dates</h2>
          </div>
          <p className="text-xs text-slate-400">Add specific dates where you will be unavailable (e.g. holidays, vacations).</p>
          
          <div className="flex items-center gap-3 mt-4">
            <input 
              type="date" 
              value={newBlockout}
              onChange={(e) => setNewBlockout(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 flex-1 sm:flex-none sm:w-48"
            />
            <button 
              onClick={handleAddBlockout}
              disabled={!newBlockout}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-2 px-4 rounded-lg transition"
            >
              Add Date
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-4">
            {blockoutDates.length === 0 ? (
              <span className="text-sm text-slate-500">No block-out dates added.</span>
            ) : (
              blockoutDates.map((date) => (
                <div key={date} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-2 py-1.5 text-sm">
                  <span className="text-slate-300 font-medium">{new Date(date).toLocaleDateString()}</span>
                  <button onClick={() => handleRemoveBlockout(date)} className="text-slate-500 hover:text-rose-400 transition p-1 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="flex justify-end pt-4 pb-12">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-lg shadow-emerald-900 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
            Save Availability
          </button>
        </div>
      </main>
    </div>
  );
}
