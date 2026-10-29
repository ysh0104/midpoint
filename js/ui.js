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
  state.myLocation = coords;
  state.myAddress = addrText;
  state.locations[0].loc = coords;
  state.locations[0].addr = addrText;

  var tokens = addrText.split(' ').filter(Boolean);
  var shortName = '내 위치';
  if (tokens.length >= 3) {
    shortName = tokens[tokens.length - 2] + ' ' + tokens[tokens.length - 1];
  } else if (tokens.length >= 2) {
    shortName = tokens[tokens.length - 1];
  }
  state.locations[0].shortName = shortName;

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
  if (state.isEditingMyLocation) {
    state.myLocation = [lat, lng];
    state.myAddress = name;
    state.locations[0].name = '내 위치';
    state.locations[0].shortName = name;
    state.locations[0].loc = [lat, lng];
    state.locations[0].addr = name;
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
    closeModal();
    showToast('내 위치가 "' + name + '"(으)로 변경되었습니다', 'map-pin');
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
  closeModal();
  showToast(name + ' 추가 완료! 중간 지점을 계산했습니다', 'map-pin-plus');
};

window.selectSearchResult = function(resultId) {
  var item = searchResultsCache[resultId];
  if (!item) return;

  if (state.isEditingMyLocation) {
    state.myLocation = [item.lat, item.lon];
    state.myAddress = item.fullAddress;
    state.locations[0].name = '내 위치';
    state.locations[0].shortName = item.shortName;
    state.locations[0].loc = [item.lat, item.lon];
    state.locations[0].addr = item.fullAddress;
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
    closeModal();
    showToast('내 위치가 "' + item.shortName + '"(으)로 변경되었습니다', 'map-pin');
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
  closeModal();
  showToast(item.shortName + ' 출발지로 추가되었습니다', 'map-pin-plus');
};

var addModal = document.getElementById('addLocationModal');

window.openEditMyLocationModal = function() {
  state.isEditingMyLocation = true;
  var titleEl = document.getElementById('modalTitle');
  var subTitleEl = document.getElementById('modalSubTitle');
  var gpsRetryBtn = document.getElementById('modalGpsRetryBtn');
  if (titleEl) titleEl.textContent = '내 위치 변경';
  if (subTitleEl) subTitleEl.textContent = '현재 계신 동네나 건물, 지하철역을 검색해 내 위치로 지정하세요';
  if (gpsRetryBtn) gpsRetryBtn.classList.remove('hidden');
  if (addModal) addModal.classList.remove('hidden');
  var input = document.getElementById('addressSearchInput');
  if (input) {
    input.placeholder = '내 위치 검색 (예: 역삼동, 판교역, 아파트명)';
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

function closeModal() {
  state.isEditingMyLocation = false;
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

  window.addEventListener('resize', function() {
    if (map) map.invalidateSize();
  });

  syncMeetFilterUI();
  locateMe(true);
  if (window.lucide) lucide.createIcons();
});
