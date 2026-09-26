"use client";
import { useState } from "react";
import { cancelBooking, rescheduleBooking } from "@repo/db";

const CANCEL_REASONS = [
  "Changed my mind",
  "Found another provider",
  "Emergency / Unavailable",
  "Price too high",
  "Other",
];

interface Props {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelRescheduleModal({ booking, isOpen, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<"cancel" | "reschedule">("cancel");
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0] || "Other");
  const [details, setDetails] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("morning");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCancel = async () => {
    if (!booking?.id) return;
    setLoading(true);
    setError(null);
    try {
      await cancelBooking(String(booking.id), reason, 0);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to cancel booking");
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!booking?.id) return;
    if (!newDate) {
      setError("Please select a new date.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const scheduled_date = new Date(`${newDate}T00:00:00`).toISOString();
      await rescheduleBooking(String(booking.id), scheduled_date);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to reschedule booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold mb-4">Manage Booking</h2>

        {error && <div className="text-red-500 mb-4">{error}</div>}

        <div className="flex border-b mb-4">
          <button
            className={`flex-1 py-2 text-center font-medium ${activeTab === "cancel" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("cancel")}
          >
            Cancel
          </button>
          <button
            className={`flex-1 py-2 text-center font-medium ${activeTab === "reschedule" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
            onClick={() => setActiveTab("reschedule")}
          >
            Reschedule
          </button>
        </div>

        {activeTab === "cancel" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border rounded p-2"
              >
                {CANCEL_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Details (optional)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full border rounded p-2"
                rows={3}
              />
            </div>
            <p className="text-sm text-gray-500">
              Note: Depending on the provider's policy, a cancellation fee may apply.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                disabled={loading}
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Canceling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">New Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Preferred Time</label>
              <select
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full border rounded p-2"
              >
                <option value="morning">Morning (8am - 12pm)</option>
                <option value="afternoon">Afternoon (12pm - 4pm)</option>
                <option value="evening">Evening (4pm - 8pm)</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleReschedule}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Rescheduling..." : "Confirm Reschedule"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
