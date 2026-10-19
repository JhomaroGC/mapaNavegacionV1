# GEMINI.md — Contexto, Reglas y Arquitectura del Proyecto

Este documento define la arquitectura, las convenciones de código y las reglas de seguridad para la asistencia de IA en el desarrollo del Mapa Interactivo del Parque de Diversiones.

---

## 1. Visión General
Aplicación web interactiva para visualizar puntos de interés (POIs) y rutas dentro de un parque de diversiones, con un panel de administración para gestionar marcadores y políneas (`PolyLines`).

---

## 2. Stack Tecnológico

* **Entorno de Desarrollo:** GitHub Codespaces.
* **Frontend:** React + Leaflet / MapLibre GL JS (Desplegado en Vercel/Netlify).
* **Backend:** Node.js con Express (Desplegado en Render/Fly.io).
* **Base de Datos:** MongoDB Atlas (Cluster M0 Gratuito - Formato GeoJSON).
* **Autenticación:** Firebase Authentication (Google Sign-In).

---

## 3. Seguridad y Variables de Entorno

* **Prohibido colocar llaves de API o credenciales hardcodeadas en el código.**
* Usar siempre `process.env` para acceder a variables sensibles (`MONGO_URI`, `FIREBASE_PRIVATE_KEY`, etc.).
* Verificar que `.env` esté incluido en `.gitignore`.

---

## 4. Convenciones de Base de Datos (GeoJSON)

* **Marcadores (`markers`):** Deben seguir la estructura GeoJSON `Point`: `[longitud, latitud]`.
* **Rutas (`routes`):** Deben seguir la estructura GeoJSON `LineString`: `[[long, lat], [long, lat], ...]`.
* **Coordenadas:** Notación estándar GeoJSON siempre almacena en orden `[Longitud, Latitud]`.

---

## 5. Control de Acceso y Middleware

* **Endpoints Públicos (`GET`):** LECTURA de marcadores y rutas (disponible para todos los visitantes).
* **Endpoints Privados (`POST`, `PUT`, `DELETE`):** ESCRITURA/ELIMINACIÓN de marcadores y rutas protegida con middleware que verifique el token JWT de Firebase para el rol de administrador.

---

## 6. Reglas para la IA

1. Proporciona siempre código completo y funcional, sin marcadores de posición (`// ... resto del código`).
2. Mantén la separación estricta entre cliente (Frontend React) y servidor (Backend Express).
3. Asegura que los componentes de mapas utilicen librerías Open Source para mantenerse dentro de cuotas gratuitas.