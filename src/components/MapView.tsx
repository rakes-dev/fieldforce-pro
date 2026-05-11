import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon in leaflet
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type?: 'user' | 'shop';
}

interface MapPath {
  lat: number;
  lng: number;
}

interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markerPosition?: { lat: number; lng: number } | null;
  markerLabel?: string;
  circleRadius?: number; // in meters
  extraMarkers?: MapMarker[];
  routePath?: MapPath[];
}

const ShopIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/606/606363.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export const MapView: React.FC<MapViewProps> = ({ 
  center, 
  zoom = 15, 
  markerPosition, 
  markerLabel = "Current Location",
  circleRadius,
  extraMarkers = [],
  routePath = []
}) => {
  // Safety check for center coordinates
  const isValidCenter = typeof center?.lat === 'number' && typeof center?.lng === 'number' && !isNaN(center.lat) && !isNaN(center.lng);
  
  if (!isValidCenter) {
    return (
      <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-zinc-50 text-zinc-400 text-xs font-medium">
        Invalid map coordinates
      </div>
    );
  }

  // Filter extra markers for valid coordinates
  const validExtraMarkers = extraMarkers.filter(m => 
    typeof m?.lat === 'number' && typeof m?.lng === 'number' && !isNaN(m.lat) && !isNaN(m.lng)
  );

  const polylinePath = routePath.map(p => [p.lat, p.lng] as [number, number]);

  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden shadow-inner border border-slate-200">
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom={false} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={[center.lat, center.lng]} zoom={zoom} />
        
        {markerPosition && typeof markerPosition.lat === 'number' && typeof markerPosition.lng === 'number' && !isNaN(markerPosition.lat) && !isNaN(markerPosition.lng) && (
          <Marker position={[markerPosition.lat, markerPosition.lng]}>
            <Popup>{markerLabel}</Popup>
          </Marker>
        )}

        {validExtraMarkers.map(m => (
          <Marker 
            key={m.id} 
            position={[m.lat, m.lng]} 
            icon={m.type === 'shop' ? ShopIcon : DefaultIcon}
          >
            <Popup>
              <div className="font-bold">{m.label}</div>
              {m.type === 'shop' && <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Registered Shop</div>}
            </Popup>
          </Marker>
        ))}

        {polylinePath.length > 1 && (
          <Polyline 
            positions={polylinePath} 
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7 }} 
          />
        )}

        {circleRadius && markerPosition && typeof markerPosition.lat === 'number' && (
          <Circle 
            center={[markerPosition.lat, markerPosition.lng]} 
            radius={circleRadius}
            pathOptions={{ fillColor: 'blue', fillOpacity: 0.1, color: 'blue', weight: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
};
