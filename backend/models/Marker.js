const mongoose = require('mongoose');

const markerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true }, // ej: atraccion, restaurante, baño
  description: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitud, latitud]
  }
});

markerSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Marker', markerSchema);