import { useEffect, useMemo, useRef, useState } from "react";
import googleLogo from "./assets/google.svg";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import L from "leaflet";
import { parkCenter } from "./data/park.js";
import { auth, db, googleProvider } from "./firebase.js";

const createMarkerIcon = (index) =>
  L.divIcon({
    className: "poi-marker",
    html: `<span class="poi-marker__dot">${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [20, 20],
  });

const RECORDED_ROUTES_STORAGE_KEY = "parque-arvi-recorded-routes";

const toLeafletPosition = ([longitude, latitude]) => [latitude, longitude];

function MapFocus({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(toLeafletPosition(position), 18, { duration: 0.5 });
    }
  }, [map, position]);

  return null;
}
function UserLocationFocus({ position }) {
  const map = useMap();
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (position && !hasCenteredRef.current) {
      map.flyTo(toLeafletPosition(position), 18, { duration: 0.5 });
      hasCenteredRef.current = true;
    }
  }, [map, position]);

  return null;
}

function App() {

  const [activeCategory, setActiveCategory] = useState("Todas");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [pointsOfInterest, setPointsOfInterest] = useState([]);
  const [poisLoading, setPoisLoading] = useState(true);
  const [poisError, setPoisError] = useState("");
  const [authUser, setAuthUser] = useState(undefined);
  const [authError, setAuthError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [routeRecordStatus, setRouteRecordStatus] = useState("idle");
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [recordedRoutes, setRecordedRoutes] = useState([]);
  const [routeRecordError, setRouteRecordError] = useState("");
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [routeStorageReady, setRouteStorageReady] = useState(false);
  const watchIdRef = useRef(null);
  const routeCoordinatesRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const [publishedRoutes, setPublishedRoutes] = useState([]);
  const [deletingRouteId, setDeletingRouteId] = useState(null);
  const [routeDeleteError, setRouteDeleteError] = useState("");
  const [selectedPublishedRouteIds, setSelectedPublishedRouteIds] = useState([]);
  const knownPublishedRouteIdsRef = useRef(new Set());
  const [publishedRoutesLoading, setPublishedRoutesLoading] = useState(true);
  const [publishedRoutesError, setPublishedRoutesError] = useState("");
  const [publishingRouteId, setPublishingRouteId] = useState(null);
  const [routePublishError, setRoutePublishError] = useState("");

  const isAdmin =
    authUser != null &&
    authUser.uid === import.meta.env.VITE_FIREBASE_ADMIN_UID;

  const publishedRouteIds = new Set(
    publishedRoutes.map((publishedRoute) => publishedRoute.id),
  );
  const emptyPoiForm = {
    title: "",
    description: "",
    category: "",
    lat: "",
    lng: "",
    hours: "",
    accessibility: "",
  };

  const [poiForm, setPoiForm] = useState(emptyPoiForm);
  const [editingPoiId, setEditingPoiId] = useState(null);
  const [poiModalOpen, setPoiModalOpen] = useState(false);
  const [poiSaving, setPoiSaving] = useState(false);
  const [poiDeletingId, setPoiDeletingId] = useState(null);
  const [poiFormError, setPoiFormError] = useState("");
  const [poiActionError, setPoiActionError] = useState("");

  const categories = useMemo(
    () => [
      "Todas",
      ...[...new Set(pointsOfInterest.map((point) => point.category))].sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    ],
    [pointsOfInterest],
  );

  const visiblePoints = useMemo(
    () =>
      (activeCategory === "Todas"
        ? pointsOfInterest
        : pointsOfInterest.filter((point) => point.category === activeCategory)
      ).toSorted((a, b) => a.name.localeCompare(b.name, "es")),
    [activeCategory, pointsOfInterest],
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "pois"),
      (snapshot) => {
        try {
          const points = snapshot.docs.map((document) => {
            const data = document.data();
            const { lat, lng } = data;

            if (
              typeof data.title !== "string" ||
              !data.title.trim() ||
              !Number.isFinite(lat) ||
              lat < -90 ||
              lat > 90 ||
              !Number.isFinite(lng) ||
              lng < -180 ||
              lng > 180
            ) {
              throw new Error(
                `El documento ${document.id} tiene datos incompletos o coordenadas inválidas.`,
              );
            }

            return {
              id: document.id,
              name: data.title.trim(),
              category:
                typeof data.category === "string" && data.category.trim()
                  ? data.category.trim()
                  : "Sin categoría",
              description:
                typeof data.description === "string" ? data.description : "",
              icon: "📍",
              hours: typeof data.hours === "string" ? data.hours : "",
              accessibility:
                typeof data.accessibility === "string"
                  ? data.accessibility
                  : "",
              position: [lng, lat],
            };
          });

          setPointsOfInterest(points);
          setPoisError("");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Error desconocido";
          setPoisError(`No se pudieron procesar los puntos de Firestore: ${message}`);
        } finally {
          setPoisLoading(false);
        }
      },
      (error) => {
        setPoisError(
          `No se pudieron cargar los puntos de Firestore (${error.code}).`,
        );
        setPoisLoading(false);
      },
    );

    return unsubscribe;
  }, []);
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "routes"),
      (snapshot) => {
        try {
          const routesFromFirestore = snapshot.docs.map((document) => {
            const data = document.data();

            if (
              typeof data.name !== "string" ||
              !data.name.trim() ||
              !Array.isArray(data.coordinates) ||
              data.coordinates.length < 2 ||
              data.coordinates.some(
                (coordinate) =>
                  !coordinate ||
                  typeof coordinate !== "object" ||
                  !Number.isFinite(coordinate.longitude) ||
                  coordinate.longitude < -180 ||
                  coordinate.longitude > 180 ||
                  !Number.isFinite(coordinate.latitude) ||
                  coordinate.latitude < -90 ||
                  coordinate.latitude > 90,
              )
            ) {
              throw new Error(
                `El documento ${document.id} tiene datos incompletos o coordenadas inválidas.`,
              );
            }

            return {
              id: document.id,
              name: data.name.trim(),
              category: data.category === "Sendero" ? "Sendero" : "Principal",
              coordinates: data.coordinates.map(({ longitude, latitude }) => [
                longitude,
                latitude,
              ]),
              startedAt:
                typeof data.startedAt === "string" ? data.startedAt : null,
              createdAt:
                typeof data.createdAt === "string" ? data.createdAt : null,
            };
          });
          const currentRouteIds = new Set(
            routesFromFirestore.map((route) => route.id),
          );
          const newRouteIds = [...currentRouteIds].filter(
            (id) => !knownPublishedRouteIdsRef.current.has(id),
          );

          knownPublishedRouteIdsRef.current = currentRouteIds;

          setSelectedPublishedRouteIds((selectedIds) => [
            ...new Set([
              ...selectedIds.filter((id) => currentRouteIds.has(id)),
              ...newRouteIds,
            ]),
          ]);
          setPublishedRoutes(routesFromFirestore);
          setPublishedRoutesError("");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Error desconocido";
          setPublishedRoutes([]);
          setPublishedRoutesError(
            `No se pudieron procesar las rutas de Firestore: ${message}`,
          );
        } finally {
          setPublishedRoutesLoading(false);
        }
      },
      (error) => {
        setPublishedRoutesError(
          `No se pudieron cargar las rutas de Firestore (${error.code}).`,
        );
        setPublishedRoutesLoading(false);
      },
    );

    return unsubscribe;
  }, []);
  useEffect(() => {
    try {
      const storedRoutes = window.localStorage.getItem(
        RECORDED_ROUTES_STORAGE_KEY,
      );
      const parsedRoutes = storedRoutes ? JSON.parse(storedRoutes) : [];

      if (
        !Array.isArray(parsedRoutes) ||
        parsedRoutes.some(
          (savedRoute) =>
            typeof savedRoute.id !== "string" ||
            typeof savedRoute.name !== "string" ||
            !Array.isArray(savedRoute.coordinates) ||
            savedRoute.coordinates.length < 2 ||
            savedRoute.coordinates.some(
              (coordinate) =>
                !Array.isArray(coordinate) ||
                coordinate.length !== 2 ||
                !Number.isFinite(coordinate[0]) ||
                coordinate[0] < -180 ||
                coordinate[0] > 180 ||
                !Number.isFinite(coordinate[1]) ||
                coordinate[1] < -90 ||
                coordinate[1] > 90,
            ),
        )
      ) {
        throw new Error("El contenido guardado no tiene un formato de ruta válido.");
      }

      setRecordedRoutes(
        parsedRoutes.map((savedRoute) => ({
          ...savedRoute,
          category: savedRoute.category === "Sendero" ? "Sendero" : "Principal",
        })),
      );
      setRouteStorageReady(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      setRouteRecordError(`No se pudieron cargar las rutas locales: ${message}`);
    } finally {
      setRoutesLoaded(true);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (user) => {
        setAuthUser(user);
        setAuthError("");
      },
      (error) => {
        setAuthUser(null);
        setAuthError(`No se pudo comprobar la sesión (${error.code}).`);
      },
    );
  }, []);
  useEffect(() => {
    if (!authUser) {
      setUserLocation(null);
      setLocationError("");
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocationError("Este navegador no ofrece geolocalización.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const { latitude, longitude, heading } = coords;

        if (
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90 ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180
        ) {
          setLocationError("El navegador devolvió una ubicación inválida.");
          return;
        }

        setUserLocation({
          position: [longitude, latitude],
          heading: Number.isFinite(heading) ? heading : null,
        });
        setLocationError("");
      },
      (error) => {
        const messages = {
          1: "Permite el acceso a la ubicación en el navegador para mostrar tu posición.",
          2: "No se pudo determinar tu ubicación.",
          3: "La solicitud de ubicación agotó el tiempo de espera.",
        };

        setLocationError(
          messages[error.code] ?? "Ocurrió un error al obtener la ubicación.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [authUser]);

  async function handleGoogleSignIn() {
    setAuthError("");

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(
        `No se pudo iniciar sesión (${error.code ?? "error desconocido"}).`,
      );
    }
  }
  useEffect(() => {
    if (!isAdmin && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setRouteRecordStatus(
        routeCoordinatesRef.current.length > 0 ? "paused" : "idle",
      );
    }
  }, [isAdmin]);

  async function handleSignOut() {
    setAuthError("");

    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(
        `No se pudo cerrar sesión (${error.code ?? "error desconocido"}).`,
      );
    }
  }

  function selectPoint(point) {
    setSelectedPoint(point);
  }

  function openNewPoiModal() {
    setPoiForm(emptyPoiForm);
    setEditingPoiId(null);
    setPoiFormError("");
    setPoiModalOpen(true);
  }

  function openEditPoiModal(point) {
    const [lng, lat] = point.position;

    setPoiForm({
      title: point.name,
      description: point.description,
      category: point.category,
      lat: String(lat),
      lng: String(lng),
      hours: point.hours,
      accessibility: point.accessibility,
    });
    setEditingPoiId(point.id);
    setPoiFormError("");
    setPoiModalOpen(true);
  }

  async function handlePoiSubmit(event) {
    event.preventDefault();
    setPoiFormError("");

    if (!isAdmin || !authUser) {
      setPoiFormError("Debes iniciar sesión con una cuenta administradora.");
      return;
    }

    const title = poiForm.title.trim();
    const category = poiForm.category.trim();
    const lat = Number(poiForm.lat);
    const lng = Number(poiForm.lng);

    if (!title || !category || poiForm.lat.trim() === "" || poiForm.lng.trim() === "") {
      setPoiFormError("Nombre, categoría, latitud y longitud son obligatorios.");
      return;
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setPoiFormError("La latitud debe ser un número entre -90 y 90.");
      return;
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setPoiFormError("La longitud debe ser un número entre -180 y 180.");
      return;
    }

    const poiData = {
      title,
      description: poiForm.description.trim(),
      category,
      lat,
      lng,
      hours: poiForm.hours.trim(),
      accessibility: poiForm.accessibility.trim(),
    };

    setPoiSaving(true);

    try {
      if (editingPoiId) {
        await updateDoc(doc(db, "pois", editingPoiId), {
          ...poiData,
          updated_at: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "pois"), {
          ...poiData,
          created_at: serverTimestamp(),
        });
      }

      setPoiModalOpen(false);
      setEditingPoiId(null);
      setPoiForm(emptyPoiForm);
    } catch (error) {
      const code = error instanceof Error ? error.code : "error desconocido";
      setPoiFormError(`No se pudo guardar el punto (${code}).`);
    } finally {
      setPoiSaving(false);
    }
  }

  async function handleDeletePoi(point) {
    if (!isAdmin || !authUser) {
      setPoiActionError("Debes iniciar sesión con una cuenta administradora.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar permanentemente “${point.name}”? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) return;

    setPoiActionError("");
    setPoiDeletingId(point.id);

    try {
      await deleteDoc(doc(db, "pois", point.id));

      if (selectedPoint?.id === point.id) {
        setSelectedPoint(null);
      }
    } catch (error) {
      const code = error instanceof Error ? error.code : "error desconocido";
      setPoiActionError(`No se pudo eliminar “${point.name}” (${code}).`);
    } finally {
      setPoiDeletingId(null);
    }
  }

  function startGpsWatch() {
    if (!isAdmin || !authUser) {
      setRouteRecordError("Debes iniciar sesión con una cuenta administradora.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setRouteRecordError("Este navegador no ofrece geolocalización.");
      return;
    }

    setRouteRecordError("");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90 ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180
        ) {
          setRouteRecordError("El GPS devolvió coordenadas inválidas.");
          return;
        }

        const nextCoordinates = [
          ...routeCoordinatesRef.current,
          [longitude, latitude],
        ];

        routeCoordinatesRef.current = nextCoordinates;
        setRouteCoordinates(nextCoordinates);
        setRouteRecordError("");
      },
      (error) => {
        const messages = {
          1: "Permiso de ubicación denegado. Habilítalo en el navegador para grabar.",
          2: "No se pudo determinar la ubicación del dispositivo.",
          3: "La solicitud de ubicación agotó el tiempo de espera.",
        };

        setRouteRecordError(
          messages[error.code] ?? "Ocurrió un error al obtener la ubicación.",
        );

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        setRouteRecordStatus("paused");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );

    setRouteRecordStatus("recording");
  }

  function startRouteRecording() {
    routeCoordinatesRef.current = [];
    setRouteCoordinates([]);
    recordingStartedAtRef.current = new Date().toISOString();
    startGpsWatch();
  }

  function pauseRouteRecording() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setRouteRecordStatus("paused");
  }

  function resumeRouteRecording() {
    if (routeCoordinatesRef.current.length === 0) {
      setRouteRecordError("Inicia una grabación nueva antes de reanudar.");
      return;
    }

    startGpsWatch();
  }

  function finishRouteRecording() {
    pauseRouteRecording();
    setRouteRecordError("");

    const coordinates = routeCoordinatesRef.current;

    if (coordinates.length < 2) {
      setRouteRecordError(
        "Registra al menos dos ubicaciones GPS antes de finalizar una ruta.",
      );
      return;
    }

    if (!routesLoaded || !routeStorageReady) {
      setRouteRecordError(
        "El almacenamiento local no está listo; no se guardó la ruta.",
      );
      return;
    }

    const defaultName = `Recorrido ${new Date().toLocaleString("es-CO")}`;
    const enteredName = window.prompt("Nombre para este recorrido:", defaultName);

    if (enteredName === null) {
      return;
    }

    const name = enteredName.trim();

    if (!name) {
      setRouteRecordError("El nombre del recorrido no puede estar vacío.");
      return;
    }

    const enteredCategory = window.prompt(
      "Categoría del recorrido:\n1. Principal\n2. Sendero",
      "1",
    );

    if (enteredCategory === null) {
      return;
    }

    const categoryByOption = {
      "1": "Principal",
      "2": "Sendero",
    };
    const category = categoryByOption[enteredCategory.trim()];

    if (!category) {
      setRouteRecordError("Elige 1 para Principal o 2 para Sendero.");
      return;
    }

    const newRoute = {
      id: crypto.randomUUID(),
      name,
      category,
      startedAt: recordingStartedAtRef.current,
      createdAt: new Date().toISOString(),
      coordinates: coordinates.map(([longitude, latitude]) => [
        longitude,
        latitude,
      ]),
    };
    const nextRoutes = [...recordedRoutes, newRoute];

    try {
      window.localStorage.setItem(
        RECORDED_ROUTES_STORAGE_KEY,
        JSON.stringify(nextRoutes),
      );
      setRecordedRoutes(nextRoutes);
      routeCoordinatesRef.current = [];
      setRouteCoordinates([]);
      recordingStartedAtRef.current = null;
      setRouteRecordStatus("idle");
    } catch (error) {
      const code = error instanceof Error ? error.name : "error desconocido";
      setRouteRecordError(`No se pudo guardar la ruta localmente (${code}).`);
    }
  }
  async function publishRecordedRoute(savedRoute) {
    if (!isAdmin || !authUser) {
      setRoutePublishError(
        "Debes iniciar sesión con una cuenta administradora para publicar rutas.",
      );
      return;
    }

    setRoutePublishError("");
    setPublishingRouteId(savedRoute.id);

    try {
      await setDoc(doc(db, "routes", savedRoute.id), {
        name: savedRoute.name,
        category: savedRoute.category,
        startedAt: savedRoute.startedAt ?? null,
        createdAt: savedRoute.createdAt,
        coordinates: savedRoute.coordinates.map(([longitude, latitude]) => ({
          longitude,
          latitude,
        })),
        publishedAt: serverTimestamp(),
      });
    } catch (error) {
      const code = error instanceof Error ? error.code : "error desconocido";
      setRoutePublishError(`No se pudo publicar la ruta (${code}).`);
    } finally {
      setPublishingRouteId(null);
    }
  }
  async function deletePublishedRoute(route) {
    if (!isAdmin || !authUser) {
      setRouteDeleteError(
        "Debes iniciar sesión con una cuenta administradora para eliminar rutas.",
      );
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar la ruta publicada “${route.name}”? La copia local del administrador se conservará.`,
    );

    if (!confirmed) return;

    setRouteDeleteError("");
    setDeletingRouteId(route.id);

    try {
      await deleteDoc(doc(db, "routes", route.id));

      if (activePublishedRouteId === route.id) {
        setActivePublishedRouteId(null);
      }
    } catch (error) {
      const code = error instanceof Error ? error.code : "error desconocido";
      setRouteDeleteError(`No se pudo eliminar la ruta (${code}).`);
    } finally {
      setDeletingRouteId(null);
    }
  }
  function downloadRecordedRoute(savedRoute) {
    const geoJson = {
      type: "Feature",
      properties: {
        name: savedRoute.name,
        startedAt: savedRoute.startedAt,
        createdAt: savedRoute.createdAt,
      },
      geometry: {
        type: "LineString",
        coordinates: savedRoute.coordinates,
      },
    };

    try {
      const blob = new Blob([JSON.stringify(geoJson, null, 2)], {
        type: "application/geo+json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = savedRoute.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-|-$/g, "");

      link.href = url;
      link.download = `${safeName || "recorrido"}.geojson`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      const code = error instanceof Error ? error.name : "error desconocido";
      setRouteRecordError(`No se pudo descargar el GeoJSON (${code}).`);
    }
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="brand">
          <span className="brand__mark" aria-hidden="true">
          ⛰︎
          </span>
          <div>
            <p className="eyebrow">EXPLORA A TU RITMO</p>
            <h1>Parque Comfama Arví</h1>
          </div>
        </header>

        <section className="auth-panel" aria-label="Cuenta">
          {authUser === undefined ? (
            <p>Comprobando sesión...</p>
          ) : authUser ? (
            <>
              <p>
                Sesión iniciada: {authUser.displayName || authUser.email}
              </p>
              <button type="button" onClick={handleSignOut}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <button type="button" onClick={handleGoogleSignIn}>
               <img src={googleLogo} alt="" aria-hidden="true" />
              Continúa con Google y Navega
            </button>
          )}

          {authError && <p role="alert">{authError}</p>}
          {locationError && <p role="alert">{locationError}</p>}
          <p>
            {isAdmin
              ? "Acceso de administrador."
              : ""}
          </p>
        </section>

        {isAdmin && (
          <section className="route-recorder" aria-labelledby="recorder-heading">
            <h2 id="recorder-heading">Grabar recorrido</h2>

            <p role="status">
              {routeRecordStatus === "recording"
                ? `Grabando GPS: ${routeCoordinates.length} ubicaciones`
                : routeRecordStatus === "paused"
                  ? `Grabación pausada: ${routeCoordinates.length} ubicaciones`
                  : "Grabación detenida"}
            </p>

            {routeRecordStatus === "idle" && (
              <button
                className="route-recorder__start-button"
                type="button"
                onClick={startRouteRecording}
                disabled={!routesLoaded || !routeStorageReady}
              >
                Iniciar grabación GPS
              </button>
            )}

            {routeRecordStatus === "recording" && (
              <>
                <button type="button" onClick={pauseRouteRecording}>
                  Pausar
                </button>
                <button type="button" onClick={finishRouteRecording}>
                  Finalizar y guardar
                </button>
              </>
            )}

            {routeRecordStatus === "paused" && (
              <>
                {routeCoordinates.length === 0 ? (
                  <button type="button" onClick={startRouteRecording}>
                    Reintentar grabación
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={resumeRouteRecording}>
                      Reanudar
                    </button>
                    <button type="button" onClick={finishRouteRecording}>
                      Finalizar y guardar
                    </button>
                  </>
                )}
              </>
            )}

            {!routesLoaded && <p role="status">Cargando rutas guardadas...</p>}
            {!routeStorageReady && routesLoaded && (
              <p role="alert">
                El almacenamiento local no está disponible; no se puede guardar.
              </p>
            )}
            {routeRecordError && <p role="alert">{routeRecordError}</p>}
            {routePublishError && <p role="alert">{routePublishError}</p>}
            {recordedRoutes.length > 0 && (
              <div>
                <h3>Rutas guardadas en este dispositivo</h3>
                <ul>
                  {recordedRoutes.map((savedRoute) => (
                    <li key={savedRoute.id}>
                      <span>{savedRoute.name}</span>
                      <button
                        className="route-recorder__download-button"
                        type="button"
                        onClick={() => downloadRecordedRoute(savedRoute)}
                      >
                        Descargar GeoJSON
                      </button>
                      {publishedRouteIds.has(savedRoute.id) ? (
                        <span>Publicada</span>
                      ) : (
                        <button
                          className="route-recorder__publish-button"
                          type="button"
                          onClick={() => publishRecordedRoute(savedRoute)}
                          disabled={publishingRouteId === savedRoute.id}
                        >
                          {publishingRouteId === savedRoute.id
                            ? "Publicando..."
                            : "Publicar"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        <section className="route-picker" aria-labelledby="published-routes-heading">
          <h2 id="published-routes-heading">Rutas</h2>

          {publishedRoutesLoading && (
            <p role="status">Cargando rutas publicadas...</p>
          )}

          {publishedRoutesError && <p role="alert">{publishedRoutesError}</p>}

          {!publishedRoutesLoading &&
            !publishedRoutesError &&
            publishedRoutes.length === 0 && (
              <p>Aún no hay rutas publicadas.</p>
            )}

          {publishedRoutes.length > 0 && (
            <div className="route-options" role="group" aria-label="Seleccionar ruta visible">
              {publishedRoutes.map((publishedRoute) => {
                const isSelected = selectedPublishedRouteIds.includes(
                  publishedRoute.id,
                );

                return (
                  <div className="route-option-row" key={publishedRoute.id}>
                    <label className={`route-option${isSelected ? " is-active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          const checked = event.target.checked;

                          setSelectedPublishedRouteIds((selectedIds) =>
                            checked
                              ? [...selectedIds, publishedRoute.id]
                              : selectedIds.filter((id) => id !== publishedRoute.id),
                          );
                        }}
                        aria-label={`Mostrar ruta ${publishedRoute.name}`}
                      />
                      <span
                        className={`route-option__line${publishedRoute.category === "Sendero"
                          ? " route-option__line--accessible"
                          : ""
                          }`}
                        aria-hidden="true"
                      />
                      <span>{publishedRoute.name}</span>
                    </label>

                    {isAdmin && (
                      <button
                        className="route-delete-button"
                        type="button"
                        onClick={() => deletePublishedRoute(publishedRoute)}
                        disabled={deletingRouteId === publishedRoute.id}
                        aria-label={`Eliminar ruta publicada ${publishedRoute.name}`}
                      >
                        {deletingRouteId === publishedRoute.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="places" aria-labelledby="places-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DESCUBRE EL PARQUE</p>
              <h2 id="places-heading">Puntos de interés</h2>
            </div>
            <span className="place-count">{visiblePoints.length}</span>
          </div>
          {isAdmin && (
            <button
              className="route-recorder__start-button"
              type="button" onClick={openNewPoiModal}>
              Agregar punto
            </button>
          )}

          {poiActionError && <p role="alert">{poiActionError}</p>}

          {poisLoading && <p role="status">Cargando puntos del parque...</p>}
          {poisError && <p role="alert">{poisError}</p>}
          {!poisLoading && !poisError && pointsOfInterest.length === 0 && (
            <p>No hay puntos en la colección pois de Firestore.</p>
          )}

          {!poisLoading && !poisError && pointsOfInterest.length > 0 && (
            <>
              <div
                className="category-filters"
                aria-label="Filtrar por categoría"
              >
                {categories.map((category) => (
                  <button
                    className={`filter-chip${activeCategory === category ? " is-active" : ""}`}
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    type="button"
                    aria-pressed={activeCategory === category}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <ul className="place-list">
                {visiblePoints.map((point, index) => (

                  <li className="place-list-item" key={point.id}>
                    <button
                      className={`place-card${selectedPoint?.id === point.id ? " is-selected" : ""}`}
                      onClick={() => selectPoint(point)}
                      type="button"
                    >
                      <span className="place-card__icon" aria-hidden="true">
                        {point.icon}
                      </span>
                      <span className="place-card__copy">
                        <span className="place-card__name">{index + 1} {point.name}</span>
                        <span className="place-card__category">{point.category}</span>
                      </span>
                      <span className="place-card__arrow" aria-hidden="true">›</span>
                    </button>

                    {isAdmin && (
                      <div className="place-admin-actions">
                        <button
                          type="button"
                          onClick={() => openEditPoiModal(point)}
                          aria-label={`Editar ${point.name}`}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePoi(point)}
                          disabled={poiDeletingId === point.id}
                          aria-label={`Eliminar ${point.name}`}
                        >
                          {poiDeletingId === point.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </aside>

      <section className="map-panel" aria-label="Mapa interactivo del parque">
        <div className="map-heading">
          <span className="map-heading__status" aria-hidden="true" />
          {/* <span>{route.label}</span> */}
          <span className="map-heading__divider" />
          <span>{visiblePoints.length} lugares</span>
        </div>

        <MapContainer
          center={toLeafletPosition(parkCenter)}
          zoom={16}
          scrollWheelZoom
          className="map"
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
            attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          />

          <MapFocus position={selectedPoint?.position} />
          <UserLocationFocus position={userLocation?.position} />
          {userLocation && (
            <Marker
              position={toLeafletPosition(userLocation.position)}
              icon={L.divIcon({
                className: "user-location-marker",
                html: `
    <span
      class="user-location-marker__dot"
      style="transform: rotate(${userLocation.heading ?? 0}deg)"
    >
      ${userLocation.heading === null
                    ? ""
                    : '<span class="user-location-marker__arrow"></span>'
                  }
    </span>
  `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              })}
            >
              <Popup>{authUser?.displayName || authUser?.email || "Usuario"}</Popup>
            </Marker>
          )}

          {publishedRoutes.map((publishedRoute, index) =>
            selectedPublishedRouteIds.includes(publishedRoute.id) ? (
              <Polyline
                key={publishedRoute.id}
                positions={publishedRoute.coordinates.map(toLeafletPosition)}
                pathOptions={{
                  color: ["#d6335c", "#5b6ee1", "#d28a27", "#8a55a2"][
                    index % 4
                  ],
                  weight: 5,
                  opacity: 0.9,
                  dashArray:
                    publishedRoute.category === "Sendero" ? "6 6" : undefined,
                }}
              />
            ) : null,
          )}
          {isAdmin && routeCoordinates.length >= 2 && (
            <Polyline
              positions={routeCoordinates.map(toLeafletPosition)}
              pathOptions={{
                color: "#d6335c",
                weight: 5,
                opacity: 0.9,
              }}
            />
          )}

          {isAdmin &&
            recordedRoutes
              .filter((savedRoute) => !publishedRouteIds.has(savedRoute.id))
              .map((savedRoute, index) => (
                <Polyline
                  key={savedRoute.id}
                  positions={savedRoute.coordinates.map(toLeafletPosition)}
                  pathOptions={{
                    color: ["#5b6ee1", "#d28a27", "#8a55a2"][index % 3],
                    weight: 4,
                    opacity: 0.8,
                  }}
                />
              ))}
          {visiblePoints.map((point, index) => (
            <Marker
              icon={createMarkerIcon(index)}
              key={point.id}
              position={toLeafletPosition(point.position)}
              eventHandlers={{ click: () => selectPoint(point) }}
            >
              <Popup>
                <article className="popup-card">
                  <p className="popup-card__category">
                    {point.icon} {point.category}
                  </p>
                  <h3>{index + 1}. {point.name}</h3>
                  <p>{point.description}</p>
                  <dl>
                    <div>
                      <dt>Horario</dt>
                      <dd>{point.hours || "No informado"}</dd>
                    </div>
                    <div>
                      <dt>Accesibilidad</dt>
                      <dd>{point.accessibility || "No informada"}</dd>
                    </div>
                  </dl>
                </article>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="map-caption">
          <span className="map-caption__icon" aria-hidden="true">
            ⓘ
          </span>
          <span>Selecciona un punto para ver su información</span>
        </div>
      </section>
      {isAdmin && poiModalOpen && (
        <div className="poi-modal-backdrop">
          <section
            className="poi-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="poi-modal-title"
          >
            <h2 id="poi-modal-title">
              {editingPoiId ? "Editar punto" : "Agregar punto"}
            </h2>

            <form onSubmit={handlePoiSubmit}>
              <label>
                Nombre *
                <input
                  required
                  value={poiForm.title}
                  onChange={(event) =>
                    setPoiForm({ ...poiForm, title: event.target.value })
                  }
                />
              </label>

              <label>
                Descripción
                <textarea
                  value={poiForm.description}
                  onChange={(event) =>
                    setPoiForm({ ...poiForm, description: event.target.value })
                  }
                />
              </label>

              <label>
                Categoría *
                <input
                  required
                  value={poiForm.category}
                  onChange={(event) =>
                    setPoiForm({ ...poiForm, category: event.target.value })
                  }
                />
              </label>

              <div className="poi-coordinate-fields">
                <label>
                  Latitud *
                  <input
                    required
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={poiForm.lat}
                    onChange={(event) =>
                      setPoiForm({ ...poiForm, lat: event.target.value })
                    }
                  />
                </label>

                <label>
                  Longitud *
                  <input
                    required
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={poiForm.lng}
                    onChange={(event) =>
                      setPoiForm({ ...poiForm, lng: event.target.value })
                    }
                  />
                </label>
              </div>

              <label>
                Horario
                <input
                  value={poiForm.hours}
                  onChange={(event) =>
                    setPoiForm({ ...poiForm, hours: event.target.value })
                  }
                />
              </label>

              <label>
                Accesibilidad
                <input
                  value={poiForm.accessibility}
                  onChange={(event) =>
                    setPoiForm({ ...poiForm, accessibility: event.target.value })
                  }
                />
              </label>

              {poiFormError && <p role="alert">{poiFormError}</p>}

              <div className="poi-modal-actions">
                <button
                  type="button"
                  onClick={() => setPoiModalOpen(false)}
                  disabled={poiSaving}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={poiSaving}>
                  {poiSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;