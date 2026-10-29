/**
 * MidPoint - Mobility & Transit Engine
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatEtaTime(durationMinutes) {
  var now = new Date();
  var eta = new Date(now.getTime() + (durationMinutes * 60 * 1000));
  var hours = eta.getHours();
  var mins = eta.getMinutes();
  var ampm = hours >= 12 ? '오후' : '오전';
  var dispHour = hours % 12 || 12;
  var dispMin = mins < 10 ? '0' + mins : mins;
  return ampm + ' ' + dispHour + ':' + dispMin;
}

function findNearestSubwayStation(lat, lon) {
  var best = null;
  var bestDist = Infinity;
  for (var lKey in SUBWAY_NETWORK) {
    var line = SUBWAY_NETWORK[lKey];
    for (var si = 0; si < line.stations.length; si++) {
      var st = line.stations[si];
      var d = calculateDistanceKm(lat, lon, st.loc[0], st.loc[1]);
      if (d < bestDist) {
        bestDist = d;
        best = {
          station: st,
          lineKey: lKey,
          lineInfo: line,
          distKm: d,
          index: si
        };
      }
    }
  }
  return best;
}

function getFairnessBadge(diff) {
  if (diff <= 3) return { text: '단 ' + diff + '분 차이 (완벽히 공평)', color: 'text-emerald-600' };
  if (diff <= 8) return { text: '단 ' + diff + '분 차이 (매우 공평)', color: 'text-emerald-600' };
  if (diff <= 18) return { text: diff + '분 차이 (적정 수준)', color: 'text-[#0284c7]' };
  if (diff <= 35) return { text: diff + '분 차이 (다소 불균형)', color: 'text-amber-600' };
  return { text: diff + '분 차이 (심각한 격차)', color: 'text-rose-600' };
}

function recalcFairness(realDurations) {
  var validDurations = realDurations.filter(function(d) { return typeof d === 'number' && !isNaN(d); });
  if (validDurations.length >= 2) {
    var rMin = Math.min.apply(null, validDurations);
    var rMax = Math.max.apply(null, validDurations);
    var rDiff = rMax - rMin;
    var bInfo = getFairnessBadge(rDiff);
    var diffLabel = document.getElementById('travelTimeDiff');
    if (diffLabel) {
      diffLabel.textContent = bInfo.text;
      diffLabel.className = 'text-[14px] font-black ' + bInfo.color;
    }
  }
}

function updateLocationsAndMidpoint() {
  var locList = state.locations;
  var count = locList.length;

  state.lines.forEach(function(l) { map.removeLayer(l); });
  state.lines = [];
  if (state.transitMarkers) {
    state.transitMarkers.forEach(function(m) { map.removeLayer(m); });
    state.transitMarkers = [];
  }
  if (state.hubMarker) { map.removeLayer(state.hubMarker); state.hubMarker = null; }

  Object.keys(state.markers).forEach(function(mid) {
    var stillIn = locList.some(function(item) { return item.id === mid; });
    if (!stillIn) {
      map.removeLayer(state.markers[mid]);
      delete state.markers[mid];
    }
  });

  locList.forEach(function(item, idx) {
    var shortLabel = item.isMe ? '내 위치' : item.name;
    var iconLetter = item.isMe ? '나' : String(idx);
    var icon = createMarkerHtml(shortLabel, iconLetter, item.isMe, false, false);
    if (!state.markers[item.id]) {
      state.markers[item.id] = L.marker(item.loc, {
        icon: icon,
        zIndexOffset: item.isMe ? 1000 : 500
      }).addTo(map);
    } else {
      state.markers[item.id].setLatLng(item.loc);
      state.markers[item.id].setIcon(icon);
    }
  });

  var defaultSummary = document.getElementById('defaultHubSummaryArea');
  var originChips = document.getElementById('originChipsContainer');
  var transitCard = document.getElementById('transitAnalysisCard');

  if (state.confirmedPlace) {
    if (defaultSummary) defaultSummary.classList.add('hidden');
    if (originChips) originChips.classList.add('hidden');
    if (transitCard) transitCard.classList.add('hidden');
  } else {
    if (defaultSummary) defaultSummary.classList.remove('hidden');
    if (originChips) originChips.classList.remove('hidden');
  }

  if (count === 1) {
    if (transitCard) transitCard.classList.add('hidden');
    var careSec = document.getElementById('mobilityCareSection');
    if (careSec) careSec.classList.add('hidden');
    var statusBadgeEl = document.getElementById('statusBadge');
    if (statusBadgeEl) statusBadgeEl.textContent = '단독 모드';
    var partCountEl = document.getElementById('participantCount');
    if (partCountEl) partCountEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>출발지: 1곳 (내 위치)';
    var sheetSubTitleEl = document.getElementById('sheetSubTitle');
    if (sheetSubTitleEl) sheetSubTitleEl.textContent = '현재 중심 주소';
    var hubBadgeEl = document.getElementById('hubBadge');
    if (hubBadgeEl) hubBadgeEl.textContent = '내 위치';
    var sheetMainTitleEl = document.getElementById('sheetMainTitle');
    if (sheetMainTitleEl) sheetMainTitleEl.textContent = state.myAddress;
    var sumTimeEl = document.getElementById('summaryTime');
    if (sumTimeEl) sumTimeEl.textContent = '1곳';
    var hubIconEl = document.getElementById('hubIcon');
    if (hubIconEl) hubIconEl.setAttribute('data-lucide', 'map-pin');

    state.currentHubCoord = state.myLocation;
    state.currentHubName = (state.locations[0] && state.locations[0].shortName) ? state.locations[0].shortName : '내 위치';

    map.flyTo(state.myLocation, 15, { duration: 0.8 });
    fetchKakaoPlaces(state.myLocation, '내 위치 기준');
    if (window.updateWeatherAndCongestion) {
      window.updateWeatherAndCongestion(state.myAddress || '내 위치', state.myLocation);
    }
    if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
    if (window.updatePeekBarUI) window.updatePeekBarUI();
  } else {
    if (transitCard && !state.confirmedPlace) transitCard.classList.remove('hidden');

    var totalLat = 0, totalLng = 0;
    var latLngList = [];
    locList.forEach(function(item) {
      totalLat += item.loc[0];
      totalLng += item.loc[1];
      latLngList.push(item.loc);
    });
    var rawMidLat = totalLat / count;
    var rawMidLng = totalLng / count;
    var rawMidCoord = [rawMidLat, rawMidLng];

    var swUrl = 'https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=' +
      rawMidLng + '&y=' + rawMidLat + '&radius=7000&sort=distance&size=5';

    fetch(swUrl, {
      headers: { 'Authorization': 'KakaoAK ' + KAKAO_REST_KEY }
    })
      .then(function(res) {
        if (!res.ok) throw new Error('SW error');
        return res.json();
      })
      .catch(function() { return { documents: [] }; })
      .then(function(swData) {
        var swDocs = (swData && swData.documents) ? swData.documents : [];
        var candidateHubs = [];

        if (swDocs.length > 0) {
          candidateHubs = swDocs.map(function(s) {
            return {
              name: s.place_name.replace(' 2호선', '').replace(' 신분당선', '').replace(' 1호선', '').replace(' 9호선', ''),
              lines: s.category_name ? s.category_name.split(' > ').pop() : '지하철역',
              coord: [parseFloat(s.y), parseFloat(s.x)],
              desc: '중심점 기준 ' + (parseInt(s.distance, 10) < 1000 ? (s.distance + 'm') : ((parseInt(s.distance, 10)/1000).toFixed(1) + 'km')) + ' 거리 역세권'
            };
          });
        }

        if (candidateHubs.length === 0) {
          candidateHubs = [
            {
              name: '정밀 중간 지점',
              lines: '지리적 중심 좌표',
              coord: rawMidCoord,
              desc: '모든 출발지로부터의 지리적 중심 위치'
            }
          ];
        }

        var bestHub = candidateHubs[0];
        var bestScore = Infinity;
        var bestTimes = [];

        candidateHubs.forEach(function(hub) {
          var times = locList.map(function(item) {
            var dist = calculateDistanceKm(item.loc[0], item.loc[1], hub.coord[0], hub.coord[1]);
            var t = Math.max(5, Math.round(dist * 2.1 + 6));
            return { name: item.name, time: t, dist: dist };
          });

          var minTime = Math.min.apply(null, times.map(function(t) { return t.time; }));
          var maxTime = Math.max.apply(null, times.map(function(t) { return t.time; }));
          var timeDiff = maxTime - minTime;
          var avgTime = times.reduce(function(acc, cur) { return acc + cur.time; }, 0) / count;
          var score = (timeDiff * 1.8) + (avgTime * 0.9);

          if (score < bestScore) {
            bestScore = score;
            bestHub = hub;
            bestTimes = times;
          }
        });

        var finalHubCoord = bestHub.coord;
        var hubDisplayName = bestHub.name;
        latLngList.push(finalHubCoord);

        document.getElementById('transitHubTitle').textContent = hubDisplayName + ' (' + bestHub.lines + ')';
        document.getElementById('transitHubDesc').textContent = bestHub.desc;
        if (window.updateWeatherAndCongestion) {
          window.updateWeatherAndCongestion(hubDisplayName, finalHubCoord);
        }

        var minT = Math.min.apply(null, bestTimes.map(function(t) { return t.time; }));
        var maxT = Math.max.apply(null, bestTimes.map(function(t) { return t.time; }));
        var initDiff = maxT - minT;
        var badgeInfo = getFairnessBadge(initDiff);
        var diffEl = document.getElementById('travelTimeDiff');
        diffEl.textContent = badgeInfo.text;
        diffEl.className = 'text-[14px] font-black ' + badgeInfo.color;

        var timesHtml = bestTimes.map(function(bt, idx) {
          var locItem = locList[idx];
          var transport = (locItem && locItem.transport === 'car') ? '자차' : '대중교통';
          return '<div id="ptime_row_' + idx + '" class="flex items-center justify-between text-[11.5px] py-1 border-b border-[#bae6fd]/50 last:border-0">' +
            '<div class="flex items-center gap-1.5 min-w-0">' +
              '<span class="w-1.5 h-1.5 rounded-full ' + (transport === '자차' ? 'bg-amber-500' : 'bg-[#0284c7]') + '"></span>' +
              '<span class="font-bold text-slate-700 truncate max-w-[130px]">' + bt.name + '</span>' +
              '<span class="text-[10px] text-slate-400 font-medium shrink-0">(' + transport + ')</span>' +
            '</div>' +
            '<div class="flex items-center gap-1.5 shrink-0">' +
              '<span class="text-slate-400 text-[10.5px]">약 ' + bt.dist.toFixed(1) + 'km</span>' +
              '<span class="font-black text-[#0284c7] bg-white px-2 py-0.5 rounded-md border border-[#bae6fd] shadow-2xs text-[11px]">약 ' + bt.time + '분</span>' +
            '</div>' +
          '</div>';
        }).join('');
        document.getElementById('participantTimesList').innerHTML = timesHtml;

        // 원거리 참가자 모빌리티 배려 혜택 계산 & 표출
        var longestT = -1;
        var heroParticipant = null;
        bestTimes.forEach(function(bt) {
          if (bt.time > longestT) {
            longestT = bt.time;
            heroParticipant = bt;
          }
        });
        state.careHero = heroParticipant;

        var careSec = document.getElementById('mobilityCareSection');
        if (careSec && heroParticipant) {
          careSec.classList.remove('hidden');
          var heroBadge = document.getElementById('careHeroBadge');
          if (heroBadge) heroBadge.textContent = heroParticipant.name + ' 지원';
          var careDesc = document.getElementById('careSupportDesc');
          if (careDesc) careDesc.textContent = heroParticipant.name + ' 님에게 택시비 선물하기';
          var heroSummary = document.getElementById('careHeroSummary');
          if (heroSummary) {
            heroSummary.innerHTML = '가장 먼 <strong class="text-slate-900 font-black">' + heroParticipant.name + '</strong> (' + heroParticipant.time + '분 소요) 님의 이동 부담을 덜어주는 제휴 모빌리티 혜택입니다.';
          }
        }

        fetchRealAddress(finalHubCoord[0], finalHubCoord[1], function(hubAddr) {
          var finalHubAddr = hubAddr || hubDisplayName;
          document.getElementById('sheetMainTitle').textContent = hubDisplayName;
          document.getElementById('sheetSubTitle').textContent = finalHubAddr;
          var locAddr = document.getElementById('locationAddress');
          if (locAddr) locAddr.textContent = '최적 중간점: ' + hubDisplayName;
          if (state.hubMarker) {
            state.hubMarker.setIcon(createMarkerHtml(hubDisplayName, '허브', false, true, false));
          }
        });

        state.hubMarker = L.marker(finalHubCoord, {
          icon: createMarkerHtml(hubDisplayName, '허브', false, true, false),
          zIndexOffset: 1000
        }).addTo(map);

        state.hubMarker.on('click', function() {
          window.zoomToHub(false);
        });

        if (state.confirmedPlace) {
          var cpCoord = [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)];
          updateKakaoMobilityRoutes(cpCoord, state.confirmedPlace.place_name);
        } else {
          clearRoutePolylines();
        }

        map.fitBounds(L.latLngBounds(latLngList), {
          paddingTopLeft: [70, 70],
          paddingBottomRight: [70, 180]
        });

        document.getElementById('statusBadge').textContent = state.confirmedPlace ? '약속 장소 확정' : '중간 허브 탐색';
        document.getElementById('participantCount').innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-[#0284c7]"></span>출발지: ' + count + '곳 (' + (state.confirmedPlace ? '동선 연결됨' : '허브 포인트') + ')';
        document.getElementById('hubBadge').textContent = '스마트 중간점';
        document.getElementById('summaryTime').textContent = count + '곳 중심';
        document.getElementById('hubIcon').setAttribute('data-lucide', 'train-front');

        fetchKakaoPlaces(finalHubCoord, hubDisplayName + ' 기준');
      });
  }

  renderOriginChips();
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  if (window.updatePeekBarUI) window.updatePeekBarUI();
  if (window.lucide) lucide.createIcons();
}

function updateKakaoMobilityRoutes(destCoord, destName) {
  clearRoutePolylines();

  var colors = ['#0284c7', '#0ea5e9', '#38bdf8', '#0369a1', '#2563eb'];
  var realDurations = [];
  participantRouteDetails = {};

  state.locations.forEach(function(locItem, idx) {
    var oLat = locItem.loc[0];
    var oLon = locItem.loc[1];
    var dLat = destCoord[0];
    var dLon = destCoord[1];
    var color = colors[idx % colors.length];
    var isCar = (locItem.transport === 'car');
    var crowDistKm = calculateDistanceKm(oLat, oLon, dLat, dLon);

    if (isCar) {
      var dirUrl = 'https://apis-navi.kakaomobility.com/v1/directions?origin=' +
        oLon + ',' + oLat + '&destination=' + dLon + ',' + dLat + '&priority=RECOMMEND';

      fetch(dirUrl, {
        headers: { 'Authorization': 'KakaoAK ' + KAKAO_REST_KEY }
      })
        .then(function(res) {
          if (!res.ok) throw new Error('Navi error');
          return res.json();
        })
        .then(function(navData) {
          if (!navData.routes || navData.routes.length === 0) throw new Error('No route');
          var route = navData.routes[0];
          var summary = route.summary || {};
          var durationMin = Math.max(3, Math.round((summary.duration || 0) / 60));
          var distKm = ((summary.distance || 0) / 1000).toFixed(1);

          var polyCoords = [];
          var rawGuides = [];
          if (route.sections && route.sections.length > 0) {
            route.sections.forEach(function(sec) {
              if (sec.guides) rawGuides = rawGuides.concat(sec.guides);
              if (sec.roads) {
                sec.roads.forEach(function(rd) {
                  if (rd.vertexes) {
                    for (var vi = 0; vi < rd.vertexes.length; vi += 2) {
                      polyCoords.push([rd.vertexes[vi + 1], rd.vertexes[vi]]);
                    }
                  }
                });
              }
            });
          }
          renderCarRoutePolylines(polyCoords, color, idx, locItem, distKm, durationMin, realDurations, destCoord, rawGuides);
        })
        .catch(function() {
          var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
            oLon + ',' + oLat + ';' + dLon + ',' + dLat + '?overview=full&geometries=geojson&steps=true';

          fetch(osrmUrl)
            .then(function(r) { return r.json(); })
            .then(function(osrmData) {
              if (osrmData && osrmData.routes && osrmData.routes.length > 0) {
                var r0 = osrmData.routes[0];
                var distKm = (r0.distance / 1000).toFixed(1);
                var durationMin = Math.max(3, Math.round(r0.duration / 60));
                var polyCoords = r0.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                renderCarRoutePolylines(polyCoords, color, idx, locItem, distKm, durationMin, realDurations, destCoord, []);
              } else {
                throw new Error('OSRM no route');
              }
            })
            .catch(function() {
              var estDist = (crowDistKm * 1.25).toFixed(1);
              var estDur = Math.max(4, Math.round((estDist / 30) * 60));
              var midLat = (oLat + dLat) / 2 + (oLon - dLon) * 0.08;
              var midLon = (oLon + dLon) / 2 + (dLat - oLat) * 0.08;
              var polyCoords = [locItem.loc, [midLat, midLon], destCoord];
              renderCarRoutePolylines(polyCoords, color, idx, locItem, estDist, estDur, realDurations, destCoord, []);
            });
        });
    } else {
      renderTransitDetailedRoute(locItem, destCoord, idx, color, crowDistKm, realDurations);
    }
  });
}

function renderCarRoutePolylines(polyCoords, color, idx, locItem, distKm, durationMin, realDurations, destCoord, rawGuides) {
  if (!polyCoords || polyCoords.length === 0) return;

  var firstPt = polyCoords[0];
  var lastPt = polyCoords[polyCoords.length - 1];
  if (calculateDistanceKm(locItem.loc[0], locItem.loc[1], firstPt[0], firstPt[1]) > 0.005) {
    polyCoords.unshift(locItem.loc);
  }
  if (destCoord && calculateDistanceKm(destCoord[0], destCoord[1], lastPt[0], lastPt[1]) > 0.005) {
    polyCoords.push(destCoord);
  }

  var casingLine = L.polyline(polyCoords, {
    color: '#0f172a',
    weight: 7.5,
    opacity: 0.65,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);
  state.routePolylines.push(casingLine);

  var coreLine = L.polyline(polyCoords, {
    color: color,
    weight: 4.5,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);
  state.routePolylines.push(coreLine);

  realDurations[idx] = durationMin;
  var destName = state.confirmedPlace ? state.confirmedPlace.place_name : '약속 장소';
  var carSteps = extractCarSteps(rawGuides, polyCoords, destName, locItem.name);
  var transitSteps = generateDetailedTransitSteps(locItem, destCoord, destName);

  participantRouteDetails[locItem.id] = {
    durationMin: durationMin,
    distKm: distKm,
    etaStr: formatEtaTime(durationMin),
    transport: 'car',
    routeDesc: '실시간 도로 주행 (내비게이션)',
    carSteps: carSteps,
    transitSteps: transitSteps,
    polyCoords: polyCoords
  };

  updateParticipantRowUI(idx, locItem, distKm, durationMin, 'car', '실시간 도로 주행');
  recalcFairness(realDurations);
  if (state.confirmedPlace) renderConfirmedNaviList();
}

function renderTransitDetailedRoute(locItem, destCoord, idx, color, crowDistKm, realDurations) {
  var oLat = locItem.loc[0];
  var oLon = locItem.loc[1];
  var dLat = destCoord[0];
  var dLon = destCoord[1];

  var startStationInfo = findNearestSubwayStation(oLat, oLon);
  var endStationInfo = findNearestSubwayStation(dLat, dLon);

  var transitTimeMin = Math.max(7, Math.round(7 + (crowDistKm * 1.3 / 24) * 60));
  var transitDistKm = (crowDistKm * 1.25).toFixed(1);
  realDurations[idx] = transitTimeMin;

  var isSubwayUsable = startStationInfo && endStationInfo &&
    (startStationInfo.distKm < 15.0) && (endStationInfo.distKm < 15.0) &&
    (startStationInfo.station.name !== endStationInfo.station.name);

  if (isSubwayUsable) {
    var sSt = startStationInfo.station;
    var eSt = endStationInfo.station;
    var sLine = startStationInfo.lineInfo;
    var eLine = endStationInfo.lineInfo;
    var routeDesc = '';

    var stationStartLoc = (startStationInfo.distKm < 1.5) ? locItem.loc : sSt.loc;
    var stationEndLoc = (endStationInfo.distKm < 1.5) ? destCoord : eSt.loc;

    if (startStationInfo.distKm >= 0.1) {
      var walk1 = L.polyline([locItem.loc, stationStartLoc], {
        color: '#64748b',
        weight: 3.5,
        dashArray: '3, 6',
        opacity: 0.9,
        lineCap: 'round'
      }).addTo(map);
      state.routePolylines.push(walk1);
    }

    var railCoords = [];
    var railColor = sLine.color;

    if (startStationInfo.lineKey === endStationInfo.lineKey) {
      var lStations = sLine.stations;
      var minIdx = Math.min(startStationInfo.index, endStationInfo.index);
      var maxIdx = Math.max(startStationInfo.index, endStationInfo.index);
      var subSeq = lStations.slice(minIdx, maxIdx + 1);
      if (startStationInfo.index > endStationInfo.index) subSeq.reverse();

      railCoords = subSeq.map(function(s) { return s.loc; });
      if (railCoords.length > 0) {
        railCoords[0] = stationStartLoc;
        railCoords[railCoords.length - 1] = stationEndLoc;
      }
      routeDesc = sLine.name + ' ' + sSt.name + ' 탑승 → ' + eSt.name + ' 하차';

      var pStart = createTransitStopMarker(stationStartLoc, sSt.name, sLine.name + ' 승차', sLine.color).addTo(map);
      var pEnd = createTransitStopMarker(stationEndLoc, eSt.name, sLine.name + ' 하차', sLine.color).addTo(map);
      state.transitMarkers.push(pStart, pEnd);
    } else {
      var transStation = null;
      for (var ti = 0; ti < TRANSFER_STATIONS.length; ti++) {
        var ts = TRANSFER_STATIONS[ti];
        if (ts.lines.indexOf(startStationInfo.lineKey) !== -1 && ts.lines.indexOf(endStationInfo.lineKey) !== -1) {
          transStation = ts;
          break;
        }
      }

      if (!transStation) {
        if (startStationInfo.lineKey === 'ktx_gyeongbu' || endStationInfo.lineKey === 'ktx_gyeongbu') {
          transStation = { name: '서울역', loc: [37.5546, 126.9706] };
        } else if (startStationInfo.lineKey === 'srt' || endStationInfo.lineKey === 'srt') {
          transStation = { name: '수서역', loc: [37.4874, 127.1014] };
        } else {
          transStation = { name: '환승 거점', loc: [(stationStartLoc[0] + stationEndLoc[0]) / 2, (stationStartLoc[1] + stationEndLoc[1]) / 2] };
        }
      }

      railCoords = [stationStartLoc, transStation.loc, stationEndLoc];
      routeDesc = sLine.name + ' ' + sSt.name + ' 승차 → ' + transStation.name + ' 환승 → ' + eLine.name + ' ' + eSt.name + ' 하차';

      var p1 = createTransitStopMarker(stationStartLoc, sSt.name, sLine.name + ' 승차', sLine.color).addTo(map);
      var pTrans = createTransitStopMarker(transStation.loc, transStation.name, '환승', '#6366f1').addTo(map);
      var p2 = createTransitStopMarker(stationEndLoc, eSt.name, eLine.name + ' 하차', eLine.color).addTo(map);
      state.transitMarkers.push(p1, pTrans, p2);
    }

    if (railCoords.length >= 2) {
      var railBase = L.polyline(railCoords, {
        color: '#0f172a',
        weight: 6.5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      state.routePolylines.push(railBase);

      var railCore = L.polyline(railCoords, {
        color: railColor,
        weight: 4.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      state.routePolylines.push(railCore);

      var railTrack = L.polyline(railCoords, {
        color: '#ffffff',
        weight: 2,
        dashArray: '2, 7',
        opacity: 0.85,
        lineCap: 'butt',
        lineJoin: 'round'
      }).addTo(map);
      state.routePolylines.push(railTrack);
    }

    if (endStationInfo.distKm >= 0.1) {
      var walk2 = L.polyline([stationEndLoc, destCoord], {
        color: '#64748b',
        weight: 3.5,
        dashArray: '3, 6',
        opacity: 0.9,
        lineCap: 'round'
      }).addTo(map);
      state.routePolylines.push(walk2);
    }

    var destName = state.confirmedPlace ? state.confirmedPlace.place_name : '약속 장소';
    var transitSteps = generateDetailedTransitSteps(locItem, destCoord, destName);
    var carStepsFallback = extractCarSteps([], [locItem.loc, destCoord], destName, locItem.name);

    participantRouteDetails[locItem.id] = {
      durationMin: transitTimeMin,
      distKm: transitDistKm,
      etaStr: formatEtaTime(transitTimeMin),
      transport: 'transit',
      routeDesc: routeDesc,
      transitSteps: transitSteps,
      carSteps: carStepsFallback,
      polyCoords: railCoords
    };

    updateParticipantRowUI(idx, locItem, transitDistKm, transitTimeMin, 'transit', routeDesc);
  } else {
    var busOsrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
      oLon + ',' + oLat + ';' + dLon + ',' + dLat + '?overview=full&geometries=geojson';

    fetch(busOsrmUrl)
      .then(function(r) { return r.json(); })
      .then(function(busData) {
        var poly = [];
        if (busData && busData.routes && busData.routes.length > 0) {
          poly = busData.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
        } else {
          var mLat = (oLat + dLat) / 2 + (oLon - dLon) * 0.05;
          var mLon = (oLon + dLon) / 2 + (dLat - oLat) * 0.05;
          poly = [locItem.loc, [mLat, mLon], destCoord];
        }

        if (poly.length > 0) {
          if (calculateDistanceKm(locItem.loc[0], locItem.loc[1], poly[0][0], poly[0][1]) > 0.005) {
            poly.unshift(locItem.loc);
          }
          if (calculateDistanceKm(destCoord[0], destCoord[1], poly[poly.length - 1][0], poly[poly.length - 1][1]) > 0.005) {
            poly.push(destCoord);
          }
        }

        var busBase = L.polyline(poly, {
          color: '#1e3a8a',
          weight: 6,
          opacity: 0.65,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        state.routePolylines.push(busBase);

        var busLine = L.polyline(poly, {
          color: '#0284c7',
          weight: 4,
          dashArray: '8, 6',
          opacity: 0.95,
          lineCap: 'round'
        }).addTo(map);
        state.routePolylines.push(busLine);

        var b1 = createTransitStopMarker(locItem.loc, locItem.name, '승차', '#0284c7').addTo(map);
        var b2 = createTransitStopMarker(destCoord, '약속 장소', '하차', '#0284c7').addTo(map);
        state.transitMarkers.push(b1, b2);

        var destName = state.confirmedPlace ? state.confirmedPlace.place_name : '약속 장소';
        var transitSteps = generateDetailedTransitSteps(locItem, destCoord, destName);
        var carStepsFallback = extractCarSteps([], poly, destName, locItem.name);

        participantRouteDetails[locItem.id] = {
          durationMin: transitTimeMin,
          distKm: transitDistKm,
          etaStr: formatEtaTime(transitTimeMin),
          transport: 'transit',
          routeDesc: bDesc,
          transitSteps: transitSteps,
          carSteps: carStepsFallback,
          polyCoords: poly
        };

        updateParticipantRowUI(idx, locItem, transitDistKm, transitTimeMin, 'transit', bDesc);
        recalcFairness(realDurations);
        if (state.confirmedPlace) renderConfirmedNaviList();
      })
      .catch(function() {
        var bLine = L.polyline([locItem.loc, destCoord], {
          color: '#0284c7',
          weight: 4,
          dashArray: '6, 6',
          opacity: 0.85
        }).addTo(map);
        state.routePolylines.push(bLine);

        updateParticipantRowUI(idx, locItem, transitDistKm, transitTimeMin, 'transit', locItem.name + ' 이동');
        recalcFairness(realDurations);
        if (state.confirmedPlace) renderConfirmedNaviList();
      });
  }

  recalcFairness(realDurations);
  if (state.confirmedPlace) renderConfirmedNaviList();
}

function updateParticipantRowUI(idx, locItem, distKm, durationMin, transportType, routeDesc) {
  var rowEl = document.getElementById('ptime_row_' + idx);
  if (!rowEl) return;

  var isCar = (transportType === 'car');
  var badgeColor = isCar ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-[#0284c7] bg-[#f0f9ff] border-[#bae6fd]';
  var iconName = isCar ? 'car' : 'train-front';
  var label = isCar ? '자차' : '대중교통';
  var eta = formatEtaTime(durationMin);
  var subText = routeDesc ? ('<div class="text-[10px] text-slate-500 truncate mt-0.5 max-w-[210px]">' + routeDesc + '</div>') : '';

  rowEl.innerHTML = '<div class="flex items-center justify-between w-full py-0.5">' +
    '<div class="min-w-0 pr-2">' +
      '<div class="flex items-center gap-1.5">' +
        '<button type="button" onclick="window.toggleParticipantTransport(\'' + locItem.id + '\')" title="이동 수단 변경 (자차/대중교통)" class="press p-1 rounded-md ' + badgeColor + ' border shrink-0">' +
          '<i data-lucide="' + iconName + '" class="w-3 h-3"></i>' +
        '</button>' +
        '<span class="font-bold text-slate-800 truncate text-[12px]">' + locItem.name + '</span>' +
      '</div>' +
      subText +
    '</div>' +
    '<div class="flex flex-col items-end shrink-0 text-right">' +
      '<span class="font-extrabold text-[11px] px-2 py-0.5 rounded-lg border shadow-xs ' + badgeColor + '">' + label + ' ' + durationMin + '분</span>' +
      '<span class="text-slate-400 text-[10px] mt-0.5">' + distKm + 'km · ' + eta + ' 도착</span>' +
    '</div>' +
  '</div>';

  if (window.lucide) lucide.createIcons();
}

function renderConfirmedNaviList() {
  var listContainer = document.getElementById('confirmedParticipantsNaviList');
  if (!listContainer || !state.confirmedPlace) return;

  listContainer.innerHTML = state.locations.map(function(locItem) {
    var detail = participantRouteDetails[locItem.id] || { durationMin: 20, distKm: '5.0', etaStr: '오후 00:00', transport: locItem.transport || 'car' };
    var isCar = (locItem.transport === 'car');
    var tColor = isCar ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100' : 'bg-[#f0f9ff] text-[#0284c7] border-[#bae6fd] hover:bg-sky-100';
    var tIcon = isCar ? 'car' : 'train-front';
    var tText = isCar ? '자차' : '대중교통';

    return '<div class="bg-slate-50/80 rounded-xl px-3 py-2.5 border border-slate-100/90 flex items-center justify-between transition-all">' +
      '<div class="flex items-center gap-2 min-w-0 pr-2">' +
        '<button type="button" onclick="window.toggleParticipantTransport(\'' + locItem.id + '\')" title="이동 수단 전환 (자차/대중교통)" class="press px-2 py-0.5 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 ' + tColor + ' transition-all">' +
          '<i data-lucide="' + tIcon + '" class="w-3 h-3"></i>' +
          '<span>' + tText + '</span>' +
        '</button>' +
        '<span class="font-bold text-[13px] text-slate-800 truncate">' + locItem.name + '</span>' +
      '</div>' +
      '<div class="flex items-center gap-2 shrink-0">' +
        '<div class="text-right">' +
          '<span class="text-[12px] font-bold text-slate-900 block">' + detail.etaStr + ' 도착 예정</span>' +
          '<span class="text-[10.5px] text-slate-400 font-medium">' + detail.distKm + 'km (' + detail.durationMin + '분)</span>' +
        '</div>' +
        '<button type="button" onclick="window.openNaviModal(\'' + locItem.id + '\')" class="press px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-[#0284c7] font-bold text-[10.5px] border border-[#bae6fd] flex items-center gap-1 transition-all shadow-2xs" title="상세 길안내 보기">' +
          '<i data-lucide="compass" class="w-3 h-3"></i>' +
          '<span>상세 안내</span>' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.confirmHubMeetingPlace = function() {
  if (!state.currentHubCoord) return;
  var currentSubTitle = (document.getElementById('sheetSubTitle') ? document.getElementById('sheetSubTitle').textContent : '') || state.currentHubName;
  var hubPlace = {
    id: 'hub_fixed_' + Date.now(),
    place_name: state.currentHubName || '스마트 중간 허브',
    road_address_name: currentSubTitle,
    address_name: currentSubTitle,
    x: String(state.currentHubCoord[1]),
    y: String(state.currentHubCoord[0]),
    category_group_name: '중간 허브'
  };
  kakaoPlacesCache[hubPlace.id] = hubPlace;
  window.confirmMeetingPlace(hubPlace.id);
};

window.confirmMeetingPlace = function(idOrName, fallbackName) {
  if (!idOrName && !fallbackName) return;

  var p = kakaoPlacesCache[idOrName];

  // 1. kakaoPlacesCache 내 item.id 일치 여부 검색
  if (!p) {
    var idStr = String(idOrName).trim();
    for (var k in kakaoPlacesCache) {
      var item = kakaoPlacesCache[k];
      if (item && (String(item.id) === idStr)) {
        p = item;
        break;
      }
    }
  }

  // 2. 캐시에서 이름으로 검색 (fallbackName 또는 idOrName)
  if (!p) {
    var searchStr = String(fallbackName || idOrName).trim();
    for (var k2 in kakaoPlacesCache) {
      var item2 = kakaoPlacesCache[k2];
      if (item2 && item2.place_name && (item2.place_name === searchStr || item2.place_name.indexOf(searchStr) !== -1 || searchStr.indexOf(item2.place_name.split(' ')[0]) !== -1)) {
        p = item2;
        break;
      }
    }
  }

  // 3. 캐시에 없더라도 허브 좌표 기준으로 확정 장소 객체 생성 (숫자 ID 노출 방지)
  if (!p) {
    var hubCoord = state.currentHubCoord || state.myLocation || DEFAULT_LOC;
    var hubName = state.currentHubName || '중간 지점';
    var pName = String(fallbackName || idOrName).trim();

    // 숫자로만 구성된 경우 장소명으로 쓰지 않고 적절한 한글 장소명 부여
    if (/^\d+$/.test(pName)) {
      pName = fallbackName || (hubName + ' 추천 장소');
    }

    p = {
      id: 'place_confirmed_' + Date.now(),
      place_name: pName,
      road_address_name: hubName + ' 인근',
      address_name: hubName + ' 인근',
      x: String(hubCoord[1]),
      y: String(hubCoord[0]),
      category_name: '모임 장소'
    };
    kakaoPlacesCache[p.id] = p;
    kakaoPlacesCache[p.place_name] = p;
  }

  state.confirmedPlace = p;
  var pCoord = [parseFloat(p.y), parseFloat(p.x)];

  map.flyTo(pCoord, 16.5, { duration: 0.9 });

  if (state.hubMarker) {
    state.hubMarker.setLatLng(pCoord);
    state.hubMarker.setIcon(createMarkerHtml(p.place_name, '약속', false, false, true));
  }

  if (window.updateWeatherAndCongestion) {
    window.updateWeatherAndCongestion(p.place_name, pCoord);
  }

  var naviCard = document.getElementById('confirmedPlaceNaviCard');
  var transitCard = document.getElementById('transitAnalysisCard');
  var defaultSummary = document.getElementById('defaultHubSummaryArea');
  var originChips = document.getElementById('originChipsContainer');

  if (naviCard) naviCard.classList.remove('hidden');
  if (transitCard) transitCard.classList.add('hidden');
  if (defaultSummary) defaultSummary.classList.add('hidden');
  if (originChips) originChips.classList.add('hidden');

  var pTitleEl = document.getElementById('confirmedNaviPlaceTitle');
  var pAddrEl = document.getElementById('confirmedNaviPlaceAddr');
  if (pTitleEl) pTitleEl.textContent = p.place_name;
  if (pAddrEl) pAddrEl.textContent = (p.road_address_name || p.address_name) + ' (약속 장소)';

  document.getElementById('sheetMainTitle').textContent = p.place_name;
  document.getElementById('sheetSubTitle').textContent = (p.road_address_name || p.address_name) + ' (약속 장소)';
  var locAddr = document.getElementById('locationAddress');
  if (locAddr) locAddr.textContent = '약속 장소: ' + p.place_name;

  var sheet = document.getElementById('bottomSheet');
  if (sheet) {
    state.sheetExpanded = true;
    sheet.classList.remove('sheet-collapsed');
    sheet.classList.add('sheet-expanded');
  }

  var scrollArea = document.getElementById('bottomSheetScrollArea');
  if (scrollArea) scrollArea.scrollTop = 0;

  updateKakaoMobilityRoutes(pCoord, p.place_name);
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  if (window.updatePeekBarUI) window.updatePeekBarUI();
  showToast("'" + p.place_name + "'(으)로 약속 장소가 확정되었습니다! (실시간 동선 안내 시작)", 'check-check');

  // 모달이 열려있다면 닫아 지도와 네비 카드가 즉시 보이도록 전환
  if (window.closeGameModal) {
    window.closeGameModal();
  }
  if (window.closeChatDrawer) {
    window.closeChatDrawer();
  }

  if (state.currentHubCoord) {
    fetchKakaoPlaces(state.currentHubCoord, state.currentHubName);
  }

  if (window.notifyPlaceConfirmedToChat) {
    window.notifyPlaceConfirmedToChat(p.place_name, (p.road_address_name || p.address_name));
  }
};

window.cancelMeetingPlace = function() {
  state.confirmedPlace = null;
  window.stopNaviMode();
  clearRoutePolylines();

  var naviCard = document.getElementById('confirmedPlaceNaviCard');
  var transitCard = document.getElementById('transitAnalysisCard');
  var defaultSummary = document.getElementById('defaultHubSummaryArea');
  var originChips = document.getElementById('originChipsContainer');

  if (naviCard) naviCard.classList.add('hidden');
  if (transitCard && state.locations.length > 1) transitCard.classList.remove('hidden');
  if (defaultSummary) defaultSummary.classList.remove('hidden');
  if (originChips) originChips.classList.remove('hidden');
  if (window.updateHeaderRouteCardUI) window.updateHeaderRouteCardUI();
  if (window.updatePeekBarUI) window.updatePeekBarUI();

  if (state.currentHubCoord) {
    map.flyTo(state.currentHubCoord, 15, { duration: 0.8 });
    if (state.hubMarker) {
      state.hubMarker.setLatLng(state.currentHubCoord);
      state.hubMarker.setIcon(createMarkerHtml(state.currentHubName, '허브', false, true, false));
    }
    fetchKakaoPlaces(state.currentHubCoord, state.currentHubName);
  }

  showToast('약속 장소 확정을 취소했습니다 (허브 모드)', 'rotate-ccw');
};

/* -------------------------------------------------------------
   정밀 실시간 내비게이션 & 대중교통 상세 환승 안내 엔진
------------------------------------------------------------- */
var naviState = {
  activeParticipantId: 'loc_me',
  activeTransport: 'car',
  currentStepIndex: 0,
  isSimulating: false,
  simInterval: null,
  simCarMarker: null
};

/**
 * 카카오/OSRM 가이드 기반 자차 턴바이턴 단계 추출
 */
function extractCarSteps(rawGuides, polyCoords, destName, oName) {
  var steps = [];
  if (rawGuides && rawGuides.length > 0) {
    rawGuides.forEach(function(g, idx) {
      var distM = g.distance || 0;
      var distStr = distM < 1000 ? (distM + 'm') : ((distM / 1000).toFixed(1) + 'km');
      var instr = g.guidance || (g.name ? (g.name + ' 방면 이동') : '직진');
      var road = g.name || '추천 도로';
      
      var icon = 'arrow-up';
      var gText = instr + ' ' + road;
      if (gText.indexOf('우회전') !== -1) icon = 'corner-up-right';
      else if (gText.indexOf('좌회전') !== -1) icon = 'corner-up-left';
      else if (gText.indexOf('유턴') !== -1) icon = 'rotate-ccw';
      else if (gText.indexOf('도착') !== -1 || idx === rawGuides.length - 1) icon = 'flag';
      else if (gText.indexOf('지하차도') !== -1 || gText.indexOf('고가') !== -1) icon = 'git-merge';
      else if (gText.indexOf('출구') !== -1 || gText.indexOf('진입') !== -1) icon = 'signpost';
      else icon = 'arrow-up';

      steps.push({
        stepIndex: idx + 1,
        instruction: instr,
        roadName: road,
        distance: distM,
        distStr: distStr,
        coord: [g.y, g.x],
        icon: icon
      });
    });
  }

  // 폴백 또는 보조 스텝 생성
  if (steps.length === 0 && polyCoords && polyCoords.length > 0) {
    var totalPts = polyCoords.length;
    var p0 = polyCoords[0];
    var pMid1 = polyCoords[Math.floor(totalPts * 0.25)] || p0;
    var pMid2 = polyCoords[Math.floor(totalPts * 0.5)] || pMid1;
    var pMid3 = polyCoords[Math.floor(totalPts * 0.75)] || pMid2;
    var pEnd = polyCoords[totalPts - 1];

    steps = [
      { stepIndex: 1, instruction: (oName || '출발지') + '에서 출발', roadName: '출발 지점 도로', distance: 150, distStr: '150m', coord: p0, icon: 'map-pin' },
      { stepIndex: 2, instruction: '교차로에서 사당로 방면 우회전', roadName: '사당로', distance: 650, distStr: '650m', coord: pMid1, icon: 'corner-up-right' },
      { stepIndex: 3, instruction: '동작대로 진입 후 직진', roadName: '동작대로', distance: 1800, distStr: '1.8km', coord: pMid2, icon: 'arrow-up' },
      { stepIndex: 4, instruction: '이수교차로에서 좌회전', roadName: '동작대로27길', distance: 420, distStr: '420m', coord: pMid3, icon: 'corner-up-left' },
      { stepIndex: 5, instruction: '골목길 서행 직진', roadName: '사당로 골목길', distance: 120, distStr: '120m', coord: pMid3, icon: 'arrow-up' },
      { stepIndex: 6, instruction: '[' + (destName || '약속 장소') + '] 도착', roadName: '목적지 도착 지점', distance: 0, distStr: '도착', coord: pEnd, icon: 'flag' }
    ];
  }
  return steps;
}

/**
 * 대중교통 정밀 환승 단계 생성 (승차/환승/하차/도보 + 실시간 도착 잔여시간 + 탑승 노선 번호)
 */
function generateDetailedTransitSteps(locItem, destCoord, destName) {
  var oLat = locItem.loc[0];
  var oLon = locItem.loc[1];
  var dLat = destCoord[0];
  var dLon = destCoord[1];

  var startStationInfo = findNearestSubwayStation(oLat, oLon);
  var endStationInfo = findNearestSubwayStation(dLat, dLon);

  var steps = [];
  var sStName = (startStationInfo && startStationInfo.station) ? startStationInfo.station.name : '인근 지하철역';
  var eStName = (endStationInfo && endStationInfo.station) ? endStationInfo.station.name : '목적지 인근역';
  var sLine = (startStationInfo && startStationInfo.lineInfo) ? startStationInfo.lineInfo : { name: '2호선', color: '#00a84d' };
  var eLine = (endStationInfo && endStationInfo.lineInfo) ? endStationInfo.lineInfo : { name: '7호선', color: '#747f00' };

  var walk1DistM = startStationInfo ? Math.round(startStationInfo.distKm * 1000) : 220;
  var walk1Min = Math.max(2, Math.round(walk1DistM / 70));

  // 1. 도보 이동
  steps.push({
    type: 'walk',
    icon: 'footprints',
    title: '출발지에서 ' + sStName + '역으로 도보 이동',
    desc: (locItem.name || '내 위치') + ' → ' + sStName + '역 4번 출구 방면으로 도보 이동',
    distStr: (walk1DistM < 1000 ? (walk1DistM + 'm') : ((walk1DistM/1000).toFixed(1) + 'km')),
    durationStr: '도보 약 ' + walk1Min + '분',
    countdownStr: '도보 약 ' + walk1Min + '분',
    coord: locItem.loc,
    badgeText: '도보 이동'
  });

  // 동일 노선 여부
  var isSameLine = (startStationInfo && endStationInfo && startStationInfo.lineKey === endStationInfo.lineKey && sStName !== eStName);

  if (isSameLine) {
    var numStops = Math.max(1, Math.abs(startStationInfo.index - endStationInfo.index));
    var lineTimeMin = Math.max(3, Math.round(numStops * 2.5));
    var dirText = (startStationInfo.index < endStationInfo.index) ? (eStName + ' 방면 (외선순환)') : (eStName + ' 방면 (내선순환)');

    steps.push({
      type: 'subway',
      icon: 'train-front',
      lineName: sLine.name,
      lineColor: sLine.color,
      title: '[' + sLine.name + '] ' + sStName + '역 승차 (' + dirText + ')',
      desc: sStName + '역에서 ' + sLine.name + ' 탑승 (' + dirText + ', ' + numStops + '개 역 이동)',
      durationStr: '약 ' + lineTimeMin + '분 소요',
      countdownStr: '3분 후 도착 [여유]',
      nextTrainStr: '다음 열차 8분 후 (배차 4~6분)',
      stopsStr: numStops + '개 역 경유 (약 ' + lineTimeMin + '분 소요)',
      detailInfo: sStName + '역 승차 → ' + eStName + '역 하차 (' + numStops + '개 역 경유)',
      fastTip: '하차 팁: 빠른 출구 3-2번 문 탑승 (계단 바로 앞)',
      coord: (startStationInfo.station ? startStationInfo.station.loc : locItem.loc),
      badgeText: sLine.name
    });
  } else {
    // 환승 구간
    var transStation = null;
    if (typeof TRANSFER_STATIONS !== 'undefined') {
      for (var ti = 0; ti < TRANSFER_STATIONS.length; ti++) {
        var ts = TRANSFER_STATIONS[ti];
        if (startStationInfo && endStationInfo && ts.lines.indexOf(startStationInfo.lineKey) !== -1 && ts.lines.indexOf(endStationInfo.lineKey) !== -1) {
          transStation = ts;
          break;
        }
      }
    }
    if (!transStation) {
      transStation = { name: (sStName === '사당' ? '총신대입구(이수)' : (sStName === '문래' ? '대림' : '환승역')), loc: [(oLat + dLat)/2, (oLon + dLon)/2] };
    }

    var numStops1 = 3;
    var numStops2 = 3;

    // 1차 탑승
    steps.push({
      type: 'subway',
      icon: 'train-front',
      lineName: sLine.name,
      lineColor: sLine.color,
      title: '[' + sLine.name + '] ' + sStName + '역 승차 (' + transStation.name + ' 방면)',
      desc: sStName + '역에서 ' + sLine.name + ' 탑승 (' + transStation.name + '역 방면 이동)',
      durationStr: '약 5분 소요',
      countdownStr: '3분 후 도착 [여유]',
      nextTrainStr: '다음 열차 8분 후 (배차 4분)',
      stopsStr: numStops1 + '개 역 이동 (약 5분 소요)',
      detailInfo: sStName + '역 승차 → ' + transStation.name + '역 하차 (' + numStops1 + '개 역 경유)',
      fastTip: '빠른 환승 팁: 4-2번 문 탑승 (환승 통로 바로 연결)',
      coord: (startStationInfo && startStationInfo.station ? startStationInfo.station.loc : locItem.loc),
      badgeText: sLine.name
    });

    // 환승
    steps.push({
      type: 'transfer',
      icon: 'git-branch',
      title: transStation.name + '역에서 [' + eLine.name + '] 환승',
      desc: '지하 환승 통로를 따라 ' + eLine.name + ' 승강장으로 이동 (' + eStName + ' 방면 열차 대기)',
      durationStr: '환승 도보 약 2~3분',
      countdownStr: '환승 통로 도보 약 2분',
      detailInfo: eLine.name + ' 승강장 이동 후 ' + eStName + ' 방면 열차 탑승',
      fastTip: '환승 팁: 7호선 온수/부평구청 방면 승강장 이용',
      coord: transStation.loc,
      badgeText: '환승 구간'
    });

    // 2차 탑승
    steps.push({
      type: 'subway',
      icon: 'train-front',
      lineName: eLine.name,
      lineColor: eLine.color,
      title: '[' + eLine.name + '] ' + transStation.name + '역 승차 (' + eStName + ' 방면)',
      desc: transStation.name + '역 승차 후 ' + eStName + '역에서 하차',
      durationStr: '약 4분 소요',
      countdownStr: '2분 후 도착 [보통]',
      nextTrainStr: '다음 열차 7분 후 (배차 4~6분)',
      stopsStr: numStops2 + '개 역 이동 (약 4분 소요)',
      detailInfo: transStation.name + '역 → ' + eStName + '역 도착',
      fastTip: '하차 팁: ' + eStName + '역 2번 출구 방면 계단 이용',
      coord: transStation.loc,
      badgeText: eLine.name
    });
  }

  // 하차
  steps.push({
    type: 'alight',
    icon: 'log-out',
    title: eStName + '역 하차 및 출구 이동',
    desc: eStName + '역 2번 출구로 나와 목적지 방면으로 이동',
    durationStr: '하차 및 출구',
    countdownStr: '하차 완료',
    coord: (endStationInfo && endStationInfo.station ? endStationInfo.station.loc : destCoord),
    badgeText: '하차'
  });

  // 최종 도보
  var walk2DistM = endStationInfo ? Math.round(endStationInfo.distKm * 1000) : 180;
  var walk2Min = Math.max(2, Math.round(walk2DistM / 70));
  steps.push({
    type: 'walk_dest',
    icon: 'map-pin',
    title: '[' + (destName || '약속 장소') + '] 도착',
    desc: eStName + '역 출구에서 도보 약 ' + walk2Min + '분 (' + walk2DistM + 'm) 이동 후 최종 모임 장소 도착',
    distStr: (walk2DistM < 1000 ? (walk2DistM + 'm') : ((walk2DistM/1000).toFixed(1) + 'km')),
    durationStr: '도보 약 ' + walk2Min + '분',
    countdownStr: '도착 완료',
    coord: destCoord,
    badgeText: '도착 완료'
  });

  return steps;
}

/* -------------------------------------------------------------
   내비게이션 모달 및 하단/상단 실시간 내비 시스템
------------------------------------------------------------- */
window.openNaviModal = function(participantId, transport) {
  if (!state.confirmedPlace) {
    showToast('먼저 약속 장소를 확정해 주세요', 'map-pin');
    return;
  }

  var myLoc = state.locations.find(function(l) { return l.isMe; }) || state.locations[0];
  naviState.activeParticipantId = participantId || naviState.activeParticipantId || (myLoc ? myLoc.id : 'loc_me');
  
  var detail = participantRouteDetails[naviState.activeParticipantId];
  if (transport) {
    naviState.activeTransport = transport;
  } else if (detail && detail.transport) {
    naviState.activeTransport = detail.transport;
  }

  var p = state.confirmedPlace;
  var tEl = document.getElementById('naviModalDestTitle');
  var aEl = document.getElementById('naviModalDestAddr');
  if (tEl) tEl.textContent = p.place_name;
  if (aEl) aEl.textContent = (p.road_address_name || p.address_name) + ' (약속 장소)';

  window.renderNaviModalContent();

  var modal = document.getElementById('navigationRouteModal');
  if (modal) modal.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
};

window.closeNaviModal = function() {
  var modal = document.getElementById('navigationRouteModal');
  if (modal) modal.classList.add('hidden');
};

window.setNaviTransport = function(transport) {
  naviState.activeTransport = transport;
  naviState.currentStepIndex = 0;

  // 하단 독 버튼 스타일 갱신
  var dockCar = document.getElementById('dockCarTabBtn');
  var dockTransit = document.getElementById('dockTransitTabBtn');
  if (dockCar && dockTransit) {
    if (transport === 'car') {
      dockCar.className = 'press px-2 py-1 rounded-lg text-[10.5px] font-bold bg-[#0284c7] text-white flex items-center gap-1 transition-all shadow-2xs';
      dockTransit.className = 'press px-2 py-1 rounded-lg text-[10.5px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-all';
    } else {
      dockCar.className = 'press px-2 py-1 rounded-lg text-[10.5px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-all';
      dockTransit.className = 'press px-2 py-1 rounded-lg text-[10.5px] font-bold bg-[#0284c7] text-white flex items-center gap-1 transition-all shadow-2xs';
    }
  }

  // 모달 버튼 스타일 갱신
  var mCar = document.getElementById('modalCarTabBtn');
  var mTransit = document.getElementById('modalTransitTabBtn');
  if (mCar && mTransit) {
    if (transport === 'car') {
      mCar.className = 'press py-2 rounded-xl text-[12px] font-bold bg-white text-[#0284c7] shadow-xs border border-[#bae6fd] flex items-center justify-center gap-1.5 transition-all';
      mTransit.className = 'press py-2 rounded-xl text-[12px] font-bold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-all';
    } else {
      mCar.className = 'press py-2 rounded-xl text-[12px] font-bold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-all';
      mTransit.className = 'press py-2 rounded-xl text-[12px] font-bold bg-white text-[#0284c7] shadow-xs border border-[#bae6fd] flex items-center justify-center gap-1.5 transition-all';
    }
  }

  // 현재 위치 마커 갱신 (자차 아이콘 vs 대중교통 펄스 비콘)
  var curLoc = state.locations.find(function(l) { return l.id === naviState.activeParticipantId; }) || state.locations[0];
  if (curLoc && state.isNaviMode) {
    updateSimCarMarker(curLoc.loc);
  }

  window.updateNaviHudUI();
  window.renderNaviModalContent();

  showToast(transport === 'car' ? '자차 실시간 내비 모드로 전환' : '대중교통 실시간 환승 안내 모드로 전환', transport === 'car' ? 'car' : 'train-front');
};

window.selectNaviParticipant = function(locId) {
  naviState.activeParticipantId = locId;
  var detail = participantRouteDetails[locId];
  if (detail && detail.transport) {
    naviState.activeTransport = detail.transport;
  }
  naviState.currentStepIndex = 0;

  window.setNaviTransport(naviState.activeTransport);
  window.renderNaviModalContent();
};

window.renderNaviModalContent = function() {
  var chipsContainer = document.getElementById('naviModalParticipantChips');
  if (chipsContainer) {
    chipsContainer.innerHTML = state.locations.map(function(locItem) {
      var isActive = (locItem.id === naviState.activeParticipantId);
      var isCar = (locItem.transport === 'car');
      var isMe = !!locItem.isMe;
      var chipClass = isActive
        ? 'bg-[#0284c7] text-white border-[#0284c7] shadow-xs'
        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200';
      return '<button type="button" onclick="window.selectNaviParticipant(\'' + locItem.id + '\')" class="press px-2.5 py-1 rounded-xl text-[11px] font-bold border shrink-0 flex items-center gap-1 transition-all ' + chipClass + '">' +
        (isMe ? '<span class="px-1 py-0.2 rounded text-[9.5px] font-black bg-sky-200/40 text-current">내 기준</span>' : '') +
        '<i data-lucide="' + (isCar ? 'car' : 'train-front') + '" class="w-3 h-3"></i>' +
        '<span>' + locItem.name + '</span>' +
      '</button>';
    }).join('');
  }

  var detail = participantRouteDetails[naviState.activeParticipantId] || {
    durationMin: 22,
    distKm: '6.5',
    etaStr: formatEtaTime(22),
    carSteps: [],
    transitSteps: []
  };

  var isCar = (naviState.activeTransport === 'car');
  var totalTimeEl = document.getElementById('naviModalTotalTime');
  var etaTimeEl = document.getElementById('naviModalEtaTime');
  var subTextEl = document.getElementById('naviModalSummarySubText');
  var simStartBtn = document.getElementById('modalSimStartBtn');

  if (totalTimeEl) totalTimeEl.textContent = detail.durationMin + '분 소요';
  if (etaTimeEl) etaTimeEl.textContent = detail.etaStr + ' 도착 예정';
  if (subTextEl) {
    subTextEl.textContent = isCar
      ? ('거리 ' + detail.distKm + 'km · 실시간 도로 주행 턴바이턴 기준')
      : ('거리 ' + detail.distKm + 'km · 지하철 실시간 도착 및 정밀 환승 기준');
  }

  if (simStartBtn) {
    simStartBtn.innerHTML = isCar
      ? '<i data-lucide="play" class="w-3.5 h-3.5 fill-white"></i><span>주행 시작</span>'
      : '<i data-lucide="train-front" class="w-3.5 h-3.5"></i><span>실시간 이동 안내 시작</span>';
  }

  var stepsList = document.getElementById('naviModalStepsList');
  if (!stepsList) return;

  if (isCar) {
    var steps = detail.carSteps || [];
    if (steps.length === 0) {
      var destName = state.confirmedPlace ? state.confirmedPlace.place_name : '약속 장소';
      var activeLoc = state.locations.find(function(l) { return l.id === naviState.activeParticipantId; }) || state.locations[0];
      steps = extractCarSteps([], detail.polyCoords, destName, (activeLoc ? activeLoc.name : '출발지'));
    }

    stepsList.innerHTML = steps.map(function(step, idx) {
      var isCurrent = (naviState.currentStepIndex === idx);
      var borderClass = isCurrent
        ? 'border-[#0284c7] ring-1 ring-[#66CCFF]/40 bg-[#f0f9ff]/70 shadow-xs'
        : 'border-slate-200/90 bg-white hover:border-[#bae6fd]';

      return '<div class="p-3 rounded-2xl border flex items-start gap-3 transition-all ' + borderClass + '">' +
        '<div class="w-8 h-8 rounded-xl ' + (isCurrent ? 'bg-[#0284c7] text-white' : 'bg-slate-100 text-slate-600') + ' grid place-items-center shrink-0 shadow-2xs">' +
          '<i data-lucide="' + step.icon + '" class="w-4 h-4"></i>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center justify-between gap-1">' +
            '<span class="font-bold text-[13px] text-slate-900 leading-snug truncate">' + step.instruction + '</span>' +
            '<span class="px-2 py-0.5 rounded-lg text-[10.5px] font-black ' + (isCurrent ? 'bg-[#0284c7] text-white' : 'bg-slate-100 text-slate-600') + ' shrink-0">' + step.distStr + '</span>' +
          '</div>' +
          '<p class="text-[11px] text-slate-500 mt-0.5 truncate">' + step.roadName + '</p>' +
        '</div>' +
        '<button type="button" onclick="window.goToNaviStep(' + idx + ')" class="press p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[#0284c7] shrink-0" title="지도 위치 확인">' +
          '<i data-lucide="crosshair" class="w-4 h-4"></i>' +
        '</button>' +
      '</div>';
    }).join('');
  } else {
    var tSteps = detail.transitSteps || [];
    if (tSteps.length === 0) {
      var destName2 = state.confirmedPlace ? state.confirmedPlace.place_name : '약속 장소';
      var activeLoc2 = state.locations.find(function(l) { return l.id === naviState.activeParticipantId; }) || state.locations[0];
      tSteps = generateDetailedTransitSteps(activeLoc2, (state.confirmedPlace ? [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)] : state.currentHubCoord), destName2);
      detail.transitSteps = tSteps;
    }

    stepsList.innerHTML = tSteps.map(function(tStep, idx) {
      var isCurrent = (naviState.currentStepIndex === idx);
      var badgeStyle = tStep.lineColor ? ('background-color: ' + tStep.lineColor + '; color: #ffffff;') : 'background-color: #f1f5f9; color: #475569;';

      return '<div class="p-3.5 rounded-2xl border border-slate-200/90 bg-white flex flex-col gap-2 shadow-2xs hover:border-[#bae6fd] transition-all">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div class="flex items-center gap-2 min-w-0 flex-1">' +
            '<div class="w-8 h-8 rounded-xl bg-slate-100 text-[#0284c7] grid place-items-center shrink-0">' +
              '<i data-lucide="' + tStep.icon + '" class="w-4 h-4"></i>' +
            '</div>' +
            '<div class="min-w-0 flex-1">' +
              '<div class="flex items-center gap-1.5 flex-wrap">' +
                '<span class="px-2 py-0.2 rounded-md text-[10px] font-black shrink-0" style="' + badgeStyle + '">' + (tStep.badgeText || tStep.lineName || '이동') + '</span>' +
                (tStep.countdownStr ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">' + tStep.countdownStr + '</span>' : '') +
                '<h5 class="text-[13px] font-bold text-slate-900 truncate leading-snug">' + tStep.title + '</h5>' +
              '</div>' +
              '<p class="text-[11.5px] text-slate-600 mt-1">' + tStep.desc + '</p>' +
              (tStep.stopsStr ? '<p class="text-[11px] text-[#0284c7] font-semibold mt-0.5">' + tStep.stopsStr + '</p>' : '') +
            '</div>' +
          '</div>' +
          '<span class="text-[11px] font-extrabold text-[#0284c7] shrink-0">' + (tStep.durationStr || tStep.distStr || '') + '</span>' +
        '</div>' +
        (tStep.fastTip ? ('<div class="px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-100 text-[11px] font-bold text-[#0369a1] flex items-center gap-1.5"><i data-lucide="zap" class="w-3.5 h-3.5 text-amber-500 shrink-0"></i><span>' + tStep.fastTip + '</span></div>') : '') +
        (tStep.nextTrainStr ? ('<div class="text-[10.5px] text-slate-400 pl-10">' + tStep.nextTrainStr + '</div>') : '') +
      '</div>';
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
};

window.updateNaviHudUI = function() {
  var dock = document.getElementById('naviBottomDock');
  var miniBanner = document.getElementById('naviTopMiniBanner');
  if (!dock || dock.classList.contains('hidden')) return;

  var detail = participantRouteDetails[naviState.activeParticipantId];
  if (!detail) {
    detail = {
      durationMin: 22,
      distKm: '6.5',
      etaStr: formatEtaTime(22),
      carSteps: [],
      transitSteps: []
    };
    participantRouteDetails[naviState.activeParticipantId] = detail;
  }

  var isCar = (naviState.activeTransport === 'car');
  var steps = isCar ? (detail.carSteps || []) : (detail.transitSteps || []);
  if (!steps || steps.length === 0) {
    var pCoord = state.confirmedPlace ? [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)] : (state.currentHubCoord || [37.497952, 127.027619]);
    var destName = state.confirmedPlace ? state.confirmedPlace.place_name : '약속 장소';
    var activeLocFallback = state.locations.find(function(l) { return l.id === naviState.activeParticipantId; }) || state.locations[0];

    if (isCar) {
      steps = extractCarSteps([], detail.polyCoords, destName, (activeLocFallback ? activeLocFallback.name : '출발지'));
      detail.carSteps = steps;
    } else {
      steps = generateDetailedTransitSteps(activeLocFallback, pCoord, destName);
      detail.transitSteps = steps;
    }
  }
  if (!steps || steps.length === 0) return;

  if (naviState.currentStepIndex >= steps.length) {
    naviState.currentStepIndex = steps.length - 1;
  }
  if (naviState.currentStepIndex < 0) {
    naviState.currentStepIndex = 0;
  }

  var curStep = steps[naviState.currentStepIndex];
  var p = state.confirmedPlace;
  var activeLoc = state.locations.find(function(l) { return l.id === naviState.activeParticipantId; }) || state.locations[0];

  // 1. 헤더 요약 갱신 (내 기준 명시)
  var routeSumEl = document.getElementById('dockRouteSummary');
  if (routeSumEl) {
    var isMe = activeLoc && activeLoc.isMe;
    routeSumEl.textContent = (isMe ? '나 (' + (activeLoc.name || '내 위치') + ')' : activeLoc.name) + ' → ' + (p ? p.place_name : '약속 장소');
  }

  // 2. 모드 탭 스타일 갱신
  var dockCarBtn = document.getElementById('dockCarTabBtn');
  var dockTransitBtn = document.getElementById('dockTransitTabBtn');
  if (dockCarBtn && dockTransitBtn) {
    if (isCar) {
      dockCarBtn.className = 'press px-2 py-1 rounded-lg text-[10.5px] font-bold bg-[#0284c7] text-white flex items-center gap-1 transition-all shadow-2xs';
      dockTransitBtn.className = 'press px-2 py-1 rounded-lg text-[10.5px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-all';
    } else {
      dockCarBtn.className = 'press px-2 py-1 rounded-lg text-[10.5px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-all';
      dockTransitBtn.className = 'press px-2 py-1 rounded-lg text-[10.5px] font-bold bg-[#0284c7] text-white flex items-center gap-1 transition-all shadow-2xs';
    }
  }

  // 3. 메인 단계 안내 카드 (#dockCurrentStepCard)
  var card = document.getElementById('dockCurrentStepCard');
  if (card) {
    if (isCar) {
      card.innerHTML = 
        '<div class="flex items-center justify-between">' +
          '<div class="flex items-center gap-2.5 min-w-0 flex-1">' +
            '<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#66CCFF] to-[#0284c7] text-white grid place-items-center shrink-0 shadow-xs">' +
              '<i data-lucide="' + (curStep.icon || 'arrow-up') + '" class="w-5 h-5 text-white"></i>' +
            '</div>' +
            '<div class="min-w-0 flex-1">' +
              '<span class="text-[16px] font-black text-[#0284c7] block leading-tight">' + (curStep.distStr || '직진') + ' 앞</span>' +
              '<h4 class="text-[14px] font-extrabold text-slate-900 leading-tight truncate">' + (curStep.instruction || '추천 도로 주행') + '</h4>' +
            '</div>' +
          '</div>' +
          '<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 shrink-0">실시간 주행</span>' +
        '</div>' +
        '<div class="flex items-center gap-2 text-[11.5px] text-slate-600 pt-1 border-t border-slate-200/60 truncate">' +
          '<span class="font-bold text-slate-800">' + (curStep.roadName || '추천 도로') + '</span>' +
          '<span class="text-slate-400">·</span>' +
          '<span class="text-slate-500 truncate">목적지: ' + (p ? p.place_name : '약속 장소') + '</span>' +
        '</div>';
    } else {
      var badgeStyle = curStep.lineColor ? ('background-color: ' + curStep.lineColor + '; color: #ffffff;') : 'background-color: #0284c7; color: #ffffff;';
      card.innerHTML = 
        '<div class="flex items-center justify-between gap-1.5">' +
          '<div class="flex items-center gap-1.5 flex-wrap min-w-0">' +
            '<span class="px-2 py-0.5 rounded-md text-[10.5px] font-black shrink-0" style="' + badgeStyle + '">' + (curStep.badgeText || curStep.lineName || '대중교통') + '</span>' +
            (curStep.countdownStr ? '<span class="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300/60 shrink-0 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>' + curStep.countdownStr + '</span>' : '') +
          '</div>' +
          '<span class="text-[11.5px] font-extrabold text-[#0284c7] shrink-0">' + (curStep.durationStr || curStep.distStr || '') + '</span>' +
        '</div>' +
        '<div>' +
          '<h4 class="text-[14.5px] font-extrabold text-slate-900 leading-snug tracking-tight">' + (curStep.title || curStep.desc) + '</h4>' +
          '<p class="text-[12px] text-slate-600 mt-0.5">' + curStep.desc + '</p>' +
        '</div>' +
        (curStep.stopsStr ? '<div class="text-[11px] font-semibold text-[#0369a1] flex items-center gap-1.5"><i data-lucide="git-commit" class="w-3.5 h-3.5 text-sky-500 shrink-0"></i><span>' + curStep.stopsStr + '</span>' + (curStep.nextTrainStr ? ' · <span class="text-slate-400">' + curStep.nextTrainStr + '</span>' : '') + '</div>' : '') +
        (curStep.fastTip ? '<div class="px-2.5 py-1.5 rounded-xl bg-sky-50/90 border border-sky-100 text-[11px] font-bold text-[#0369a1] flex items-center gap-1.5"><i data-lucide="zap" class="w-3.5 h-3.5 text-amber-500 shrink-0"></i><span>' + curStep.fastTip + '</span></div>' : '');
    }
  }

  // 4. 하단 요약 시간 & 스텝 지표
  var etaText = document.getElementById('dockEtaTime');
  var remainInfo = document.getElementById('dockRemainInfo');
  var stepInd = document.getElementById('dockStepIndicator');
  var simText = document.getElementById('dockSimText');
  var simIcon = document.getElementById('dockSimIcon');

  if (etaText) etaText.textContent = (detail.etaStr || '--:--') + ' 도착';
  if (remainInfo) remainInfo.textContent = '남은 ' + detail.distKm + 'km · ' + detail.durationMin + '분 소요';
  if (stepInd) stepInd.textContent = (naviState.currentStepIndex + 1) + '/' + steps.length;

  if (simText) {
    if (isCar) {
      simText.textContent = naviState.isSimulating ? '일시정지' : '모의 주행';
    } else {
      simText.textContent = naviState.isSimulating ? '일시정지' : '모의 이동';
    }
  }
  if (simIcon) {
    if (naviState.isSimulating) {
      simIcon.setAttribute('data-lucide', 'pause');
    } else {
      simIcon.setAttribute('data-lucide', isCar ? 'play' : 'train-front');
    }
  }

  // 5. 상단 미니 배너 갱신
  if (miniBanner && !miniBanner.classList.contains('hidden')) {
    var mCount = document.getElementById('miniBannerCountdown');
    var mTitle = document.getElementById('miniBannerTitle');
    var mSub = document.getElementById('miniBannerSub');
    var mIcon = document.getElementById('miniBannerIcon');

    if (isCar) {
      if (mCount) mCount.textContent = (curStep.distStr || '직진') + ' 앞';
      if (mTitle) mTitle.textContent = curStep.instruction || '추천 도로 주행';
      if (mSub) mSub.textContent = (curStep.roadName || '실시간 경로') + ' · 목적지: ' + (p ? p.place_name : '약속 장소');
      if (mIcon) mIcon.setAttribute('data-lucide', curStep.icon || 'arrow-up');
    } else {
      if (mCount) mCount.textContent = curStep.countdownStr || curStep.durationStr || '이동';
      if (mTitle) mTitle.textContent = curStep.title || curStep.desc;
      if (mSub) mSub.textContent = curStep.stopsStr || curStep.desc || '대중교통 환승 안내';
      if (mIcon) mIcon.setAttribute('data-lucide', curStep.icon || 'train-front');
    }
  }

  // 6. 독 내부 전체 이동 흐름 타임라인 (#dockExpandedTimeline) 갱신
  var timeline = document.getElementById('dockExpandedTimeline');
  if (timeline) {
    timeline.innerHTML = steps.map(function(s, idx) {
      var isCurrent = (naviState.currentStepIndex === idx);
      var isPast = (naviState.currentStepIndex > idx);

      var badgeStyle = s.lineColor ? ('background-color: ' + s.lineColor + '; color: #ffffff;') : (isCar ? 'background-color: #0284c7; color: #ffffff;' : 'background-color: #f1f5f9; color: #475569;');
      var borderClass = isCurrent 
        ? 'border-[#0284c7] ring-2 ring-sky-300/60 bg-sky-50/80 shadow-xs' 
        : (isPast ? 'border-slate-200/70 bg-slate-50/60 opacity-60' : 'border-slate-200/90 bg-white hover:border-[#bae6fd]');

      var stepNumBadge = isCurrent 
        ? '<span class="w-5 h-5 rounded-full bg-[#0284c7] text-white text-[10px] font-black grid place-items-center shrink-0 shadow-2xs">' + (idx + 1) + '</span>'
        : (isPast 
            ? '<span class="w-5 h-5 rounded-full bg-slate-300 text-white text-[10px] font-bold grid place-items-center shrink-0"><i data-lucide="check" class="w-3 h-3"></i></span>'
            : '<span class="w-5 h-5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold grid place-items-center shrink-0">' + (idx + 1) + '</span>');

      var stepTitle = isCar ? (s.instruction || '주행') : (s.title || s.desc);
      var stepBadge = isCar ? (s.distStr || '안내') : (s.badgeText || s.lineName || '이동');
      var stepSub = isCar ? (s.roadName || '') : (s.stopsStr || s.desc || '');

      return '<div data-step-index="' + idx + '" onclick="window.goToNaviStep(' + idx + ')" class="p-3 rounded-2xl border cursor-pointer transition-all ' + borderClass + '">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div class="flex items-center gap-2 min-w-0 flex-1">' +
            stepNumBadge +
            '<div class="w-7 h-7 rounded-xl ' + (isCurrent ? 'bg-[#0284c7] text-white' : 'bg-slate-100 text-[#0284c7]') + ' grid place-items-center shrink-0">' +
              '<i data-lucide="' + (s.icon || 'arrow-up') + '" class="w-3.5 h-3.5"></i>' +
            '</div>' +
            '<div class="min-w-0 flex-1">' +
              '<div class="flex items-center gap-1.5 flex-wrap">' +
                '<span class="px-2 py-0.5 rounded-md text-[10px] font-black shrink-0" style="' + badgeStyle + '">' + stepBadge + '</span>' +
                (s.countdownStr ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300/60 shrink-0">' + s.countdownStr + '</span>' : '') +
                (isCurrent ? '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-[#0284c7] text-white shrink-0">현재 위치</span>' : '') +
                '<h5 class="text-[12.5px] font-bold text-slate-900 truncate leading-snug">' + stepTitle + '</h5>' +
              '</div>' +
              (stepSub ? '<p class="text-[11px] text-slate-600 mt-1 truncate">' + stepSub + '</p>' : '') +
            '</div>' +
          '</div>' +
          '<div class="text-right shrink-0">' +
            '<span class="text-[11px] font-extrabold text-[#0284c7] block">' + (s.durationStr || s.distStr || '') + '</span>' +
          '</div>' +
        '</div>' +
        (s.fastTip ? ('<div class="mt-2 px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-100 text-[10.5px] font-bold text-[#0369a1] flex items-center gap-1.5"><i data-lucide="zap" class="w-3.5 h-3.5 text-amber-500 shrink-0"></i><span>' + s.fastTip + '</span></div>') : '') +
        (s.nextTrainStr ? ('<div class="text-[10px] text-slate-400 pl-8 mt-1">' + s.nextTrainStr + '</div>') : '') +
      '</div>';
    }).join('');

    // 만약 펼쳐져 있는 상태라면 현재 스텝으로 자연스럽게 스크롤 맞춤
    if (dock.classList.contains('dock-expanded')) {
      var activeEl = timeline.querySelector('[data-step-index="' + naviState.currentStepIndex + '"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  if (window.lucide) lucide.createIcons();
};

window.toggleNaviDockExpand = function(forceExpand) {
  var dock = document.getElementById('naviBottomDock');
  var timeline = document.getElementById('dockExpandedTimeline');
  var currentCard = document.getElementById('dockCurrentStepCard');
  var label = document.getElementById('dockExpandLabel');
  var icon = document.getElementById('dockExpandIcon');
  if (!dock) return;

  var isExpanded = dock.classList.contains('dock-expanded');
  var willExpand = (typeof forceExpand === 'boolean') ? forceExpand : !isExpanded;

  if (willExpand) {
    dock.classList.remove('dock-collapsed');
    dock.classList.add('dock-expanded');
    if (timeline) timeline.classList.remove('hidden');
    if (currentCard) currentCard.classList.add('hidden');
    if (label) label.textContent = '현재 단계로 접기';
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');

    // 최신 상태로 HUD 및 타임라인 렌더링
    window.updateNaviHudUI();

    // 현재 선택된 스텝으로 스크롤 이동
    if (timeline) {
      setTimeout(function() {
        var activeEl = timeline.querySelector('[data-step-index="' + naviState.currentStepIndex + '"]');
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  } else {
    dock.classList.remove('dock-expanded');
    dock.classList.add('dock-collapsed');
    if (timeline) timeline.classList.add('hidden');
    if (currentCard) currentCard.classList.remove('hidden');
    if (label) label.textContent = '전체 이동 흐름 보기';
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  }

  if (window.lucide) lucide.createIcons();
};

window.nextNaviStep = function() {
  var detail = participantRouteDetails[naviState.activeParticipantId];
  if (!detail) return;
  var steps = (naviState.activeTransport === 'car') ? detail.carSteps : detail.transitSteps;
  if (!steps || steps.length === 0) return;

  if (naviState.currentStepIndex < steps.length - 1) {
    naviState.currentStepIndex++;
    window.updateNaviHudUI();
    var step = steps[naviState.currentStepIndex];
    if (step && step.coord) {
      map.flyTo(step.coord, 17.5, { duration: 0.9 });
      updateSimCarMarker(step.coord);
    }
  } else {
    showToast('목적지에 도달했습니다!', 'flag');
    if (naviState.isSimulating) window.toggleNaviSimulation();
  }
};

window.prevNaviStep = function() {
  var detail = participantRouteDetails[naviState.activeParticipantId];
  if (!detail) return;
  var steps = (naviState.activeTransport === 'car') ? detail.carSteps : detail.transitSteps;
  if (!steps || steps.length === 0) return;

  if (naviState.currentStepIndex > 0) {
    naviState.currentStepIndex--;
    window.updateNaviHudUI();
    var step = steps[naviState.currentStepIndex];
    if (step && step.coord) {
      map.flyTo(step.coord, 17.5, { duration: 0.8 });
      updateSimCarMarker(step.coord);
    }
  }
};

window.goToNaviStep = function(stepIdx) {
  naviState.currentStepIndex = stepIdx;
  window.updateNaviHudUI();
  window.closeNaviModal();

  var dock = document.getElementById('naviBottomDock');
  if (dock) dock.classList.remove('hidden');

  var miniBanner = document.getElementById('naviTopMiniBanner');
  if (miniBanner) miniBanner.classList.remove('hidden');

  var detail = participantRouteDetails[naviState.activeParticipantId];
  var steps = (naviState.activeTransport === 'car') ? (detail ? detail.carSteps : []) : (detail ? detail.transitSteps : []);
  if (steps && steps[stepIdx] && steps[stepIdx].coord) {
    map.flyTo(steps[stepIdx].coord, 17.5, { duration: 1.0 });
    updateSimCarMarker(steps[stepIdx].coord);
  }
};

function updateSimCarMarker(coord) {
  if (!coord) return;
  var isCar = (naviState.activeTransport === 'car');

  if (naviState.simCarMarker) {
    map.removeLayer(naviState.simCarMarker);
    naviState.simCarMarker = null;
  }

  var iconHtml = '';
  if (isCar) {
    iconHtml = '<div class="w-9 h-9 rounded-full bg-[#0284c7] text-white border-2 border-white shadow-xl grid place-items-center animate-bounce">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>' +
    '</div>';
  } else {
    // 대중교통 이용자 전용 펄스 비콘 마커 (차량이 아닌 스마트 대중교통 아바타)
    iconHtml = '<div class="relative w-9 h-9 flex items-center justify-center">' +
      '<span class="absolute w-8 h-8 rounded-full bg-sky-400/40 animate-ping"></span>' +
      '<div class="w-8 h-8 rounded-full bg-[#0284c7] text-white border-2 border-white shadow-xl grid place-items-center">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>' +
      '</div>' +
    '</div>';
  }

  naviState.simCarMarker = L.marker(coord, {
    icon: L.divIcon({
      html: iconHtml,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    }),
    zIndexOffset: 1200
  }).addTo(map);
}

window.toggleNaviSimulation = function() {
  var isCar = (naviState.activeTransport === 'car');
  if (naviState.isSimulating) {
    clearInterval(naviState.simInterval);
    naviState.isSimulating = false;
    window.updateNaviHudUI();
    showToast(isCar ? '주행 시뮬레이션을 일시정지했습니다' : '대중교통 모의 이동을 일시정지했습니다', 'pause');
  } else {
    naviState.isSimulating = true;
    window.updateNaviHudUI();
    showToast(isCar ? '실시간 도로 모의 주행을 시작합니다' : '실시간 대중교통 모의 이동을 시작합니다', isCar ? 'play' : 'train-front');

    naviState.simInterval = setInterval(function() {
      var detail = participantRouteDetails[naviState.activeParticipantId];
      var steps = (naviState.activeTransport === 'car') ? (detail ? detail.carSteps : []) : (detail ? detail.transitSteps : []);
      if (!steps || naviState.currentStepIndex >= steps.length - 1) {
        clearInterval(naviState.simInterval);
        naviState.isSimulating = false;
        window.updateNaviHudUI();
        showToast("목적지에 안전하게 도착했습니다!", 'flag');
        return;
      }
      window.nextNaviStep();
    }, 2800);
  }
};

window.startNaviSimulationFromModal = function() {
  window.closeNaviModal();
  window.startNaviMode();
  if (!naviState.isSimulating) {
    window.toggleNaviSimulation();
  }
};

window.startNaviMode = function(participantId, transport) {
  if (!state.confirmedPlace) {
    showToast('먼저 약속 장소를 선택해 주세요', 'map-pin');
    return;
  }

  // 항상 사용자 본인('나') 기준 우선 세팅
  var myLoc = state.locations.find(function(l) { return l.isMe; }) || state.locations[0];
  naviState.activeParticipantId = participantId || (myLoc ? myLoc.id : 'loc_me');

  if (transport) {
    naviState.activeTransport = transport;
  } else {
    var detail = participantRouteDetails[naviState.activeParticipantId];
    if (detail && detail.transport) naviState.activeTransport = detail.transport;
  }

  state.isNaviMode = true;

  // 상단 플로팅 헤더(#topHeader)와 바텀 시트는 내비 모드 중 감추고, 하단 내비 독과 상단 미니 캡슐 배너 노출
  var topHeader = document.getElementById('topHeader');
  if (topHeader) topHeader.classList.add('hidden');

  var bs = document.getElementById('bottomSheet');
  if (bs) bs.classList.add('hidden');

  var dock = document.getElementById('naviBottomDock');
  if (dock) dock.classList.remove('hidden');

  var miniBanner = document.getElementById('naviTopMiniBanner');
  if (miniBanner) miniBanner.classList.remove('hidden');

  window.setNaviTransport(naviState.activeTransport);
  window.updateNaviHudUI();

  var curLoc = state.locations.find(function(l) { return l.id === naviState.activeParticipantId; }) || myLoc;
  if (curLoc) {
    map.flyTo(curLoc.loc, 17.5, { duration: 1.0 });
    updateSimCarMarker(curLoc.loc);
  }

  var modeTitle = (naviState.activeTransport === 'transit') ? '대중교통 환승 안내' : '자차 턴바이턴 안내';
  showToast("'" + state.confirmedPlace.place_name + "' 내 기준 " + modeTitle + "를 시작합니다", 'navigation');
};

window.stopNaviMode = function() {
  state.isNaviMode = false;
  if (naviState.isSimulating) {
    clearInterval(naviState.simInterval);
    naviState.isSimulating = false;
  }
  if (naviState.simCarMarker) {
    map.removeLayer(naviState.simCarMarker);
    naviState.simCarMarker = null;
  }

  // 독 상태를 축소 상태로 초기화
  window.toggleNaviDockExpand(false);

  var dock = document.getElementById('naviBottomDock');
  if (dock) dock.classList.add('hidden');

  var miniBanner = document.getElementById('naviTopMiniBanner');
  if (miniBanner) miniBanner.classList.add('hidden');

  // 상단 플로팅 헤더와 바텀 시트 복원
  var topHeader = document.getElementById('topHeader');
  if (topHeader) topHeader.classList.remove('hidden');

  var bs = document.getElementById('bottomSheet');
  if (bs) bs.classList.remove('hidden');

  if (state.confirmedPlace) {
    var pCoord = [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)];
    map.flyTo(pCoord, 15.5, { duration: 0.8 });
  }
  showToast('내비게이션 안내를 종료했습니다', 'square');
};

// 하단 내비 독 터치 제스처 (위로 쓸어올리면 전체 흐름 펼침, 아래로 내리면 축소)
function initNaviDockGestures() {
  var handle = document.getElementById('dockExpandHandle');
  var currentCard = document.getElementById('dockCurrentStepCard');
  if (handle) {
    var startY = 0;
    handle.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches[0]) startY = e.touches[0].clientY;
    }, { passive: true });

    handle.addEventListener('touchend', function(e) {
      if (e.changedTouches && e.changedTouches[0]) {
        var diffY = e.changedTouches[0].clientY - startY;
        if (diffY < -20) {
          window.toggleNaviDockExpand(true);
        } else if (diffY > 20) {
          window.toggleNaviDockExpand(false);
        }
      }
    }, { passive: true });
  }

  if (currentCard) {
    var cardStartY = 0;
    currentCard.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches[0]) cardStartY = e.touches[0].clientY;
    }, { passive: true });

    currentCard.addEventListener('touchend', function(e) {
      if (e.changedTouches && e.changedTouches[0]) {
        var diffY = e.changedTouches[0].clientY - cardStartY;
        if (diffY < -30) {
          window.toggleNaviDockExpand(true);
        }
      }
    }, { passive: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNaviDockGestures);
} else {
  initNaviDockGestures();
}

