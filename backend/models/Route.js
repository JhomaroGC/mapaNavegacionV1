const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: '#3388ff' },
  path: {
    type: { type: String, enum: ['LineString'], default: 'LineString' },
    coordinates: { type: [[Number]], required: true } // [[long, lat], [long, lat], ...]
  }
});

module.exports = mongoose.model('Route', routeSchema);