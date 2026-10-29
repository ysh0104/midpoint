/**
 * MidPoint - Global State Management
 */
var cachedLoc = null;
try {
  var rawLoc = localStorage.getItem('user_last_my_location');
  if (rawLoc) cachedLoc = JSON.parse(rawLoc);
} catch (e) {}

var initCoord = (cachedLoc && cachedLoc.coords) ? cachedLoc.coords : DEFAULT_LOC;
var initAddr = (cachedLoc && cachedLoc.addr) ? cachedLoc.addr : '실제 위치 확인 중...';
var initShort = (cachedLoc && cachedLoc.shortName) ? cachedLoc.shortName : '내 위치';

var state = {
  myLocation: initCoord,
  myAddress: initAddr,
  locations: [
    { id: 'loc_me', name: '내 위치', shortName: initShort, addr: initAddr, loc: initCoord, isMe: true, transport: 'car' }
  ],
  markers: {},
  hubMarker: null,
  lines: [],
  placeMarkers: [],
  sheetExpanded: false,
  selectedCategory: 'CE7', // 'CE7': 카페, 'FD6': 맛집
  currentHubCoord: null,
  currentHubName: '',
  confirmedPlace: null,
  routePolylines: [],
  transitMarkers: [],
  isNaviMode: false,
  careHero: null,
  currentVoucherType: 'kakaot',
  selectedGiftAmount: 3000,
  meetFilter: {
    purpose: 'all',    // 'all' | 'business' | 'date' | 'friends' | 'group'
    ageGroup: 'all',   // 'all' | '20s' | '30s' | '40s'
    gender: 'all',     // 'all' | 'female' | 'male'
    transportPref: 'mixed' // 'transit' | 'car' | 'mixed'
  },
  tempMeetFilter: {
    purpose: 'all',
    ageGroup: 'all',
    gender: 'all',
    transportPref: 'mixed'
  }
};

var participantRouteDetails = {};
var searchResultsCache = {};
var kakaoPlacesCache = {};
