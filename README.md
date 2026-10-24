# Mapa interactivo del Parque Comfama Arví

Prototipo frontend para explorar puntos de interés y recorridos sugeridos o accesibles en un parque. Está construido con React, Vite y Leaflet; por ahora usa datos locales de demostración y no necesita backend ni credenciales.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Desarrollo local

```bash
npm install
npm run dev
```

Vite mostrará la URL local en la terminal. Para generar la versión de producción:

```bash
npm run build
```

## Datos del mapa

Los puntos de interés, horarios y categorías se cargan desde [`mapa_parque_categorizado.json`](./mapa_parque_categorizado.json). [`src/data/park.js`](./src/data/park.js) adapta sus campos al formato que consume la interfaz y genera los filtros a partir de las categorías disponibles. Las líneas de recorrido en el mapa siguen siendo ilustrativas; sus trazados deben sustituirse por rutas verificadas.

El archivo de puntos almacena coordenadas como `[latitud, longitud]`. La adaptación las convierte a `[longitud, latitud]` y la interfaz las transforma al orden `[latitud, longitud]` que espera Leaflet.

El mapa usa teselas de OpenStreetMap con la atribución requerida. Antes de desplegar a producción, revisa la política de uso de teselas de OpenStreetMap y selecciona un proveedor adecuado para el tráfico esperado.
