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
          if (route.sections && route.sections.length > 0) {
            route.sections.forEach(function(sec) {
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
          renderCarRoutePolylines(polyCoords, color, idx, locItem, distKm, durationMin, realDurations, destCoord);
        })
        .catch(function() {
          var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
            oLon + ',' + oLat + ';' + dLon + ',' + dLat + '?overview=full&geometries=geojson';

          fetch(osrmUrl)
            .then(function(r) { return r.json(); })
            .then(function(osrmData) {
              if (osrmData && osrmData.routes && osrmData.routes.length > 0) {
                var r0 = osrmData.routes[0];
                var distKm = (r0.distance / 1000).toFixed(1);
                var durationMin = Math.max(3, Math.round(r0.duration / 60));
                var polyCoords = r0.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                renderCarRoutePolylines(polyCoords, color, idx, locItem, distKm, durationMin, realDurations, destCoord);
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
              renderCarRoutePolylines(polyCoords, color, idx, locItem, estDist, estDur, realDurations, destCoord);
            });
        });
    } else {
      renderTransitDetailedRoute(locItem, destCoord, idx, color, crowDistKm, realDurations);
    }
  });
}

function renderCarRoutePolylines(polyCoords, color, idx, locItem, distKm, durationMin, realDurations, destCoord) {
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
  participantRouteDetails[locItem.id] = {
    durationMin: durationMin,
    distKm: distKm,
    etaStr: formatEtaTime(durationMin),
    transport: 'car',
    routeDesc: '실시간 도로 주행 (내비게이션)'
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

    participantRouteDetails[locItem.id] = {
      durationMin: transitTimeMin,
      distKm: transitDistKm,
      etaStr: formatEtaTime(transitTimeMin),
      transport: 'transit',
      routeDesc: routeDesc
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

        var bDesc = locItem.name + ' 승차 → 목적지 하차';
        participantRouteDetails[locItem.id] = {
          durationMin: transitTimeMin,
          distKm: transitDistKm,
          etaStr: formatEtaTime(transitTimeMin),
          transport: 'transit',
          routeDesc: bDesc
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
      '<div class="text-right shrink-0">' +
        '<span class="text-[12.5px] font-bold text-slate-900 block">' + detail.etaStr + ' 도착 예정</span>' +
        '<span class="text-[11px] text-slate-400 font-medium">' + detail.distKm + 'km (' + detail.durationMin + '분 소요)</span>' +
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

window.startNaviMode = function() {
  if (!state.confirmedPlace) {
    showToast('먼저 약속 장소를 선택해 주세요', 'map-pin');
    return;
  }

  state.isNaviMode = true;
  var hud = document.getElementById('naviHudBar');
  if (hud) hud.classList.remove('hidden');

  var p = state.confirmedPlace;
  var myDetail = participantRouteDetails['loc_me'] || { durationMin: 22, distKm: '6.5', etaStr: formatEtaTime(22) };

  document.getElementById('naviDestinationName').textContent = '목적지: ' + p.place_name;
  document.getElementById('naviEtaText').textContent = myDetail.etaStr;
  document.getElementById('naviRemainDist').textContent = myDetail.distKm + 'km (' + myDetail.durationMin + '분)';
  document.getElementById('naviNextDistance').textContent = '400m 앞';
  document.getElementById('naviNextInstruction').textContent = '직진 후 우회전 (추천 경로)';

  map.flyTo(state.myLocation, 17.5, {
    duration: 1.2,
    easeLinearity: 0.25
  });

  showToast("'" + p.place_name + "' 실시간 내비 안내를 시작합니다", 'navigation');
  if (window.lucide) lucide.createIcons();
};

window.stopNaviMode = function() {
  state.isNaviMode = false;
  var hud = document.getElementById('naviHudBar');
  if (hud) hud.classList.add('hidden');

  if (state.confirmedPlace) {
    var pCoord = [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)];
    map.flyTo(pCoord, 15.5, { duration: 0.8 });
  }
  showToast('내비게이션 안내를 종료했습니다', 'square');
};
