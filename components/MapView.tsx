import React, { useEffect, useRef } from 'react';
import { Contractor } from '../types';
import L from 'leaflet';

interface MapViewProps {
  contractors: Contractor[];
}

// Fix for default icon issue with webpack/bundlers
const defaultIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

const MapView: React.FC<MapViewProps> = ({ contractors }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      // Initialize map
      mapInstance.current = L.map(mapRef.current).setView([43.5, -79.7], 10); // Centered on the GTA
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance.current);
      markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    }
  }, []);

  useEffect(() => {
    if (markersLayer.current && mapInstance.current) {
      // Clear existing markers
      markersLayer.current.clearLayers();

      if (contractors.length > 0) {
        const bounds = L.latLngBounds([]);
        contractors.forEach(contractor => {
          const marker = L.marker([contractor.lat, contractor.lng], { icon: defaultIcon });
          marker.bindPopup(`
            <div style="font-family: Inter, sans-serif;">
              <h4 style="font-weight: bold; margin: 0 0 5px 0;">${contractor.name}</h4>
              <p style="margin: 0; font-size: 12px; color: #555;">${contractor.category}</p>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #555;">${contractor.location}</p>
            </div>
          `);
          markersLayer.current?.addLayer(marker);
          bounds.extend([contractor.lat, contractor.lng]);
        });
        // Fit map to markers
        mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
      } else {
        // If no contractors, reset view
        mapInstance.current.setView([43.5, -79.7], 10);
      }
    }
  }, [contractors]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
};

export default MapView;
