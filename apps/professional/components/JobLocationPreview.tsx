"use client";

import { useEffect, useRef } from "react";
import { Navigation, ExternalLink, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface JobLocationPreviewProps {
  lat: number;
  lng: number;
  address: string;
}

export default function JobLocationPreview({ lat, lng, address }: JobLocationPreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initPreviewMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = await import("leaflet");
      if (!isMounted || !mapContainerRef.current) return;

      const customDestinationIcon = L.divIcon({
        className: "custom-dest-pin",
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            background: #10b981;
            color: white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 10px rgba(16,185,129,0.4);
            border: 2px solid white;
          ">
            <svg style="transform: rotate(45deg); width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      L.marker([lat, lng], { icon: customDestinationIcon }).addTo(map);

      mapInstanceRef.current = map;
    }

    initPreviewMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng]);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="space-y-3">
      {/* Mini Map Preview */}
      <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        <div className="absolute top-2 left-2 z-10 bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 shadow">
          GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 truncate max-w-[200px] flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" /> {address}
        </span>

        {/* Turn-by-turn Navigation Button */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all shrink-0"
        >
          <Navigation className="h-3.5 w-3.5" />
          <span>Navigate to Customer</span>
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
      </div>
    </div>
  );
}

