const express = require('express');
const router = express.Router();
const Marker = require('../models/Marker');
const Route = require('../models/Route');
const verifyAdmin = require('../middleware/auth');

// --- RUTAS PÚBLICAS (Llamadas desde el mapa público) ---

// Obtener todos los marcadores
router.get('/markers', async (req, res) => {
  try {
    const markers = await Marker.find();
    res.json(markers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener todas las rutas/políneas
router.get('/routes', async (req, res) => {
  try {
    const routes = await Route.find();
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- RUTAS PROTEGIDAS (Solo Administradores) ---

// Crear un nuevo marcador
router.post('/markers', verifyAdmin, async (req, res) => {
  try {
    const { name, category, description, coordinates } = req.body;
    const newMarker = new Marker({
      name,
      category,
      description,
      location: { type: 'Point', coordinates } // [longitud, latitud]
    });
    await newMarker.save();
    res.status(201).json(newMarker);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Crear una nueva ruta (PolyLine)
router.post('/routes', verifyAdmin, async (req, res) => {
  try {
    const { name, color, coordinates } = req.body;
    const newRoute = new Route({
      name,
      color,
      path: { type: 'LineString', coordinates } // [[long, lat], [long, lat], ...]
    });
    await newRoute.save();
    res.status(201).json(newRoute);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;