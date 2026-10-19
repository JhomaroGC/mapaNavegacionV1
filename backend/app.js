require('dotenv').config();
//const admin=require('./backend/node_modules/firebase-admin')

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const requiredEnv = [
'MONGO_URI',
'FIREBASE_PROJECT_ID',
'FIREBASE_CLIENT_EMAIL',
'FIREBASE_PRIVATE_KEY',
];

for (const name of requiredEnv) {
if (!process.env[name]) {
throw new Error(`Falta la variable de entorno ${name}`);
}
}

const mapRoutes = require('./routes/map');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (req, res) => {
res.json({ status: 'ok' });
});

app.use('/api', mapRoutes);

async function startServer() {
try {
await mongoose.connect(process.env.MONGO_URI);
app.listen(port, () => {
console.log(`Backend escuchando en el puerto ${port}`);
});
} catch (error) {
console.error('No se pudo iniciar el backend:', error);
process.exit(1);
}
}

startServer();