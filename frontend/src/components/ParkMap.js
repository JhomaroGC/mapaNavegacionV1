import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

export default function ParkMap() {
  const [markers, setMarkers] = useState([]);
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    // Cargar marcadores y rutas desde tu API Backend
    axios.get('/api/markers').then(res => setMarkers(res.data));
    axios.get('/api/routes').then(res => setRoutes(res.data));
  }, []);

  return (
    <MapContainer center={[4.711, -74.006]} zoom={15} style={{ height: '100vh', width: '100%' }}>
  <TileLayer
  url="https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png"
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
/>

      {/* Renderizado de Marcadores */}
      {markers.map(m => (
        <Marker key={m._id} position={[m.location.coordinates[1], m.location.coordinates[0]]}>
          <Popup>
            <h3>{m.name}</h3>
            <p>{m.description}</p>
          </Popup>
        </Marker>
      ))}

      {/* Renderizado de Políneas / Rutas */}
      {routes.map(r => (
        <Polyline 
          key={r._id} 
          positions={r.path.coordinates.map(coord => [coord[1], coord[0]])} 
          pathOptions={{ color: r.color }} 
        />
      ))}
    </MapContainer>
  );
}