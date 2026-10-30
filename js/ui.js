/**
 * MidPoint - UI, Search & App Bootstrap Engine
 * Handles toast, modal controls, address search, origin chips, event listeners, and initial bootstrap
 */

var toastTimer = null;
function showToast(msg, iconName) {
  var toast = document.getElementById('toast');
  var txt = document.getElementById('toastText');
  var iconEl = document.getElementById('toastIcon');
  if (!toast || !txt || !iconEl) return;
  var holder = iconEl.parentNode;
  txt.textContent = msg;
  holder.innerHTML = '<i id="toastIcon" data-lucide="' + (iconName || 'check') + '" class="w-3 h-3" stroke-width="3"></i>';
  if (window.lucide) lucide.createIcons();
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.classList.remove('show');
  }, 2400);
}

function fetchRealAddress(lat, lng, callback) {
  var addrUrl = 'https://dapi.kakao.com/v2/local/geo/coord2address.json?x=' + lng + '&y=' + lat;

  fetch(addrUrl, {
    headers: { 'Authorization': 'KakaoAK ' + KAKAO_REST_KEY }
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Kakao coord2address error');
      return res.json();
    })
    .then(function(data) {
      if (data && data.documents && data.documents.length > 0) {
        var doc = data.documents[0];
        if (doc.road_address) {
          var ra = doc.road_address;
          var bName = ra.building_name ? (' (' + ra.building_name + ')') : '';
          callback(ra.address_name + bName);
          return;
        }
        if (doc.address) {
          callback(doc.address.address_name);
          return;
        }
      }
      throw new Error('Fallback to regioncode');
    })
    .catch(function() {
      var regUrl = 'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=' + lng + '&y=' + lat;
      fetch(regUrl, {
        headers: { 'Authorization': 'KakaoAK ' + KAKAO_REST_KEY }
      })
        .then(function(r) { return r.json(); })
        .then(function(rData) {
          if (rData && rData.documents && rData.documents.length > 0) {
            var reg = rData.documents.find(function(d) { return d.region_type === 'H'; }) || rData.documents[0];
            callback(reg.address_name);
          } else {
            callback('서울특별시 중구 태평로1가 (서울시청)');
          }
        })
        .catch(function() {
          callback('서울특별시 중구 태평로1가 (서울시청)');
        });
    });
}

function locateMe(isInit) {
  var addrEl = document.getElementById('locationAddress');
  var pulseEl = document.getElementById('addrPulse');
  if (addrEl) addrEl.textContent = '실제 현재 위치 및 주소를 확인하는 중...';
  if (pulseEl) pulseEl.className = 'w-2 h-2 rounded-full bg-amber-400 shrink-0';

  function fallbackToIpLocation(failReason) {
    console.log('Falling back to ipwho.is IP geolocation. Reason:', failReason);
    fetch('https://ipwho.is/')
      .then(function(res) { return res.json(); })
      .then(function(ipData) {
        if (ipData && ipData.success && ipData.latitude && ipData.longitude) {
          state.myLocation = [ipData.latitude, ipData.longitude];
          fetchRealAddress(ipData.latitude, ipData.longitude, function(kakaoAddr) {
            var resolvedAddr = kakaoAddr || ((ipData.region ? ipData.region + ' ' : '') + (ipData.city || ''));
            var toastMsg = '네트워크 기반 위치로 설정되었습니다 (주소를 눌러 직접 변경 가능)';
            onLocationResolved(state.myLocation, resolvedAddr, isInit, toastMsg);
          });
        } else {
          var msg = '위치 권한이 차단되어 서울시청으로 설정되었습니다. 상단 주소를 눌러 내 위치를 설정하세요';
          onLocationResolved(DEFAULT_LOC, '서울특별시 중구 태평로1가 (서울시청)', isInit, msg);
        }
      })
      .catch(function(err) {
        console.warn('IP geolocation failed:', err);
        var msg = '위치 권한이 차단되어 서울시청으로 설정되었습니다. 상단 주소를 눌러 내 위치를 설정하세요';
        onLocationResolved(DEFAULT_LOC, '서울특별시 중구 태평로1가 (서울시청)', isInit, msg);
      });
  }

  if (!navigator.geolocation) {
    fallbackToIpLocation('navigator.geolocation not supported');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      state.myLocation = [lat, lng];

      fetchRealAddress(lat, lng, function(addrString) {
        var finalAddr = addrString || '서울특별시 중구 태평로1가 (서울시청)';
        onLocationResolved(state.myLocation, finalAddr, isInit, '기기 GPS로 내 위치를 정확히 찾았습니다');
      });
    },
    function (err) {
      var reasonText = 'Code ' + err.code + ': ' + (err.message || 'GPS 에러');
      console.warn('Geolocation failed:', reasonText);
      fallbackToIpLocation(reasonText);
    },
    {
      enableHighAccuracy: false,
      timeout: 7000,
      maximumAge: 60000
    }
  );
}

window.retryGpsFromModal = function() {
  closeModal();
  showToast('GPS 위치를 다시 탐색합니다...', 'crosshair');
  locateMe(false);
};

function onLocationResolved(coords, addrText, isInit, toastMsg) {
  state.realGpsLocation = coords;
  state.realGpsAddress = addrText;
  state.myLocation = coords;
  state.myAddress = addrText;
  state.locations[0].loc = coords;
  state.locations[0].addr = addrText;
  state.locations[0].isCustom = false;

  var tokens = addrText.split(' ').filter(Boolean);
  var shortName = '내 위치';
  if (tokens.length >= 3) {
    shortName = tokens[tokens.length - 2] + ' ' + tokens[tokens.length - 1];
  } else if (tokens.length >= 2) {
    shortName = tokens[tokens.length - 1];
  }
  state.locations[0].shortName = shortName;
  state.locations[0].name = '내 위치';

  try {
    localStorage.setItem('user_last_my_location', JSON.stringify({
      coords: coords,
      addr: addrText,
      shortName: shortName
    }));
  } catch(e) {}

  var addrEl = document.getElementById('locationAddress');
  var pulseEl = document.getElementById('addrPulse');

  if (addrEl) addrEl.textContent = addrText;
  if (pulseEl) pulseEl.className = 'w-2 h-2 rounded-full bg-[#0284c7] shrink-0';

  updateLocationsAndMidpoint();
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  showToast(toastMsg, 'check');
}

function renderOriginChips() {
  var container = document.getElementById('originChipsContainer');
  if (!container) return;

  var html = state.locations.map(function(item) {
    var isMe = item.isMe;
    var actionBtn = isMe
      ? '<button type="button" onclick="window.openEditMyLocationModal()" title="내 위치 주소 변경" class="press ml-0.5 text-[#0284c7] hover:text-[#0369a1]"><i data-lucide="edit-3" class="w-3 h-3"></i></button>'
      : '<button type="button" onclick="window.removeLocation(\'' + item.id + '\')" class="ml-0.5 text-slate-400 hover:text-slate-600"><i data-lucide="x" class="w-3 h-3"></i></button>';
    var dotColor = isMe ? 'bg-[#0284c7]' : 'bg-[#66CCFF]';
    var labelName = isMe ? '내 위치' : item.name;

    var isCar = (item.transport === 'car');
    var transIcon = isCar ? 'car' : 'train-front';
    var transText = isCar ? '자차' : '대중교통';
    var transClass = isCar ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100' : 'bg-[#f0f9ff] text-[#0284c7] border-[#bae6fd] hover:bg-sky-100';

    return '<div class="h-8 px-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-[12px] font-bold text-slate-800 shrink-0 flex items-center gap-2">' +
      '<span class="w-2 h-2 rounded-full ' + dotColor + ' shrink-0 shadow-xs"></span>' +
      '<span class="truncate max-w-[130px]">' + labelName + '</span>' +
      '<button type="button" onclick="window.toggleParticipantTransport(\'' + item.id + '\')" title="이동 수단 변경 (자차/대중교통)" class="press px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold border flex items-center gap-1 shrink-0 transition-all ' + transClass + '">' +
        '<i data-lucide="' + transIcon + '" class="w-3 h-3"></i>' +
        '<span>' + transText + '</span>' +
      '</button>' +
      actionBtn +
    '</div>';
  }).join('');

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

window.toggleParticipantTransport = function(locId) {
  var item = state.locations.find(function(l) { return l.id === locId; });
  if (!item) return;

  item.transport = (item.transport === 'car') ? 'transit' : 'car';
  renderOriginChips();

  if (state.confirmedPlace) {
    var destCoord = [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)];
    updateKakaoMobilityRoutes(destCoord, state.confirmedPlace.place_name);
    renderConfirmedNaviList();
  }

  var tLabel = (item.transport === 'car') ? '자차' : '대중교통';
  showToast(item.name + ' 이동 수단: ' + tLabel, (item.transport === 'car') ? 'car' : 'train-front');
  if (window.lucide) lucide.createIcons();
};

window.removeLocation = function(locId) {
  state.confirmedPlace = null;
  var naviCard = document.getElementById('confirmedPlaceNaviCard');
  if (naviCard) naviCard.classList.add('hidden');
  var defaultSummary = document.getElementById('defaultHubSummaryArea');
  var originChips = document.getElementById('originChipsContainer');
  if (defaultSummary) defaultSummary.classList.remove('hidden');
  if (originChips) originChips.classList.remove('hidden');

  state.locations = state.locations.filter(function(item) { return item.id !== locId; });
  updateLocationsAndMidpoint();
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  showToast('출발지를 삭제했습니다', 'trash-2');
};

function searchAddressList(query) {
  if (!query || !query.trim()) return;
  var trimmed = query.trim();

  var section = document.getElementById('searchResultsSection');
  var list = document.getElementById('searchResultsList');
  var countEl = document.getElementById('searchResultsCount');
  var submitBtn = document.getElementById('searchAddressSubmitBtn');

  section.classList.remove('hidden');
  list.innerHTML = '<div class="py-5 text-center text-slate-400 text-[12px] flex items-center justify-center gap-2">' +
    '<span class="w-3.5 h-3.5 border-2 border-[#0284c7] border-t-transparent rounded-full animate-spin"></span>' +
    '<span>카카오 실시간 주소 데이터를 조회하는 중...</span>' +
  '</div>';
  countEl.textContent = '카카오 검색 중...';
  if (submitBtn) submitBtn.disabled = true;

  var myCenter = state.myLocation || DEFAULT_LOC;
  var kakaoUrl = 'https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(trimmed) +
    '&x=' + myCenter[1] + '&y=' + myCenter[0] + '&sort=accuracy&size=10';

  fetch(kakaoUrl, {
    headers: { 'Authorization': 'KakaoAK ' + KAKAO_REST_KEY }
  })
    .then(function(res) {
      if (!res.ok) throw new Error('Kakao API error');
      return res.json();
    })
    .then(function(data) {
      if (submitBtn) submitBtn.disabled = false;
      searchResultsCache = {};

      var docs = (data && data.documents) ? data.documents : [];

      if (docs.length === 0) {
        var matchedPresets = KOREAN_PRESET_COMPLEXES.filter(function(item) {
          return item.name.indexOf(trimmed) !== -1 || trimmed.indexOf(item.name) !== -1;
        });

        if (matchedPresets.length > 0) {
          docs = matchedPresets.map(function(p) {
            return {
              place_name: p.name,
              road_address_name: p.addr,
              address_name: p.addr,
              x: p.lon,
              y: p.lat,
              category_group_name: p.cat
            };
          });
        }
      }

      if (docs.length === 0) {
        countEl.textContent = '결과 없음';
        list.innerHTML = '<div class="py-5 px-3 text-center text-slate-400 text-[12px] bg-slate-50 rounded-xl border border-slate-200/60">' +
          '일치하는 카카오 장소 데이터를 찾지 못했습니다.<br>' +
          '<span class="text-[11px] text-slate-400">지하철역, 건물명, 대표 아파트 이름으로 다시 검색해 보세요.</span>' +
        '</div>';
        return;
      }

      countEl.textContent = '카카오 장소 ' + docs.length + '건';

      var html = docs.map(function(item, idx) {
        var id = 'res_' + idx;
        var fullAddr = item.road_address_name || item.address_name || '';
        var shortName = item.place_name || trimmed;
        var badge = item.category_group_name || (item.category_name ? item.category_name.split(' > ').pop() : '장소');
        if (badge.length > 8) badge = badge.slice(0, 7) + '..';

        var parsedItem = {
          id: id,
          shortName: shortName,
          fullAddress: fullAddr,
          lat: parseFloat(item.y),
          lon: parseFloat(item.x),
          badge: badge,
          phone: item.phone || '',
          placeUrl: item.place_url || ''
        };
        searchResultsCache[id] = parsedItem;

        return '<div class="press p-2.5 rounded-xl bg-slate-50 hover:bg-[#f0f9ff] border border-slate-200/80 hover:border-[#66CCFF] transition-all flex items-center justify-between cursor-pointer group" onclick="window.selectSearchResult(\'' + id + '\')">' +
          '<div class="min-w-0 pr-2">' +
            '<div class="flex items-center gap-1.5">' +
              '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] shrink-0">' + badge + '</span>' +
              '<h4 class="text-[13px] font-bold text-slate-900 group-hover:text-[#0284c7] truncate">' + shortName + '</h4>' +
            '</div>' +
            '<p class="text-[11px] text-slate-500 truncate mt-0.5">' + fullAddr + '</p>' +
          '</div>' +
          '<button type="button" class="px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-[11px] font-bold shrink-0 transition-all shadow-xs">' +
            '선택' +
          '</button>' +
        '</div>';
      }).join('');

      list.innerHTML = html;
    })
    .catch(function(err) {
      console.warn('Kakao search fallback:', err);
      if (submitBtn) submitBtn.disabled = false;
      countEl.textContent = '검색 실패';
      list.innerHTML = '<div class="py-4 text-center text-slate-400 text-[12px]">일시적인 네트워크 오류가 발생했습니다. 다시 시도해 주세요.</div>';
    });
}

window.addPredefinedLocation = function(name, lat, lng) {
  if (state.savedPlaceTarget) {
    var target = state.savedPlaceTarget;
    var savedPlaces = getSavedPlaces();
    savedPlaces[target] = {
      name: (target === 'home' ? '우리집' : '회사'),
      shortName: name,
      addr: name,
      lat: lat,
      lng: lng
    };
    saveSavedPlaces(savedPlaces);
    state.savedPlaceTarget = null;
    closeModal();
    if (window.renderSavedPlacesModalUI) window.renderSavedPlacesModalUI();
    var targetName = (target === 'home' ? '우리집' : '회사');
    showToast(targetName + ' 주소가 "' + name + '"(으)로 등록되었습니다', 'bookmark-check');
    return;
  }

  if (state.isEditingMyLocation) {
    state.myLocation = [lat, lng];
    state.myAddress = name;
    state.locations[0].name = '내 위치';
    state.locations[0].shortName = name;
    state.locations[0].loc = [lat, lng];
    state.locations[0].addr = name;
    state.locations[0].isCustom = true;
    try {
      localStorage.setItem('user_last_my_location', JSON.stringify({
        coords: [lat, lng],
        addr: name,
        shortName: name
      }));
    } catch(e) {}
    var addrEl = document.getElementById('locationAddress');
    if (addrEl) addrEl.textContent = name;
    map.setView([lat, lng], 14, { animate: true });
    updateLocationsAndMidpoint();
    if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
    closeModal();
    showToast('출발지가 "' + name + '"(으)로 변경되었습니다', 'map-pin');
    return;
  }

  var defaultTrans = (state.meetFilter && state.meetFilter.transportPref === 'car') ? 'car' : 'transit';
  var newLoc = {
    id: 'loc_' + Date.now(),
    name: name,
    loc: [lat, lng],
    isMe: false,
    transport: defaultTrans
  };
  state.confirmedPlace = null;
  var naviCard = document.getElementById('confirmedPlaceNaviCard');
  if (naviCard) naviCard.classList.add('hidden');
  state.locations.push(newLoc);
  updateLocationsAndMidpoint();
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  closeModal();
  showToast(name + ' 추가 완료! 중간 지점을 계산했습니다', 'map-pin-plus');
};

window.selectSearchResult = function(resultId) {
  var item = searchResultsCache[resultId];
  if (!item) return;

  if (state.savedPlaceTarget) {
    var sTarget = state.savedPlaceTarget;
    var sPlaces = getSavedPlaces();
    sPlaces[sTarget] = {
      name: (sTarget === 'home' ? '우리집' : '회사'),
      shortName: item.shortName,
      addr: item.fullAddress,
      lat: item.lat,
      lng: item.lon
    };
    saveSavedPlaces(sPlaces);
    state.savedPlaceTarget = null;
    closeModal();
    if (window.renderSavedPlacesModalUI) window.renderSavedPlacesModalUI();
    var sTargetName = (sTarget === 'home' ? '우리집' : '회사');
    showToast(sTargetName + ' 주소가 "' + item.shortName + '"(으)로 등록되었습니다', 'bookmark-check');
    return;
  }

  if (state.isEditingMyLocation) {
    state.myLocation = [item.lat, item.lon];
    state.myAddress = item.fullAddress;
    state.locations[0].name = item.shortName;
    state.locations[0].shortName = item.shortName;
    state.locations[0].loc = [item.lat, item.lon];
    state.locations[0].addr = item.fullAddress;
    state.locations[0].isCustom = true;
    try {
      localStorage.setItem('user_last_my_location', JSON.stringify({
        coords: [item.lat, item.lon],
        addr: item.fullAddress,
        shortName: item.shortName
      }));
    } catch(e) {}
    var addrEl = document.getElementById('locationAddress');
    if (addrEl) addrEl.textContent = item.fullAddress;
    map.setView([item.lat, item.lon], 14, { animate: true });
    state.confirmedPlace = null;
    var nCard = document.getElementById('confirmedPlaceNaviCard');
    if (nCard) nCard.classList.add('hidden');
    updateLocationsAndMidpoint();
    if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
    closeModal();
    showToast('출발지가 "' + item.shortName + '"(으)로 변경되었습니다', 'map-pin');
    return;
  }

  var defaultTrans = (state.meetFilter && state.meetFilter.transportPref === 'car') ? 'car' : 'transit';
  var newLoc = {
    id: 'loc_' + Date.now(),
    name: item.shortName,
    addr: item.fullAddress,
    loc: [item.lat, item.lon],
    isMe: false,
    transport: defaultTrans
  };
  state.confirmedPlace = null;
  var naviCard2 = document.getElementById('confirmedPlaceNaviCard');
  if (naviCard2) naviCard2.classList.add('hidden');
  state.locations.push(newLoc);
  updateLocationsAndMidpoint();
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  closeModal();
  showToast(item.shortName + ' 출발지로 추가되었습니다', 'map-pin-plus');
};

var addModal = document.getElementById('addLocationModal');

window.openEditMyLocationModal = function() {
  state.isEditingMyLocation = true;
  var titleEl = document.getElementById('modalTitle');
  var subTitleEl = document.getElementById('modalSubTitle');
  var gpsRetryBtn = document.getElementById('modalGpsRetryBtn');
  if (titleEl) titleEl.textContent = '내 출발지 주소 변경';
  if (subTitleEl) subTitleEl.textContent = '현재 위치뿐만 아니라 집, 회사, 역 등 모임을 시작할 다른 주소를 검색해 지정하세요';
  if (gpsRetryBtn) gpsRetryBtn.classList.remove('hidden');
  if (addModal) addModal.classList.remove('hidden');
  var input = document.getElementById('addressSearchInput');
  if (input) {
    input.placeholder = '출발 주소 검색 (예: 강남역, 판교 테크노밸리, 아파트명)';
    input.focus();
  }
  if (window.lucide) lucide.createIcons();
};

window.openAddModal = function() {
  state.isEditingMyLocation = false;
  var titleEl = document.getElementById('modalTitle');
  var subTitleEl = document.getElementById('modalSubTitle');
  var gpsRetryBtn = document.getElementById('modalGpsRetryBtn');
  if (titleEl) titleEl.textContent = '출발지 주소 추가';
  if (subTitleEl) subTitleEl.textContent = '주소나 지하철역을 입력하면 중간 지점을 찾아줍니다';
  if (gpsRetryBtn) gpsRetryBtn.classList.add('hidden');
  if (addModal) addModal.classList.remove('hidden');
  var input = document.getElementById('addressSearchInput');
  if (input) {
    input.placeholder = '아파트, 지하철역, 빌라, 도로명 검색';
    input.focus();
  }
  if (window.lucide) lucide.createIcons();
};

// --------------------------------------------------------------------
// 즐겨찾기 (집 / 회사) 장소 로컬 스토리지 관리 시스템
// --------------------------------------------------------------------
function getSavedPlaces() {
  try {
    var raw = localStorage.getItem('midpoint_saved_places');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {
    home: null,
    work: null
  };
}

function saveSavedPlaces(data) {
  try {
    localStorage.setItem('midpoint_saved_places', JSON.stringify(data));
  } catch(e) {}
  window.renderQuickPlacesBar();
  window.renderSavedPlacesModalUI();
}

window.renderQuickPlacesBar = function() {
  var bar = document.getElementById('headerQuickLocBar');
  if (!bar) return;

  var saved = getSavedPlaces();
  var myLoc = state.locations[0];
  var isGps = myLoc && !myLoc.isCustom;

  var gpsClass = isGps ? 'bg-white text-[#4a80f0] font-bold shadow-xs' : 'route-planner-chip font-medium';

  // 1. 실시간 현위치
  var html = '<button type="button" onclick="window.restoreMyLiveGps()" class="press px-2.5 py-1 rounded-full ' + gpsClass + ' shrink-0 flex items-center gap-1 transition-all">' +
    '<i data-lucide="crosshair" class="w-3 h-3"></i>' +
    '<span>실시간 현위치</span>' +
  '</button>';

  // 2. 집 (Home)
  if (saved.home) {
    var isHomeActive = myLoc && myLoc.isCustom && (myLoc.name === '우리집' || myLoc.addr === saved.home.addr);
    var homeClass = isHomeActive ? 'bg-white text-[#4a80f0] font-bold shadow-xs' : 'route-planner-chip font-medium';
    var shortHome = saved.home.shortName || '우리집';
    html += '<button type="button" onclick="window.setOriginToSavedPlace(\'home\')" class="press px-2.5 py-1 rounded-full ' + homeClass + ' shrink-0 flex items-center gap-1 transition-all" title="집: ' + saved.home.addr + '">' +
      '<i data-lucide="home" class="w-3 h-3"></i>' +
      '<span>집 (' + shortHome + ')</span>' +
    '</button>';
  } else {
    html += '<button type="button" onclick="window.openSavedPlaceEditor(\'home\')" class="press px-2.5 py-1 rounded-full border border-dashed border-white/40 bg-white/10 hover:bg-white/20 text-white/90 shrink-0 flex items-center gap-1 transition-all" title="집 주소 등록">' +
      '<i data-lucide="plus" class="w-3 h-3"></i>' +
      '<span>집 등록</span>' +
    '</button>';
  }

  // 3. 회사 (Work)
  if (saved.work) {
    var isWorkActive = myLoc && myLoc.isCustom && (myLoc.name === '회사' || myLoc.addr === saved.work.addr);
    var workClass = isWorkActive ? 'bg-white text-[#4a80f0] font-bold shadow-xs' : 'route-planner-chip font-medium';
    var shortWork = saved.work.shortName || '회사';
    html += '<button type="button" onclick="window.setOriginToSavedPlace(\'work\')" class="press px-2.5 py-1 rounded-full ' + workClass + ' shrink-0 flex items-center gap-1 transition-all" title="회사: ' + saved.work.addr + '">' +
      '<i data-lucide="briefcase" class="w-3 h-3"></i>' +
      '<span>회사 (' + shortWork + ')</span>' +
    '</button>';
  } else {
    html += '<button type="button" onclick="window.openSavedPlaceEditor(\'work\')" class="press px-2.5 py-1 rounded-full border border-dashed border-white/40 bg-white/10 hover:bg-white/20 text-white/90 shrink-0 flex items-center gap-1 transition-all" title="회사 주소 등록">' +
      '<i data-lucide="plus" class="w-3 h-3"></i>' +
      '<span>회사 등록</span>' +
    '</button>';
  }

  // 4. 즐겨찾기 설정 (아이콘 버튼)
  html += '<button type="button" onclick="window.openSavedPlacesModal()" class="press px-2 py-1 rounded-full route-planner-chip text-white/90 shrink-0 flex items-center gap-1 transition-all" title="즐겨찾기 장소 관리 및 설정">' +
    '<i data-lucide="bookmark" class="w-3 h-3"></i>' +
    '<span>즐겨찾기 설정</span>' +
  '</button>';

  // 5. 주소 직접 검색
  html += '<button type="button" onclick="window.openEditMyLocationModal()" class="press px-2.5 py-1 rounded-full route-planner-chip text-white/90 shrink-0 flex items-center gap-1 transition-all">' +
    '<i data-lucide="search" class="w-3 h-3"></i>' +
    '<span>직접 검색...</span>' +
  '</button>';

  bar.innerHTML = html;
  if (window.lucide) lucide.createIcons();
};

window.setOriginToSavedPlace = function(type) {
  var saved = getSavedPlaces();
  var place = saved[type];
  if (!place) {
    window.openSavedPlaceEditor(type);
    return;
  }
  var placeTitle = (type === 'home' ? '우리집' : '회사');
  window.setMyCustomOrigin(placeTitle, place.addr, place.lat, place.lng);
};

window.openSavedPlaceEditor = function(type) {
  state.savedPlaceTarget = type;
  state.isEditingMyLocation = false;
  var modal = document.getElementById('addLocationModal');
  var titleEl = document.getElementById('modalTitle');
  var subTitleEl = document.getElementById('modalSubTitle');
  var gpsRetryBtn = document.getElementById('modalGpsRetryBtn');
  var label = (type === 'home' ? '우리집' : '회사');
  if (titleEl) titleEl.textContent = label + ' 주소 등록';
  if (subTitleEl) subTitleEl.textContent = label + '로 설정할 주소나 건물을 검색해 주세요';
  if (gpsRetryBtn) gpsRetryBtn.classList.remove('hidden');
  if (modal) modal.classList.remove('hidden');
  var input = document.getElementById('addressSearchInput');
  if (input) {
    input.value = '';
    input.placeholder = label + ' 주소 검색 (예: 도로명, 역이름, 건물명)';
    setTimeout(function() { input.focus(); }, 150);
  }
  if (window.lucide) lucide.createIcons();
};

window.openSavedPlacesModal = function() {
  var modal = document.getElementById('savedPlacesModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  window.renderSavedPlacesModalUI();
};

window.closeSavedPlacesModal = function() {
  var modal = document.getElementById('savedPlacesModal');
  if (modal) modal.classList.add('hidden');
};

window.renderSavedPlacesModalUI = function() {
  var saved = getSavedPlaces();
  var homeText = document.getElementById('savedHomeAddrText');
  var homeActions = document.getElementById('savedHomeActions');
  var workText = document.getElementById('savedWorkAddrText');
  var workActions = document.getElementById('savedWorkActions');

  if (homeText) {
    homeText.textContent = saved.home ? saved.home.addr : '등록된 주소가 없습니다.';
    homeText.className = saved.home ? 'text-[12px] text-slate-800 pl-9 font-semibold' : 'text-[12px] text-slate-400 pl-9 font-medium';
  }
  if (homeActions) {
    if (saved.home) {
      homeActions.innerHTML = '<button type="button" onclick="window.openSavedPlaceEditor(\'home\')" class="press px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition-colors">변경</button>' +
        '<button type="button" onclick="window.deleteSavedPlace(\'home\')" class="press p-1 text-slate-400 hover:text-rose-500 transition-colors" title="삭제"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>';
    } else {
      homeActions.innerHTML = '<button type="button" onclick="window.saveCurrentGpsAsSavedPlace(\'home\')" class="press px-2.5 py-1 rounded-lg bg-sky-50 text-[#4a80f0] border border-sky-200 text-[11px] font-bold hover:bg-sky-100 transition-colors">현위치로 등록</button>' +
        '<button type="button" onclick="window.openSavedPlaceEditor(\'home\')" class="press px-2.5 py-1 rounded-lg bg-[#4a80f0] text-white text-[11px] font-bold hover:bg-blue-600 transition-colors shadow-2xs">주소 검색</button>';
    }
  }

  if (workText) {
    workText.textContent = saved.work ? saved.work.addr : '등록된 주소가 없습니다.';
    workText.className = saved.work ? 'text-[12px] text-slate-800 pl-9 font-semibold' : 'text-[12px] text-slate-400 pl-9 font-medium';
  }
  if (workActions) {
    if (saved.work) {
      workActions.innerHTML = '<button type="button" onclick="window.openSavedPlaceEditor(\'work\')" class="press px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition-colors">변경</button>' +
        '<button type="button" onclick="window.deleteSavedPlace(\'work\')" class="press p-1 text-slate-400 hover:text-rose-500 transition-colors" title="삭제"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>';
    } else {
      workActions.innerHTML = '<button type="button" onclick="window.saveCurrentGpsAsSavedPlace(\'work\')" class="press px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 text-[11px] font-bold hover:bg-indigo-100 transition-colors">현위치로 등록</button>' +
        '<button type="button" onclick="window.openSavedPlaceEditor(\'work\')" class="press px-2.5 py-1 rounded-lg bg-[#4a80f0] text-white text-[11px] font-bold hover:bg-blue-600 transition-colors shadow-2xs">주소 검색</button>';
    }
  }

  if (window.lucide) lucide.createIcons();
};

window.saveCurrentGpsAsSavedPlace = function(type) {
  var coords = state.realGpsLocation || state.myLocation;
  var addr = state.realGpsAddress || state.myAddress;
  if (!coords || !addr) {
    showToast('실시간 GPS 주소를 확인하는 중입니다', 'crosshair');
    return;
  }
  var tokens = addr.split(' ').filter(Boolean);
  var shortName = tokens.length >= 2 ? tokens[tokens.length - 1] : (type === 'home' ? '우리집' : '회사');
  var saved = getSavedPlaces();
  saved[type] = {
    name: (type === 'home' ? '우리집' : '회사'),
    shortName: shortName,
    addr: addr,
    lat: coords[0],
    lng: coords[1]
  };
  saveSavedPlaces(saved);
  showToast((type === 'home' ? '우리집' : '회사') + '이 현재 위치로 등록되었습니다', 'bookmark-check');
};

window.deleteSavedPlace = function(type) {
  var saved = getSavedPlaces();
  saved[type] = null;
  saveSavedPlaces(saved);
  showToast((type === 'home' ? '우리집' : '회사') + ' 즐겨찾기를 삭제했습니다', 'trash-2');
};

// --------------------------------------------------------------------
// 상단 모임 경로 & 주소 플래너 바 인터랙션 구현 (눈이 편안한 iOS 내비 스타일)
// --------------------------------------------------------------------
window.updateHeaderRouteCardUI = function() {
  var header = document.getElementById('topHeader');
  if (!header) return;

  var myLoc = state.locations[0];
  var myOriginAddrEl = document.getElementById('headerMyOriginAddr');
  var myOriginBadgeEl = document.getElementById('headerMyOriginTypeBadge');
  var gpsRestoreBtn = document.getElementById('headerGpsRestoreBtn');
  var topSearchAddr = document.getElementById('topSearchDisplayAddr');

  if (myLoc) {
    var isCustom = !!myLoc.isCustom;
    var displayAddr = myLoc.addr || myLoc.name || state.myAddress || '위치 확인 중';
    if (topSearchAddr) {
      topSearchAddr.textContent = displayAddr;
    }
    if (myOriginAddrEl) {
      myOriginAddrEl.textContent = (isCustom ? '출발지: ' : '현위치: ') + displayAddr;
      myOriginAddrEl.title = displayAddr;
    }
    if (myOriginBadgeEl) {
      if (isCustom) {
        myOriginBadgeEl.classList.remove('hidden');
        myOriginBadgeEl.textContent = '지정 주소';
        myOriginBadgeEl.className = 'text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/20 text-white shrink-0';
      } else {
        myOriginBadgeEl.classList.add('hidden');
      }
    }
    if (gpsRestoreBtn) {
      if (isCustom) {
        gpsRestoreBtn.classList.remove('hidden');
      } else {
        gpsRestoreBtn.classList.add('hidden');
      }
    }
  }

  // 추가 참가자 출발지 (2명 이상일 때)
  var othersContainer = document.getElementById('headerOtherParticipantsArea');
  if (othersContainer) {
    if (state.locations.length > 1) {
      othersContainer.classList.remove('hidden');
      othersContainer.innerHTML = state.locations.slice(1).map(function(item) {
        return '<div class="flex items-center justify-between gap-1 text-[11px] text-white/95 bg-white/15 px-2.5 py-1 rounded-xl">' +
          '<div class="flex items-center gap-1.5 min-w-0 flex-1">' +
            '<span class="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>' +
            '<span class="font-bold text-white shrink-0">' + item.name + ':</span>' +
            '<span class="truncate text-white/85">' + (item.addr || item.name) + '</span>' +
          '</div>' +
          '<button type="button" onclick="window.removeLocation(\'' + item.id + '\')" class="press p-0.5 text-white/70 hover:text-white transition-colors shrink-0" title="출발지 삭제">' +
            '<i data-lucide="x" class="w-3.5 h-3.5"></i>' +
          '</button>' +
        '</div>';
      }).join('');
    } else {
      othersContainer.classList.add('hidden');
      othersContainer.innerHTML = '';
    }
  }

  // 도착지 입력 (Row 2): 레퍼런스와 동일하게 "도착지 입력" 제공, "추천 중간점" 배지/텍스트 완전 제거
  var destAddrEl = document.getElementById('headerDestAddr');
  var destDotEl = document.getElementById('headerDestDot');
  if (destAddrEl) {
    if (state.confirmedPlace) {
      destAddrEl.textContent = '도착지: ' + state.confirmedPlace.place_name;
      destAddrEl.className = 'truncate block text-[13px] font-bold text-white';
      if (destDotEl) destDotEl.className = 'w-2 h-2 rounded-full bg-white shrink-0';
    } else {
      destAddrEl.textContent = '도착지 입력';
      destAddrEl.className = 'truncate block text-[13px] font-normal text-white/70 group-hover:text-white transition-colors';
      if (destDotEl) destDotEl.className = 'w-2 h-2 rounded-full bg-white/40 shrink-0';
    }
  }

  // 교통수단 버튼 활성화 갱신 (부드러운 화이트 캡슐 하이라이트)
  var currentTrans = (state.meetFilter && state.meetFilter.transportPref) || 'transit';
  var btnCar = document.getElementById('headerTabCar');
  var btnTransit = document.getElementById('headerTabTransit');
  var btnWalk = document.getElementById('headerTabWalk');
  var btnBike = document.getElementById('headerTabBike');

  var activeClass = 'press px-3.5 h-7 rounded-full bg-white text-[#4a80f0] font-bold shadow-xs flex items-center justify-center gap-1 transition-all';
  var inactiveClass = 'press w-8 h-7 rounded-full flex items-center justify-center transition-all text-white/80 hover:text-white hover:bg-white/10';

  if (btnCar) btnCar.className = (currentTrans === 'car') ? activeClass : inactiveClass;
  if (btnTransit) btnTransit.className = (currentTrans === 'transit' || currentTrans === 'mixed') ? activeClass : inactiveClass;
  if (btnWalk) btnWalk.className = (currentTrans === 'walk') ? activeClass : inactiveClass;
  if (btnBike) btnBike.className = (currentTrans === 'bike') ? activeClass : inactiveClass;

  window.renderQuickPlacesBar();
  if (window.renderTossCardUI) window.renderTossCardUI();

  if (window.lucide) lucide.createIcons();
};

// --------------------------------------------------------------------
// 토스 스타일 단일 포커스 모임 카드 렌더러 (Toss Meeting Card Engine)
// --------------------------------------------------------------------
window.renderTossCardUI = function() {
  var count = (state.locations && state.locations.length) || 1;
  var myLoc = state.locations[0];
  var planPhase = document.getElementById('tossPlanPhase');
  var resultPhase = document.getElementById('tossResultPhase');
  var myAddrText = document.getElementById('tossMyAddrText');
  var friendsList = document.getElementById('tossFriendsList');
  var topBadge = document.getElementById('tossStatusBadge');

  if (myAddrText && myLoc) {
    var addr = myLoc.addr || myLoc.name || state.myAddress || '내 위치 확인 중...';
    myAddrText.textContent = addr;
  }

  // 1명일 때: 약속 준비 모드
  if (count <= 1) {
    if (planPhase) planPhase.classList.remove('hidden');
    if (resultPhase) resultPhase.classList.add('hidden');
    if (topBadge) {
      topBadge.textContent = '약속 준비';
      topBadge.className = 'text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#2563eb]';
    }

    if (friendsList) {
      friendsList.innerHTML = '<div onclick="window.openAddModal()" class="press cursor-pointer border border-dashed border-slate-300 hover:border-[#2563eb] bg-white/70 hover:bg-blue-50/40 rounded-xl p-2.5 flex items-center justify-between gap-2 transition-all group">' +
        '<div class="flex items-center gap-2 min-w-0">' +
          '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>' +
          '<span class="text-[10.5px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">친구</span>' +
          '<span class="text-[12px] font-semibold text-slate-400 group-hover:text-[#2563eb] truncate transition-colors">터치하여 친구의 출발지를 입력하세요</span>' +
        '</div>' +
        '<div class="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-[#2563eb] text-slate-400 group-hover:text-white flex items-center justify-center transition-all shrink-0">' +
          '<i data-lucide="plus" class="w-3.5 h-3.5"></i>' +
        '</div>' +
      '</div>';
    }
  } else {
    // 2명 이상: 황금 밸런스 중간 장소 도출 완료 모드
    if (planPhase) planPhase.classList.add('hidden');
    if (resultPhase) resultPhase.classList.remove('hidden');
    if (topBadge) {
      topBadge.textContent = count + '곳 모임 (' + (state.currentHubName || '중간 지점') + ')';
      topBadge.className = 'text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700';
    }

    var hubNameEl = document.getElementById('tossHubName');
    if (hubNameEl && state.currentHubName) {
      hubNameEl.textContent = state.currentHubName;
    }

    var diffEl = document.getElementById('travelTimeDiff');
    var diffBadge = document.getElementById('tossDiffBadge');
    if (diffBadge) {
      var diffText = (diffEl && diffEl.textContent && diffEl.textContent.trim()) ? diffEl.textContent.trim() : '공평한 이동시간';
      diffBadge.textContent = (diffText.indexOf('차이') !== -1 || diffText.indexOf('공평') !== -1) ? diffText : (diffText + ' 차이');
    }

    // 참가자별 소요시간 게이지 바 렌더링
    var gaugeArea = document.getElementById('tossTimeGaugeArea');
    if (gaugeArea && state.locations) {
      var maxDur = 1;
      state.locations.forEach(function(loc) {
        var d = participantRouteDetails[loc.id] ? participantRouteDetails[loc.id].durationMin : 25;
        if (d > maxDur) maxDur = d;
      });

      gaugeArea.innerHTML = state.locations.map(function(loc, idx) {
        var isMe = idx === 0;
        var rDet = participantRouteDetails[loc.id];
        var dur = rDet ? rDet.durationMin : (isMe ? 19 : 18);
        var pct = Math.max(25, Math.min(100, Math.round((dur / maxDur) * 100)));
        var barColor = isMe ? 'bg-[#2563eb]' : 'bg-emerald-500';
        var badgeColor = isMe ? 'bg-blue-100 text-[#2563eb]' : 'bg-emerald-100 text-emerald-700';
        var transName = (loc.transport === 'car') ? '자차' : ((loc.transport === 'walk') ? '도보' : '대중교통');

        return '<div class="flex flex-col gap-1">' +
          '<div class="flex items-center justify-between text-[11.5px] font-bold">' +
            '<div class="flex items-center gap-1.5 min-w-0">' +
              '<span class="px-1.5 py-0.2 rounded text-[10px] font-extrabold ' + badgeColor + '">' + (isMe ? '나' : loc.name) + '</span>' +
              '<span class="text-slate-600 truncate text-[11px]">' + (loc.addr || loc.name) + ' (' + transName + ')</span>' +
            '</div>' +
            '<span class="font-black text-slate-900 shrink-0 ml-2">' + dur + '분</span>' +
          '</div>' +
          '<div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden">' +
            '<div class="h-full rounded-full ' + barColor + ' transition-all duration-500" style="width: ' + pct + '%"></div>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  if (window.lucide) lucide.createIcons();
};

window.handleTossFindMidpoint = function() {
  var count = (state.locations && state.locations.length) || 1;
  if (count <= 1) {
    showToast('함께 만날 친구의 출발지를 추가해 주세요!', 'user-plus');
    window.openAddModal();
  } else {
    window.zoomToHub(false);
  }
};

window.setHeaderTransport = function(mode) {
  if (!state.meetFilter) state.meetFilter = {};
  state.meetFilter.transportPref = mode;

  // 모든 참가자 기본 교통수단 동기화
  var mappedTransport = (mode === 'car') ? 'car' : 'transit';
  state.locations.forEach(function(l) {
    l.transport = mappedTransport;
  });

  if (state.confirmedPlace) {
    var destCoord = [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)];
    updateKakaoMobilityRoutes(destCoord, state.confirmedPlace.place_name);
    renderConfirmedNaviList();
  }

  window.updateHeaderRouteCardUI();
  var modeNames = { car: '자차', transit: '대중교통', walk: '도보', bike: '자전거' };
  var modeIcons = { car: 'car', transit: 'bus', walk: 'footprints', bike: 'bike' };
  showToast(modeNames[mode] + ' 이동 모드로 설정되었습니다', modeIcons[mode] || 'navigation');
};

window.restoreMyLiveGps = function() {
  if (state.realGpsLocation && state.realGpsAddress) {
    state.myLocation = state.realGpsLocation;
    state.myAddress = state.realGpsAddress;
    state.locations[0].loc = state.realGpsLocation;
    state.locations[0].addr = state.realGpsAddress;
    state.locations[0].shortName = '내 위치';
    state.locations[0].name = '내 위치';
    state.locations[0].isCustom = false;
    map.setView(state.realGpsLocation, 15, { animate: true });
    updateLocationsAndMidpoint();
    window.updateHeaderRouteCardUI();
    showToast('실시간 내 GPS 위치로 복귀했습니다', 'crosshair');
  } else {
    showToast('실시간 GPS 위치를 다시 탐색합니다...', 'crosshair');
    locateMe(false);
  }
};

window.setMyCustomOrigin = function(name, addr, lat, lng) {
  state.locations[0].isCustom = true;
  state.locations[0].name = name;
  state.locations[0].shortName = name;
  state.locations[0].addr = addr;
  state.locations[0].loc = [lat, lng];
  state.myLocation = [lat, lng];
  state.myAddress = addr;
  state.confirmedPlace = null;

  var naviCard = document.getElementById('confirmedPlaceNaviCard');
  if (naviCard) naviCard.classList.add('hidden');

  map.setView([lat, lng], 15, { animate: true });
  updateLocationsAndMidpoint();
  window.updateHeaderRouteCardUI();
  showToast('출발지를 "' + name + '"(으)로 설정했습니다', 'map-pin');
};

window.toggleOriginAddressMode = function() {
  if (state.locations[0].isCustom) {
    window.restoreMyLiveGps();
  } else {
    window.openEditMyLocationModal();
  }
};

window.openRoutePlanner = function() {
  state.routePlannerOpen = true;
  var searchBar = document.getElementById('topSearchBarContainer');
  var routeHeader = document.getElementById('topHeader');
  if (searchBar) searchBar.classList.add('hidden');
  if (routeHeader) routeHeader.classList.remove('hidden');
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  if (window.lucide) lucide.createIcons();
};

window.closeRoutePlanner = function() {
  state.routePlannerOpen = false;
  var searchBar = document.getElementById('topSearchBarContainer');
  var routeHeader = document.getElementById('topHeader');
  if (routeHeader) routeHeader.classList.add('hidden');
  if (searchBar) searchBar.classList.remove('hidden');
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  if (window.lucide) lucide.createIcons();
};

window.handleSearchInputClick = function() {
  // 검색창 탭 시: 길찾기 모드로 전환하면서 목적지 검색 열기
  window.openRoutePlanner();
  setTimeout(function() {
    window.focusOrSearchDestination();
  }, 100);
};

window.toggleTopHeaderCompact = function() {
  window.closeRoutePlanner();
};

window.openOriginAddressPicker = function() {
  window.openEditMyLocationModal();
};

window.focusOrSearchDestination = function() {
  if (state.confirmedPlace) {
    var pCoord = [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)];
    map.flyTo(pCoord, 16.5, { duration: 0.8 });
    showToast(state.confirmedPlace.place_name + ' 위치로 이동', 'map-pin');
  } else if (state.currentHubCoord) {
    window.zoomToHub(false);
  } else {
    window.openAddModal();
  }
};

window.openAddressOptionsDrawer = function() {
  window.openSavedPlacesModal();
};

function closeModal() {
  state.isEditingMyLocation = false;
  state.savedPlaceTarget = null;
  if (addModal) addModal.classList.add('hidden');
  var input = document.getElementById('addressSearchInput');
  if (input) input.value = '';
  var section = document.getElementById('searchResultsSection');
  if (section) section.classList.add('hidden');
  var list = document.getElementById('searchResultsList');
  if (list) list.innerHTML = '';
}

// --------------------------------------------------------------------
// UI 이벤트 리스너 등록 & 초기 구동 (Bootstrap)
// --------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
  initMap();

  var sheet = document.getElementById('bottomSheet');
  var sheetHandle = document.getElementById('sheetHandle');
  if (sheetHandle && sheet) {
    sheetHandle.addEventListener('click', function() {
      state.sheetExpanded = !state.sheetExpanded;
      if (state.sheetExpanded) {
        sheet.classList.remove('sheet-collapsed');
        sheet.classList.add('sheet-expanded');
      } else {
        sheet.classList.remove('sheet-expanded');
        sheet.classList.add('sheet-collapsed');
      }
    });
  }

  var scrollArea = document.getElementById('bottomSheetScrollArea');
  if (scrollArea && sheet) {
    scrollArea.addEventListener('scroll', function() {
      if (!state.sheetExpanded && scrollArea.scrollTop > 8) {
        state.sheetExpanded = true;
        sheet.classList.remove('sheet-collapsed');
        sheet.classList.add('sheet-expanded');
      }
    }, { passive: true });
  }

  var zoomInBtn = document.getElementById('zoomInBtn');
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() {
      map.setZoom(Math.round(map.getZoom()) + 1, { animate: true });
    });
  }

  var zoomOutBtn = document.getElementById('zoomOutBtn');
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() {
      map.setZoom(Math.round(map.getZoom()) - 1, { animate: true });
    });
  }

  var gpsBtn = document.getElementById('gpsBtn');
  if (gpsBtn) {
    gpsBtn.addEventListener('click', function() {
      locateMe(false);
    });
  }

  var openAddLocationBtn = document.getElementById('openAddLocationBtn');
  if (openAddLocationBtn) openAddLocationBtn.addEventListener('click', window.openAddModal);

  var closeAddLocationModalBtn = document.getElementById('closeAddLocationModalBtn');
  if (closeAddLocationModalBtn) closeAddLocationModalBtn.addEventListener('click', closeModal);

  var searchForm = document.getElementById('searchAddressForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var val = document.getElementById('addressSearchInput').value;
      if (val && val.trim()) {
        searchAddressList(val);
      } else {
        showToast('검색할 장소나 주소를 입력해 주세요', 'search');
      }
    });
  }

  if (addModal) {
    addModal.addEventListener('click', function(e) {
      if (e.target === addModal) closeModal();
    });
  }

  var filterModal = document.getElementById('meetFilterModal');
  if (filterModal) {
    filterModal.addEventListener('click', function(e) {
      if (e.target === filterModal) window.closeMeetFilterModal();
    });
  }

  var voucherModal = document.getElementById('mobilityVoucherModal');
  if (voucherModal) {
    voucherModal.addEventListener('click', function(e) {
      if (e.target === voucherModal) window.closeMobilityVoucherModal();
    });
  }

  var taxiGiftModalEl = document.getElementById('taxiGiftModal');
  if (taxiGiftModalEl) {
    taxiGiftModalEl.addEventListener('click', function(e) {
      if (e.target === taxiGiftModalEl) window.closeTaxiGiftModal();
    });
  }

  var randomGameModalEl = document.getElementById('randomGameModal');
  if (randomGameModalEl) {
    randomGameModalEl.addEventListener('click', function(e) {
      if (e.target === randomGameModalEl) window.closeGameModal();
    });
  }

  var chatDrawerModalEl = document.getElementById('chatDrawerModal');
  if (chatDrawerModalEl) {
    chatDrawerModalEl.addEventListener('click', function(e) {
      if (e.target === chatDrawerModalEl) window.closeChatDrawer();
    });
  }

  var savedPlacesModalEl = document.getElementById('savedPlacesModal');
  if (savedPlacesModalEl) {
    savedPlacesModalEl.addEventListener('click', function(e) {
      if (e.target === savedPlacesModalEl) window.closeSavedPlacesModal();
    });
  }

  window.addEventListener('resize', function() {
    if (map) map.invalidateSize();
  });

  syncMeetFilterUI();
  if (window.renderQuickPlacesBar) window.renderQuickPlacesBar();
  if (window.renderTossCardUI) window.renderTossCardUI();
  locateMe(true);
  if (window.lucide) lucide.createIcons();
});
