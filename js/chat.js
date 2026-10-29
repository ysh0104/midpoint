/**
 * MidPoint - Meeting Coordination Chat Module (모임 장소 조율 채팅방)
 * Enables real-time group coordination, interactive place sharing,
 * midpoint hub announcements, and roulette/game triggers.
 */

(function () {
  'use strict';

  var chatState = {
    isOpen: false,
    unreadCount: 2,
    messages: [
      {
        id: 'msg_init_sys',
        type: 'system',
        text: '모임 장소 조율방이 개설되었습니다.',
        time: getNowTimeString(-8)
      },
      {
        id: 'msg_init_1',
        sender: '다은',
        avatarColor: 'bg-rose-500',
        type: 'text',
        text: '우리 오늘 어디서 만날까? 중간 지점 검색해봤어?',
        time: getNowTimeString(-6)
      },
      {
        id: 'msg_init_2',
        sender: '영은',
        avatarColor: 'bg-emerald-600',
        type: 'text',
        text: '다들 이동하기 편한 곳이면 좋겠어! 괜찮은 카페 있으면 공유해줘',
        time: getNowTimeString(-3)
      }
    ]
  };

  function getNowTimeString(offsetMinutes) {
    var now = new Date();
    if (offsetMinutes) {
      now = new Date(now.getTime() + offsetMinutes * 60000);
    }
    var hours = now.getHours();
    var minutes = now.getMinutes();
    var ampm = hours >= 12 ? '오후' : '오전';
    var formattedHours = hours % 12 || 12;
    var formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return ampm + ' ' + formattedHours + ':' + formattedMinutes;
  }

  function getFriendProfiles() {
    var friends = [];
    if (state.locations && state.locations.length > 1) {
      for (var i = 1; i < state.locations.length; i++) {
        var loc = state.locations[i];
        var name = loc.shortName || loc.name || ('친구 ' + i);
        var colors = ['bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-violet-600'];
        friends.push({
          name: name,
          color: colors[(i - 1) % colors.length]
        });
      }
    } else {
      friends.push({ name: '다은', color: 'bg-rose-500' });
      friends.push({ name: '영은', color: 'bg-emerald-600' });
    }
    return friends;
  }

  function updateUnreadBadges() {
    var floatingBadge = document.getElementById('chatBadge');
    var headerBadge = document.getElementById('chatHeaderBadge');
    var count = chatState.unreadCount;

    if (floatingBadge) {
      if (count > 0) {
        floatingBadge.classList.remove('hidden');
        floatingBadge.textContent = count > 9 ? '9+' : count;
      } else {
        floatingBadge.classList.add('hidden');
      }
    }

    if (headerBadge) {
      if (count > 0) {
        headerBadge.classList.remove('hidden');
      } else {
        headerBadge.classList.add('hidden');
      }
    }
  }

  function updateChatHeaderInfo() {
    var countBadge = document.getElementById('chatParticipantCountBadge');
    var subText = document.getElementById('chatParticipantsSubText');
    var bannerText = document.getElementById('chatHubBannerText');

    var friends = getFriendProfiles();
    var names = ['나'].concat(friends.map(function(f) { return f.name; }));

    if (countBadge) countBadge.textContent = names.length + '명';
    if (subText) subText.textContent = names.join(', ');

    if (bannerText) {
      if (state.currentHubName) {
        bannerText.innerHTML = '중간 지점: <strong>' + state.currentHubName + '</strong>';
      } else {
        bannerText.innerHTML = '출발지를 추가하면 최적의 중간 지점이 계산됩니다';
      }
    }
  }

  function scrollChatToBottom(smooth) {
    var list = document.getElementById('chatMessageList');
    if (!list) return;
    setTimeout(function() {
      list.scrollTo({
        top: list.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }, 40);
  }

  window.openChatDrawer = function() {
    var modal = document.getElementById('chatDrawerModal');
    if (!modal) return;
    chatState.isOpen = true;
    chatState.unreadCount = 0;
    updateUnreadBadges();
    updateChatHeaderInfo();
    window.renderChatMessages();

    modal.classList.remove('hidden');
    scrollChatToBottom(false);
    if (window.lucide) lucide.createIcons();

    var input = document.getElementById('chatInputText');
    if (input) setTimeout(function() { input.focus(); }, 150);
  };

  window.closeChatDrawer = function() {
    var modal = document.getElementById('chatDrawerModal');
    if (modal) modal.classList.add('hidden');
    chatState.isOpen = false;
  };

  window.toggleChatDrawer = function() {
    if (chatState.isOpen) {
      window.closeChatDrawer();
    } else {
      window.openChatDrawer();
    }
  };

  window.renderChatMessages = function() {
    var list = document.getElementById('chatMessageList');
    if (!list) return;

    list.innerHTML = chatState.messages.map(function(m) {
      if (m.type === 'system') {
        return '<div class="flex justify-center my-1">' +
          '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/70 text-slate-600 text-[10.5px] font-semibold border border-slate-300/60 shadow-2xs">' +
            '<i data-lucide="info" class="w-3 h-3 text-[#0284c7]"></i>' +
            '<span>' + m.text + '</span>' +
          '</span>' +
        '</div>';
      }

      var isMe = m.sender === '나';

      if (isMe) {
        var isWhiteCard = (m.type === 'poll' || m.type === 'place' || m.type === 'hub' || m.type === 'roulette');
        var bubbleClass = isWhiteCard
          ? 'bg-white text-slate-800 border border-slate-200/90 rounded-2xl rounded-tr-xs p-3.5 shadow-xs text-[12.5px] leading-relaxed max-w-[295px]'
          : 'bg-[#0284c7] text-white rounded-2xl rounded-tr-xs p-3 shadow-xs text-[12.5px] leading-relaxed max-w-[280px]';

        return '<div class="flex flex-col items-end gap-1 pl-8">' +
          '<div class="flex items-end gap-1.5">' +
            '<span class="text-[9.5px] text-slate-400 font-semibold">' + m.time + '</span>' +
            '<div class="' + bubbleClass + '">' +
              renderMessageContent(m) +
            '</div>' +
          '</div>' +
        '</div>';
      } else {
        var initial = (m.sender || '친').charAt(0);
        var color = m.avatarColor || 'bg-indigo-600';

        return '<div class="flex items-start gap-2 pr-10">' +
          '<div class="w-8 h-8 rounded-xl ' + color + ' text-white font-extrabold text-[12px] grid place-items-center shrink-0 shadow-2xs select-none">' +
            initial +
          '</div>' +
          '<div class="flex flex-col items-start gap-1">' +
            '<div class="flex items-baseline gap-1.5">' +
              '<span class="text-[11.5px] font-bold text-slate-800">' + m.sender + '</span>' +
              '<span class="text-[9.5px] text-slate-400 font-medium">' + m.time + '</span>' +
            '</div>' +
            '<div class="bg-white text-slate-800 rounded-2xl rounded-tl-xs p-3 border border-slate-200/90 shadow-2xs text-[12.5px] leading-relaxed max-w-[280px]">' +
              renderMessageContent(m) +
            '</div>' +
          '</div>' +
        '</div>';
      }
    }).join('');

    if (window.lucide) lucide.createIcons();
  };

  function renderMessageContent(m) {
    if (m.type === 'place' && m.placeData) {
      var p = m.placeData;
      return '<div class="flex flex-col gap-2">' +
        (m.text ? ('<p class="font-medium">' + m.text + '</p>') : '') +
        '<div class="p-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-900 flex flex-col gap-1.5 shadow-2xs">' +
          '<div class="flex items-center justify-between gap-1">' +
            '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]">' + (p.category || '장소') + '</span>' +
            '<span class="text-[10px] text-slate-400 font-semibold">' + (p.distStr || '중간 지점 부근') + '</span>' +
          '</div>' +
          '<h5 class="text-[13.5px] font-black text-slate-900 tracking-tight leading-snug truncate">' + p.name + '</h5>' +
          '<p class="text-[10.5px] text-slate-500 truncate">' + p.address + '</p>' +
          '<div class="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/70">' +
            '<button type="button" onclick="window.viewPlaceFromChat(\'' + p.id + '\')" class="press py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 flex items-center justify-center gap-0.5 transition-all">' +
              '<i data-lucide="map" class="w-3 h-3 text-[#0284c7]"></i>' +
              '<span>지도</span>' +
            '</button>' +
            '<button type="button" onclick="window.addRouletteFromChat(\'' + escapeJsString(p.name) + '\')" class="press py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 flex items-center justify-center gap-0.5 transition-all">' +
              '<i data-lucide="dices" class="w-3 h-3 text-purple-600"></i>' +
              '<span>룰렛 담기</span>' +
            '</button>' +
            '<button type="button" onclick="window.confirmPlaceFromChat(\'' + p.id + '\', \'' + escapeJsString(p.name) + '\')" class="press py-1 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all">' +
              '<i data-lucide="check" class="w-3 h-3 text-white"></i>' +
              '<span>확정</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    if (m.type === 'hub' && m.hubData) {
      var h = m.hubData;
      return '<div class="flex flex-col gap-2">' +
        '<p class="font-medium">' + m.text + '</p>' +
        '<div class="p-2.5 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] text-slate-900 flex flex-col gap-1 shadow-2xs">' +
          '<div class="flex items-center gap-1 text-[#0284c7] text-[10.5px] font-bold">' +
            '<i data-lucide="compass" class="w-3.5 h-3.5"></i>' +
            '<span>최적 중간 허브 역</span>' +
          '</div>' +
          '<h5 class="text-[14px] font-black text-slate-900 tracking-tight">' + h.name + '</h5>' +
          '<p class="text-[11px] text-slate-600">' + (h.diffText || '양쪽 모두 환승 최소화') + '</p>' +
          '<button type="button" onclick="window.viewHubFromChat()" class="press mt-1 w-full py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all">' +
            '<i data-lucide="zoom-in" class="w-3 h-3"></i>' +
            '<span>중간 지점 지도 보기</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    if (m.type === 'roulette') {
      return '<div class="flex flex-col gap-2">' +
        '<p class="font-medium">' + m.text + '</p>' +
        '<div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-900 flex flex-col gap-1.5 shadow-2xs">' +
          '<div class="flex items-center gap-1 text-purple-600 text-[10.5px] font-bold">' +
            '<i data-lucide="dices" class="w-3.5 h-3.5"></i>' +
            '<span>랜덤 결정 도우미</span>' +
          '</div>' +
          '<p class="text-[11px] text-slate-600">후보 장소들을 룰렛으로 돌려 공정하게 결정해보세요!</p>' +
          '<button type="button" onclick="window.openGameFromChat()" class="press w-full py-1.5 rounded-lg bg-gradient-to-r from-[#66CCFF] to-[#0284c7] hover:from-[#38bdf8] hover:to-[#0369a1] text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-all">' +
            '<i data-lucide="disc" class="w-3 h-3 text-white"></i>' +
            '<span>돌려돌려 룰렛 열기</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    if (m.type === 'poll') {
      var poll = m;
      var totalVotes = poll.totalVotes || 0;
      var isFinished = (poll.status === 'finished');
      var myVote = poll.myVotedOptionId;

      // 1위 후보 찾기
      var maxVotes = -1;
      var topOption = null;
      poll.options.forEach(function(opt) {
        if (opt.votes > maxVotes && opt.votes > 0) {
          maxVotes = opt.votes;
          topOption = opt;
        }
      });

      var optionsHtml = poll.options.map(function(opt) {
        var pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
        var isMyChoice = (myVote === opt.id);
        var isTop = (topOption && topOption.id === opt.id && maxVotes > 0);

        // 전체적인 느낌은 하얀색, 테두리나 버튼만 하늘색
        var cardBorder = isMyChoice
          ? 'border-[#66CCFF] ring-1 ring-[#66CCFF]/35 bg-white shadow-2xs'
          : 'border-slate-200/90 bg-white hover:border-[#bae6fd]';

        var votersHtml = (opt.voters && opt.voters.length > 0)
          ? '<div class="flex items-center gap-1 mt-1">' +
              opt.voters.map(function(v) {
                var vChip = (v === '나')
                  ? 'bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]'
                  : 'bg-slate-100 text-slate-600 border border-slate-200';
                return '<span class="px-1.5 py-0.2 rounded text-[8.5px] font-bold ' + vChip + '">' + v + '</span>';
              }).join('') +
            '</div>'
          : '';

        var btnHtml = isFinished
          ? (isMyChoice ? '<span class="text-[10px] font-bold text-[#0284c7] flex items-center gap-0.5"><i data-lucide="check" class="w-3 h-3"></i>선택</span>' : '')
          : ('<button type="button" onclick="window.voteChatPoll(\'' + poll.pollId + '\', ' + opt.id + ')" class="press px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all ' +
              (isMyChoice ? 'bg-[#0284c7] text-white border border-[#0284c7] shadow-2xs' : 'bg-white hover:bg-sky-50/80 text-[#0284c7] border border-[#bae6fd]') + '">' +
              (isMyChoice ? '선택됨' : '투표') +
            '</button>');

        return '<div class="p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ' + cardBorder + '">' +
          '<div class="flex items-center justify-between gap-1.5">' +
            '<div class="min-w-0 flex-1">' +
              '<div class="flex items-center gap-1.5">' +
                '<span class="font-bold text-[12px] text-slate-900 truncate">' + opt.name + '</span>' +
                (isTop ? '<span class="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-white text-[#0284c7] border border-[#bae6fd] shrink-0">1위</span>' : '') +
              '</div>' +
              '<div class="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">' +
                '<span>' + opt.category + '</span>' +
                '<span class="text-slate-300">·</span>' +
                '<span>' + opt.distStr + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="shrink-0 flex items-center gap-2">' +
              '<span class="text-[11px] font-bold text-slate-600">' + opt.votes + '표 (' + pct + '%)</span>' +
              btnHtml +
            '</div>' +
          '</div>' +
          // 깔끔한 프로그레스 바
          '<div class="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">' +
            '<div class="h-full rounded-full ' + (isTop ? 'bg-[#0284c7]' : 'bg-[#66CCFF]/80') + ' transition-all duration-300" style="width: ' + pct + '%"></div>' +
          '</div>' +
          votersHtml +
        '</div>';
      }).join('');

      var confirmBtnHtml = (!isFinished && topOption && maxVotes > 0)
        ? '<button type="button" onclick="window.confirmPollWinner(\'' + poll.pollId + '\')" class="press mt-1 w-full py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-[11.5px] font-bold flex items-center justify-center gap-1.5 border border-[#0284c7] shadow-xs transition-all">' +
            '<i data-lucide="check-check" class="w-4 h-4 text-white"></i>' +
            '<span>1위 [' + topOption.name + ']로 약속 확정하기</span>' +
          '</button>'
        : '';

      return '<div class="flex flex-col gap-2 min-w-[245px] max-w-[285px] bg-white text-slate-800">' +
        '<div class="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100">' +
          '<div class="flex items-center gap-1.5 text-slate-900 font-bold text-[12px]">' +
            '<i data-lucide="vote" class="w-4 h-4 text-[#0284c7]"></i>' +
            '<span>' + (poll.title || '모임 장소 투표') + '</span>' +
          '</div>' +
          '<span class="text-[10px] text-slate-400 font-medium">' + (isFinished ? '투표 완료' : ('총 ' + totalVotes + '명 참여')) + '</span>' +
        '</div>' +
        '<div class="space-y-1.5">' + optionsHtml + '</div>' +
        confirmBtnHtml +
      '</div>';
    }

    return '<p>' + escapeHtml(m.text) + '</p>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeJsString(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  window.sendChatMessage = function() {
    var input = document.getElementById('chatInputText');
    if (!input || !input.value.trim()) return;
    var userText = input.value.trim();
    input.value = '';

    addMessage({
      sender: '나',
      type: 'text',
      text: userText
    });

    handleAutoResponse(userText);
  };

  function addMessage(msg) {
    msg.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    msg.time = getNowTimeString(0);
    chatState.messages.push(msg);

    if (!chatState.isOpen) {
      chatState.unreadCount++;
      updateUnreadBadges();
      showToast(msg.sender + ': ' + (msg.text ? msg.text.substring(0, 18) + '...' : '장소를 공유했습니다'), 'message-square');
    }

    if (chatState.isOpen) {
      window.renderChatMessages();
      scrollChatToBottom(true);
    }
  }

  function handleAutoResponse(userText) {
    var friends = getFriendProfiles();
    var randomFriend = friends[Math.floor(Math.random() * friends.length)];

    var replyText = '';
    var lower = userText.toLowerCase();

    if (lower.indexOf('카페') !== -1 || lower.indexOf('커피') !== -1 || lower.indexOf('디저트') !== -1) {
      var cafeReplies = [
        '좋아! 디저트 맛있는 곳이나 조용한 카페로 가자',
        '나도 커피 마시고 싶었어! 분위기 좋은 곳 있으면 추천해줘',
        '역 근처에 대형 베이커리 카페 있던데 어때?'
      ];
      replyText = cafeReplies[Math.floor(Math.random() * cafeReplies.length)];
    } else if (lower.indexOf('맛집') !== -1 || lower.indexOf('밥') !== -1 || lower.indexOf('점심') !== -1 || lower.indexOf('저녁') !== -1) {
      var foodReplies = [
        '배고프다 밥 먼저 먹을까? 맛있는 곳 찾아보자',
        '다들 선호하는 메뉴 있어? 일식이랑 양식 둘 다 좋아',
        '중간 지점 맛집 리스트에서 평점 높은 곳 골라보자!'
      ];
      replyText = foodReplies[Math.floor(Math.random() * foodReplies.length)];
    } else if (lower.indexOf('룰렛') !== -1 || lower.indexOf('게임') !== -1 || lower.indexOf('랜덤') !== -1 || lower.indexOf('내기') !== -1) {
      replyText = '룰렛 완전 찬성! 후보 3개 골라서 돌려보자';
    } else if (lower.indexOf('어디') !== -1 || lower.indexOf('중간') !== -1 || lower.indexOf('역') !== -1) {
      var hubName = state.currentHubName || '중간 지점';
      replyText = hubName + ' 쪽이면 다들 환승도 적고 딱 좋을 것 같아!';
    } else {
      var genericReplies = [
        '응 좋아! 확인했어',
        '난 다 좋아, 편한 곳으로 정해줘!',
        '지도에 공유해준 장소들 다 마음에 든다',
        '거기 위치 괜찮네! 시간 맞춰서 출발할게'
      ];
      replyText = genericReplies[Math.floor(Math.random() * genericReplies.length)];
    }

    setTimeout(function() {
      addMessage({
        sender: randomFriend.name,
        avatarColor: randomFriend.color,
        type: 'text',
        text: replyText
      });
    }, 700 + Math.random() * 500);
  }

  /* -------------------------------------------------------------
     퀵 공유 기능 (중간 지점 / 인기 장소 / 룰렛 초대 / 내 위치)
  ------------------------------------------------------------- */
  window.sendChatHubShare = function() {
    var hubName = state.currentHubName || '중간 지점';
    var timeDiffEl = document.getElementById('travelTimeDiff');
    var diffStr = timeDiffEl ? timeDiffEl.textContent : '최적 대중교통 이동 동선';

    addMessage({
      sender: '나',
      type: 'hub',
      text: '우리 모임 최적의 중간 지점을 찾았어!',
      hubData: {
        name: hubName,
        diffText: diffStr
      }
    });

    setTimeout(function() {
      var friends = getFriendProfiles();
      var f = friends[0] || { name: '다은', color: 'bg-rose-500' };
      addMessage({
        sender: f.name,
        avatarColor: f.color,
        type: 'text',
        text: '오 ' + hubName + '이면 지하철로 한 번에 갈 수 있어서 최고다!'
      });
    }, 800);
  };

  window.sendChatTopPlaceShare = function() {
    var cached = Object.values(kakaoPlacesCache || {});
    if (cached.length === 0) {
      showToast('아직 탐색된 장소가 없습니다. 지도를 확인해 주세요.', 'info');
      return;
    }
    var p = cached[0];
    window.sharePlaceToChat(p.id, '여기 분위기 진짜 좋은 것 같은데 어때?');
  };

  window.sendChatRouletteInvite = function() {
    addMessage({
      sender: '나',
      type: 'roulette',
      text: '장소 고민되면 룰렛 돌려서 랜덤으로 결정해보자!'
    });

    setTimeout(function() {
      var friends = getFriendProfiles();
      var f = friends[friends.length - 1] || { name: '영은', color: 'bg-emerald-600' };
      addMessage({
        sender: f.name,
        avatarColor: f.color,
        type: 'text',
        text: '오 룰렛 콜! 후보 담아서 바로 돌려보자'
      });
    }, 800);
  };

  window.sendChatLocationStatus = function() {
    var myAddr = state.myAddress || '내 위치';
    addMessage({
      sender: '나',
      type: 'text',
      text: '나 지금 [' + myAddr + ']에서 출발 준비 중이야. 다들 슬슬 준비하자!'
    });

    setTimeout(function() {
      var friends = getFriendProfiles();
      var f = friends[0] || { name: '다은', color: 'bg-rose-500' };
      addMessage({
        sender: f.name,
        avatarColor: f.color,
        type: 'text',
        text: '확인! 나도 시간 맞춰서 나갈게~'
      });
    }, 900);
  };

  /* -------------------------------------------------------------
     장소 카드에서 "채팅에 공유" 클릭 시 호출
  ------------------------------------------------------------- */
  window.sharePlaceToChat = function(placeId, customIntroText) {
    var p = kakaoPlacesCache[placeId];
    if (!p) {
      showToast('장소 정보를 찾을 수 없습니다', 'alert-circle');
      return;
    }

    var distStr = '';
    if (state.currentHubCoord) {
      var pCoord = [parseFloat(p.y), parseFloat(p.x)];
      var d = calculateDistance(state.currentHubCoord[0], state.currentHubCoord[1], pCoord[0], pCoord[1]);
      distStr = d < 1000 ? Math.round(d) + 'm' : (d / 1000).toFixed(1) + 'km';
    }

    var subCat = (p.category_name || '').split('>').pop().trim() || '추천 장소';

    addMessage({
      sender: '나',
      type: 'place',
      text: customIntroText || ('이 장소 어때? 같이 가보자!'),
      placeData: {
        id: p.id,
        name: p.place_name,
        category: subCat,
        address: p.road_address_name || p.address_name,
        distStr: distStr ? ('중간점에서 ' + distStr) : '',
        url: p.place_url
      }
    });

    window.openChatDrawer();

    setTimeout(function() {
      var friends = getFriendProfiles();
      var f = friends[Math.floor(Math.random() * friends.length)];
      var reactions = [
        '오 ' + p.place_name + ' 평점 진짜 높네! 좌석도 넓어 보여',
        '여기 리뷰 보니까 디저트 맛있대! 난 완전 찬성',
        '인테리어 깔끔하고 분위기 좋다! 여기로 확정할까?'
      ];
      addMessage({
        sender: f.name,
        avatarColor: f.color,
        type: 'text',
        text: reactions[Math.floor(Math.random() * reactions.length)]
      });
    }, 900);
  };

  /* -------------------------------------------------------------
     채팅 내 카드 액션 버튼 핸들러
  ------------------------------------------------------------- */
  window.viewPlaceFromChat = function(placeId) {
    window.closeChatDrawer();
    if (window.focusKakaoPlace) {
      window.focusKakaoPlace(placeId);
    }
  };

  window.addRouletteFromChat = function(placeName) {
    if (window.addGameItemDirectly) {
      var added = window.addGameItemDirectly(placeName);
      if (added) {
        showToast('[' + placeName + '] 룰렛 후보에 담았습니다', 'check');
      }
    }
  };

  window.confirmPlaceFromChat = function(placeId, placeName) {
    if (window.confirmMeetingPlace) {
      window.confirmMeetingPlace(placeId, placeName);
      window.closeChatDrawer();
    }
  };

  window.viewHubFromChat = function() {
    window.closeChatDrawer();
    if (window.zoomToHub) {
      window.zoomToHub(false);
    }
  };

  window.openGameFromChat = function() {
    window.closeChatDrawer();
    if (window.openGameModal) {
      window.openGameModal();
    }
  };

  /* -------------------------------------------------------------
     모임 장소 실시간 투표 (Poll Widget) 시스템
  ------------------------------------------------------------- */
  window.sendChatPlacePoll = function() {
    var candidates = [];

    // 1. kakaoPlacesCache에서 2~3개 추출
    if (typeof kakaoPlacesCache !== 'undefined') {
      for (var k in kakaoPlacesCache) {
        var p = kakaoPlacesCache[k];
        if (p && p.place_name) {
          var distM = parseInt(p.distance, 10);
          var distStr = isNaN(distM) ? '중간 지점 인근' : (distM < 1000 ? (distM + 'm') : ((distM / 1000).toFixed(1) + 'km'));
          candidates.push({
            placeId: p.id,
            name: p.place_name,
            category: p.category_name ? p.category_name.split(' > ').pop() : '장소',
            distStr: distStr
          });
          if (candidates.length >= 3) break;
        }
      }
    }

    // 2. 캐시에 없거나 부족할 때 정갈한 추천 후보지
    if (candidates.length < 2) {
      candidates = [
        { placeId: 'place_sample_1', name: '레드버튼 보드게임카페 이수역점', category: '보드게임/놀거리', distStr: '중간역 도보 3분' },
        { placeId: 'place_sample_2', name: '투썸플레이스 사당점', category: '디저트 카페', distStr: '중간역 1번 출구 앞' },
        { placeId: 'place_sample_3', name: '스타벅스 이수역점', category: '커피 전문점', distStr: '중간역 4번 출구 앞' }
      ];
    }

    // 후보지 캐시 등록 (장소 확정 시 이름과 좌표가 올바르게 연동되도록 보장)
    if (typeof kakaoPlacesCache !== 'undefined') {
      candidates.forEach(function(c) {
        var existing = kakaoPlacesCache[c.placeId] || kakaoPlacesCache[c.name];
        var item = existing || {
          id: c.placeId,
          place_name: c.name,
          category_name: c.category,
          distance: '200'
        };
        kakaoPlacesCache[c.placeId] = item;
        kakaoPlacesCache[c.name] = item;
      });
    }

    var pollId = 'poll_' + Date.now();
    var pollOptions = candidates.map(function(c, idx) {
      return {
        id: idx,
        placeId: c.placeId,
        name: c.name,
        category: c.category,
        distStr: c.distStr,
        votes: 0,
        voters: []
      };
    });

    addMessage({
      sender: '나',
      type: 'poll',
      pollId: pollId,
      title: '모임 장소 다수결 투표',
      options: pollOptions,
      status: 'active',
      myVotedOptionId: null,
      totalVotes: 0,
      winnerOption: null
    });

    showToast('장소 결정 투표를 올렸습니다', 'check-square');

    // 친구들의 자연스러운 반응 & 자동 투표 참여 시뮬레이션
    setTimeout(function() {
      addMessage({
        sender: '다은',
        avatarColor: 'bg-rose-500',
        type: 'text',
        text: '오 투표 올라왔다! 다들 어디 갈래? 난 바로 투표할게~'
      });

      // 다은이 첫 번째 후보에 1표 투표
      setTimeout(function() {
        simulateFriendVote(pollId, '다은', 0);
      }, 700);
    }, 800);
  };

  window.voteChatPoll = function(pollId, optionId) {
    var pollMsg = chatState.messages.find(function(m) { return m.pollId === pollId; });
    if (!pollMsg || pollMsg.status === 'finished') return;

    var oldChoice = pollMsg.myVotedOptionId;
    if (oldChoice === optionId) return; // 이미 선택한 항목

    // 이전 투표 취소 (재투표 지원)
    if (oldChoice !== null && oldChoice !== undefined) {
      var prevOpt = pollMsg.options.find(function(o) { return o.id === oldChoice; });
      if (prevOpt && prevOpt.votes > 0) {
        prevOpt.votes--;
        prevOpt.voters = prevOpt.voters.filter(function(v) { return v !== '나'; });
        pollMsg.totalVotes--;
      }
    }

    // 신규 투표 적용
    var targetOpt = pollMsg.options.find(function(o) { return o.id === optionId; });
    if (targetOpt) {
      targetOpt.votes++;
      if (!targetOpt.voters.includes('나')) targetOpt.voters.push('나');
      pollMsg.totalVotes++;
      pollMsg.myVotedOptionId = optionId;
      showToast('[' + targetOpt.name + ']에 투표했습니다', 'check');
    }

    window.renderChatMessages();

    // 아직 영은이가 투표하지 않았다면, 내가 투표한 뒤 영은이도 자동 투표 참여
    var hasYoungeunVoted = pollMsg.options.some(function(o) { return o.voters && o.voters.includes('영은'); });
    if (!hasYoungeunVoted) {
      setTimeout(function() {
        var youngeunChoice = (optionId === 0) ? 0 : 1;
        simulateFriendVote(pollId, '영은', youngeunChoice);
        var chosenPlaceName = pollMsg.options[youngeunChoice].name;
        addMessage({
          sender: '영은',
          avatarColor: 'bg-emerald-600',
          type: 'text',
          text: '나도 [' + chosenPlaceName + '] 찬성! 여기로 다들 모이자!'
        });
      }, 1200);
    }
  };

  function simulateFriendVote(pollId, friendName, optionId) {
    var pollMsg = chatState.messages.find(function(m) { return m.pollId === pollId; });
    if (!pollMsg || pollMsg.status === 'finished') return;

    var opt = pollMsg.options.find(function(o) { return o.id === optionId; });
    if (opt && !opt.voters.includes(friendName)) {
      opt.votes++;
      opt.voters.push(friendName);
      pollMsg.totalVotes++;
      window.renderChatMessages();
    }
  }

  window.confirmPollWinner = function(pollId) {
    var pollMsg = chatState.messages.find(function(m) { return m.pollId === pollId; });
    if (!pollMsg) return;

    // 1위 후보 찾기
    var topOption = null;
    var maxVotes = -1;
    pollMsg.options.forEach(function(o) {
      if (o.votes > maxVotes) {
        maxVotes = o.votes;
        topOption = o;
      }
    });

    if (!topOption) return;

    pollMsg.status = 'finished';
    pollMsg.winnerOption = topOption;

    // 모임 장소 확정 실행 (ID와 함께 실제 장소명을 전달하여 숫자로 표시되는 현상 방지)
    window.confirmPlaceFromChat(topOption.placeId || topOption.name, topOption.name);

    addMessage({
      type: 'system',
      text: "투표 결과 최다 득표를 받은 '" + topOption.name + "'(으)로 최종 모임 장소가 확정되었습니다!"
    });
  };

  /* -------------------------------------------------------------
     외부 이벤트 연동: 약속 확정 / 취소 알림
  ------------------------------------------------------------- */
  window.notifyPlaceConfirmedToChat = function(placeName, address) {
    addMessage({
      type: 'system',
      text: "'" + placeName + "'(으)로 최종 모임 장소가 확정되었습니다."
    });

    setTimeout(function() {
      addMessage({
        sender: '다은',
        avatarColor: 'bg-rose-500',
        type: 'text',
        text: '와! 결정된 [' + placeName + '] 너무 좋다! 거기로 가자~'
      });
    }, 600);

    setTimeout(function() {
      addMessage({
        sender: '영은',
        avatarColor: 'bg-emerald-600',
        type: 'text',
        text: '오예 장소 확정 완료! 다들 늦지 말고 ' + placeName + '에서 봐!'
      });
    }, 1200);
  };

  window.notifyPlaceCancelledToChat = function() {
    addMessage({
      type: 'system',
      text: '모임 장소 확정이 변경/취소되어 중간 지점 탐색 모드로 전환되었습니다.'
    });
  };

  // 초기 뱃지 동기화
  document.addEventListener('DOMContentLoaded', function() {
    updateUnreadBadges();
  });

})();
