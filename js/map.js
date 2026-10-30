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

  // 초고속 고화질 내추럴 지형 파스텔 타일 (lyrs=p 지형 기복도 + s.t:2|s.e:l.i|p.v:off 로 혼잡한 상점 아이콘은 숨기고 산·공원·하천의 눈이 편안한 파스텔 자연색 유지)
  L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&apistyle=s.t:2%7Cs.e:l.i%7Cp.v:off&x={x}&y={y}&z={z}&hl=ko', {
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
    var apptHtml = '<div class="appt-clean-capsule-wrap">' +
      '<div class="modern-label appt-label shadow-md">' +
        '<span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>' +
        '<span style="letter-spacing: -0.02em;">' + label + '</span>' +
      '</div>' +
    '</div>';
    return L.divIcon({
      html: apptHtml,
      className: '',
      iconSize: [160, 32],
      iconAnchor: [80, 16]
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

window.smoothFlyTo = function(targetCoord, targetZoom, onComplete) {
  if (!map || !targetCoord) return;
  targetZoom = (typeof targetZoom === 'number') ? targetZoom : 16.5;

  var currentCenter = map.getCenter();
  var currentZoom = map.getZoom();
  var targetLatLng = L.latLng(targetCoord[0], targetCoord[1]);
  var distMeters = currentCenter.distanceTo(targetLatLng);
  var zoomDiff = Math.abs(currentZoom - targetZoom);

  // 1. 이미 해당 위치 근처(80m 이내)에 있고 줌 레벨도 이미 근접해 있을 때:
  // => 카메라 flyTo를 아예 실행하지 않아 진동/덜컹거림을 100% 방지!
  if (distMeters < 80 && zoomDiff < 0.6) {
    if (typeof onComplete === 'function') onComplete(false);
    return;
  }

  // 2. 근거리(350m 이내) 이동일 때:
  // 급격한 flyTo 대신 부드러운 panTo + setZoom으로 흔들림 없이 매끄럽게 중심 맞춤
  if (distMeters < 350) {
    if (zoomDiff < 0.8) {
      map.panTo(targetLatLng, { animate: true, duration: 0.45 });
    } else {
      map.flyTo(targetLatLng, targetZoom, {
        animate: true,
        duration: 0.7,
        easeLinearity: 0.2
      });
    }
    if (typeof onComplete === 'function') {
      setTimeout(function() { onComplete(true); }, 500);
    }
    return;
  }

  // 3. 원거리에서 해당 장소로 접근할 때:
  // Leaflet 기본 flyTo의 덜컹거림을 방지하고 완만한 곡선과 1.1초의 균일한 트랜지션으로 우아하게 이동
  map.flyTo(targetLatLng, targetZoom, {
    animate: true,
    duration: 1.15,
    easeLinearity: 0.22,
    noMoveStart: true
  });

  if (typeof onComplete === 'function') {
    setTimeout(function() { onComplete(true); }, 1200);
  }
};

window.zoomToHub = function(isSilent) {
  if (!state.currentHubCoord || !map) return;

  window.smoothFlyTo(state.currentHubCoord, 16.5, function(didFly) {
    if (!isSilent && didFly) {
      showToast(state.currentHubName + ' 중심으로 이동했습니다', 'zoom-in');
    }
  });

  setTimeout(function() {
    fetchKakaoPlaces(state.currentHubCoord, state.currentHubName);
  }, 400);

  var sheet = document.getElementById('bottomSheet');
  if (sheet && !state.sheetExpanded) {
    state.sheetExpanded = true;
    sheet.classList.remove('sheet-collapsed');
    sheet.classList.add('sheet-expanded');
  }
};

