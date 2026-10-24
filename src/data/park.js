import parkPlaces from "../../mapa_parque_categorizado.json";

export const parkCenter = [-75.49483187315003, 6.264523683101534];

export const pointsOfInterest = parkPlaces.map((place) => ({
  id: place.id,
  name: place.nombre.trim(),
  category: place.categoria.trim(),
  description: place.descripcion,
  icon: "📍",
  hours: place.horario,
  accessibility: place.categoria_accesible,
  position: [place.coords[1], place.coords[0]],
}));

export const categories = [
  "Todas",
  ...new Set(pointsOfInterest.map((point) => point.category)),
].sort((a, b) => (a === "Todas" ? -1 : b === "Todas" ? 1 : a.localeCompare(b, "es")));

export const routes = {
  suggested: {
    label: "Recorrido sugerido",
    color: "#e76f35",
    coordinates: [
      [-75.49483187315003, 6.264523683101534],
      [-75.4938, 6.2654],
      [-75.4961, 6.2649],
      [-75.4955, 6.2637],
      [-75.4936, 6.2639],
    ],
  },
  accessible: {
    label: "Recorrido accesible",
    color: "#247b78",
    coordinates: [
      [-75.49483187315003, 6.264523683101534],
      [-75.4961, 6.2649],
      [-75.4955, 6.2637],
      [-75.4936, 6.2639],
    ],
  },
};
