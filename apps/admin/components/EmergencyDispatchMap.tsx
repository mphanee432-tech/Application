"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface SosAlertMapData {
  id: string;
  lat: number;
  lng: number;
  status: "active" | "dispatched" | "resolved";
  reason: string;
  creator_role: "user" | "professional";
  created_at: string;
  notes?: string | null;
  creator?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
  };
  booking?: {
    service_id?: string;
    status?: string;
    scheduled_at?: string;
  } | null;
}

interface EmergencyDispatchMapProps {
  alerts: SosAlertMapData[];
}

export default function EmergencyDispatchMap({ alerts }: EmergencyDispatchMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initEmergencyMap() {
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
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        markersLayerRef.current = markersLayer;
      }

      // Re-populate emergency markers
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers();
        const latLngBounds: [number, number][] = [];

        alerts.forEach((alert) => {
          const lat = Number(alert.lat);
          const lng = Number(alert.lng);

          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

          latLngBounds.push([lat, lng]);

          const isActive = alert.status === "active" || alert.status === "dispatched";
          const pinColor = isActive ? "#e11d48" : "#10b981"; // rose-600 vs emerald-500

          const markerIcon = L.divIcon({
            className: `emergency-pin-${alert.id}`,
            html: `
              <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
                ${
                  isActive
                    ? `<div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(225, 29, 72, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                    : ""
                }
                <div style="
                  position: relative;
                  width: 28px;
                  height: 28px;
                  background: ${pinColor};
                  border: 2px solid white;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: 900;
                  font-size: 13px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                ">
                  !
                </div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18],
          });

          const victimName = alert.creator?.full_name || alert.creator?.email || "Unknown Victim";
          const victimPhone = alert.creator?.phone || alert.creator?.mobile || "Not specified";
          const reportedTime = new Date(alert.created_at).toLocaleTimeString();

          const popupContent = `
            <div style="font-family: sans-serif; font-size: 12px; min-width: 220px; line-height: 1.4;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid #fee2e2; padding-bottom: 4px;">
                <span style="font-weight: 800; font-size: 13px; color: #991b1b;">
                  EMERGENCY SOS #${alert.id.slice(0, 6)}
                </span>
                <span style="background: ${pinColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase;">
                  ${alert.status}
                </span>
              </div>
              <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                ${alert.reason}
              </div>
              <div style="margin-top: 6px; font-size: 11px; color: #475569;">
                <div><b>Victim:</b> ${victimName} (${alert.creator_role})</div>
                <div><b>Phone:</b> <a href="tel:${victimPhone}" style="color: #2563eb; font-weight: 700;">${victimPhone}</a></div>
                <div><b>Reported At:</b> ${reportedTime}</div>
                <div><b>GPS:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
              </div>
            </div>
          `;

          const marker = L.marker([lat, lng], { icon: markerIcon }).bindPopup(popupContent);
          markersLayerRef.current.addLayer(marker);
        });

        if (latLngBounds.length > 0 && mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(latLngBounds, { padding: [60, 60], maxZoom: 14 });
        }
      }
    }

    initEmergencyMap();

    return () => {
      isMounted = false;
    };
  }, [alerts]);

  return (
    <div className="relative w-full h-[460px] rounded-2xl overflow-hidden border border-rose-900/60 bg-slate-900 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Emergency Legend */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl text-xs space-y-1.5 shadow-xl">
        <span className="font-bold text-[11px] text-rose-400 block mb-1 uppercase tracking-wider flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
          <span>Distress Pin Legend</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-600 shadow-sm shadow-rose-600/50" />
          <span className="text-slate-300 font-medium">Active / Dispatched SOS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="text-slate-300 font-medium">Resolved Emergency</span>
        </div>
      </div>
    </div>
  );
}
