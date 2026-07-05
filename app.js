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
  activeVariants: new Set(),
  routeDetailPromises: new Map(),
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
const DATA_VERSION = "20260705-split-data-1";

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
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  fitMap: document.querySelector("#fitMap"),
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
  els.downloadGeojson.addEventListener("click", () => downloadGeojson());
  els.downloadGpx.addEventListener("click", () => downloadGpx());
  els.editForm.addEventListener("submit", saveEditRequest);
  els.copyPrompt.addEventListener("click", copyEditPrompt);
  setupMapInteractions();
  window.addEventListener("resize", () => drawAll());
  await loadTrip(state.trips[0].id);
}

function setupMapInteractions() {
  els.zoomIn.addEventListener("click", () => {
    stopPanInertia();
    zoomBy(0.5);
  });
  els.zoomOut.addEventListener("click", () => {
    stopPanInertia();
    zoomBy(-0.5);
  });
  els.fitMap.addEventListener("click", () => {
    stopPanInertia();
    fitToRoutes(selectedRoute() ? [selectedRoute()] : filteredRoutes());
    drawMap();
  });
  els.map.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(".map-controls, .map-legend, .map-hint")) return;
    if (event.target.closest(".route-line")) return;
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
  els.tripDescription.textContent = "Browse route ideas, then choose dates, region, and trip style to see what deserves a closer planning check.";
  renderRegionOptions();
  renderStyleFilters();
  renderGroupTabs();
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
  const counts = routes.reduce((acc, route) => {
    acc[route.status || "idea"] = (acc[route.status || "idea"] || 0) + 1;
    return acc;
  }, {});
  const summary = filteredReadinessSummary(matchingRoutes);
  const chips = [
    statChip(`${matchingRoutes.length} matching`, "library"),
    statChip(`${routes.length} total routes`, "library"),
    statChip(`${counts.ride_ready || 0} ride-ready`, "ride_ready"),
    statChip(`${summary.needsRefreshCount || 0} need refresh`, "planning_grade"),
    statChip(`${counts.planning_grade || 0} planning-grade`, "planning_grade"),
    statChip(`${counts.idea || 0} ideas`, "idea"),
  ];
  if (isCaliforniaContext()) {
    const californiaRoutes = matchingRoutes.filter(isCaliforniaPriority);
    chips.push(statChip(`${californiaRoutes.length} California matches`, "planning_grade"));
  }
  if (archived.length) chips.push(statChip(`${archived.length} rough leads archived`, "idea"));
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
  if (state.statusFilter !== "all") parts.push(`status: ${labelStatus(state.statusFilter)}`);
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
  const snapshotLabel = planningContextActive()
    ? dateContextActive() ? "date-filtered" : "filtered"
    : "library";
  const topBlocker = blockers[0]
    ? `${blockers[0].category}: ${blockers[0].count}`
    : "no blocker data";
  els.readinessDashboard.innerHTML = `
    <span><strong>${summary.routeCount || 0}</strong> ${snapshotLabel} matches</span>
    <span><strong>${summary.rideReadyCount || 0}</strong> ride-ready</span>
    <span><strong>${summary.planningGradeCount || 0}</strong> planning-grade</span>
    <span><strong>${summary.needsRefreshCount || 0}</strong> need refresh</span>
    <span>top gate: <strong>${escapeHtml(topBlocker)}</strong></span>`;
}

function filteredReadinessSummary(routes) {
  const gateKeys = ["targetWindowFit", "legalAccess", "campingPermits", "waterResupply", "closuresFireWeather", "officialGeometry", "mapArtifacts"];
  const gateCounts = {};
  const blockerCounts = {};
  const regionCounts = {};
  let needsRefreshCount = 0;
  let blockedRouteCount = 0;
  for (const route of routes) {
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
      const category = action.category || "Blocker";
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
    rideReadyCount: routes.filter((route) => route.status === "ride_ready").length,
    planningGradeCount: routes.filter((route) => route.status === "planning_grade").length,
    ideaCount: routes.filter((route) => route.status === "idea").length,
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
  if (filters.statusFilter !== "all" && route.status !== filters.statusFilter) return false;
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
    route.status,
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
    const row = document.createElement("div");
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.className = `route-row ${state.selectedRouteId === route.id ? "active" : ""}`;
    row.innerHTML = `
      <span class="route-swatch" style="background:${route.color || "#2f7b58"}"></span>
      <span>
        <span class="route-name">${escapeHtml(route.name)}</span>
        <span class="route-meta">${escapeHtml(route.region || labelGroup(route.group))} &middot; ${route.distanceMi || 0} mi &middot; ${(route.gainFt || 0).toLocaleString()} ft &middot; ${route.days.length} days &middot; ${escapeHtml(route.shape || "route")}</span>
        <span class="pill-row primary-pills">
          <span class="pill ${route.status || "idea"}">${labelStatus(route.status)}</span>
          <span class="pill ${rideReadyClearanceClass(route)}">${rideReadyClearanceLabel(route)}</span>
          <span class="pill ${gateChipClass(topGate(route))}">${browseConcernLabel(route)}</span>
          ${route.difficulty ? `<span class="pill">${escapeHtml(route.difficulty)}</span>` : ""}
        </span>
        <span class="pill-row secondary-pills">
          <span class="pill">surface: ${escapeHtml(route.gravelLevel || "unknown")}</span>
          <span class="pill ${route.sourceQuality}">${labelQuality(route.sourceQuality)}</span>
          ${route.bestSeason ? `<span class="pill">season: ${escapeHtml(route.bestSeason)}</span>` : ""}
          <span class="pill ${gateCountClass(route)}">${gateCountLabel(route)}</span>
        </span>
        ${sourceLinkHtml(route, { compact: true })}
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
    row.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      selectRoute(route);
    });
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
  const routeFragment = document.createDocumentFragment();
  const projection = projectionContext(rect);
  const route = selectedRoute();
  const routes = route ? [route] : filteredRoutes();
  els.map.classList.toggle("is-overview-zoomed-out", !route && state.map.zoom <= 7);
  els.mapTitle.textContent = route ? route.name : routes.length ? "All Matching Routes" : "No Matching Routes";
  els.mapSubtitle.textContent = route
    ? `${route.distanceMi || 0} mi | ${(route.gainFt || 0).toLocaleString()} ft | ${route.days.length} days | ${labelStatus(route.status)} | ${labelDecision(route.promotionChecklist?.finalDecision)}`
    : routes.length ? "Browse all visible routes, then select one for days, resources, variants, and evidence." : "Clear search or loosen filters to restore the map.";
  els.mapQa.textContent = route
    ? `Before ride-ready: ${gateCountLabel(route)} | ${topGateLabel(route)} | ${rideReadyClearanceLabel(route)}`
    : planningContextActive() ? "Planning context active: final route-specific checks are still required before departure." : "Date-agnostic browse mode: select a route to inspect planning status and evidence.";
  renderMapLegend(routes);

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
  state.map.renderedZoom = state.map.zoom;
  state.map.renderedCenter = [...state.map.center];
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

function renderMapLegend(routes) {
  const items = [];
  for (const route of routes.slice(0, 8)) {
    items.push({ color: route.color || "#2f7b58", label: route.name, meta: labelStatus(route.status) });
  }
  const route = selectedRoute();
  if (route) {
    for (const variant of route.variants || []) {
      if (state.activeVariants.has(variant.id)) {
        items.push({ color: variant.color || "#8b6f47", label: variant.name, meta: variant.type || "variant", dashed: true });
      }
    }
  }
  els.mapLegend.replaceChildren(...items.map((item) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `<span class="legend-line ${item.dashed ? "dashed" : ""}" style="background:${item.color}"></span><span>${escapeHtml(item.label)}</span><em>${escapeHtml(item.meta)}</em>`;
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
    intro.innerHTML = `<strong>Select a route to inspect days, camps, resources, variants, and vetting evidence.</strong><p class="route-note">The library starts date- and region-agnostic. Add dates, region, length, or style filters when you want to check which options are plausible for a specific trip.</p>`;
    const cards = filteredRoutes().slice(0, 18).map((item) => {
      const card = document.createElement("div");
      card.className = "overview-card";
      card.innerHTML = `
        <strong>${escapeHtml(item.name)}</strong>
        <div class="day-meta">${escapeHtml(item.region || labelGroup(item.group))} &middot; ${item.distanceMi || 0} mi &middot; ${(item.gainFt || 0).toLocaleString()} ft &middot; ${item.days.length} days &middot; ${escapeHtml(item.shape || "route")}</div>
        <span class="pill-row">
          <span class="pill ${item.status || "idea"}">${labelStatus(item.status)}</span>
          <span class="pill ${rideReadyClearanceClass(item)}">${rideReadyClearanceLabel(item)}</span>
          <span class="pill ${gateChipClass(topGate(item))}">${browseConcernLabel(item)}</span>
          <span class="pill">${escapeHtml(item.difficultyProfile?.beginnerSuitability || "fit TBD")}</span>
          <span class="pill ${gateCountClass(item)}">${gateCountLabel(item)}</span>
        </span>
        <p class="route-note">${escapeHtml(item.description || item.sourceNote || "")}</p>
        ${sourceLinkHtml(item)}`;
      return card;
    });
    els.dayFlow.replaceChildren(intro, ...cards);
    return;
  }
  els.detailTitle.textContent = route.name;
  els.detailMeta.textContent = `route overview | ${route.days.length} days | ${labelStatus(route.status)}`;
  const overview = document.createElement("div");
  overview.className = "overview-card route-overview-card";
  overview.innerHTML = `
    <strong>${escapeHtml(route.name)}</strong>
    <div class="trip-summary-grid">
      ${overviewFact("Region", route.region || labelGroup(route.group))}
      ${overviewFact("Distance", `${route.distanceMi || 0} mi`)}
      ${overviewFact("Gain", `${(route.gainFt || 0).toLocaleString()} ft`)}
      ${overviewFact("Days", `${route.days.length}`)}
      ${overviewFact("Shape", route.shape)}
      ${overviewFact("Best season", route.bestSeason)}
    </div>
    <span class="pill-row primary-pills">
      <span class="pill ${route.status || "idea"}">${labelStatus(route.status)}</span>
      <span class="pill ${rideReadyClearanceClass(route)}">${rideReadyClearanceLabel(route)}</span>
      <span class="pill ${gateChipClass(topGate(route))}">${browseConcernLabel(route)}</span>
      <span class="pill ${route.sourceQuality}">${labelQuality(route.sourceQuality)}</span>
    </span>
    ${sourceLinkHtml(route)}
    <div class="planning-status ${route.status === "ride_ready" ? "pass" : ""}">
      <strong>Planning status</strong>
      <span>${route.status === "ride_ready" ? "Ride-ready based on current imported evidence." : "Useful planning material, not ride-ready until route-specific checks are refreshed."}</span>
      <div class="route-overview-grid">
        ${overviewFact("Main thing to verify", browseConcernLabel(route))}
        ${overviewFact("Open checks", gateCountLabel(route))}
        ${overviewFact("Ride-ready clearance", rideReadyClearanceLabel(route))}
      </div>
      <div class="gate-strip">${gateChipsHtml(route, 5)}</div>
    </div>
    <div class="logistics-panel">
      <strong>Known logistics</strong>
      <div class="route-overview-grid">
        ${overviewFact("Difficulty", route.difficulty || route.difficultyProfile?.overall)}
        ${overviewFact("Surface", route.surfaceMix || route.gravelLevel)}
        ${overviewFact("Camping / lodging", route.resources?.camping || route.resources?.lodging)}
        ${overviewFact("Water / resupply", route.resources?.water || route.resources?.resupply)}
        ${overviewFact("Hazards", firstListValue(route.hazards))}
        ${overviewFact("Exports", "GPX and GeoJSON are local; refresh evidence before riding.")}
      </div>
      ${sourceListHtml(route)}
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
    els.reviewPanel.innerHTML = "<p class=\"route-note\">Vetting evidence appears after you select a route. Browse first, then use this area for promotion gates, blockers, dated evidence, and handoff notes.</p>";
    return;
  }
  const review = route.review || {};
  const verification = route.verification || {};
  const checklist = route.promotionChecklist || {};
  els.reviewMeta.textContent = review.decision || "needs review";
  const openAttr = shouldOpenEvidenceDetails() ? " open" : "";
  els.reviewPanel.innerHTML = `
    <div class="qa-callout ${route.status === "ride_ready" ? "pass" : ""}">
      <strong>Evidence summary</strong>
      <span>${escapeHtml(rideReadyClearanceTitle(route))} | ${escapeHtml(gateCountLabel(route))} | ${escapeHtml(browseConcernLabel(route))}</span>
    </div>
    <details class="evidence-disclosure"${openAttr}>
      <summary>Evidence & gates</summary>
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
    || ["planning_grade", "ride_ready"].includes(state.statusFilter);
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
  const blocked = (score.blockerCount || 0) > 0 || route.status !== "ride_ready";
  return `<div class="qa-callout ${blocked ? "fail" : value >= 70 ? "pass" : ""}">
    <strong>${escapeHtml(rideReadyClearanceTitle(route))}</strong>
    <span>${score.blockerCount || 0} blockers | ${score.requiredActionCount || 0} required gates | ${score.passGateCount || 0}/${score.gateCount || 6} ride-ready gates pass | clearance ${value}/100, not route quality</span>
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
  return `<strong>Ride-ready promotion gates</strong><div class="check-grid">${items.map(([label, value, note]) => checkItem(label, value, note)).join("")}</div>`;
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
  els.routeSvg.style.transform = transform;
  state.map.zoomPreviewing = true;
}

function resetMapPreviewTransform() {
  if (state.map.previewFrame) {
    window.cancelAnimationFrame(state.map.previewFrame);
    state.map.previewFrame = null;
  }
  if (!state.map.zoomPreviewing) return;
  els.tileLayer.style.transform = "";
  els.routeSvg.style.transform = "";
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
  const tileZoom = clamp(Math.floor(state.map.zoom), state.map.minZoom, state.map.maxZoom);
  const scale = 2 ** (state.map.zoom - tileZoom);
  const center = lonLatToWorld(state.map.center[0], state.map.center[1], tileZoom);
  const topLeft = [center[0] - rect.width / (2 * scale), center[1] - rect.height / (2 * scale)];
  const tileBuffer = 1;
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
      const img = state.map.tileNodes.get(key) || document.createElement("img");
      const subdomain = ["a", "b", "c"][(wrappedX + y) % 3];
      if (!img.dataset.tileKey) {
        img.alt = "";
        img.decoding = "async";
        img.loading = "eager";
        img.dataset.tileKey = key;
        img.src = `https://${subdomain}.tile.opentopomap.org/${key}.png`;
      }
      img.style.left = `${Math.round((x * 256 - topLeft[0]) * scale)}px`;
      img.style.top = `${Math.round((y * 256 - topLeft[1]) * scale)}px`;
      img.style.width = `${Math.ceil(256 * scale)}px`;
      img.style.height = `${Math.ceil(256 * scale)}px`;
      nextTileNodes.set(key, img);
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
  els.downloadGeojson.disabled = disabled;
  els.downloadGpx.disabled = disabled;
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
      status: route.status,
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
    const tracks = routes.flatMap((route) => route.days.map((day) => {
      const pts = day.coords.map((coord) => {
        const ele = coord.length > 2 ? `<ele>${coord[2].toFixed(1)}</ele>` : "";
        return `      <trkpt lat="${coord[1].toFixed(6)}" lon="${coord[0].toFixed(6)}">${ele}</trkpt>`;
      }).join("\n");
      return `  <trk><name>${xmlEscape(route.name)} - Day ${day.day}</name><desc>${xmlEscape(day.name)}</desc><trkseg>\n${pts}\n    </trkseg></trk>`;
    })).join("\n");
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="bikepacking_planner" xmlns="http://www.topografix.com/GPX/1/1">\n${tracks}\n</gpx>\n`;
    downloadText(`${exportBaseName()}.gpx`, gpx, "application/gpx+xml");
  } catch (error) {
    showLoadError(error);
  }
}

function exportBaseName() {
  const route = selectedRoute();
  return route ? route.id : `${state.trip.id}-${state.group}-routes`;
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
  const prompt = `Route edit request for bikepacking_planner.\nTrip: ${state.trip.id}\nRoute: ${route?.name || "All Route Options"}\nCurrent status: ${route?.status || "mixed"}\nRequest: ${text}\nPreserve source-quality labels, route shape labels, status labels, terrain/topographic basemap QA, resources, difficulty dimensions, GPX/GeoJSON exports, variants, elevation comparisons, and local-cache reuse.`;
  try {
    await navigator.clipboard.writeText(prompt);
    els.editStatus.textContent = "prompt copied";
  } catch {
    els.editStatus.textContent = "clipboard blocked";
  }
}

function labelQuality(value) {
  return {
    official_gpx: "Official GPX",
    routed_approximation: "Routed approx",
    concept: "Rough sketch",
    verified_variant: "Verified variant",
  }[value] || value || "Unknown";
}

function labelStatus(value) {
  return {
    idea: "Idea",
    planning_grade: "Planning-grade",
    ride_ready: "Ride-ready",
  }[value] || "Idea";
}

function labelDecision(value) {
  return String(value || "candidate").replace(/_/g, " ");
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
  if (route.status === "ride_ready") return "Ride-ready clearance: current";
  const blockers = route.readinessScore?.blockerCount || 0;
  if (blockers) return "Ride-ready clearance: blocked";
  return "Planning grade: unresolved gates";
}

function rideReadyClearanceLabel(route) {
  if (route.status === "ride_ready") return "clearance: current";
  const blockers = route.readinessScore?.blockerCount || 0;
  if (blockers) return "clearance blocked";
  const required = route.readinessScore?.requiredActionCount || 0;
  if (required) return "clearance pending";
  return "planning-grade gates";
}

function rideReadyClearanceClass(route) {
  if (route.status === "ride_ready") return "clearance_good";
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
  if (route.status === "ride_ready" || decision === "ride_ready_with_final_refresh") return "readiness_good";
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
  if (route.status === "ride_ready" || decision === "ride_ready_with_final_refresh") return "ready with refresh";
  const windowFit = route.promotionChecklist?.targetWindowFit || "";
  if (windowFit === "needs_refresh") return "needs date refresh";
  if (windowFit === "blocker") return "date/window blocker";
  return "planning check TBD";
}

function topGate(route) {
  return biggestGates(route, 1)[0] || {
    label: route.status === "ride_ready" ? "ride-ready" : "planning check TBD",
    severity: route.status === "ride_ready" ? "pass" : "needs",
  };
}

function topGateLabel(route) {
  return topGate(route).label;
}

function browseConcernLabel(route) {
  if (route.status === "ride_ready") return "Ready with final refresh";
  const label = topGateLabel(route);
  return {
    "camp/permit unresolved": "Needs camp check",
    "segment-level bike legality": "Needs bike-legality check",
    "water/resupply gap": "Needs water check",
    "fire/smoke/weather": "Needs fire/weather refresh",
    "closure overlay": "Needs closure check",
    "export/map QA": "Needs export/map QA",
    "date/window unresolved": "Needs date check",
    "bailout unresolved": "Needs bailout plan",
    "source evidence gap": "Needs source check",
  }[label] || `Needs ${label}`;
}

function gateCountLabel(route) {
  const blockers = route.readinessScore?.blockerCount || 0;
  const required = route.readinessScore?.requiredActionCount || 0;
  if (route.status === "ride_ready" && !blockers && !required) return "0 open gates";
  if (blockers) return `${blockers} blocker${blockers === 1 ? "" : "s"}`;
  if (required) return `${required} required gate${required === 1 ? "" : "s"}`;
  const gates = biggestGates(route, 6).length;
  return `${gates} open gate${gates === 1 ? "" : "s"}`;
}

function gateCountClass(route) {
  const blockers = route.readinessScore?.blockerCount || 0;
  if (route.status === "ride_ready" && !blockers) return "readiness_good";
  if (blockers) return "readiness_blocked";
  return "readiness_candidate";
}

function gateChipClass(gate) {
  if (gate?.severity === "pass") return "readiness_good";
  if (gate?.severity === "blocker") return "readiness_blocked";
  return "readiness_candidate";
}

function gateChipsHtml(route, limit = 5) {
  const gates = biggestGates(route, limit);
  if (!gates.length) {
    return `<span class="gate-chip pass">ride-ready</span>`;
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
  if (text.includes("camp") || text.includes("permit") || text.includes("reservation") || text.includes("overnight")) return "camp/permit unresolved";
  if (text.includes("legal") || text.includes("bike") || text.includes("bicycle") || text.includes("segment")) return "segment-level bike legality";
  if (text.includes("water") || text.includes("resupply")) return "water/resupply gap";
  if (text.includes("fire") || text.includes("smoke") || text.includes("weather") || text.includes("heat") || text.includes("aqi")) return "fire/smoke/weather";
  if (text.includes("closure") || text.includes("closed")) return "closure overlay";
  if (text.includes("gpx") || text.includes("geojson") || text.includes("export") || text.includes("map") || text.includes("geometry")) return "export/map QA";
  if (text.includes("target") || text.includes("date") || text.includes("july") || text.includes("weekend") || text.includes("window")) return "date/window unresolved";
  if (text.includes("bailout")) return "bailout unresolved";
  if (text.includes("source")) return "source evidence gap";
  return labelKey(category || "open gate").toLowerCase();
}

function overviewFact(label, value) {
  return `<span><strong>${escapeHtml(label)}</strong><em>${escapeHtml(value || "TBD")}</em></span>`;
}

function sourceLinkHtml(route, options = {}) {
  const source = primarySource(route);
  if (!source) return "";
  const className = options.compact ? "source-link compact" : "source-link";
  const prefix = source.kind === "audit" ? "Audit:" : "Source:";
  return `<a class="${className}" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><span>${prefix}</span> ${escapeHtml(source.label)} <em>↗</em></a>`;
}

function sourceListHtml(route) {
  const sources = routeSources(route).slice(0, 6);
  if (!sources.length) {
    return `<div class="source-list"><strong>Stored web sources</strong><p class="route-note">No human or website source URL is stored for this route yet.</p></div>`;
  }
  return `<div class="source-list"><strong>Stored web sources</strong>${sources.map((source) => `
    <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
      <span>${escapeHtml(source.title || source.label || sourceLabelForUrl(source.url))}</span>
      ${source.accessed ? `<em>${escapeHtml(source.accessed)}</em>` : ""}
    </a>`).join("")}</div>`;
}

function primarySource(route = {}) {
  const candidates = routeSources(route);
  const routePage = candidates.find((item) => isRouteSourceUrl(item.url));
  if (routePage) return { ...routePage, label: sourceLabelForUrl(routePage.url) };
  const webSource = candidates.find((item) => !isDirectFileUrl(item.url));
  return webSource || candidates[0] || null;
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
  const cleanUrl = normalizeHttpUrl(url);
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
    return "Original route source";
  } catch {
    return "Original route source";
  }
}

function extractHttpUrls(value = "") {
  return String(value || "").match(/https?:\/\/[^\s<>)"']+/g) || [];
}

function normalizeHttpUrl(value) {
  const url = String(value || "").trim().replace(/[.,;:]+$/, "");
  if (!/^https?:\/\//i.test(url)) return "";
  return url;
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
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("github.com") && parsed.pathname.includes("/issues/")) return "audit";
  } catch {
    return "source";
  }
  return "source";
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
