"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface BookingMarkerData {
  id: string;
  latitude: number | null;
  longitude: number | null;
  lat?: number | null;
  lng?: number | null;
  status: string;
  service_type: string;
  service?: { name: string };
  price: number;
  address: string;
  customer?: { full_name?: string; phone?: string };
  professional?: { profile?: { full_name?: string } };
}

interface LiveDispatchMapProps {
  bookings: BookingMarkerData[];
}

const statusColors: Record<string, string> = {
  pending: "#ef4444", // Red
  accepted: "#3b82f6", // Blue
  en_route: "#f59e0b", // Yellow / Amber
  in_progress: "#10b981", // Green
  completed: "#64748b", // Slate
};

export default function LiveDispatchMap({ bookings }: LiveDispatchMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initDispatchMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = await import("leaflet");

      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const defaultCenter: [number, number] = [40.7128, -74.006];
        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 12,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        markersLayerRef.current = markersLayer;
      }

      // Re-populate markers
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers();
        const latLngBounds: [number, number][] = [];

        bookings.forEach((booking) => {
          const lat = Number(booking.latitude || booking.lat);
          const lng = Number(booking.longitude || booking.lng);

          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

          latLngBounds.push([lat, lng]);
          const color = statusColors[booking.status] || "#3b82f6";

          const markerIcon = L.divIcon({
            className: `dispatch-pin-${booking.status}`,
            html: `
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background: ${color};
                color: white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                border: 2px solid white;
              ">
                <div style="transform: rotate(45deg); font-size: 11px; font-weight: bold;">
                  ${booking.status === "pending" ? "!" : "•"}
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
          });

          const serviceName = booking.service?.name || booking.service_type;
          const customerName = booking.customer?.full_name || "Customer";
          const proName = booking.professional?.profile?.full_name || "Unassigned";

          const popupContent = `
            <div style="font-family: sans-serif; font-size: 12px; min-width: 180px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <b style="font-size: 13px;">${serviceName}</b>
                <span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                  ${booking.status}
                </span>
              </div>
              <div style="color: #64748b; margin-bottom: 4px;">${booking.address}</div>
              <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                <div><b>Customer:</b> ${customerName}</div>
                <div><b>Provider:</b> ${proName}</div>
                <div><b>Price:</b> $${Number(booking.price).toFixed(2)}</div>
              </div>
            </div>
          `;

          const marker = L.marker([lat, lng], { icon: markerIcon }).bindPopup(popupContent);
          markersLayerRef.current.addLayer(marker);
        });

        if (latLngBounds.length > 0 && mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 14 });
        }
      }
    }

    initDispatchMap();

    return () => {
      isMounted = false;
    };
  }, [bookings]);

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Status Legend Overlay */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl text-xs space-y-1.5 shadow-xl">
        <span className="font-bold text-[11px] text-slate-300 block mb-1 uppercase tracking-wider">
          Dispatch Status Legend
        </span>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
          <span className="text-slate-300">Pending Broadcast</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
          <span className="text-slate-300">Accepted / Matched</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
          <span className="text-slate-300">En Route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="text-slate-300">Work In Progress</span>
        </div>
      </div>
    </div>
  );
}

