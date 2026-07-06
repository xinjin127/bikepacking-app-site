const state = {
  trips: [],
  trip: null,
  group: "all",
  selectedRegion: "all",
  statusFilter: "all",
  difficultyFilter: "all",
  gravelFilter: "all",
  readinessFilter: "all",
  tripLengthFilter: "all",
  seasonFilter: "all",
  dateStart: "",
  dateEnd: "",
  tripStyleFilters: new Set(),
  planningContextActive: false,
  routeSearch: "",
  selectedRouteId: "__all",
  highlightedRouteId: null,
  campsites: [],
  campsitesLoaded: false,
  campsitesVisible: true,
  selectedCampsiteId: null,
  dispersedAreas: [],
  dispersedAreasVisible: true,
  dispersedAreasLoading: false,
  dispersedAreasError: "",
  dispersedAreasNotice: "",
  dispersedAreasCache: new Map(),
  dispersedAreasRequestKey: "",
  basemap: "fast",
  activeVariants: new Set(),
  routeDetailPromises: new Map(),
  exportPackageUrl: "",
  exportPackageRouteId: "",
  exportPackagePreparingRouteId: "",
  map: {
    zoom: 8,
    center: [-122.3, 38.2],
    renderedZoom: 8,
    renderedCenter: [-122.3, 38.2],
    minZoom: 4,
    maxZoom: 15,
    dragging: false,
    dragStart: null,
    dragCenter: null,
    dragLast: null,
    dragLastTime: 0,
    panVelocity: [0, 0],
    inertiaFrame: null,
    inertiaLastTime: 0,
    wheelSensitivity: 420,
    tileRefreshTimer: null,
    previewFrame: null,
    zoomPreviewing: false,
    tileNodes: new Map(),
  },
};

window.plannerState = state;

const STYLE_FILTERS = [
  { id: "beginner", label: "Beginner-friendly" },
  { id: "low-climbing", label: "Low climbing" },
  { id: "high-gravel", label: "High gravel" },
  { id: "transit", label: "Transit-friendly" },
  { id: "campground", label: "Campground-based" },
  { id: "lodging", label: "Motel/lodging possible" },
  { id: "loop", label: "Loop" },
  { id: "point-to-point", label: "Point-to-point" },
];

const COUNTED_SELECT_FILTERS = [
  { stateKey: "selectedRegion", elKey: "regionFilter" },
  { stateKey: "seasonFilter", elKey: "seasonFilter" },
  { stateKey: "tripLengthFilter", elKey: "tripLengthFilter" },
  { stateKey: "difficultyFilter", elKey: "difficultyFilter" },
  { stateKey: "gravelFilter", elKey: "gravelFilter" },
  { stateKey: "readinessFilter", elKey: "readinessFilter" },
  { stateKey: "statusFilter", elKey: "statusFilter" },
];

const TRIP_FETCH_TIMEOUT_MS = 22000;
const MAX_LOCAL_STORAGE_CACHE_BYTES = 1_500_000;
const OVERVIEW_ROUTE_POINTS = 260;
const OVERVIEW_HIGHLIGHT_POINTS = 1000;
const DETAIL_ROUTE_POINTS = 6000;
const DATA_VERSION = "20260705-export-package-1";
const CAMPSITE_DATA_PATH = "california_route_stay_inventory.geojson";
const BLM_CA_SMA_QUERY_URL = "https://gis.blm.gov/caarcgis/rest/services/lands/BLM_CA_LandStatus_SurfaceManagementAgency/FeatureServer/0/query";
const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});
const DISPERSED_AREA_STYLES = {
  2: { color: "#6f5aa8", label: "BLM candidate land", manager: "BLM" },
  915: { color: "#2f7b58", label: "USFS candidate land", manager: "USFS" },
};
const CAMPSITE_CATEGORY_STYLES = {
  hike_bike_site: { color: "#007c91", label: "Hike/bike" },
  public_bookable_or_permit_campsite: { color: "#2f7b58", label: "Public/bookable" },
  private_campsite_or_lodging: { color: "#8a5a00", label: "Private/lodging" },
  dispersed_allowed_region: { color: "#6f5aa8", label: "Dispersed region" },
};
const TILE_PROVIDERS = {
  fast: {
    name: "Flat / No Topo",
    subdomains: ["a", "b", "c", "d"],
    url: (subdomain, key) => `https://${subdomain}.basemaps.cartocdn.com/rastertiles/voyager/${key}.png`,
  },
  topo: {
    name: "Topo",
    subdomains: ["a", "b", "c"],
    url: (subdomain, key) => `https://${subdomain}.tile.opentopomap.org/${key}.png`,
  },
};

const els = {
  tripSelect: document.querySelector("#tripSelect"),
  tripDescription: document.querySelector("#tripDescription"),
  libraryStats: document.querySelector("#libraryStats"),
  readinessDashboard: document.querySelector("#readinessDashboard"),
  activeFilterSummary: document.querySelector("#activeFilterSummary"),
  clearFilters: document.querySelector("#clearFilters"),
  routeSearch: document.querySelector("#routeSearch"),
  regionFilter: document.querySelector("#regionFilter"),
  tripLengthFilter: document.querySelector("#tripLengthFilter"),
  seasonFilter: document.querySelector("#seasonFilter"),
  dateStart: document.querySelector("#dateStart"),
  dateEnd: document.querySelector("#dateEnd"),
  styleFilters: document.querySelector("#styleFilters"),
  statusFilter: document.querySelector("#statusFilter"),
  difficultyFilter: document.querySelector("#difficultyFilter"),
  gravelFilter: document.querySelector("#gravelFilter"),
  readinessFilter: document.querySelector("#readinessFilter"),
  groupTabs: document.querySelector("#groupTabs"),
  routeList: document.querySelector("#routeList"),
  routeCount: document.querySelector("#routeCount"),
  mapTitle: document.querySelector("#mapTitle"),
  mapSubtitle: document.querySelector("#mapSubtitle"),
  mapQa: document.querySelector("#mapQa"),
  map: document.querySelector("#map"),
  tileLayer: document.querySelector("#tileLayer"),
  routeSvg: document.querySelector("#routeSvg"),
  dispersedSvg: document.querySelector("#dispersedSvg"),
  campsiteSvg: document.querySelector("#campsiteSvg"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  fitMap: document.querySelector("#fitMap"),
  basemapSelect: document.querySelector("#basemapSelect"),
  dispersedLayerToggle: document.querySelector("#dispersedLayerToggle"),
  campsitePopup: document.querySelector("#campsitePopup"),
  mapLegend: document.querySelector("#mapLegend"),
  dayFlow: document.querySelector("#dayFlow"),
  detailTitle: document.querySelector("#detailTitle"),
  detailMeta: document.querySelector("#detailMeta"),
  reviewMeta: document.querySelector("#reviewMeta"),
  reviewPanel: document.querySelector("#reviewPanel"),
  resourceMeta: document.querySelector("#resourceMeta"),
  resourcePanel: document.querySelector("#resourcePanel"),
  variants: document.querySelector("#variants"),
  variantMeta: document.querySelector("#variantMeta"),
  elevationBars: document.querySelector("#elevationBars"),
  exportRoutePackage: document.querySelector("#exportRoutePackage"),
  downloadGeojson: document.querySelector("#downloadGeojson"),
  downloadGpx: document.querySelector("#downloadGpx"),
  editForm: document.querySelector("#editForm"),
  editText: document.querySelector("#editText"),
  editStatus: document.querySelector("#editStatus"),
  copyPrompt: document.querySelector("#copyPrompt"),
  sourceNotes: document.querySelector("#sourceNotes"),
};

async function init() {
  hideLoadError();
  state.basemap = localStorage.getItem("bikepacking_planner:basemap") in TILE_PROVIDERS
    ? localStorage.getItem("bikepacking_planner:basemap")
    : "fast";
  if (els.basemapSelect) els.basemapSelect.value = state.basemap;
  if (els.dispersedLayerToggle) els.dispersedLayerToggle.checked = state.dispersedAreasVisible;
  state.trips = await fetchJson("/api/trips");
  if (!state.trips.length) {
    els.tripDescription.textContent = "No imported trips found. Run python -m bikepacking_planner import-existing.";
    return;
  }
  els.tripSelect.replaceChildren(...state.trips.map((trip) => option(trip.id, trip.name)));
  els.tripSelect.addEventListener("change", () => loadTrip(els.tripSelect.value));
  els.routeSearch.addEventListener("input", () => {
    state.routeSearch = els.routeSearch.value.trim().toLowerCase();
    resetRouteSelection();
  });
  els.regionFilter.addEventListener("change", () => {
    state.group = "all";
    state.selectedRegion = els.regionFilter.value;
    resetRouteSelection();
  });
  els.tripLengthFilter.addEventListener("change", () => {
    state.tripLengthFilter = els.tripLengthFilter.value;
    resetRouteSelection();
  });
  els.seasonFilter.addEventListener("change", () => {
    state.seasonFilter = els.seasonFilter.value;
    resetRouteSelection();
  });
  els.dateStart.addEventListener("change", () => {
    state.dateStart = els.dateStart.value;
    resetRouteSelection();
  });
  els.dateEnd.addEventListener("change", () => {
    state.dateEnd = els.dateEnd.value;
    resetRouteSelection();
  });
  els.statusFilter.addEventListener("change", () => {
    state.statusFilter = els.statusFilter.value;
    resetRouteSelection();
  });
  els.difficultyFilter.addEventListener("change", () => {
    state.difficultyFilter = els.difficultyFilter.value;
    resetRouteSelection();
  });
  els.gravelFilter.addEventListener("change", () => {
    state.gravelFilter = els.gravelFilter.value;
    resetRouteSelection();
  });
  els.readinessFilter.addEventListener("change", () => {
    state.readinessFilter = els.readinessFilter.value;
    resetRouteSelection();
  });
  els.clearFilters.addEventListener("click", () => {
    clearPlanningFilters();
  });
  els.downloadGeojson?.addEventListener("click", () => downloadGeojson());
  els.downloadGpx?.addEventListener("click", () => downloadGpx());
  els.exportRoutePackage?.addEventListener("click", (event) => {
    if (els.exportRoutePackage.getAttribute("aria-disabled") === "true" || !els.exportRoutePackage.getAttribute("href")) {
      event.preventDefault();
      const route = selectedRoute();
      if (route) prepareRouteExport(route);
    }
  });
  els.editForm.addEventListener("submit", saveEditRequest);
  els.copyPrompt.addEventListener("click", copyEditPrompt);
  setupMapInteractions();
  window.addEventListener("resize", () => drawAll());
  await loadTrip(state.trips[0].id);
}

function setupMapInteractions() {
  els.zoomIn?.addEventListener("click", () => {
    stopPanInertia();
    zoomBy(0.5);
  });
  els.zoomOut?.addEventListener("click", () => {
    stopPanInertia();
    zoomBy(-0.5);
  });
  els.fitMap?.addEventListener("click", () => {
    stopPanInertia();
    fitToRoutes(selectedRoute() ? [selectedRoute()] : filteredRoutes());
    drawMap();
  });
  els.basemapSelect.addEventListener("change", () => {
    state.basemap = els.basemapSelect.value in TILE_PROVIDERS ? els.basemapSelect.value : "fast";
    localStorage.setItem("bikepacking_planner:basemap", state.basemap);
    state.map.tileNodes.clear();
    stopPanInertia();
    commitMapPreview();
    drawMap();
  });
  els.dispersedLayerToggle?.addEventListener("change", () => {
    state.dispersedAreasVisible = Boolean(els.dispersedLayerToggle.checked);
    state.dispersedAreasError = "";
    state.dispersedAreasNotice = "";
    drawMap();
  });
  els.routeSvg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const routeId = event.target.closest?.(".route-line")?.dataset?.route;
    if (!routeId) return;
    focusRouteIdFromMap(routeId, event);
  }, { capture: true });
  els.routeSvg.addEventListener("click", (event) => {
    const routeId = routeIdFromMapEvent(event);
    if (!routeId) return;
    focusRouteIdFromMap(routeId, event);
  });
  els.map.addEventListener("click", (event) => {
    if (state.map.dragging) return;
    if (event.target.closest(".map-controls, .map-layer-controls, .map-legend, .map-hint, .campsite-popup, .campsite-marker")) return;
    const routeId = routeIdFromMapEvent(event);
    if (!routeId) return;
    focusRouteIdFromMap(routeId, event);
  });
  els.map.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(".map-controls, .map-layer-controls, .map-legend, .map-hint, .campsite-popup")) return;
    if (event.target.closest(".campsite-marker")) return;
    if (event.target.closest(".route-line")) return;
    state.selectedCampsiteId = null;
    stopPanInertia();
    commitMapPreview();
    state.map.dragging = true;
    state.map.dragStart = [event.clientX, event.clientY];
    state.map.dragCenter = [...state.map.center];
    state.map.dragLast = [event.clientX, event.clientY];
    state.map.dragLastTime = performance.now();
    state.map.panVelocity = [0, 0];
    els.map.classList.add("is-dragging");
    els.map.setPointerCapture(event.pointerId);
  });
  els.map.addEventListener("pointermove", (event) => {
    if (!state.map.dragging) return;
    const [startX, startY] = state.map.dragStart;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const startWorld = lonLatToWorld(state.map.dragCenter[0], state.map.dragCenter[1], state.map.zoom);
    state.map.center = worldToLonLat(startWorld[0] - dx, startWorld[1] - dy, state.map.zoom);
    updatePanVelocity(event);
    queueMapPreviewTransform();
  });
  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    els.map.addEventListener(eventName, (event) => {
      if (!state.map.dragging) return;
      state.map.dragging = false;
      els.map.classList.remove("is-dragging");
      if (event.pointerId !== undefined && els.map.hasPointerCapture(event.pointerId)) {
        els.map.releasePointerCapture(event.pointerId);
      }
      if (!startPanInertia()) scheduleMapCommit(70);
    });
  }
  els.map.addEventListener("wheel", (event) => {
    event.preventDefault();
    handleWheelZoom(event);
  }, { passive: false });
}

function handleWheelZoom(event) {
  stopPanInertia();
  const rect = els.map.getBoundingClientRect();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
  const delta = event.deltaY * unit;
  if (!delta) return;
  const sensitivity = event.ctrlKey ? state.map.wheelSensitivity * 1.6 : state.map.wheelSensitivity;
  const zoomDelta = clamp(-delta / sensitivity, -0.34, 0.34);
  zoomBy(zoomDelta, [event.clientX, event.clientY], { preview: true });
  scheduleZoomCommit();
}

async function loadTrip(tripId) {
  state.trip = await fetchJson(`/api/trips/${tripId}`);
  state.routeDetailPromises.clear();
  state.group = "all";
  state.selectedRegion = "all";
  state.statusFilter = "all";
  state.difficultyFilter = "all";
  state.gravelFilter = "all";
  state.readinessFilter = "all";
  state.tripLengthFilter = "all";
  state.seasonFilter = "all";
  state.dateStart = "";
  state.dateEnd = "";
  state.tripStyleFilters.clear();
  state.planningContextActive = false;
  state.routeSearch = "";
  els.routeSearch.value = "";
  els.regionFilter.value = "all";
  els.tripLengthFilter.value = "all";
  els.seasonFilter.value = "all";
  els.dateStart.value = "";
  els.dateEnd.value = "";
  els.statusFilter.value = "all";
  els.difficultyFilter.value = "all";
  els.gravelFilter.value = "all";
  els.readinessFilter.value = "all";
  state.selectedRouteId = "__all";
  state.highlightedRouteId = null;
  state.activeVariants.clear();
  els.tripDescription.textContent = "Browse route candidates, then choose dates, region, and trip style to see what work remains before ride-ready.";
  renderRegionOptions();
  renderStyleFilters();
  renderGroupTabs();
  await loadCampsites();
  fitToRoutes(filteredRoutes());
  drawAll();
}

function resetRouteSelection() {
  state.selectedRouteId = "__all";
  state.highlightedRouteId = null;
  state.activeVariants.clear();
  fitToRoutes(filteredRoutes());
  drawAll();
}

function clearPlanningFilters() {
  state.group = "all";
  state.selectedRegion = "all";
  state.tripLengthFilter = "all";
  state.seasonFilter = "all";
  state.dateStart = "";
  state.dateEnd = "";
  state.tripStyleFilters.clear();
  state.difficultyFilter = "all";
  state.gravelFilter = "all";
  state.readinessFilter = "all";
  state.statusFilter = "all";
  state.routeSearch = "";
  els.regionFilter.value = "all";
  els.tripLengthFilter.value = "all";
  els.seasonFilter.value = "all";
  els.dateStart.value = "";
  els.dateEnd.value = "";
  els.difficultyFilter.value = "all";
  els.gravelFilter.value = "all";
  els.readinessFilter.value = "all";
  els.statusFilter.value = "all";
  els.routeSearch.value = "";
  resetRouteSelection();
}

async function fetchJson(url) {
  const withVersion = (path) => `${path}${path.includes("?") ? "&" : "?"}v=${DATA_VERSION}`;
  const candidates = [];
  if (url === "/api/trips") {
    candidates.push("data/trips/index.json");
    candidates.push("../data/trips/index.json");
    candidates.push(url);
  } else if (url.startsWith("/api/trips/")) {
    const tripId = encodeURIComponent(url.split("/").pop());
    candidates.push(`data/trips/${tripId}.json`);
    candidates.push(`../data/trips/${tripId}.json`);
    candidates.push(url);
  } else {
    candidates.push(url);
  }
  const errors = [];
  for (const candidate of candidates) {
    try {
      const payload = await fetchJsonWithRetry(withVersion(candidate));
      rememberJson(url, payload);
      return payload;
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  const cached = recallJson(url);
  if (cached) return cached;
  throw new Error(`Could not load route data. Tried ${errors.join(" | ")}`);
}

async function loadCampsites() {
  if (state.campsitesLoaded) return;
  const candidates = [
    `data/campsites/${CAMPSITE_DATA_PATH}`,
    `../data/campsites/${CAMPSITE_DATA_PATH}`,
    `../../research/campsites/${CAMPSITE_DATA_PATH}`,
  ];
  const errors = [];
  for (const candidate of candidates) {
    try {
      const payload = await fetchJsonWithRetry(`${candidate}?v=${DATA_VERSION}`, 1);
      state.campsites = normalizeCampsites(payload);
      state.campsitesLoaded = true;
      return;
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  state.campsites = [];
  state.campsitesLoaded = false;
  console.warn(`Could not load campsite data. Tried ${errors.join(" | ")}`);
}

function normalizeCampsites(payload) {
  const features = payload?.features || [];
  return features.map((feature, index) => {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [];
    return {
      ...properties,
      id: campsiteId(properties, coordinates, index),
      longitude: coordinates[0],
      latitude: coordinates[1],
    };
  }).filter((site) => Number.isFinite(site.longitude) && Number.isFinite(site.latitude));
}

function campsiteId(properties, coordinates, index) {
  return [
    properties.routeId || "route",
    properties.siteName || "site",
    coordinates[0],
    coordinates[1],
    index,
  ].join("|");
}

async function fetchJsonWithRetry(url, attempts = 2) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchJsonOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await delay(240 * (attempt + 1));
    }
  }
  throw lastError;
}

async function fetchJsonOnce(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TRIP_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function rememberJson(url, payload) {
  try {
    const serialized = JSON.stringify({ savedAt: Date.now(), payload });
    if (serialized.length > MAX_LOCAL_STORAGE_CACHE_BYTES) return;
    window.localStorage.setItem(cacheKey(url), serialized);
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

function recallJson(url) {
  try {
    const raw = window.localStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached?.payload || null;
  } catch {
    return null;
  }
}

function routeDetailCandidates(route) {
  const detailPath = route.detailPath || `routes/${route.id}.json`;
  const basePath = state.trip?.detailBasePath || `${state.trip?.id || "route-library"}/`;
  return [
    `data/trips/${basePath}${detailPath}`,
    `../data/trips/${basePath}${detailPath}`,
  ];
}

function routeHasFullDetail(route) {
  return route && route.hasFullDetail !== false && !route.overviewGeometry;
}

async function hydrateRoute(route) {
  if (!route || routeHasFullDetail(route)) return route;
  if (!state.routeDetailPromises.has(route.id)) {
    state.routeDetailPromises.set(route.id, (async () => {
      const errors = [];
      for (const candidate of routeDetailCandidates(route)) {
        try {
          const detail = await fetchJsonWithRetry(`${candidate}${candidate.includes("?") ? "&" : "?"}v=${DATA_VERSION}`);
          const fullRoute = detail.route || detail;
          Object.assign(route, fullRoute, { hasFullDetail: true, overviewGeometry: false });
          return route;
        } catch (error) {
          errors.push(`${candidate}: ${error.message}`);
        }
      }
      throw new Error(`Could not load route detail for ${route.name || route.id}. Tried ${errors.join(" | ")}`);
    })());
  }
  return state.routeDetailPromises.get(route.id);
}

async function hydrateRoutes(routes) {
  const hydrated = [];
  for (const route of routes) {
    hydrated.push(await hydrateRoute(route));
  }
  return hydrated;
}

function cacheKey(url) {
  return `bikepacking_planner:last_good:${url}`;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function showLoadError(error) {
  els.tripDescription.textContent = "Route data did not load. The local server may have restarted; refresh or start the app server and try again.";
  els.routeList.replaceChildren(emptyNote(error.message));
  els.readinessDashboard.replaceChildren();
  els.libraryStats.replaceChildren();
  els.activeFilterSummary.textContent = "Unable to load route data.";
}

function hideLoadError() {
  els.activeFilterSummary.textContent = "";
}

function renderRegionOptions() {
  const groups = state.trip?.routeGroups || [];
  const options = [option("all", "All regions"), ...groups.map((group) => option(group.id, group.name))];
  els.regionFilter.replaceChildren(...options);
  els.regionFilter.value = state.selectedRegion;
}

function renderStyleFilters() {
  els.styleFilters.replaceChildren(...STYLE_FILTERS.map((style) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.tripStyleFilters.has(style.id) ? "active" : "";
    button.textContent = `${style.label} (${countRoutesForFilter("tripStyleFilters", style.id)})`;
    button.addEventListener("click", () => {
      if (state.tripStyleFilters.has(style.id)) state.tripStyleFilters.delete(style.id);
      else state.tripStyleFilters.add(style.id);
      resetRouteSelection();
    });
    return button;
  }));
}

function option(value, text) {
  const el = document.createElement("option");
  el.value = value;
  el.dataset.label = text;
  el.textContent = text;
  return el;
}

function renderFilterCounts() {
  for (const filter of COUNTED_SELECT_FILTERS) {
    const select = els[filter.elKey];
    if (!select) continue;
    for (const item of select.options) {
      const label = item.dataset.label || item.textContent.replace(/\s+\(\d+\)$/, "");
      item.dataset.label = label;
      item.textContent = `${label} (${countRoutesForFilter(filter.stateKey, item.value)})`;
    }
    select.value = state[filter.stateKey];
  }
}

function renderGroupTabs() {
  const groups = [{ id: "all", name: "All routes" }, ...(state.trip.routeGroups || [])];
  els.groupTabs.replaceChildren(...groups.map((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${group.name} (${countRoutesForGroup(group.id)})`;
    button.className = state.group === group.id ? "active" : "";
    button.addEventListener("click", () => {
      state.group = group.id;
      state.selectedRegion = group.id === "california-priority" ? "all" : group.id;
      els.regionFilter.value = state.selectedRegion;
      state.selectedRouteId = "__all";
      state.highlightedRouteId = null;
      state.activeVariants.clear();
      fitToRoutes(filteredRoutes());
      drawAll();
    });
    return button;
  }));
}

function countRoutesForGroup(groupId) {
  const filters = currentRouteFilters();
  filters.group = groupId;
  if (groupId !== state.group) filters.selectedRegion = "all";
  return (state.trip?.routes || []).filter((route) => routePassesFilters(route, filters)).length;
}

function renderLibraryStats() {
  const routes = state.trip?.routes || [];
  const archived = state.trip?.archivedCandidates || [];
  const matchingRoutes = filteredRoutes();
  const maturityCounts = routes.reduce((acc, route) => {
    const key = routeMaturity(route);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const gateCounts = routes.reduce((acc, route) => {
    const key = routeGateStatus(route);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const summary = filteredReadinessSummary(matchingRoutes);
  const chips = [
    statChip(`${matchingRoutes.length} matching`, "library"),
    statChip(`${routes.length} total routes`, "library"),
    statChip(`${maturityCounts.plan_ready || 0} plan ready`, "plan_ready"),
    statChip(`${maturityCounts.concept || 0} concepts`, "concept"),
    statChip(`${maturityCounts.candidate || 0} candidates`, "candidate"),
    statChip(`${gateCounts.confirmed || 0} ride-ready`, "confirmed"),
    statChip(`${summary.gateBlockedCount || 0} need work`, "blocked"),
    statChip(`${summary.gatePartialCount || 0} need review`, "partial"),
  ];
  if (isCaliforniaContext()) {
    const californiaRoutes = matchingRoutes.filter(isCaliforniaPriority);
    chips.push(statChip(`${californiaRoutes.length} California matches`, "plan_ready"));
  }
  if (archived.length) chips.push(statChip(`${archived.length} rough leads archived`, "candidate"));
  els.libraryStats.replaceChildren(...chips);
}

function renderActiveFilterSummary() {
  const parts = [];
  if (state.routeSearch) parts.push(`search: "${state.routeSearch}"`);
  if (state.selectedRegion !== "all") parts.push(`region: ${labelGroup(state.selectedRegion)}`);
  if (state.tripLengthFilter !== "all") parts.push(`length: ${tripLengthLabel(state.tripLengthFilter)}`);
  if (state.seasonFilter !== "all") parts.push(`season notes: ${state.seasonFilter}`);
  if (dateContextActive()) parts.push(`broad season notes matching ${formatDateRange()}`);
  if (state.difficultyFilter !== "all") parts.push(`difficulty: ${state.difficultyFilter}`);
  if (state.gravelFilter !== "all") parts.push(`surface: ${state.gravelFilter}`);
  if (state.readinessFilter !== "all") parts.push(`readiness: ${state.readinessFilter}`);
  if (state.statusFilter !== "all") parts.push(`maturity: ${labelMaturity(state.statusFilter)}`);
  for (const style of state.tripStyleFilters) {
    parts.push(`style: ${STYLE_FILTERS.find((item) => item.id === style)?.label || style}`);
  }
  const prefix = parts.length ? `Showing routes with ${parts.join(" · ")}.` : "Browsing all routes.";
  const suffix = dateContextActive()
    ? " Final campsite availability, fire, closures, weather, and water are not verified by this filter."
    : "";
  els.activeFilterSummary.textContent = `${prefix}${suffix}`;
  els.clearFilters.disabled = !planningContextActive() && !state.routeSearch;
}

function renderReadinessDashboard() {
  const routes = filteredRoutes();
  const summary = filteredReadinessSummary(routes);
  const blockers = summary.topBlockerCategories || [];
  const windowLabel = dateContextActive() ? formatDateRange() : "No exact dates selected";
  const commonBlockers = blockers.length
    ? blockers.slice(0, 4).map((item) => `<li>${escapeHtml(item.category)} <strong>${item.count}</strong></li>`).join("")
    : "<li>No blocker data for the current view</li>";
  els.readinessDashboard.innerHTML = `
    <div class="decision-head">
      <strong>Decision Snapshot</strong>
      <span>${escapeHtml(windowLabel)}</span>
    </div>
    <div class="decision-metrics">
      <span><strong>${summary.gateConfirmedCount || 0}</strong> ride-ready</span>
      <span><strong>${summary.needsRefreshCount || 0}</strong> close / needs refresh</span>
      <span><strong>${summary.planReadyCount || 0}</strong> planning-grade</span>
      <span><strong>${summary.blockedRouteCount || summary.gateBlockedCount || 0}</strong> blocked / rework</span>
      <span><strong>${summary.routeCount || 0}</strong> matching routes</span>
    </div>
    <div class="decision-blockers">
      <span>Most common remaining work</span>
      <ul>${commonBlockers}</ul>
    </div>`;
}

function filteredReadinessSummary(routes) {
  const gateKeys = ["targetWindowFit", "legalAccess", "campingPermits", "waterResupply", "closuresFireWeather", "officialGeometry", "mapArtifacts"];
  const gateCounts = {};
  const blockerCounts = {};
  const regionCounts = {};
  let needsRefreshCount = 0;
  let blockedRouteCount = 0;
  const maturityCounts = {};
  const gateStatusCounts = {};
  for (const route of routes) {
    const maturity = routeMaturity(route);
    const gateStatus = routeGateStatus(route);
    maturityCounts[maturity] = (maturityCounts[maturity] || 0) + 1;
    gateStatusCounts[gateStatus] = (gateStatusCounts[gateStatus] || 0) + 1;
    const checklist = route.promotionChecklist || {};
    regionCounts[route.region || labelGroup(route.group) || "Unmapped"] = (regionCounts[route.region || labelGroup(route.group) || "Unmapped"] || 0) + 1;
    const routeNeedsRefresh = gateKeys.some((key) => checklist[key] === "needs_refresh");
    const routeBlocked = gateKeys.some((key) => checklist[key] === "blocker")
      || (route.promotionActions || []).some((action) => action.priority === "blocker" || action.status === "blocker");
    if (routeNeedsRefresh) needsRefreshCount += 1;
    if (routeBlocked) blockedRouteCount += 1;
    for (const key of gateKeys) {
      const value = checklist[key] || "unknown";
      gateCounts[key] ||= {};
      gateCounts[key][value] = (gateCounts[key][value] || 0) + 1;
    }
    for (const action of route.promotionActions || []) {
      if (action.priority !== "blocker") continue;
      const category = compactGateLabel(action.category || "Work item", action.action || "");
      blockerCounts[category] = (blockerCounts[category] || 0) + 1;
    }
  }
  const topRoutes = [...routes]
    .sort((a, b) => {
      const aReview = routeReviewScore(a);
      const bReview = routeReviewScore(b);
      if (aReview !== bReview) return aReview - bReview;
      return (b.readinessScore?.score || 0) - (a.readinessScore?.score || 0) || (a.name || "").localeCompare(b.name || "");
    })
    .slice(0, 8)
    .map((route) => ({
      id: route.id,
      name: route.name,
      clearance: rideReadyClearanceLabel(route),
      blockers: route.readinessScore?.blockerCount || 0,
      decision: route.promotionChecklist?.finalDecision || "",
    }));
  return {
    routeCount: routes.length,
    candidateCount: maturityCounts.candidate || 0,
    conceptCount: maturityCounts.concept || 0,
    planReadyCount: maturityCounts.plan_ready || 0,
    gateConfirmedCount: gateStatusCounts.confirmed || 0,
    gatePartialCount: gateStatusCounts.partial || 0,
    gateBlockedCount: gateStatusCounts.blocked || 0,
    needsRefreshCount,
    blockedRouteCount,
    averageScore: routes.length ? Math.round(routes.reduce((sum, route) => sum + (route.readinessScore?.score || 0), 0) / routes.length * 10) / 10 : 0,
    topRoutes,
    gateCounts,
    topRegions: Object.entries(regionCounts)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region))
      .slice(0, 5),
    topBlockerCategories: Object.entries(blockerCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
      .slice(0, 6),
  };
}

function gateSnapshot(gateCounts) {
  const labels = {
    targetWindowFit: "window",
    legalAccess: "legal",
    campingPermits: "camp",
    waterResupply: "water",
    closuresFireWeather: "closure/fire",
  };
  return Object.entries(labels).map(([key, label]) => {
    const counts = gateCounts[key] || {};
    return `${label}: ${counts.pass || 0} pass, ${counts.needs_refresh || 0} refresh, ${counts.blocker || 0} blocked`;
  }).join(" | ");
}

function statChip(text, status) {
  const chip = document.createElement("span");
  chip.className = `status-chip ${status}`;
  chip.textContent = text;
  return chip;
}

function filteredRoutes() {
  const routes = state.trip?.routes || [];
  const filtered = routes.filter((route) => routePassesFilters(route, currentRouteFilters()));
  return sortRoutesForReview(filtered);
}

function countRoutesForFilter(filterKey, value) {
  const filters = currentRouteFilters();
  if (filterKey === "tripStyleFilters") {
    const styles = new Set(state.tripStyleFilters);
    if (!styles.has(value)) styles.add(value);
    filters.tripStyleFilters = styles;
  } else {
    filters[filterKey] = value;
  }
  return (state.trip?.routes || []).filter((route) => routePassesFilters(route, filters)).length;
}

function currentRouteFilters() {
  return {
    group: state.group,
    selectedRegion: state.selectedRegion,
    statusFilter: state.statusFilter,
    gravelFilter: state.gravelFilter,
    tripLengthFilter: state.tripLengthFilter,
    seasonFilter: state.seasonFilter,
    dateStart: state.dateStart,
    dateEnd: state.dateEnd,
    tripStyleFilters: new Set(state.tripStyleFilters),
    readinessFilter: state.readinessFilter,
    difficultyFilter: state.difficultyFilter,
    routeSearch: state.routeSearch,
  };
}

function routePassesFilters(route, filters) {
  if (!routeMatchesGroup(route, filters.group)) return false;
  if (!routeMatchesRegion(route, filters.selectedRegion)) return false;
  if (filters.statusFilter !== "all" && routeMaturity(route) !== filters.statusFilter) return false;
  if (filters.gravelFilter !== "all" && route.gravelLevel !== filters.gravelFilter) return false;
  if (filters.tripLengthFilter !== "all" && !matchesTripLength(route, filters.tripLengthFilter)) return false;
  if (filters.seasonFilter !== "all" && !matchesSeason(route, filters.seasonFilter)) return false;
  if (!matchesPlanningDates(route, filters)) return false;
  if (!matchesTripStyles(route, filters.tripStyleFilters)) return false;
  if (filters.readinessFilter !== "all" && !matchesReadiness(route, filters.readinessFilter)) return false;
  if (filters.difficultyFilter !== "all" && !matchesDifficulty(route, filters.difficultyFilter)) return false;
  if (filters.routeSearch && !matchesSearch(route, filters.routeSearch)) return false;
  return true;
}

function sortRoutesForReview(routes) {
  return [...routes].sort((a, b) => {
    if (state.group === "all") {
      const aPriority = isCaliforniaPriority(a) ? 0 : 1;
      const bPriority = isCaliforniaPriority(b) ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
    }
    const aScore = routeReviewScore(a);
    const bScore = routeReviewScore(b);
    if (aScore !== bScore) return aScore - bScore;
    const aReadiness = a.readinessScore?.score ?? 0;
    const bReadiness = b.readinessScore?.score ?? 0;
    if (aReadiness !== bReadiness) return bReadiness - aReadiness;
    const aDays = Math.abs((a.days?.length || 99) - 2);
    const bDays = Math.abs((b.days?.length || 99) - 2);
    if (aDays !== bDays) return aDays - bDays;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function routeReviewScore(route) {
  const decision = route.promotionChecklist?.finalDecision || "candidate";
  const fit = route.promotionChecklist?.targetWindowFit || "";
  const ranks = {
    ride_ready_with_final_refresh: 0,
    near_ride_ready: 1,
    top_candidate: 2,
    close_candidate: 3,
    candidate: 4,
    rework: 6,
    segment_only: 7,
    reject_rework: 8,
  };
  const base = ranks[decision] ?? 5;
  return fit === "blocker" ? Math.max(base, 7) : base;
}

function matchesReadiness(route, filter) {
  const checklist = route.promotionChecklist || {};
  const decision = checklist.finalDecision || "";
  const windowFit = checklist.targetWindowFit || "";
  if (filter === "best") return ["ride_ready_with_final_refresh", "near_ride_ready", "top_candidate", "close_candidate"].includes(decision);
  if (filter === "near") return ["ride_ready_with_final_refresh", "near_ride_ready"].includes(decision);
  if (filter === "candidate") return windowFit === "needs_refresh" || decision === "candidate";
  if (filter === "blocked") return windowFit === "blocker" || ["reject_rework", "segment_only", "rework"].includes(decision);
  return true;
}

function routeMatchesGroup(route, groupId) {
  if (groupId === "all") return true;
  if (groupId === "california-priority") {
    return isCaliforniaPriority(route);
  }
  return route.group === groupId;
}

function routeMatchesRegion(route, regionId) {
  if (regionId === "all") return true;
  if (regionId === "california-priority") return isCaliforniaPriority(route);
  return route.group === regionId;
}

function isCaliforniaPriority(route) {
  return isCaliforniaGroup(route.group);
}

function isCaliforniaGroup(groupId) {
  return ["bay-norcal", "marin", "coast", "truckee", "sierra", "redwood-coast", "california", "socal"].includes(groupId);
}

function matchesSearch(route, query) {
  const fields = [
    route.id,
    route.name,
    route.region,
    route.group,
    route.shape,
    route.maturity,
    route.gateStatus,
    route.surfaceMix,
    route.bestSeason,
    route.description,
    route.sourceNote,
    ...(route.tips || []),
    ...(route.hazards || []),
    ...Object.values(route.resources || {}),
    ...Object.values(route.difficultyProfile || {}),
  ];
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return query.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

function matchesDifficulty(route, filter) {
  const profile = route.difficultyProfile || {};
  const haystack = `${profile.overall || ""} ${profile.climbing || ""} ${profile.beginnerSuitability || ""} ${route.difficulty || ""}`.toLowerCase();
  if (filter === "beginner") return haystack.includes("beginner friendly");
  if (filter === "moderate") return haystack.includes("moderate");
  if (filter === "hard") return haystack.includes("hard");
  return true;
}

function matchesTripLength(route, filter) {
  const days = route.days?.length || 0;
  if (filter === "overnight") return days <= 2;
  if (filter === "2-3") return days >= 2 && days <= 3;
  if (filter === "4-5") return days >= 4 && days <= 5;
  if (filter === "weeklong") return days >= 6;
  return true;
}

function tripLengthLabel(value) {
  return {
    overnight: "overnight routes",
    "2-3": "2-3 day routes",
    "4-5": "4-5 day routes",
    weeklong: "weeklong+ routes",
  }[value] || "any length";
}

function matchesPlanningDates(route, filters = currentRouteFilters()) {
  if (!filters.dateStart && !filters.dateEnd) return true;
  const seasonText = `${route.bestSeason || ""} ${route.description || ""}`.toLowerCase();
  const startSeason = filters.dateStart ? monthToSeason(new Date(`${filters.dateStart}T00:00:00`).getMonth()) : "";
  const endSeason = filters.dateEnd ? monthToSeason(new Date(`${filters.dateEnd}T00:00:00`).getMonth()) : "";
  const seasons = [...new Set([startSeason, endSeason].filter(Boolean))];
  if (!seasons.length || !seasonText.trim()) return true;
  return seasons.some((season) => seasonText.includes(season) || seasonText.includes("year-round") || seasonText.includes("all year"));
}

function matchesSeason(route, season) {
  const seasonText = `${route.bestSeason || ""} ${route.description || ""}`.toLowerCase();
  if (!seasonText.trim()) return true;
  return seasonText.includes(season) || seasonText.includes("year-round") || seasonText.includes("all year");
}

function matchesTripStyles(route, styles = state.tripStyleFilters) {
  for (const style of styles) {
    if (!matchesTripStyle(route, style)) return false;
  }
  return true;
}

function matchesTripStyle(route, style) {
  const profile = route.difficultyProfile || {};
  const resources = route.resources || {};
  const haystack = [
    route.name,
    route.shape,
    route.surfaceMix,
    route.gravelLevel,
    route.description,
    route.bestSeason,
    ...(route.tips || []),
    ...(route.hazards || []),
    ...Object.values(profile),
    ...Object.values(resources),
  ].filter(Boolean).join(" ").toLowerCase();
  if (style === "beginner") return haystack.includes("beginner");
  if (style === "low-climbing") return (route.gainFt || 0) <= 4500 || haystack.includes("low climbing");
  if (style === "high-gravel") return route.gravelLevel === "high" || haystack.includes("high gravel");
  if (style === "transit") return haystack.includes("transit") || haystack.includes("train") || haystack.includes("smart") || haystack.includes("bus");
  if (style === "campground") return haystack.includes("campground") || haystack.includes("state park") || haystack.includes("camp");
  if (style === "lodging") return haystack.includes("motel") || haystack.includes("lodging") || haystack.includes("hotel");
  if (style === "loop") return haystack.includes("loop");
  if (style === "point-to-point") return haystack.includes("point-to-point") || haystack.includes("point to point");
  return true;
}

function planningContextActive() {
  return state.selectedRegion !== "all"
    || state.tripLengthFilter !== "all"
    || state.seasonFilter !== "all"
    || state.difficultyFilter !== "all"
    || state.gravelFilter !== "all"
    || state.readinessFilter !== "all"
    || state.statusFilter !== "all"
    || Boolean(state.dateStart || state.dateEnd)
    || state.tripStyleFilters.size > 0;
}

function dateContextActive() {
  return Boolean(state.dateStart || state.dateEnd);
}

function formatDateRange() {
  if (state.dateStart && state.dateEnd) return `${formatShortDate(state.dateStart)}-${formatShortDate(state.dateEnd)}`;
  if (state.dateStart) return `after ${formatShortDate(state.dateStart)}`;
  return `before ${formatShortDate(state.dateEnd)}`;
}

function formatShortDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isCaliforniaContext() {
  return state.selectedRegion === "california-priority"
    || (state.selectedRegion !== "all" && isCaliforniaGroup(state.selectedRegion))
    || state.group === "california-priority"
    || (state.group !== "all" && isCaliforniaGroup(state.group));
}

function selectedRoute() {
  return (state.trip?.routes || []).find((route) => route.id === state.selectedRouteId) || null;
}

function routeCoords(route) {
  return route.days.flatMap((day) => day.coords);
}

function allDisplayedCoordSets() {
  const route = selectedRoute();
  const routes = route ? [route] : filteredRoutes();
  const sets = routes.flatMap((item) => item.days.map((day) => day.coords));
  if (route) {
    for (const variant of route.variants || []) {
      if (state.activeVariants.has(variant.id)) sets.push(variant.coords);
    }
  }
  return sets;
}

function renderRouteList() {
  const routes = filteredRoutes();
  els.routeCount.textContent = `${routes.length} routes`;
  if (!routes.length) {
    const empty = emptyNote("No routes match these filters. Clear search, region, dates, trip length, style, readiness, or surface filters.");
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "empty-clear";
    clear.textContent = "Clear planning filters";
    clear.addEventListener("click", clearPlanningFilters);
    els.routeList.replaceChildren(empty, clear);
    return;
  }
  const all = document.createElement("button");
  all.type = "button";
  all.className = `route-row ${state.selectedRouteId === "__all" ? "active" : ""}`;
  all.innerHTML = `<span class="route-swatch" style="background:#7a6f59"></span><span><span class="route-name">All Matching Routes</span><span class="route-meta">Browse the library map and narrow by region, dates, length, and trip style.</span><span class="pill-row primary-pills"><span class="pill">Browse mode</span><span class="pill">${routes.length} visible</span></span></span>`;
  all.addEventListener("click", () => {
    state.selectedRouteId = "__all";
    state.highlightedRouteId = null;
    state.activeVariants.clear();
    fitToRoutes(routes);
    drawAll();
  });

  const rows = routes.map((route) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `route-row ${state.selectedRouteId === route.id ? "active" : ""}`;
    row.innerHTML = `
      <span class="route-swatch" style="background:${route.color || "#2f7b58"}"></span>
      <span>
        <span class="route-title-line"><span class="status-chip ${rideReadyStatusClass(route)}">${rideReadyStatusLabel(route)}</span><span class="route-name">${escapeHtml(route.name)}</span></span>
        <span class="route-meta">${escapeHtml(route.region || labelGroup(route.group))} &middot; ${route.distanceMi || 0} mi &middot; ${(route.gainFt || 0).toLocaleString()} ft &middot; ${route.days.length} days &middot; ${escapeHtml(route.shape || "route")}</span>
        <span class="pill-row primary-pills">
          <span class="pill ${routeMaturityClass(route)}">${routeMaturityLabel(route)}</span>
          <span class="pill ${gateChipClass(topGate(route))}">Remaining work: ${escapeHtml(topGateLabel(route))}</span>
          ${routeDifficultyChip(route)}
        </span>
        <span class="pill-row secondary-pills">
          <span class="pill ${route.sourceQuality}">${labelQuality(route.sourceQuality)}</span>
          <span class="pill">${surfaceLabel(route)}</span>
          <span class="pill ${gateCountClass(route)}">${gateSummaryLabel(route)}</span>
        </span>
      </span>`;
    row.addEventListener("mouseenter", () => {
      if (state.selectedRouteId === "__all") {
        state.highlightedRouteId = route.id;
        drawMap();
      }
    });
    row.addEventListener("mouseleave", () => {
      if (state.selectedRouteId === "__all") {
        state.highlightedRouteId = null;
        drawMap();
      }
    });
    row.addEventListener("click", () => selectRoute(route));
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectRoute(route);
    });
    return row;
  });
  els.routeList.replaceChildren(all, ...rows);
}

async function selectRoute(route) {
  state.selectedRouteId = route.id;
  state.selectedCatalogueId = null;
  state.highlightedRouteId = null;
  state.activeVariants.clear();
  fitToRoutes([route]);
  drawAll();
  try {
    await hydrateRoute(route);
    if (state.selectedRouteId === route.id) {
      fitToRoutes([route]);
      drawAll();
    }
  } catch (error) {
    showLoadError(error);
  }
}

async function focusRouteFromMap(route, event = null) {
  event?.preventDefault();
  event?.stopPropagation();
  stopPanInertia();
  commitMapPreview();
  await selectRoute(route);
}

function focusRouteIdFromMap(routeId, event = null) {
  const route = (state.trip?.routes || []).find((item) => item.id === routeId);
  if (!route) return;
  focusRouteFromMap(route, event);
}

function routeIdFromMapEvent(event) {
  return event.target.closest?.(".route-line")?.dataset?.route
    || state.highlightedRouteId
    || nearestRouteIdAtClientPoint(event.clientX, event.clientY);
}

function nearestRouteIdAtClientPoint(clientX, clientY) {
  const rect = els.map.getBoundingClientRect();
  if (!rect.width || !rect.height) return "";
  const projection = projectionContext(rect);
  const target = [clientX - rect.left, clientY - rect.top];
  const route = selectedRoute();
  const routes = route ? [route] : filteredRoutes();
  let best = { routeId: "", distanceSq: Infinity };
  for (const item of routes) {
    const maxPoints = route ? DETAIL_ROUTE_POINTS : (state.highlightedRouteId === item.id ? OVERVIEW_HIGHLIGHT_POINTS : OVERVIEW_ROUTE_POINTS);
    for (const day of item.days || []) {
      const coords = displayCoords(day.coords || [], maxPoints);
      for (let index = 1; index < coords.length; index += 1) {
        const a = project(coords[index - 1], projection);
        const b = project(coords[index], projection);
        const distanceSq = pointToSegmentDistanceSq(target, a, b);
        if (distanceSq < best.distanceSq) best = { routeId: item.id, distanceSq };
      }
    }
  }
  return best.distanceSq <= 24 ** 2 ? best.routeId : "";
}

function pointToSegmentDistanceSq(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (!dx && !dy) return (point[0] - a[0]) ** 2 + (point[1] - a[1]) ** 2;
  const t = clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

function drawAll() {
  if (!state.trip) return;
  renderGroupTabs();
  renderStyleFilters();
  renderFilterCounts();
  renderLibraryStats();
  renderActiveFilterSummary();
  renderReadinessDashboard();
  renderRouteList();
  updateExportButtons();
  renderDetails();
  renderVariants();
  renderReviewPanel();
  renderResourcePanel();
  renderElevation();
  renderSourceNotes();
  drawMap();
}

function drawMap() {
  stopPanInertia();
  resetMapPreviewTransform();
  const map = document.querySelector("#map");
  const rect = map.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  drawTiles(rect);
  els.routeSvg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  els.dispersedSvg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  els.campsiteSvg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  const routeFragment = document.createDocumentFragment();
  const projection = projectionContext(rect);
  const route = selectedRoute();
  const routes = route ? [route] : filteredRoutes();
  els.map.classList.toggle("is-overview-zoomed-out", !route && state.map.zoom <= 7);
  els.mapTitle.textContent = route ? route.name : routes.length ? "All Matching Routes" : "No Matching Routes";
  els.mapSubtitle.textContent = route
    ? `${route.distanceMi || 0} mi | ${(route.gainFt || 0).toLocaleString()} ft | ${route.days.length} days | ${labelMaturity(routeMaturity(route))} | ${labelGateStatus(routeGateStatus(route))}`
    : routes.length ? "Browse all visible routes, then select one for days, resources, variants, and evidence." : "Clear search or loosen filters to restore the map.";
  els.mapQa.textContent = route
    ? `Ride-ready work: ${gateCountLabel(route)} | ${topGateLabel(route)} | ${rideReadyClearanceLabel(route)}`
    : planningContextActive() ? "Planning context active: final route-specific checks are still required before departure." : "Date-agnostic browse mode: select a route to inspect planning status, ride-ready work, and evidence.";
  renderDispersedAreas(projection);

  const drawRoutes = state.highlightedRouteId
    ? [
      ...routes.filter((item) => item.id !== state.highlightedRouteId),
      ...routes.filter((item) => item.id === state.highlightedRouteId),
    ]
    : routes;

  for (const item of drawRoutes) {
    const highlighted = state.highlightedRouteId && state.highlightedRouteId === item.id;
    const dim = state.highlightedRouteId && !highlighted;
    const overview = !route;
    const maxPoints = overview
      ? (highlighted ? OVERVIEW_HIGHLIGHT_POINTS : OVERVIEW_ROUTE_POINTS)
      : DETAIL_ROUTE_POINTS;
    for (const day of item.days) {
      appendPath(day.coords, item.color, {
        routeId: item.id,
        day: day.day,
        maxPoints,
        className: `route-line shadow ${overview ? "overview" : ""} ${dim ? "dim" : ""}`,
        title: item.name,
        onClick: (event) => focusRouteFromMap(item, event),
        onEnter: () => {
          if (state.map.dragging) return;
          if (state.selectedRouteId === "__all") {
            state.highlightedRouteId = item.id;
            drawMap();
          }
        },
        onLeave: () => {
          if (state.selectedRouteId === "__all" && state.highlightedRouteId === item.id) {
            state.highlightedRouteId = null;
            drawMap();
          }
        },
      }, routeFragment, projection);
      appendPath(day.coords, item.color, {
        routeId: item.id,
        day: day.day,
        maxPoints,
        className: `route-line ${overview ? "overview" : ""} ${dim ? "dim" : ""} ${highlighted ? "highlight" : ""}`,
        title: item.name,
        onClick: (event) => focusRouteFromMap(item, event),
        onEnter: () => {
          if (state.map.dragging) return;
          if (state.selectedRouteId === "__all") {
            state.highlightedRouteId = item.id;
            drawMap();
          }
        },
        onLeave: () => {
          if (state.map.dragging) return;
          if (state.selectedRouteId === "__all") {
            state.highlightedRouteId = null;
            drawMap();
          }
        },
      }, routeFragment, projection);
    }
  }

  if (route) {
    for (const variant of route.variants || []) {
      if (!state.activeVariants.has(variant.id)) continue;
      appendPath(variant.coords, variant.color, { className: "route-line shadow variant" }, routeFragment, projection);
      appendPath(variant.coords, variant.color, { className: "route-line variant highlight" }, routeFragment, projection);
    }
    appendWaypoints(route.waypoints || [], routeFragment, projection);
  }
  els.routeSvg.replaceChildren(routeFragment);
  renderCampsites(routes, projection);
  renderMapLegend(routes);
  state.map.renderedZoom = state.map.zoom;
  state.map.renderedCenter = [...state.map.center];
}

function renderDispersedAreas(projection) {
  els.map.classList.toggle("dispersed-hidden", !state.dispersedAreasVisible);
  if (!state.dispersedAreasVisible) {
    els.dispersedSvg.replaceChildren();
    return;
  }
  queueDispersedAreaLoad(projection);
  const fragment = document.createDocumentFragment();
  for (const area of state.dispersedAreas) {
    const pathData = dispersedAreaPath(area.geometry, projection);
    if (!pathData) continue;
    const style = dispersedAreaStyle(area.properties?.SMA_ID);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("class", `dispersed-area ${escapeSvgClass(style.manager.toLowerCase())}`);
    path.setAttribute("fill", style.color);
    path.setAttribute("stroke", style.color);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${style.label}: public-land planning layer; verify local closures, fire restrictions, road access, and posted rules.`;
    path.appendChild(title);
    fragment.appendChild(path);
  }
  els.dispersedSvg.replaceChildren(fragment);
}

function queueDispersedAreaLoad(projection) {
  const bounds = viewportBounds(projection);
  if (!bounds) return;
  const spanArea = Math.abs(bounds.east - bounds.west) * Math.abs(bounds.north - bounds.south);
  if (!selectedRoute() && (state.map.zoom < 7 || spanArea > 10)) {
    state.dispersedAreas = [];
    state.dispersedAreasError = "";
    state.dispersedAreasNotice = "Zoom in or select a route";
    state.dispersedAreasRequestKey = "";
    return;
  }
  const cacheKey = dispersedAreaCacheKey(bounds, state.map.zoom);
  if (state.dispersedAreasRequestKey === cacheKey) return;
  if (state.dispersedAreasCache.has(cacheKey)) {
    state.dispersedAreas = state.dispersedAreasCache.get(cacheKey);
    state.dispersedAreasRequestKey = cacheKey;
    state.dispersedAreasError = "";
    state.dispersedAreasNotice = "";
    return;
  }
  if (state.dispersedAreasLoading) return;
  state.dispersedAreasLoading = true;
  state.dispersedAreasRequestKey = cacheKey;
  fetchDispersedAreas(bounds)
    .then((features) => {
      state.dispersedAreasCache.set(cacheKey, features);
      state.dispersedAreas = features;
      state.dispersedAreasError = "";
      state.dispersedAreasNotice = features.length >= 1200 ? "Candidate layer may be clipped; zoom in for complete local detail" : "";
    })
    .catch((error) => {
      state.dispersedAreasError = error.message || "Could not load candidate dispersed land.";
      state.dispersedAreasNotice = "";
      console.warn(state.dispersedAreasError);
    })
    .finally(() => {
      state.dispersedAreasLoading = false;
      drawMap();
    });
}

async function fetchDispersedAreas(bounds) {
  const params = new URLSearchParams({
    f: "geojson",
    where: "SMA_ID IN (2,915)",
    outFields: "OBJECTID,SMA_ID",
    returnGeometry: "true",
    inSR: "4326",
    outSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometryPrecision: "5",
    maxAllowableOffset: "0.001",
    resultRecordCount: "1200",
    geometry: JSON.stringify({
      xmin: bounds.west,
      ymin: bounds.south,
      xmax: bounds.east,
      ymax: bounds.north,
      spatialReference: { wkid: 4326 },
    }),
  });
  const payload = await fetchJsonWithRetry(`${BLM_CA_SMA_QUERY_URL}?${params.toString()}`, 1);
  return (payload.features || [])
    .filter((feature) => feature.geometry && Object.prototype.hasOwnProperty.call(DISPERSED_AREA_STYLES, feature.properties?.SMA_ID))
    .slice(0, 1200);
}

function viewportBounds(projection) {
  const corners = [
    screenToLonLat(0, 0, projection.zoom),
    screenToLonLat(projection.rect.width, 0, projection.zoom),
    screenToLonLat(0, projection.rect.height, projection.zoom),
    screenToLonLat(projection.rect.width, projection.rect.height, projection.zoom),
  ];
  const lons = corners.map((coord) => coord[0]).filter(Number.isFinite);
  const lats = corners.map((coord) => coord[1]).filter(Number.isFinite);
  if (!lons.length || !lats.length) return null;
  return {
    west: Math.max(-125.5, Math.min(...lons)),
    east: Math.min(-113.5, Math.max(...lons)),
    south: Math.max(31, Math.min(...lats)),
    north: Math.min(43, Math.max(...lats)),
  };
}

function dispersedAreaCacheKey(bounds, zoom) {
  const precision = zoom < 7 ? 1 : zoom < 10 ? 2 : 3;
  return [
    Math.floor(zoom),
    bounds.west.toFixed(precision),
    bounds.south.toFixed(precision),
    bounds.east.toFixed(precision),
    bounds.north.toFixed(precision),
  ].join("|");
}

function dispersedAreaPath(geometry, projection) {
  const rings = [];
  if (geometry?.type === "Polygon") {
    rings.push(...geometry.coordinates);
  } else if (geometry?.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) rings.push(...polygon);
  }
  const parts = [];
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    const sampled = displayCoords(ring, state.map.zoom < 8 ? 180 : 420);
    const commands = sampled.map((coord, index) => {
      const [x, y] = project(coord, projection);
      return `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    if (commands.length) parts.push(`${commands.join(" ")} Z`);
  }
  return parts.join(" ");
}

function dispersedAreaStyle(smaId) {
  return DISPERSED_AREA_STYLES[smaId] || { color: "#7a6f59", label: "Candidate public land", manager: "Public land" };
}

function appendPath(coords, color, options = {}, target = els.routeSvg, projection = projectionContext()) {
  if (!coords || coords.length < 2) return;
  const pathCoords = displayCoords(coords, options.maxPoints);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathCoords.map((coord, index) => {
    const [x, y] = project(coord, projection);
    return `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" "));
  path.setAttribute("stroke", options.className?.includes("shadow") ? "rgba(255,253,248,.94)" : (color || "#2f7b58"));
  path.setAttribute("class", options.className || "route-line");
  if (options.routeId) path.dataset.route = options.routeId;
  if (options.day) path.dataset.day = String(options.day);
  if (options.title) {
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = options.title;
    path.appendChild(title);
  }
  if (options.onClick) path.addEventListener("click", options.onClick);
  if (options.onEnter) path.addEventListener("mouseenter", options.onEnter);
  if (options.onLeave) path.addEventListener("mouseleave", options.onLeave);
  target.appendChild(path);
}

function displayCoords(coords, maxPoints = 0) {
  if (!maxPoints || coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / Math.max(2, maxPoints - 1));
  const sampled = [];
  for (let index = 0; index < coords.length; index += step) {
    sampled.push(coords[index]);
  }
  const last = coords[coords.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

function appendWaypoints(waypoints, target = els.routeSvg, projection = projectionContext()) {
  for (const waypoint of waypoints.slice(0, 30)) {
    const [x, y] = project(waypoint.coord, projection);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "waypoint");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x.toFixed(1));
    circle.setAttribute("cy", y.toFixed(1));
    circle.setAttribute("r", waypoint.kind?.includes("camp") ? "4" : "3");
    circle.setAttribute("fill", waypoint.kind?.includes("camp") ? "#7b4ab8" : "#596862");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", (x + 7).toFixed(1));
    text.setAttribute("y", (y - 6).toFixed(1));
    text.textContent = waypoint.name;
    g.append(circle, text);
    target.appendChild(g);
  }
}

function renderCampsites(routes, projection) {
  const visibleSites = visibleCampsites(routes);
  els.map.classList.toggle("campsites-hidden", !state.campsitesVisible);
  if (!state.campsitesVisible || !visibleSites.length) {
    els.campsiteSvg.replaceChildren();
    renderCampsitePopup(null, projection);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const site of visibleSites) {
    const [x, y] = project([site.longitude, site.latitude], projection);
    if (x < -24 || y < -24 || x > projection.rect.width + 24 || y > projection.rect.height + 24) continue;
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const style = campsiteStyle(site.category);
    marker.setAttribute("class", `campsite-marker ${escapeSvgClass(site.category)} ${state.selectedCampsiteId === site.id ? "active" : ""}`);
    marker.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    marker.dataset.campsite = site.id;
    marker.setAttribute("tabindex", "0");
    marker.setAttribute("role", "button");
    marker.setAttribute("aria-label", `${site.siteName}, ${style.label}`);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${site.siteName} | ${style.label} | ${site.routeName}`;
    const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    halo.setAttribute("r", "8.5");
    halo.setAttribute("class", "campsite-halo");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "5.4");
    circle.setAttribute("fill", style.color);
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "path");
    icon.setAttribute("d", campsiteIconPath(site.category));
    icon.setAttribute("class", "campsite-icon");
    marker.append(title, halo, circle, icon);
    marker.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.selectedCampsiteId = state.selectedCampsiteId === site.id ? null : site.id;
      drawMap();
    });
    marker.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      state.selectedCampsiteId = state.selectedCampsiteId === site.id ? null : site.id;
      drawMap();
    });
    fragment.appendChild(marker);
  }
  els.campsiteSvg.replaceChildren(fragment);
  renderCampsitePopup(visibleSites.find((site) => site.id === state.selectedCampsiteId), projection);
}

function visibleCampsites(routes) {
  if (!state.campsitesVisible || !state.campsites.length) return [];
  const routeIds = new Set(routes.map((route) => route.id));
  const sites = state.campsites.filter((site) => routeIds.has(site.routeId));
  const selected = selectedRoute();
  if (selected) return sites;
  const seen = new Set();
  return sites.filter((site) => {
    const key = `${site.siteName}|${site.category}|${site.longitude.toFixed(5)}|${site.latitude.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderCampsitePopup(site, projection) {
  if (!site) {
    els.campsitePopup.hidden = true;
    els.campsitePopup.replaceChildren();
    return;
  }
  const [x, y] = project([site.longitude, site.latitude], projection);
  const left = clamp(x + 14, 12, Math.max(12, projection.rect.width - 310));
  const top = clamp(y - 18, 12, Math.max(12, projection.rect.height - 210));
  const style = campsiteStyle(site.category);
  els.campsitePopup.style.left = `${left}px`;
  els.campsitePopup.style.top = `${top}px`;
  els.campsitePopup.hidden = false;
  const campsiteLink = campsitePrimaryLink(site);
  els.campsitePopup.innerHTML = `
    <button type="button" class="popup-close" aria-label="Close campsite details">&times;</button>
    <span class="campsite-popup-category" style="--site-color:${escapeHtml(style.color)}">${escapeHtml(style.label)}</span>
    <strong>${escapeHtml(site.siteName || "Campsite")}</strong>
    <em>${escapeHtml(site.routeName || "")}</em>
    <p>${escapeHtml(site.notes || "Confirm current status, reservation, permit, water, fire rules, and closures before relying on this site.")}</p>
    <a class="campsite-primary-link" href="${escapeHtml(campsiteLink.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(campsiteLink.label)}</a>`;
  els.campsitePopup.querySelector(".popup-close")?.addEventListener("click", () => {
    state.selectedCampsiteId = null;
    drawMap();
  });
}

function campsitePrimaryLink(site) {
  const campingUrl = String(site.campingSourceUrl || "").trim();
  const routeUrl = String(site.routeSourceUrl || "").trim();
  const sourceName = String(site.campingSourceName || "").trim();
  const routeSourceOnly = !campingUrl
    || (routeUrl && normalizeUrl(campingUrl) === normalizeUrl(routeUrl))
    || /route source|gpx waypoint/i.test(sourceName);
  if (!routeSourceOnly) {
    return {
      url: campingUrl,
      label: sourceName ? `Open ${sourceName}` : "Open campsite source",
    };
  }
  return {
    url: campsiteMapSearchUrl(site),
    label: "Open campsite location",
  };
}

function campsiteMapSearchUrl(site) {
  const name = site.siteName ? `${site.siteName} ` : "";
  const query = `${name}${site.latitude},${site.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function normalizeUrl(value = "") {
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(value || "").trim().replace(/\/$/, "");
  }
}

function campsiteStyle(category) {
  return CAMPSITE_CATEGORY_STYLES[category] || { color: "#596862", label: "Campsite" };
}

function campsiteIconPath(category) {
  if (category === "private_campsite_or_lodging") return "M -3 3 L -3 -2 L 0 -4 L 3 -2 L 3 3 Z";
  if (category === "dispersed_allowed_region") return "M 0 -4 L 4 3 L -4 3 Z";
  if (category === "hike_bike_site") return "M -4 2 L -1 -4 L 1 -4 L 4 2 Z M -1 2 L 0 -1 L 1 2";
  return "M -4 3 L 0 -4 L 4 3 Z M -2 3 L 0 -1 L 2 3";
}

function escapeSvgClass(value = "") {
  return String(value).replace(/[^a-z0-9_-]/gi, "-");
}

function renderMapLegend(routes) {
  const route = selectedRoute();
  const items = [];
  if (route) {
    for (const item of routes.slice(0, 8)) {
      items.push({ color: item.color || "#2f7b58", label: item.name, meta: `${labelMaturity(routeMaturity(item))} / ${labelGateStatus(routeGateStatus(item))}` });
    }
  } else if (routes.length) {
    items.push({ color: "#7a6f59", label: `${routes.length} visible routes`, meta: "browse" });
  }
  for (const variant of route?.variants || []) {
    if (state.activeVariants.has(variant.id)) {
      items.push({ color: variant.color || "#8b6f47", label: variant.name, meta: variant.type || "variant", dashed: true });
    }
  }
  if (state.dispersedAreasVisible) {
    if (route) {
      items.push({ color: DISPERSED_AREA_STYLES[2].color, label: DISPERSED_AREA_STYLES[2].label, meta: "candidate", area: true });
      items.push({ color: DISPERSED_AREA_STYLES[915].color, label: DISPERSED_AREA_STYLES[915].label, meta: "verify", area: true });
    } else {
      items.push({ color: DISPERSED_AREA_STYLES[915].color, label: "Public land overlay", meta: "on", area: true });
    }
    if (state.dispersedAreasNotice) items.push({ color: "#7a6f59", label: state.dispersedAreasNotice, meta: "detail", dashed: true });
    if (state.dispersedAreasLoading) items.push({ color: "#7a6f59", label: "Loading candidate land", meta: "live GIS", dashed: true });
    if (state.dispersedAreasError) items.push({ color: "#9b4637", label: "Candidate land unavailable", meta: "source", dashed: true });
  }
  if (state.campsitesVisible) {
    const categories = [...new Set(visibleCampsites(routes).map((site) => site.category))];
    if (route) {
      for (const category of categories) {
        const style = campsiteStyle(category);
        items.push({ color: style.color, label: style.label, meta: "camp", marker: true });
      }
    } else if (categories.length) {
      items.push({ color: "#007c91", label: `${visibleCampsites(routes).length} camps`, meta: "shown", marker: true });
    }
  }
  els.mapLegend.hidden = !items.length;
  els.mapLegend.classList.toggle("compact", !route);
  els.mapLegend.replaceChildren(...items.map((item) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `<span class="${item.marker ? "legend-dot" : item.area ? "legend-area" : "legend-line"} ${item.dashed ? "dashed" : ""}" style="background:${item.color}"></span><span>${escapeHtml(item.label)}</span><em>${escapeHtml(item.meta)}</em>`;
    return row;
  }));
}

function renderDetails() {
  const route = selectedRoute();
  if (!route) {
    els.detailTitle.textContent = "Route Library Overview";
    els.detailMeta.textContent = planningContextActive() ? "filtered browse" : "browse mode";
    if (!filteredRoutes().length) {
      els.dayFlow.replaceChildren(emptyNote("No matching routes to compare."));
      return;
    }
    const intro = document.createElement("div");
    intro.className = "overview-card browse-intro";
    intro.innerHTML = `<strong>Select a route to inspect days, camps, resources, variants, and evidence.</strong><p class="route-note">The library starts date- and region-agnostic. Add dates, region, length, or style filters when you want to check which options are plausible for a specific trip.</p>`;
    const cards = filteredRoutes().slice(0, 18).map((item) => {
      const card = document.createElement("div");
      card.className = "overview-card";
      card.innerHTML = `
        <strong>${escapeHtml(item.name)}</strong>
        <div class="day-meta">${escapeHtml(item.region || labelGroup(item.group))} &middot; ${item.distanceMi || 0} mi &middot; ${(item.gainFt || 0).toLocaleString()} ft &middot; ${item.days.length} days &middot; ${escapeHtml(item.shape || "route")}</div>
        <span class="pill-row">
          <span class="pill ${routeMaturityClass(item)}">${routeMaturityLabel(item)}</span>
          <span class="pill ${rideReadyStatusClass(item)}">${rideReadyStatusLabel(item)}</span>
          <span class="pill ${gateChipClass(topGate(item))}">Remaining work: ${escapeHtml(topGateLabel(item))}</span>
          ${routeDifficultyChip(item)}
          <span class="pill ${gateCountClass(item)}">${gateSummaryLabel(item)}</span>
        </span>
        <p class="route-note">${escapeHtml(item.description || item.sourceNote || "")}</p>
        ${sourceLinkHtml(item)}`;
      return card;
    });
    els.dayFlow.replaceChildren(intro, ...cards);
    return;
  }
  els.detailTitle.textContent = route.name;
  els.detailMeta.textContent = `route overview | ${route.days.length} days | ${routeMaturityLabel(route)} | ${labelGateStatus(routeGateStatus(route))}`;
  const overview = document.createElement("div");
  const gateStatus = routeGateStatus(route);
  const maturity = routeMaturity(route);
  const primaryGate = topGate(route);
  const isGateConfirmed = gateStatus === "confirmed";
  overview.className = `overview-card route-overview-card route-status-card ${isGateConfirmed ? "pass" : "blocked"}`;
  overview.innerHTML = `
    <div class="route-status-header">
      <div>
        <span class="status-kicker">${escapeHtml(labelMaturity(maturity))} | ${escapeHtml(labelQuality(route.sourceQuality))}</span>
        <strong>${escapeHtml(routeStatusHeadline(route))}</strong>
        <p>${escapeHtml(routeStatusSentence(route))}</p>
      </div>
      <span class="status-badge ${escapeHtml(gateStatus)}">${escapeHtml(labelGateStatus(gateStatus))}</span>
    </div>
    <div class="route-metric-strip">
      ${routeMetric("Distance", `${route.distanceMi || 0} mi`)}
      ${routeMetric("Gain", `${(route.gainFt || 0).toLocaleString()} ft`)}
      ${routeMetric("Days", `${route.days.length}`)}
      ${routeMetric("Region", route.region || labelGroup(route.group))}
      ${routeMetric("Shape", route.shape)}
    </div>
    ${sourceLinkHtml(route)}
    <div class="before-ready-strip">
      <strong>${escapeHtml(isGateConfirmed ? "Confirmed" : "Before ride-ready")}</strong>
      <span>${escapeHtml(visibleGateCountLabel(route, 5))}</span>
      <span>${escapeHtml(primaryGate.detail || primaryGate.label || "Route-specific checks remain open.")}</span>
      <div class="gate-strip">${gateChipsHtml(route, 5)}</div>
    </div>
    <div class="route-quick-notes">
      ${quickNote("Season", route.bestSeason)}
      ${quickNote("Surface", route.surfaceMix || route.gravelLevel)}
      ${quickNote("Camp", route.resources?.camping || route.resources?.lodging)}
      ${quickNote("Water", route.resources?.water || route.resources?.resupply)}
      ${quickNote("Hazard", firstListValue(route.hazards))}
    </div>`;
  const cards = route.days.map((day) => {
    const card = document.createElement("div");
    card.className = "day-card";
    card.innerHTML = `<strong>Day ${day.day}: ${escapeHtml(day.name)}</strong><div class="day-meta">${day.distanceMi || 0} mi | ${(day.gainFt || 0).toLocaleString()} ft gain</div><p class="route-note">${escapeHtml(day.camp || "")}</p>`;
    return card;
  });
  els.dayFlow.replaceChildren(overview, ...cards);
}

function renderReviewPanel() {
  const route = selectedRoute();
  if (!route) {
    els.reviewMeta.textContent = "select route";
    els.reviewPanel.innerHTML = "<p class=\"route-note\">Vetting evidence appears after you select a route. Browse first, then use this area for ride-ready work, blockers, dated evidence, and handoff notes.</p>";
    return;
  }
  const review = route.review || {};
  const verification = route.verification || {};
  const checklist = route.promotionChecklist || {};
  els.reviewMeta.textContent = review.decision || "needs review";
  const openAttr = shouldOpenEvidenceDetails() ? " open" : "";
  els.reviewPanel.innerHTML = `
    <div class="qa-callout ${routeGateStatus(route) === "confirmed" ? "pass" : ""}">
      <strong>Evidence summary</strong>
      <span>${escapeHtml(rideReadyClearanceTitle(route))} | ${escapeHtml(gateCountLabel(route))} | ${escapeHtml(browseConcernLabel(route))}</span>
    </div>
    <details class="evidence-disclosure"${openAttr}>
      <summary>Evidence & ride-ready work</summary>
      <div class="evidence-disclosure-body">
        <div class="qa-callout ${route.mapQuality?.terrainVisible ? "pass" : "fail"}">
          <strong>Map QA</strong>
          <span>${route.mapQuality?.terrainVisible ? "Terrain/topographic background present" : "Terrain background missing"} | ${escapeHtml(route.mapQuality?.routeContrast || "contrast unknown")}</span>
        </div>
        ${targetWindowCallout(checklist)}
        ${readinessScoreCallout(route)}
        ${promotionChecklistBlock(checklist)}
        <div class="check-grid">
          ${checkItem("Legal access", verification.legalAccess)}
          ${checkItem("Resources", verification.resourceAvailability)}
          ${checkItem("GPX/GeoJSON", verification.gpxGeojson)}
          ${checkItem("Elevation", verification.elevationProfile)}
          ${checkItem("PDF render", verification.pdfRendered)}
        </div>
        ${readinessEvidenceBlock(route.readinessEvidence)}
        ${promotionActionsBlock(route.promotionActions)}
        ${listBlock("Blockers", review.blockers)}
        ${listBlock("Required fixes", review.requiredFixes)}
        ${listBlock("Open questions", review.openQuestions)}
      </div>
    </details>`;
}

function shouldOpenEvidenceDetails() {
  return ["near", "candidate", "blocked"].includes(state.readinessFilter)
    || ["concept", "plan_ready"].includes(state.statusFilter);
}

function targetWindowCallout(checklist) {
  const windowInfo = state.trip.targetTripWindow || {};
  const status = checklist.targetWindowFit || "needs_refresh";
  const label = windowInfo.label
    ? `${windowInfo.label}: ${windowInfo.coreDates || `${windowInfo.startDate} to ${windowInfo.endDate}`}`
    : "Target window";
  return `<div class="qa-callout ${status === "blocker" ? "fail" : status === "pass" ? "pass" : ""}">
    <strong>${escapeHtml(label)}</strong>
    <span>${escapeHtml(checklist.targetWindowNote || windowInfo.note || "Refresh date-specific conditions before departure.")}</span>
  </div>`;
}

function readinessScoreCallout(route) {
  const score = route.readinessScore || {};
  const value = score.score ?? 0;
  const blocked = (score.blockerCount || 0) > 0 || routeGateStatus(route) !== "confirmed";
  return `<div class="qa-callout ${blocked ? "fail" : value >= 70 ? "pass" : ""}">
    <strong>${escapeHtml(rideReadyClearanceTitle(route))}</strong>
    <span>${score.blockerCount || 0} blockers | ${score.requiredActionCount || 0} work items | ${score.passGateCount || 0}/${score.gateCount || 6} checks pass | clearance score ${value}/100, not route quality</span>
  </div>`;
}

function promotionChecklistBlock(checklist) {
  const items = [
    ["Window fit", checklist.targetWindowFit, checklist.targetWindowNote],
    ["Official geometry", checklist.officialGeometry, checklist.officialGeometryNote],
    ["Legal access", checklist.legalAccess],
    ["Camps / permits", checklist.campingPermits],
    ["Water / resupply", checklist.waterResupply],
    ["Closures / fire / weather", checklist.closuresFireWeather],
    ["Map artifacts", checklist.mapArtifacts],
    ["Decision", checklist.finalDecision],
  ];
  return `<strong>Ride-ready work checks</strong><div class="check-grid">${items.map(([label, value, note]) => checkItem(label, value, note)).join("")}</div>`;
}

function promotionActionsBlock(actions = []) {
  const items = (actions || []).filter(Boolean);
  if (!items.length) return "";
  return `<strong>Promotion action queue</strong><div class="action-list">${items.map((item) => `
    <div class="action-item ${escapeHtml(item.priority || "required")}">
      <span>${escapeHtml(item.category || "Action")}</span>
      <strong>${escapeHtml(item.action || "")}</strong>
      <em>${escapeHtml(item.status || "open")}</em>
    </div>`).join("")}</div>`;
}

function readinessEvidenceBlock(evidence = []) {
  const items = (evidence || []).filter(Boolean);
  if (!items.length) return "";
  return `<strong>Dated readiness evidence</strong><div class="evidence-list">${items.map((item) => `
    <div class="evidence-item ${escapeHtml(item.status || "partial")}">
      <span>${escapeHtml(labelKey(item.gate || "evidence"))}</span>
      <strong>${escapeHtml(item.finding || "")}</strong>
      <em>${escapeHtml(item.status || "partial")} | ${escapeHtml(item.checkedAt || "undated")}</em>
      ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceName || item.url)}</a>` : `<small>${escapeHtml(item.sourceName || "")}</small>`}
    </div>`).join("")}</div>`;
}

function renderResourcePanel() {
  const route = selectedRoute();
  if (!route) {
    els.resourceMeta.textContent = "select route";
    els.resourcePanel.innerHTML = "<p class=\"route-note\">Select a route to inspect difficulty, water, resupply, camping, lodging, hazards, and practical tips.</p>";
    return;
  }
  const profile = route.difficultyProfile || {};
  const resources = route.resources || {};
  els.resourceMeta.textContent = `${profile.overall || "difficulty TBD"} | ${route.gravelLevel || "gravel TBD"}`;
  els.resourcePanel.innerHTML = `
    <div class="info-columns">
      <div>
        <strong>Difficulty</strong>
        <dl>${definitionList(profile)}</dl>
      </div>
      <div>
        <strong>Resources</strong>
        <dl>${definitionList(resources)}</dl>
      </div>
    </div>
    ${listBlock("Hazards", route.hazards)}
    ${listBlock("Route tips", route.tips)}`;
}

function checkItem(label, value, note = "") {
  const ok = ["verified", "available_approximation", "not_required", "pass", "ride_ready_with_final_refresh"].includes(value);
  const blocked = ["blocker", "fail"].includes(value);
  return `<span class="check-item ${ok ? "ok" : blocked ? "blocker" : "needs"}"><strong>${escapeHtml(label)}</strong><em>${escapeHtml(value || "needed")}</em>${note ? `<small>${escapeHtml(note)}</small>` : ""}</span>`;
}

function listBlock(title, items = []) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return "";
  return `<strong>${escapeHtml(title)}</strong><ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function firstListValue(items = []) {
  return (items || []).filter(Boolean)[0] || "";
}

function definitionList(obj = {}) {
  return Object.entries(obj).map(([key, value]) => `<dt>${escapeHtml(labelKey(key))}</dt><dd>${escapeHtml(value)}</dd>`).join("");
}

function labelKey(key) {
  return String(key).replace(/([A-Z])/g, " $1").replace(/^./, (ch) => ch.toUpperCase());
}

function renderVariants() {
  const route = selectedRoute();
  if (!route) {
    els.variantMeta.textContent = "select a route";
    els.variants.replaceChildren(emptyNote("Select a route to inspect gravel, detours, and alternate-day options."));
    return;
  }
  const variants = route.variants || [];
  els.variantMeta.textContent = `${variants.length} options`;
  if (!variants.length) {
    els.variants.replaceChildren(emptyNote("No variants imported for this route yet."));
    return;
  }
  els.variants.replaceChildren(...variants.map((variant) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `variant-row ${state.activeVariants.has(variant.id) ? "active" : ""}`;
    row.innerHTML = `<strong>${escapeHtml(variant.name)}</strong><div class="day-meta">${variant.distanceMi || 0} mi | ${(variant.gainFt || 0).toLocaleString()} ft | ${escapeHtml(variant.type || "variant")}</div><span class="pill-row"><span class="pill ${variant.sourceQuality}">${labelQuality(variant.sourceQuality)}</span>${variant.difficulty ? `<span class="pill">${escapeHtml(variant.difficulty)}</span>` : ""}</span>`;
    row.addEventListener("click", () => {
      if (state.activeVariants.has(variant.id)) state.activeVariants.delete(variant.id);
      else state.activeVariants.add(variant.id);
      fitToRoutes([route]);
      drawAll();
    });
    return row;
  }));
}

function renderElevation() {
  const route = selectedRoute();
  const routes = route ? [route] : filteredRoutes();
  if (!routes.length) {
    els.elevationBars.replaceChildren(emptyNote("No elevation comparison for the current filters."));
    return;
  }
  let maxGain = 1;
  for (const item of routes) {
    maxGain = Math.max(maxGain, item.gainFt || 0);
  }
  els.elevationBars.replaceChildren(...routes.slice(0, 12).map((item) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    const pct = Math.max(4, Math.round((item.gainFt || 0) / maxGain * 100));
    row.innerHTML = `<strong>${escapeHtml(item.name)}</strong><span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${item.color || "#2f7b58"}"></span></span><span class="day-meta">${(item.gainFt || 0).toLocaleString()} ft</span>`;
    return row;
  }));
}

function renderSourceNotes() {
  const route = selectedRoute();
  const notes = route
    ? [route.sourceNote, route.verification?.notes, route.mapQuality?.reviewRule, ...(route.logistics || [])]
    : (state.trip.sourceNotes || []);
  els.sourceNotes.innerHTML = `<strong>Source Notes</strong><br>${notes.filter(Boolean).map(linkifyNote).join("<br>")}`;
}

function emptyNote(text) {
  const div = document.createElement("div");
  div.className = "overview-card";
  div.textContent = text;
  return div;
}

function fitToRoutes(routes) {
  const sets = routes.flatMap((route) => route.days.map((day) => day.coords));
  const route = selectedRoute();
  if (route) {
    for (const variant of route.variants || []) {
      if (state.activeVariants.has(variant.id)) sets.push(variant.coords);
    }
  }
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  let coordCount = 0;
  for (const coords of sets) {
    for (const coord of coords || []) {
      west = Math.min(west, coord[0]);
      east = Math.max(east, coord[0]);
      south = Math.min(south, coord[1]);
      north = Math.max(north, coord[1]);
      coordCount += 1;
    }
  }
  if (!coordCount) return;
  state.map.center = [(west + east) / 2, (south + north) / 2];
  state.map.zoom = fitZoom([west, south, east, north]);
}

function fitZoom(bounds) {
  const rect = els.map.getBoundingClientRect();
  const width = Math.max(320, rect.width || 900);
  const height = Math.max(320, rect.height || 560);
  const padding = 72;
  const [west, south, east, north] = bounds;
  for (let zoom = state.map.maxZoom; zoom >= state.map.minZoom; zoom -= 1) {
    const northwest = lonLatToWorld(west, north, zoom);
    const southeast = lonLatToWorld(east, south, zoom);
    const spanX = Math.abs(southeast[0] - northwest[0]);
    const spanY = Math.abs(southeast[1] - northwest[1]);
    if (spanX <= width - padding * 2 && spanY <= height - padding * 2) {
      return clamp(zoom, state.map.minZoom, state.map.maxZoom);
    }
  }
  return state.map.minZoom;
}

function zoomBy(delta, anchorClient = null, options = {}) {
  const oldZoom = state.map.zoom;
  const newZoom = clamp(oldZoom + delta, state.map.minZoom, state.map.maxZoom);
  if (newZoom === oldZoom) return;

  if (anchorClient) {
    const rect = els.map.getBoundingClientRect();
    const screenX = anchorClient[0] - rect.left;
    const screenY = anchorClient[1] - rect.top;
    const anchorLonLat = screenToLonLat(screenX, screenY, oldZoom);
    state.map.zoom = newZoom;
    const anchorWorld = lonLatToWorld(anchorLonLat[0], anchorLonLat[1], newZoom);
    const centerWorld = [
      anchorWorld[0] - (screenX - rect.width / 2),
      anchorWorld[1] - (screenY - rect.height / 2),
    ];
    state.map.center = worldToLonLat(centerWorld[0], centerWorld[1], newZoom);
  } else {
    state.map.zoom = newZoom;
  }
  if (options.preview) queueMapPreviewTransform();
  else drawMap(options);
}

function scheduleZoomCommit() {
  scheduleMapCommit(110);
}

function scheduleMapCommit(delay = 90) {
  if (state.map.tileRefreshTimer) {
    window.clearTimeout(state.map.tileRefreshTimer);
  }
  state.map.tileRefreshTimer = window.setTimeout(() => {
    state.map.tileRefreshTimer = null;
    drawMap();
  }, delay);
}

function updatePanVelocity(event) {
  if (!state.map.dragLast) {
    state.map.dragLast = [event.clientX, event.clientY];
    state.map.dragLastTime = performance.now();
    return;
  }
  const now = performance.now();
  const elapsed = Math.max(8, now - state.map.dragLastTime);
  const dx = event.clientX - state.map.dragLast[0];
  const dy = event.clientY - state.map.dragLast[1];
  const frameScale = 16 / elapsed;
  const nextVelocity = [
    clamp(dx * frameScale, -42, 42),
    clamp(dy * frameScale, -42, 42),
  ];
  state.map.panVelocity = [
    state.map.panVelocity[0] * 0.35 + nextVelocity[0] * 0.65,
    state.map.panVelocity[1] * 0.35 + nextVelocity[1] * 0.65,
  ];
  state.map.dragLast = [event.clientX, event.clientY];
  state.map.dragLastTime = now;
}

function startPanInertia() {
  const [vx, vy] = state.map.panVelocity;
  if (Math.hypot(vx, vy) < 0.9) return false;
  state.map.inertiaLastTime = performance.now();
  const step = (now) => {
    const elapsed = Math.min(32, Math.max(8, now - state.map.inertiaLastTime));
    state.map.inertiaLastTime = now;
    const scale = elapsed / 16;
    panByPixels(state.map.panVelocity[0] * scale, state.map.panVelocity[1] * scale);
    state.map.panVelocity = [
      state.map.panVelocity[0] * (0.90 ** scale),
      state.map.panVelocity[1] * (0.90 ** scale),
    ];
    queueMapPreviewTransform();
    if (Math.hypot(state.map.panVelocity[0], state.map.panVelocity[1]) < 0.12) {
      state.map.inertiaFrame = null;
      scheduleMapCommit(35);
      return;
    }
    state.map.inertiaFrame = window.requestAnimationFrame(step);
  };
  state.map.inertiaFrame = window.requestAnimationFrame(step);
  return true;
}

function stopPanInertia() {
  if (state.map.inertiaFrame) {
    window.cancelAnimationFrame(state.map.inertiaFrame);
    state.map.inertiaFrame = null;
  }
  state.map.panVelocity = [0, 0];
}

function panByPixels(dx, dy) {
  const centerWorld = lonLatToWorld(state.map.center[0], state.map.center[1], state.map.zoom);
  state.map.center = worldToLonLat(centerWorld[0] - dx, centerWorld[1] - dy, state.map.zoom);
}

function queueMapPreviewTransform() {
  if (state.map.previewFrame) return;
  state.map.previewFrame = window.requestAnimationFrame(() => {
    state.map.previewFrame = null;
    applyMapPreviewTransform();
  });
}

function commitMapPreview() {
  if (state.map.tileRefreshTimer) {
    window.clearTimeout(state.map.tileRefreshTimer);
    state.map.tileRefreshTimer = null;
  }
  if (state.map.previewFrame) {
    window.cancelAnimationFrame(state.map.previewFrame);
    state.map.previewFrame = null;
    applyMapPreviewTransform();
  }
  if (state.map.zoomPreviewing) drawMap();
}

function applyMapPreviewTransform() {
  const rect = els.map.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const baseZoom = state.map.renderedZoom;
  const baseCenter = state.map.renderedCenter;
  const scale = 2 ** (state.map.zoom - baseZoom);
  const baseCenterWorld = lonLatToWorld(baseCenter[0], baseCenter[1], baseZoom);
  const currentCenterWorld = lonLatToWorld(state.map.center[0], state.map.center[1], baseZoom);
  const tx = rect.width / 2 - scale * rect.width / 2 + scale * (baseCenterWorld[0] - currentCenterWorld[0]);
  const ty = rect.height / 2 - scale * rect.height / 2 + scale * (baseCenterWorld[1] - currentCenterWorld[1]);
  const transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(5)})`;
  els.tileLayer.style.transform = transform;
  els.dispersedSvg.style.transform = transform;
  els.routeSvg.style.transform = transform;
  els.campsiteSvg.style.transform = transform;
  state.map.zoomPreviewing = true;
}

function resetMapPreviewTransform() {
  if (state.map.previewFrame) {
    window.cancelAnimationFrame(state.map.previewFrame);
    state.map.previewFrame = null;
  }
  if (!state.map.zoomPreviewing) return;
  els.tileLayer.style.transform = "";
  els.dispersedSvg.style.transform = "";
  els.routeSvg.style.transform = "";
  els.campsiteSvg.style.transform = "";
  state.map.zoomPreviewing = false;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lonLatToWorld(lon, lat, zoom = state.map.zoom) {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin(lat * Math.PI / 180);
  return [(lon + 180) / 360 * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
}

function worldToLonLat(x, y, zoom = state.map.zoom) {
  const scale = 256 * 2 ** zoom;
  const lon = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lon, lat];
}

function screenToLonLat(screenX, screenY, zoom = state.map.zoom) {
  const rect = els.map.getBoundingClientRect();
  const center = lonLatToWorld(state.map.center[0], state.map.center[1], zoom);
  return worldToLonLat(center[0] + screenX - rect.width / 2, center[1] + screenY - rect.height / 2, zoom);
}

function projectionContext(rect = els.map.getBoundingClientRect(), zoom = state.map.zoom, center = state.map.center) {
  return {
    rect,
    zoom,
    centerWorld: lonLatToWorld(center[0], center[1], zoom),
  };
}

function project(coord, context = projectionContext()) {
  const point = lonLatToWorld(coord[0], coord[1], context.zoom);
  return [
    context.rect.width / 2 + point[0] - context.centerWorld[0],
    context.rect.height / 2 + point[1] - context.centerWorld[1],
  ];
}

function drawTiles(rect) {
  const provider = TILE_PROVIDERS[state.basemap] || TILE_PROVIDERS.fast;
  const tileZoom = clamp(Math.floor(state.map.zoom), state.map.minZoom, state.map.maxZoom);
  const scale = 2 ** (state.map.zoom - tileZoom);
  const center = lonLatToWorld(state.map.center[0], state.map.center[1], tileZoom);
  const topLeft = [center[0] - rect.width / (2 * scale), center[1] - rect.height / (2 * scale)];
  const tileBuffer = state.map.dragging || state.map.zoomPreviewing || tileZoom <= 7 ? 0 : 1;
  const minX = Math.floor(topLeft[0] / 256) - tileBuffer;
  const minY = Math.floor(topLeft[1] / 256) - tileBuffer;
  const maxX = Math.floor((topLeft[0] + rect.width / scale) / 256) + tileBuffer;
  const maxY = Math.floor((topLeft[1] + rect.height / scale) / 256) + tileBuffer;
  const maxTile = 2 ** tileZoom;
  const fragment = document.createDocumentFragment();
  const nextTileNodes = new Map();
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      const key = `${tileZoom}/${wrappedX}/${y}`;
      const cacheKey = `${state.basemap}:${key}`;
      const img = state.map.tileNodes.get(cacheKey) || document.createElement("img");
      const subdomain = provider.subdomains[(wrappedX + y) % provider.subdomains.length];
      if (!img.dataset.tileKey) {
        img.alt = "";
        img.decoding = "async";
        img.loading = "lazy";
        img.dataset.tileKey = cacheKey;
        img.dataset.provider = provider.name;
        img.referrerPolicy = "no-referrer";
        img.src = provider.url(subdomain, key);
      }
      img.style.left = `${Math.round((x * 256 - topLeft[0]) * scale)}px`;
      img.style.top = `${Math.round((y * 256 - topLeft[1]) * scale)}px`;
      img.style.width = `${Math.ceil(256 * scale)}px`;
      img.style.height = `${Math.ceil(256 * scale)}px`;
      nextTileNodes.set(cacheKey, img);
      fragment.appendChild(img);
    }
  }
  els.tileLayer.replaceChildren(fragment);
  state.map.tileNodes = nextTileNodes;
}

function currentExportRoutes() {
  const route = selectedRoute();
  return route ? [route] : filteredRoutes();
}

function updateExportButtons() {
  const disabled = currentExportRoutes().length === 0;
  if (els.downloadGeojson) els.downloadGeojson.disabled = disabled;
  if (els.downloadGpx) els.downloadGpx.disabled = disabled;
  const route = selectedRoute();
  if (els.exportRoutePackage) {
    els.exportRoutePackage.hidden = !route;
    if (!route) {
      clearRouteExport();
      els.exportRoutePackage.textContent = "Preparing export...";
      els.exportRoutePackage.setAttribute("aria-disabled", "true");
      els.exportRoutePackage.removeAttribute("href");
    } else if (state.exportPackageRouteId !== route.id && state.exportPackagePreparingRouteId !== route.id) {
      prepareRouteExport(route);
    }
  }
}

function routeToGeojson(route) {
  const features = route.days.map((day) => ({
    type: "Feature",
    properties: {
      route: route.id,
      routeName: route.name,
      day: day.day,
      name: day.name,
      camp: day.camp,
      distance_mi: day.distanceMi,
      gain_ft: day.gainFt,
      source_quality: route.sourceQuality,
      maturity: routeMaturity(route),
      gate_status: routeGateStatus(route),
      surface_mix: route.surfaceMix,
      best_season: route.bestSeason,
      resource_water: route.resources?.water,
      resource_camping: route.resources?.camping,
      map_basemap: route.mapQuality?.basemap,
    },
    geometry: { type: "LineString", coordinates: day.coords },
  }));
  return { type: "FeatureCollection", features };
}

async function downloadGeojson() {
  try {
    const routes = await hydrateRoutes(currentExportRoutes());
    const collection = { type: "FeatureCollection", features: routes.flatMap((route) => routeToGeojson(route).features) };
    downloadText(`${exportBaseName()}.geojson`, JSON.stringify(collection, null, 2), "application/geo+json");
  } catch (error) {
    showLoadError(error);
  }
}

async function downloadGpx() {
  try {
    const routes = await hydrateRoutes(currentExportRoutes());
    downloadText(`${exportBaseName()}.gpx`, routesToGpx(routes), "application/gpx+xml");
  } catch (error) {
    showLoadError(error);
  }
}

async function exportSelectedRoutePackage() {
  const route = selectedRoute();
  if (!route) return;
  try {
    const blob = await routeExportPackage(route);
    downloadBlob(`${route.id}-export.zip`, blob, "application/zip");
  } catch (error) {
    showLoadError(error);
  }
}

async function prepareRouteExport(route) {
  if (!els.exportRoutePackage || !route) return;
  clearRouteExport();
  state.exportPackagePreparingRouteId = route.id;
  els.exportRoutePackage.textContent = "Preparing export...";
  els.exportRoutePackage.setAttribute("aria-disabled", "true");
  els.exportRoutePackage.removeAttribute("href");
  try {
    const blob = await routeExportPackage(route);
    if (selectedRoute()?.id !== route.id) return;
    const url = URL.createObjectURL(blob);
    state.exportPackageUrl = url;
    state.exportPackageRouteId = route.id;
    els.exportRoutePackage.href = url;
    els.exportRoutePackage.download = `${route.id}-export.zip`;
    els.exportRoutePackage.textContent = "Export GPX + PDF";
    els.exportRoutePackage.setAttribute("aria-disabled", "false");
  } catch (error) {
    if (selectedRoute()?.id === route.id) showLoadError(error);
    els.exportRoutePackage.textContent = "Export unavailable";
  } finally {
    if (state.exportPackagePreparingRouteId === route.id) state.exportPackagePreparingRouteId = "";
  }
}

async function routeExportPackage(route) {
  const [hydrated] = await hydrateRoutes([route]);
  const gpx = new TextEncoder().encode(routesToGpx([hydrated]));
  const pdf = new Uint8Array(await routeSummaryPdf(hydrated).arrayBuffer());
  return buildZip([
    { name: `${hydrated.id}.gpx`, bytes: gpx },
    { name: `${hydrated.id}-summary.pdf`, bytes: pdf },
  ]);
}

function clearRouteExport() {
  if (state.exportPackageUrl) URL.revokeObjectURL(state.exportPackageUrl);
  state.exportPackageUrl = "";
  state.exportPackageRouteId = "";
}

function routesToGpx(routes) {
  const tracks = routes.flatMap((route) => route.days.map((day) => {
    const pts = day.coords.map((coord) => {
      const ele = coord.length > 2 ? `<ele>${coord[2].toFixed(1)}</ele>` : "";
      return `      <trkpt lat="${coord[1].toFixed(6)}" lon="${coord[0].toFixed(6)}">${ele}</trkpt>`;
    }).join("\n");
    return `  <trk><name>${xmlEscape(route.name)} - Day ${day.day}</name><desc>${xmlEscape(day.name)}</desc><trkseg>\n${pts}\n    </trkseg></trk>`;
  })).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="bikepacking_planner" xmlns="http://www.topografix.com/GPX/1/1">\n${tracks}\n</gpx>\n`;
}

function routeSummaryPdf(route) {
  const lines = routeSummaryLines(route).flatMap((line) => wrapPdfLine(line, 92));
  const content = [
    "BT",
    "/F1 18 Tf",
    "54 760 Td",
    `(${pdfEscape(route.name || "Route summary")}) Tj`,
    "/F1 10 Tf",
    "0 -24 Td",
    ...lines.slice(0, 42).map((line) => [`(${pdfEscape(line)}) Tj`, "0 -14 Td"]).flat(),
    "ET",
  ].join("\n");
  return buildPdf(content);
}

function routeSummaryLines(route) {
  const gates = biggestGates(route, 6).map((gate) => `- ${gate.label}${gate.detail ? `: ${gate.detail}` : ""}`);
  const source = primarySource(route);
  return [
    `Region: ${route.region || labelGroup(route.group)}`,
    `Distance: ${route.distanceMi || 0} mi | Gain: ${(route.gainFt || 0).toLocaleString()} ft | Days: ${(route.days || []).length}`,
    `Shape: ${route.shape || "route"} | Surface: ${surfaceLabel(route)} | Difficulty: ${route.difficulty || "TBD"}`,
    `Readiness: ${rideReadyStatusLabel(route)} | Stage: ${routeMaturityLabel(route)}`,
    `Best season: ${route.bestSeason || "TBD"}`,
    "",
    "Remaining work before ride-ready:",
    ...(gates.length ? gates : ["- No remaining work listed"]),
    "",
    "Known logistics:",
    `Camping/lodging: ${summaryText(route.resources?.camping || route.overnight?.summary, "TBD")}`,
    `Water/resupply: ${summaryText(route.resources?.water || route.resupply?.summary, "TBD")}`,
    `Hazards: ${summaryText(route.hazards || route.safety?.summary, "Refresh conditions before riding.")}`,
    "",
    `Primary source: ${source?.label || source?.title || "TBD"} ${source?.url || ""}`,
    "Generated by Bikepacking Route Library. Refresh closures, fire, weather, water, and permits before departure.",
  ];
}

function summaryText(value, fallback = "TBD") {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => summaryText(item, "")).filter(Boolean).join("; ") || fallback;
  if (value && typeof value === "object") return value.summary || value.notes || value.label || fallback;
  return value || fallback;
}

function wrapPdfLine(line, width) {
  if (!line) return [""];
  const words = String(line).replace(/\s+/g, " ").split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildPdf(content) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: "application/pdf" });
}

function pdfEscape(value) {
  return String(value || "").replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach((file) => {
    const nameBytes = new TextEncoder().encode(file.name);
    const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
    const crc = crc32(bytes);
    const localHeader = zipLocalHeader(nameBytes, bytes.length, crc);
    localParts.push(localHeader, bytes);
    centralParts.push(zipCentralHeader(nameBytes, bytes.length, crc, offset));
    offset += localHeader.length + bytes.length;
  });
  const central = concatUint8(centralParts);
  const end = zipEndRecord(files.length, central.length, offset);
  return new Blob([...localParts, central, end], { type: "application/zip" });
}

function zipLocalHeader(nameBytes, size, crc) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  return header;
}

function zipCentralHeader(nameBytes, size, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function zipEndRecord(entries, centralSize, centralOffset) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entries, true);
  view.setUint16(10, entries, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

function concatUint8(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function exportBaseName() {
  const route = selectedRoute();
  return route ? route.id : `${state.trip.id}-${state.group}-routes`;
}

function downloadText(filename, text, type) {
  downloadBlob(filename, new Blob([text], { type }), type);
}

function downloadBlob(filename, blob, type = "application/octet-stream") {
  const typedBlob = blob.type ? blob : new Blob([blob], { type });
  const url = URL.createObjectURL(typedBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function saveEditRequest(event) {
  event.preventDefault();
  const text = els.editText.value.trim();
  if (!text) return;
  const route = selectedRoute();
  els.editStatus.textContent = "saving...";
  try {
    const response = await fetch("/api/edit-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: state.trip.id,
        routeId: route?.id || null,
        routeName: route?.name || "All Route Options",
        text,
        context: {
          group: state.group,
          activeVariants: [...state.activeVariants],
          sourcePolicy: state.trip.sourcePolicy,
        },
      }),
    });
    if (response.ok) {
      els.editStatus.textContent = "saved";
      els.editText.value = "";
    } else {
      els.editStatus.textContent = "copy prompt instead";
    }
  } catch {
    els.editStatus.textContent = "copy prompt instead";
  }
}

async function copyEditPrompt() {
  const text = els.editText.value.trim();
  const route = selectedRoute();
  const prompt = `Route edit request for bikepacking_planner.\nTrip: ${state.trip.id}\nRoute: ${route?.name || "All Route Options"}\nCurrent maturity: ${route ? labelMaturity(routeMaturity(route)) : "mixed"}\nCurrent ride-ready work status: ${route ? labelGateStatus(routeGateStatus(route)) : "mixed"}\nRequest: ${text}\nPreserve source-quality labels, route shape labels, maturity, ride-ready work status, terrain/topographic basemap QA, resources, difficulty dimensions, GPX/GeoJSON exports, variants, elevation comparisons, and local-cache reuse.`;
  try {
    await navigator.clipboard.writeText(prompt);
    els.editStatus.textContent = "prompt copied";
  } catch {
    els.editStatus.textContent = "clipboard blocked";
  }
}

function labelQuality(value) {
  return {
    official_gpx: "Official route file",
    user_provided_gpx: "User-provided GPX",
    routed_approximation: "Approximate route",
    concept: "Research lead",
    verified_variant: "Source-backed route",
  }[value] || value || "Unknown";
}

function routeMaturity(route) {
  return route?.maturity || route?.status || "candidate";
}

function routeGateStatus(route) {
  if (route?.gateStatus) return route.gateStatus;
  if (route?.status === "ride_ready") return "confirmed";
  const blockers = route?.readinessScore?.blockerCount || 0;
  return blockers ? "blocked" : "partial";
}

function labelMaturity(value) {
  return {
    candidate: "Candidate",
    concept: "Concept",
    plan_ready: "Plan Ready",
    idea: "Candidate",
    planning_grade: "Plan Ready",
    ride_ready: "Plan Ready",
  }[value] || "Candidate";
}

function routeMaturityLabel(route) {
  if (route?.status === "ride_ready") return "Ride-ready plan";
  if (route?.sourceQuality === "concept") return "Research lead";
  return "Planning material";
}

function routeMaturityClass(route) {
  if (route?.status === "ride_ready") return "ride_ready";
  if (route?.sourceQuality === "concept") return "concept";
  return "planning_grade";
}

function labelGateStatus(value) {
  return {
    blocked: "Work required",
    partial: "Needs review",
    confirmed: "Ride-ready",
  }[value] || "Needs review";
}

function rideReadyStatusLabel(route) {
  if (routeGateStatus(route) === "confirmed") return "Ride-ready";
  const gates = biggestGates(route, 20).length;
  if (gates) return "Not ride-ready";
  return "Needs current-condition refresh";
}

function rideReadyStatusClass(route) {
  if (routeGateStatus(route) === "confirmed") return "readiness_good";
  if (biggestGates(route, 20).some((gate) => gate.severity === "blocker")) return "readiness_blocked";
  return "readiness_candidate";
}

function labelDecision(value) {
  return {
    candidate: "new candidate",
    top_candidate: "strong candidate",
    close_candidate: "close candidate",
    near_ride_ready: "close to ride-ready",
    ride_ready_with_final_refresh: "ride-ready with final refresh",
    reject_rework: "blocked - do not use yet",
    segment_only: "segment only",
    rework: "rework",
  }[value] || String(value || "candidate").replace(/_/g, " ");
}

function labelReadiness(route) {
  const decision = route.promotionChecklist?.finalDecision || "candidate";
  return labelDecision(decision);
}

function labelTargetWindow(route) {
  const fit = route.promotionChecklist?.targetWindowFit || "needs_refresh";
  return fit.replace(/_/g, " ");
}

function rideReadyClearanceTitle(route) {
  if (routeGateStatus(route) === "confirmed") return "Ride-ready status: confirmed";
  const blockers = route.readinessScore?.blockerCount || 0;
  if (blockers) return "Ride-ready work required";
  return "Ride-ready status: needs review";
}

function rideReadyClearanceLabel(route) {
  if (routeGateStatus(route) === "confirmed") return "Ride-ready";
  const blockers = route.readinessScore?.blockerCount || 0;
  if (blockers) return "Work required";
  const required = route.readinessScore?.requiredActionCount || 0;
  if (required) return "Needs review";
  return "Needs review";
}

function rideReadyClearanceClass(route) {
  if (routeGateStatus(route) === "confirmed") return "clearance_good";
  const blockers = route.readinessScore?.blockerCount || 0;
  if (blockers) return "clearance_blocked";
  return "clearance_pending";
}

function targetWindowClass(route) {
  const fit = route.promotionChecklist?.targetWindowFit || "";
  if (fit === "pass") return "window_pass";
  if (fit === "blocker") return "window_blocked";
  return "window_refresh";
}

function readinessClass(route) {
  const decision = route.promotionChecklist?.finalDecision || "";
  const windowFit = route.promotionChecklist?.targetWindowFit || "";
  if (routeGateStatus(route) === "confirmed" || decision === "ride_ready_with_final_refresh") return "readiness_good";
  if (windowFit === "blocker" || ["reject_rework", "segment_only", "rework"].includes(decision)) return "readiness_blocked";
  return "readiness_candidate";
}

function labelGroup(groupId) {
  const group = (state.trip?.routeGroups || []).find((item) => item.id === groupId);
  return group?.name || groupId || "Unmapped";
}

function mainBlockerLabel(route) {
  const blocker = (route.promotionActions || []).find((action) => action.priority === "blocker");
  if (blocker?.category) return `blocker: ${blocker.category}`;
  const decision = route.promotionChecklist?.finalDecision || "";
  if (routeGateStatus(route) === "confirmed" || decision === "ride_ready_with_final_refresh") return "ride-ready";
  const windowFit = route.promotionChecklist?.targetWindowFit || "";
  if (windowFit === "needs_refresh") return "needs date refresh";
  if (windowFit === "blocker") return "date/window blocker";
  return "planning check TBD";
}

function topGate(route) {
  return biggestGates(route, 1)[0] || {
    label: routeGateStatus(route) === "confirmed" ? "Ride-ready" : "Planning check TBD",
    severity: routeGateStatus(route) === "confirmed" ? "pass" : "needs",
  };
}

function topGateLabel(route) {
  return topGate(route).label;
}

function browseConcernLabel(route) {
  if (routeGateStatus(route) === "confirmed") return "Ride-ready";
  const label = topGateLabel(route);
  return {
    "Camp/permit not confirmed": "Needs camp check",
    "Bike legality audit needed": "Needs bike-legality check",
    "Traffic/shoulder review": "Needs traffic/shoulder review",
    "Water/resupply not confirmed": "Needs water check",
    "Fire/weather refresh": "Needs fire/weather refresh",
    "Closure check needed": "Needs closure check",
    "Map/export QA needed": "Needs map/export QA",
    "Trip dates not cleared": "Needs date check",
    "Bailout plan missing": "Needs bailout plan",
    "Source evidence gap": "Needs source check",
  }[label] || `Needs ${label}`;
}

function gateCountLabel(route) {
  const blockers = route.readinessScore?.blockerCount || 0;
  const required = route.readinessScore?.requiredActionCount || 0;
  if (routeGateStatus(route) === "confirmed" && !blockers && !required) return "0 work items";
  if (blockers) return `${blockers} blocker${blockers === 1 ? "" : "s"}`;
  if (required) return `${required} work item${required === 1 ? "" : "s"}`;
  const gates = biggestGates(route, 6).length;
  return `${gates} work item${gates === 1 ? "" : "s"}`;
}

function visibleGateCountLabel(route, limit = 5) {
  const gates = biggestGates(route, limit);
  if (routeGateStatus(route) === "confirmed" && !gates.length) return "0 work items";
  const shown = gates.length;
  const total = biggestGates(route, 20).length;
  const noun = shown === 1 ? "work item" : "work items";
  return total > shown ? `Top ${shown} of ${total} ${noun}` : `${shown} ${noun}`;
}

function gateSummaryLabel(route) {
  const total = biggestGates(route, 20).length;
  if (routeGateStatus(route) === "confirmed" && !total) return "No remaining work";
  return `${total} remaining work ${total === 1 ? "item" : "items"}`;
}

function gateCountClass(route) {
  const blockers = route.readinessScore?.blockerCount || 0;
  if (routeGateStatus(route) === "confirmed" && !blockers) return "readiness_good";
  if (blockers) return "readiness_blocked";
  return "readiness_candidate";
}

function surfaceLabel(route) {
  const surface = route.gravelLevel || route.surfaceMix || "surface TBD";
  return `Surface ${String(surface).replace(/_/g, " ")}`;
}

function routeDifficultyChip(route) {
  const difficulty = route.difficulty || route.difficultyProfile?.beginnerSuitability || "";
  if (!difficulty || /tbd|unknown|fit tbd/i.test(difficulty)) return "";
  return `<span class="pill">${escapeHtml(difficulty)}</span>`;
}

function gateChipClass(gate) {
  if (gate?.severity === "pass") return "readiness_good";
  if (gate?.severity === "blocker") return "readiness_blocked";
  return "readiness_candidate";
}

function gateChipsHtml(route, limit = 5) {
  const gates = biggestGates(route, limit);
  if (!gates.length) {
    return `<span class="gate-chip pass">Ride-ready</span>`;
  }
  return gates.map((gate) => `<span class="gate-chip ${escapeHtml(gate.severity)}" title="${escapeHtml(gate.detail || gate.label)}">${escapeHtml(gate.label)}</span>`).join("");
}

function biggestGates(route, limit = 5) {
  const candidates = [];
  for (const action of route.promotionActions || []) {
    candidates.push(gateFromAction(action));
  }
  const checklist = route.promotionChecklist || {};
  const checklistItems = [
    ["targetWindowFit", "Target weekend fit", checklist.targetWindowNote],
    ["legalAccess", "Legal access", checklist.legalAccessNote],
    ["campingPermits", "Camping / permits", checklist.campingPermitsNote],
    ["waterResupply", "Water / resupply", checklist.waterResupplyNote],
    ["closuresFireWeather", "Closures / fire / weather", checklist.closuresFireWeatherNote],
    ["mapArtifacts", "Map/export QA", checklist.mapArtifactsNote],
    ["officialGeometry", "Official geometry", checklist.officialGeometryNote],
  ];
  for (const [key, category, note] of checklistItems) {
    const status = checklist[key];
    if (!status || ["pass", "verified", "not_required"].includes(status)) continue;
    candidates.push({
      label: compactGateLabel(category, note),
      detail: note || category,
      severity: status === "blocker" || status === "fail" ? "blocker" : "needs",
      score: status === "blocker" ? 0 : 1,
    });
  }
  for (const item of route.readinessEvidence || []) {
    if (!["blocker", "needs_refresh", "partial", "fail"].includes(item.status)) continue;
    candidates.push({
      label: compactGateLabel(item.gate, item.finding),
      detail: item.finding || item.sourceName || item.gate,
      severity: item.status === "blocker" || item.status === "fail" ? "blocker" : "needs",
      score: item.status === "blocker" ? 0 : 2,
    });
  }
  for (const blocker of route.review?.blockers || []) {
    candidates.push({
      label: compactGateLabel("Blocker", blocker),
      detail: blocker,
      severity: "blocker",
      score: 0,
    });
  }
  return dedupeGates(candidates)
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function gateFromAction(action = {}) {
  const severity = action.priority === "blocker" || action.status === "blocker" ? "blocker" : "needs";
  return {
    label: compactGateLabel(action.category, action.action),
    detail: action.action || action.category,
    severity,
    score: severity === "blocker" ? 0 : 1,
  };
}

function dedupeGates(gates) {
  const seen = new Set();
  const result = [];
  for (const gate of gates.filter((item) => item && item.label)) {
    const key = gate.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(gate);
  }
  return result;
}

function compactGateLabel(category = "", detail = "") {
  const text = `${category} ${detail}`.toLowerCase();
  if (text.includes("camp") || text.includes("permit") || text.includes("reservation") || text.includes("overnight")) return "Camp/permit not confirmed";
  if (text.includes("legal") || text.includes("bike") || text.includes("bicycle") || text.includes("segment")) return "Bike legality audit needed";
  if (text.includes("traffic") || text.includes("shoulder") || text.includes("highway") || text.includes("road stress") || text.includes("paved connector")) return "Traffic/shoulder review";
  if (text.includes("water") || text.includes("resupply")) return "Water/resupply not confirmed";
  if (text.includes("fire") || text.includes("smoke") || text.includes("weather") || text.includes("heat") || text.includes("aqi")) return "Fire/weather refresh";
  if (text.includes("closure") || text.includes("closed")) return "Closure check needed";
  if (text.includes("gpx") || text.includes("geojson") || text.includes("export") || text.includes("map") || text.includes("geometry")) return "Map/export QA needed";
  if (text.includes("target") || text.includes("date") || text.includes("july") || text.includes("weekend") || text.includes("window")) return "Trip dates not cleared";
  if (text.includes("bailout")) return "Bailout plan missing";
  if (text.includes("source")) return "Source evidence gap";
  if (String(category || "").toLowerCase().trim() === "blocker") return "Route-specific blocker";
  return labelKey(category || "work item").toLowerCase().trim();
}

function overviewFact(label, value) {
  return `<span><strong>${escapeHtml(label)}</strong><em>${escapeHtml(value || "TBD")}</em></span>`;
}

function routeMetric(label, value) {
  return `<span><strong>${escapeHtml(value || "TBD")}</strong><em>${escapeHtml(label)}</em></span>`;
}

function quickNote(label, value) {
  if (!value) return "";
  return `<p><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></p>`;
}

function routeStatusSentence(route) {
  if (routeGateStatus(route) === "confirmed") {
    return "This route has passed the imported ride-ready checks. Still refresh closures, weather, and water before departure.";
  }
  const gateLabels = biggestGates(route, 3).map((gate) => gate.label).filter(Boolean);
  const open = gateCountLabel(route);
  const source = labelQuality(route.sourceQuality).toLowerCase();
  return `Useful ${source} planning material with ${open}; current ride-ready work includes ${gateLabels.join(", ") || "route-specific verification"}.`;
}

function routeStatusHeadline(route) {
  if (routeGateStatus(route) === "confirmed") return "Ride-ready checks are confirmed";
  const gates = biggestGates(route, 2).map((gate) => gate.label).filter(Boolean);
  return `Not ride-ready: ${gates.join(" + ") || browseConcernLabel(route)}`;
}

function sourceLinkHtml(route, options = {}) {
  const source = primarySource(route);
  if (!source) return "";
  const className = options.compact ? "source-link compact" : "source-link";
  const prefix = source.kind === "audit" ? "Audit:" : "Source:";
  if (source.kind === "local") {
    return `<span class="${className} local-source"><span>${prefix}</span> ${escapeHtml(source.label)} <em>local</em></span>`;
  }
  return `<a class="${className}" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><span>${prefix}</span> ${escapeHtml(source.label)} <em>↗</em></a>`;
}

function sourceListHtml(route) {
  const sources = routeSources(route).slice(0, 6);
  if (!sources.length) {
    return `<div class="source-list"><strong>Stored sources</strong><p class="route-note">No route source URL or local source file is stored for this route yet.</p></div>`;
  }
  return `<div class="source-list"><strong>Stored sources</strong>${sources.map((source) => {
    const label = escapeHtml(source.title || source.label || sourceLabelForUrl(source.url));
    const meta = source.accessed ? `<em>${escapeHtml(source.accessed)}</em>` : source.kind === "local" ? "<em>local</em>" : "";
    if (source.kind === "local") {
      return `<span class="source-list-local"><span>${label}</span>${meta}</span>`;
    }
    return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><span>${label}</span>${meta}</a>`;
  }).join("")}</div>`;
}

function primarySource(route = {}) {
  const candidates = routeSources(route);
  const routePage = candidates.find((item) => isRouteSourceUrl(item.url));
  if (routePage) return { ...routePage, label: sourceLabelForUrl(routePage.url) };
  const geometrySource = candidates.find((item) => item.kind === "local" || isGeometrySource(item));
  if (geometrySource) return geometrySource;
  const webSource = candidates.find((item) => item.kind !== "audit" && !isOperationalGateSource(item));
  return webSource || candidates.find((item) => item.kind === "audit") || candidates[0] || null;
}

function routeSources(route = {}) {
  const candidates = [
    sourceCandidate(route.sourceUrl, "Original route source"),
    ...sourceCandidatesFromSources(route.sources),
    ...sourceCandidatesFromEvidence(route.readinessEvidence),
    ...sourceCandidatesFromText(route.sourceNote),
    ...sourceCandidatesFromText(route.description),
    sourceCandidate(route.issueUrl, "Planning/audit reference"),
  ].filter(Boolean);
  return dedupeSources(candidates);
}

function sourceCandidate(url, label = "Original source", options = {}) {
  const cleanUrl = normalizeSourceUrl(url);
  if (!cleanUrl) return null;
  const kind = options.kind || sourceKindForUrl(cleanUrl);
  const displayLabel = kind === "audit" && ["Original source", "Original route source"].includes(label)
    ? "Planning/audit reference"
    : label;
  return { url: cleanUrl, label: displayLabel, kind };
}

function sourceCandidatesFromSources(sources = []) {
  return (sources || []).map((source) => {
    if (typeof source === "string") return sourceCandidate(source);
    const candidate = sourceCandidate(source?.url, source?.title || source?.sourceName || "Original route source");
    if (!candidate) return null;
    return { ...candidate, title: source?.title || candidate.label, accessed: source?.accessed };
  }).filter(Boolean);
}

function sourceCandidatesFromEvidence(evidence = []) {
  return (evidence || []).map((item) => sourceCandidate(item?.url, item?.sourceName || "Source evidence")).filter(Boolean);
}

function sourceCandidatesFromText(value = "") {
  return extractHttpUrls(value).map((url) => sourceCandidate(url, sourceLabelForUrl(url))).filter(Boolean);
}

function sourceLabelForUrl(url) {
  try {
    const parsed = new URL(url);
    if (isRouteSourceUrl(url)) return "BIKEPACKING.com route source";
    if (isDirectFileUrl(url)) return "Route geometry file";
    return "Original route source";
  } catch {
    if (isDirectFileUrl(url)) return "Route geometry file";
    return "Original route source";
  }
}

function extractHttpUrls(value = "") {
  return String(value || "").match(/https?:\/\/[^\s<>)"']+/g) || [];
}

function normalizeSourceUrl(value) {
  const url = String(value || "").trim().replace(/[.,;:]+$/, "");
  if (isLocalSourcePath(url)) return url;
  if (!/^https?:\/\//i.test(url)) return "";
  return url;
}

function isLocalSourcePath(url = "") {
  return /^(routes|research|bikepacking_planner|docs)\//.test(String(url || ""));
}

function isDirectFileUrl(url = "") {
  return /\.(gpx|geojson|json|kml|kmz|zip)(\?|#|$)/i.test(url);
}

function dedupeSources(sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources) {
    const key = source.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function isRouteSourceUrl(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("bikepacking.com") && parsed.pathname.includes("/routes/");
  } catch {
    return false;
  }
}

function sourceKindForUrl(url = "") {
  if (isLocalSourcePath(url)) return "local";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("github.com") && parsed.pathname.includes("/issues/")) return "audit";
  } catch {
    return "source";
  }
  return "source";
}

function isGeometrySource(source = {}) {
  return isDirectFileUrl(source.url) || /gpx|geojson|route geometry|route file/i.test(`${source.label || ""} ${source.title || ""}`);
}

function isOperationalGateSource(source = {}) {
  const haystack = `${source.url || ""} ${source.label || ""} ${source.title || ""}`.toLowerCase();
  return [
    "quickmap.dot.ca.gov",
    "weather.gov",
    "airnow.gov",
    "fire.ca.gov",
    "conditions",
    "closure",
    "transit",
    "parking",
    "camping",
    "reservation",
    "state parks",
  ].some((needle) => haystack.includes(needle));
}

function monthToSeason(month) {
  if ([2, 3, 4].includes(month)) return "spring";
  if ([5, 6, 7].includes(month)) return "summer";
  if ([8, 9, 10].includes(month)) return "fall";
  return "winter";
}

function linkifyNote(value) {
  return escapeHtml(value).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function xmlEscape(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[ch]));
}

init().catch((error) => {
  console.error(error);
  showLoadError(error);
});
