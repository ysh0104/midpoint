/**
 * MidPoint - Leaflet Map Engine & Custom Markers
 */
var map = null;
var isZoomActive = false;
var zoomCooldownTimer = null;
var gestureStartZoom = 14;
var pendingZoomReq = null;
var zoomRaf = null;

function initMap() {
  map = L.map('realMap', {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    zoomSnap: 0,
    zoomDelta: 0.25,
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
    dragging: true,
    tap: false,
    touchZoom: true,
    doubleClickZoom: true,
    keyboard: true,
    inertia: true
  }).setView(state.myLocation || DEFAULT_LOC, 14);

  // 초고속 무제한 고화질 타일
  L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ko', {
    maxZoom: 20,
    minZoom: 6,
    keepBuffer: 16,
    subdomains: ['0', '1', '2', '3'],
    updateWhenIdle: false,
    updateWhenZooming: true
  }).addTo(map);

  setTimeout(function() { if (map) map.invalidateSize(); }, 150);
  setTimeout(function() { if (map) map.invalidateSize(); }, 500);

  setupTrackpadGestures();
}

function scheduleZoom(latlng, targetZoom) {
  pendingZoomReq = { latlng: latlng, zoom: targetZoom };
  if (!zoomRaf) {
    zoomRaf = requestAnimationFrame(function() {
      if (pendingZoomReq && map) {
        map.setZoomAround(pendingZoomReq.latlng, pendingZoomReq.zoom, { animate: false });
        pendingZoomReq = null;
      }
      zoomRaf = null;
    });
  }
}

function setupTrackpadGestures() {
  var mapEl = document.getElementById('realMap');
  if (!mapEl) return;

  // macOS Safari 트랙패드 핀치 제스처
  mapEl.addEventListener('gesturestart', function(e) {
    e.preventDefault();
    isZoomActive = true;
    gestureStartZoom = map.getZoom();
  }, { passive: false });

  mapEl.addEventListener('gesturechange', function(e) {
    e.preventDefault();
    isZoomActive = true;
    clearTimeout(zoomCooldownTimer);
    zoomCooldownTimer = setTimeout(function() {
      isZoomActive = false;
    }, 250);

    var rect = mapEl.getBoundingClientRect();
    var latlng = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]);
    var targetZoom = gestureStartZoom + Math.log2(e.scale);
    var boundedZoom = Math.max(6, Math.min(19, targetZoom));
    scheduleZoom(latlng, boundedZoom);
  }, { passive: false });

  mapEl.addEventListener('gestureend', function(e) {
    e.preventDefault();
    zoomCooldownTimer = setTimeout(function() {
      isZoomActive = false;
    }, 250);
  }, { passive: false });

  // Chrome / Edge / Whale 등 휠/핀치 제스처
  mapEl.addEventListener('wheel', function(e) {
    e.preventDefault();
    var isPinchZoom = e.ctrlKey || e.metaKey;

    if (isPinchZoom) {
      isZoomActive = true;
      clearTimeout(zoomCooldownTimer);
      zoomCooldownTimer = setTimeout(function() {
        isZoomActive = false;
      }, 250);

      var rect = mapEl.getBoundingClientRect();
      var latlng = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]);
      var currentZoom = map.getZoom();
      var zoomChange = -e.deltaY * 0.035;
      var newZoom = Math.max(6, Math.min(19, currentZoom + zoomChange));
      scheduleZoom(latlng, newZoom);
      return;
    }

    if (isZoomActive) return;
    map.panBy([e.deltaX, e.deltaY], { animate: false });
  }, { passive: false });
}

function clearRoutePolylines() {
  if (state.routePolylines) {
    state.routePolylines.forEach(function(pl) { map.removeLayer(pl); });
    state.routePolylines = [];
  }
  if (state.lines) {
    state.lines.forEach(function(l) { map.removeLayer(l); });
    state.lines = [];
  }
  if (state.transitMarkers) {
    state.transitMarkers.forEach(function(m) { map.removeLayer(m); });
    state.transitMarkers = [];
  }
}

function createMarkerHtml(label, iconText, isMe, isHub, isAppt) {
  if (isMe) {
    var meHtml = '<div class="my-location-marker">' +
      '<div class="modern-label" style="box-shadow: 0 4px 14px rgba(102,204,255,0.3); border-color: #66CCFF;">' +
        '<span class="w-2 h-2 rounded-full bg-[#0284c7]"></span>' +
        '<span style="font-weight: 800; color: #0284c7;">' + label + '</span>' +
      '</div>' +
      '<div class="relative flex items-center justify-center mt-1">' +
        '<div class="my-loc-pulse-outer"></div>' +
        '<div class="my-loc-pulse"></div>' +
        '<div class="my-loc-core"></div>' +
      '</div>' +
    '</div>';
    return L.divIcon({
      html: meHtml,
      className: '',
      iconSize: [80, 56],
      iconAnchor: [40, 42]
    });
  }

  if (isHub) {
    var hubHtml = '<div class="modern-marker-wrap">' +
      '<div class="hub-ground-halo"></div>' +
      '<div class="hub-ground-ripple"></div>' +
      '<div class="modern-label hub-label">' +
        '<span class="w-2 h-2 rounded-full bg-[#0284c7]"></span>' +
        '<span style="letter-spacing: -0.02em;">' + label + '</span>' +
      '</div>' +
      '<div class="modern-pin-body pin-theme-hub">' +
        '<div class="modern-pin-content">' +
          '<span style="font-size: 11.5px; font-weight: 900; letter-spacing: -0.04em; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">허브</span>' +
        '</div>' +
      '</div>' +
    '</div>';
    return L.divIcon({
      html: hubHtml,
      className: '',
      iconSize: [160, 76],
      iconAnchor: [80, 76]
    });
  }

  if (isAppt) {
    var apptHtml = '<div class="modern-marker-wrap">' +
      '<div class="modern-label appt-label">' +
        '<span class="w-2 h-2 rounded-full bg-white"></span>' +
        '<span>' + label + '</span>' +
      '</div>' +
      '<div class="modern-pin-body pin-theme-appt">' +
        '<div class="modern-pin-content">' +
          '<span style="font-size: 11px; font-weight: 900; color: #ffffff;">약속</span>' +
        '</div>' +
      '</div>' +
    '</div>';
    return L.divIcon({
      html: apptHtml,
      className: '',
      iconSize: [160, 76],
      iconAnchor: [80, 76]
    });
  }

  var isP1 = (iconText === '1');
  var themeCls = isP1 ? 'pin-theme-dep' : 'pin-theme-target';
  var dotColor = isP1 ? 'bg-[#0284c7]' : 'bg-[#66CCFF]';

  var depHtml = '<div class="modern-marker-wrap">' +
    '<div class="modern-label">' +
      '<span class="w-2 h-2 rounded-full ' + dotColor + '"></span>' +
      '<span>' + label + '</span>' +
    '</div>' +
    '<div class="modern-pin-body ' + themeCls + '">' +
      '<div class="modern-pin-content">' +
        '<span style="font-size: 13.5px; font-weight: 900;">' + iconText + '</span>' +
      '</div>' +
    '</div>' +
  '</div>';

  return L.divIcon({
    html: depHtml,
    className: '',
    iconSize: [160, 76],
    iconAnchor: [80, 76]
  });
}

function createTransitStopMarker(loc, title, badgeText, badgeColor) {
  var html = '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full shadow-md border text-[10px] font-black whitespace-nowrap" style="background:#ffffff; color:#0f172a; border-color:' + badgeColor + '; transform: translate(-50%, -100%);">' +
    '<span class="w-2 h-2 rounded-full shrink-0" style="background:' + badgeColor + ';"></span>' +
    '<span>' + badgeText + '</span>' +
    '<span class="text-slate-800 font-extrabold">' + title + '</span>' +
  '</div>';
  var icon = L.divIcon({
    html: html,
    className: 'transit-stop-pin',
    iconSize: [0, 0]
  });
  return L.marker(loc, { icon: icon, zIndexOffset: 900 });
}

window.zoomToHub = function(isSilent) {
  if (!state.currentHubCoord || !map) return;

  map.flyTo(state.currentHubCoord, 16.5, {
    duration: 1.4,
    easeLinearity: 0.25
  });

  if (!isSilent) {
    showToast(state.currentHubName + ' 중심으로 확대! 주변 장소를 탐색합니다', 'zoom-in');
  }

  setTimeout(function() {
    fetchKakaoPlaces(state.currentHubCoord, state.currentHubName);
  }, 450);

  var sheet = document.getElementById('bottomSheet');
  if (sheet && !state.sheetExpanded) {
    state.sheetExpanded = true;
    sheet.classList.remove('sheet-collapsed');
    sheet.classList.add('sheet-expanded');
  }
};
