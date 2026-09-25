"use client";

import { useEffect, useRef, useState } from "react";
import { Locate, MapPin, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface LocationCoords {
  lat: number;
  lng: number;
}

interface DraggableAddressMapProps {
  initialCoords?: LocationCoords;
  onLocationChange: (coords: LocationCoords) => void;
}

export default function DraggableAddressMap({
  initialCoords = { lat: 40.7128, lng: -74.006 },
  onLocationChange,
}: DraggableAddressMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [coords, setCoords] = useState<LocationCoords>(initialCoords);
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return; // already initialized

      const L = await import("leaflet");

      if (!isMounted || !mapContainerRef.current) return;

      // Custom high-contrast SVG pin icon
      const customPinIcon = L.divIcon({
        className: "custom-leaflet-pin",
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            background: #2563eb;
            color: white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(37,99,235,0.4);
            border: 2px solid white;
          ">
            <svg style="transform: rotate(45deg); width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38],
      });

      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([coords.lat, coords.lng], {
        draggable: true,
        icon: customPinIcon,
      }).addTo(map);

      marker.bindPopup("<b>Service Point</b><br/>Drag to refine exact location.").openPopup();

      marker.on("dragend", (event: any) => {
        const position = event.target.getLatLng();
        const newCoords = {
          lat: parseFloat(position.lat.toFixed(6)),
          lng: parseFloat(position.lng.toFixed(6)),
        };
        setCoords(newCoords);
        onLocationChange(newCoords);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const handleAutoLocate = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setDetecting(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDetecting(false);
        const newCoords = {
          lat: parseFloat(position.coords.latitude.toFixed(6)),
          lng: parseFloat(position.coords.longitude.toFixed(6)),
        };

        setCoords(newCoords);
        onLocationChange(newCoords);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([newCoords.lat, newCoords.lng], 16, {
            duration: 1.2,
          });
          markerRef.current.setLatLng([newCoords.lat, newCoords.lng]);
          markerRef.current.openPopup();
        }
      },
      (error) => {
        setDetecting(false);
        setGeoError(`Unable to detect location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-blue-400" /> Exact Service Location (Draggable Pin)
        </label>
        <button
          type="button"
          onClick={handleAutoLocate}
          disabled={detecting}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/80 rounded-lg transition-colors disabled:opacity-50"
        >
          {detecting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
              <span>Locating...</span>
            </>
          ) : (
            <>
              <Locate className="h-3 w-3 text-blue-400" />
              <span>Auto-Detect My GPS</span>
            </>
          )}
        </button>
      </div>

      {geoError && (
        <div className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2">
          {geoError}
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full h-56 rounded-xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-900">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        <div className="absolute bottom-2 left-2 z-10 bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-300 pointer-events-none shadow-md">
          Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Drag and drop the blue pin directly over your front entrance or unit for precise dispatcher arrival.
      </p>
    </div>
  );
}

