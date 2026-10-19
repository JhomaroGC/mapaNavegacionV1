import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import axios from 'axios';

export default function AdminMap({ token }) {
  const mapRef = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Habilitar controles de dibujo de Geoman
    map.pm.addControls({
      position: 'topleft',
      drawMarker: true,
      drawPolyline: true,
      drawRectangle: false,
      drawPolygon: false,
      drawCircle: false,
      editMode: true,
      dragMode: true,
      removalMode: true,
    });

    // Evento al crear una nueva figura o marcador
    map.on('pm:create', async (e) => {
      const { shape, layer } = e;
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };

      if (shape === 'Marker') {
        const latLng = layer.getLatLng();
        const name = prompt('Nombre del punto de interés:');
        if (!name) return;

        await axios.post('/api/markers', {
          name,
          category: 'General',
          description: 'Punto de interés creado desde el mapa',
          coordinates: [latLng.lng, latLng.lat]
        }, authHeader);

        alert('¡Marcador guardado exitosamente!');
      }

      if (shape === 'Line') {
        const latLngs = layer.getLatLngs();
        const name = prompt('Nombre de la ruta/camino:');
        if (!name) return;

        // Formatear coordenadas para GeoJSON LineString [longitud, latitud]
        const coordinates = latLngs.map(pt => [pt.lng, pt.lat]);

        await axios.post('/api/routes', {
          name,
          color: '#3388ff',
          coordinates
        }, authHeader);

        alert('¡Ruta guardada exitosamente!');
      }
    });

  }, [token]);

  return (
    <MapContainer 
      center={[4.711, -74.006]} 
      zoom={15} 
      style={{ height: '90vh', width: '100%' }}
      ref={mapRef}
    >
<TileLayer
  url="https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png"
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
/>
    </MapContainer>
  );
}