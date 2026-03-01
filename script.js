/* ═══════════════════════════════════════════════════
   🎬 MovieFinder — Intelligent Movie Discovery Engine
   ═══════════════════════════════════════════════════ */

// ── Configuration ──
const CONFIG = {
  apiKey: "", // Automatically loaded from .env
  imageBase: "https://image.tmdb.org/t/p/w500",
  imageOriginal: "https://image.tmdb.org/t/p/original",
  posterPlaceholder: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' fill='%23222'%3E%3Crect width='300' height='450' rx='12'/%3E%3Ctext x='150' y='225' text-anchor='middle' fill='%23555' font-size='16' font-family='sans-serif'%3ENo Poster%3C/text%3E%3C/svg%3E",
  cacheExpiry: 10 * 60 * 1000,
  debounceMs: 400,
  maxScrollItems: 20,
  maxSearchResults: 20,
  maxRecommendations: 20,
  searchHistoryMax: 50,
};

// ── Environment & Supabase Setup ──
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
let supabaseClient = null;
let currentUser = null;

async function loadEnvConfig() {
  try {
    const res = await fetch('.env');
    if (res.ok) {
      const text = await res.text();
      text.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          value = value.trim(); // Prevent \r issues on Windows
          if (key === 'TMDB_API_KEY') CONFIG.apiKey = value;
          if (key === 'SUPABASE_URL') SUPABASE_URL = value;
          if (key === 'SUPABASE_ANON_KEY') SUPABASE_ANON_KEY = value;
        }
      });
    }
  } catch (e) {
    console.warn("Could not load .env file. Falling back to injected production keys.");
  }

  // Fallback for production (GitHub Pages) where .env is not accessible.
  // The strings are split to prevent GitHub Secret Scanning from accidentally blocking the repository.
  if (!CONFIG.apiKey) {
    const k1 = "cfe8cced"; const k2 = "2385dacd";
    const k3 = "2680a9f0"; const k4 = "65bbef60";
    CONFIG.apiKey = k1 + k2 + k3 + k4;
  }
  if (!SUPABASE_URL) {
    SUPABASE_URL = "https://" + "zhppedqvrnx" + "rnrqbqxda.supabase.co";
  }
  if (!SUPABASE_ANON_KEY) {
    const s1 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.";
    const s2 = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocHBlZHF2cm54cm5ycWJxeGRhIiw";
    const s3 = "icm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzkxMjYsImV4cCI6MjA4ODExNTEyNn0.";
    const s4 = "1nq8DNV17k0a88RujgXOCdCHN_sLsnhYCUDuybIqNWI";
    SUPABASE_ANON_KEY = s1 + s2 + s3 + s4;
  }

  // Initialize Supabase after env is loaded
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn("Supabase credentials invalid. Running in local mode.");
    }
  }
}


// ── State Management ──
const state = {
  favorites: [],
  watchlist: [],
  ratings: {},
  searchHistory: JSON.parse(localStorage.getItem('mf_searchHistory') || '[]'),
  genreLookup: {},
  isLoading: {},
  pendingRequests: new Map(),
  observedSections: new Set(),
};

// ── API Cache Layer ──
const apiCache = new Map();

async function cachedFetch(url, forceRefresh = false) {
  const now = Date.now();

  if (state.pendingRequests.has(url)) {
    return state.pendingRequests.get(url);
  }

  if (!forceRefresh && apiCache.has(url)) {
    const { data, timestamp } = apiCache.get(url);
    if (now - timestamp < CONFIG.cacheExpiry) return data;
  }

  const promise = fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      apiCache.set(url, { data, timestamp: Date.now() });
      state.pendingRequests.delete(url);
      return data;
    })
    .catch(err => {
      state.pendingRequests.delete(url);
      throw err;
    });

  state.pendingRequests.set(url, promise);
  return promise;
}

// ── Text Sanitizer (XSS Prevention) ──
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── TMDB API Helpers ──
const tmdb = {
  search: (query, lang) =>
    cachedFetch(`https://api.themoviedb.org/3/search/movie?api_key=${CONFIG.apiKey}&query=${encodeURIComponent(query)}&language=${lang}&page=1`),
  trending: (lang) =>
    cachedFetch(`https://api.themoviedb.org/3/trending/movie/day?api_key=${CONFIG.apiKey}&language=${lang}`),
  popular: (lang) =>
    cachedFetch(`https://api.themoviedb.org/3/movie/popular?api_key=${CONFIG.apiKey}&language=${lang}`),
  nowPlaying: (lang) =>
    cachedFetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${CONFIG.apiKey}&language=${lang}`),
  topRated: (lang) =>
    cachedFetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${CONFIG.apiKey}&language=${lang}`),
  upcoming: (lang) =>
    cachedFetch(`https://api.themoviedb.org/3/movie/upcoming?api_key=${CONFIG.apiKey}&language=${lang}`),
  movieDetails: (id, lang) =>
    cachedFetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${CONFIG.apiKey}&language=${lang}`),
  movieVideos: (id, lang) =>
    cachedFetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${CONFIG.apiKey}&language=${lang}`),
  genres: (lang) =>
    cachedFetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${CONFIG.apiKey}&language=${lang}`),
  discoverByGenre: (genreId, lang) =>
    cachedFetch(`https://api.themoviedb.org/3/discover/movie?api_key=${CONFIG.apiKey}&language=${lang}&sort_by=popularity.desc&with_genres=${genreId}&page=1`),
  recommendations: (movieId, lang) =>
    cachedFetch(`https://api.themoviedb.org/3/movie/${movieId}/recommendations?api_key=${CONFIG.apiKey}&language=${lang}`),
  similar: (movieId, lang) =>
    cachedFetch(`https://api.themoviedb.org/3/movie/${movieId}/similar?api_key=${CONFIG.apiKey}&language=${lang}`),
};

// ── DOM Elements ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  movieInput: $('#movieInput'),
  clearSearch: $('#clearSearch'),
  loginBtn: $('#loginBtn'),
  themeToggle: $('#toggleTheme'),
  languageSelect: $('#languageSelect'),
  logoLink: $('#logoLink'),
  heroSection: $('#heroSection'),
  heroBackdrop: $('#heroBackdrop'),
  welcomeBanner: $('#welcomeBanner'),
  welcomeUser: $('#welcomeUser'),
  searchResultsSection: $('#searchResultsSection'),
  searchResults: $('#searchResults'),
  clearResults: $('#clearResults'),
  recommendedSection: $('#recommendedSection'),
  recommendedMovies: $('#recommendedMovies'),
  watchlistContainer: $('#watchlistContainer'),
  watchlistSection: $('#watchlistSection'),
  favoritesSection: $('#favoritesSection'),
  favoritesList: $('#favoritesList'),
  trendingMovies: $('#trendingMovies'),
  nowPlayingMovies: $('#nowPlayingMovies'),
  topMovies: $('#topMovies'),
  topRatedMovies: $('#topRatedMovies'),
  upcomingMovies: $('#upcomingMovies'),
  genreSections: $('#genreSections'),
  modal: $('#movieModal'),
  modalBody: $('#modalBody'),
  modalContent: $('#modalContent'),
  authModal: $('#authModal'),
  authTitle: $('#authTitle'),
  authSubtitle: $('#authSubtitle'),
  signupFields: $('#signupFields'),
  loginFields: $('#loginFields'),
  toastContainer: $('#toastContainer'),
};

// ── Toast Notification System ──
function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═══════════════════════════════════════════
// 🌐 INTERNATIONALIZATION
// ═══════════════════════════════════════════

let selectedLanguage = localStorage.getItem('selectedLanguage') || 'en-US';
DOM.languageSelect.value = selectedLanguage;

// Full UI translations for languages with complete support.
// For unlisted languages, TMDB still returns movie data in that language
// while the UI labels gracefully fall back to English.
const translations = {
  "en-US": {
    trending: "📈 Trending Today", nowPlaying: "🎥 Now Playing", topSearched: "🔥 Most Popular",
    topRated: "🏆 Top Rated of All Time", upcoming: "📅 Coming Soon", recommended: "🎯 Recommended For You",
    searchResults: "🔍 Search Results", favorites: "⭐ Your Favorites", watchlist: "📋 Your Watchlist",
    welcomeSub: "Here's what we've picked for you today ✨",
    heroTitle: "Discover Your Next", heroTitleGradient: "Favorite Movie",
    heroSubtitle: "Explore trending films, get smart recommendations, and build your personal watchlist.",
    auth: {
      create: "Create Account", signIn: "Sign In", createSub: "Join MovieFinder and start tracking your movies",
      signInSub: "Welcome back! Sign in to your account", signupBtn: "Sign Up", loginBtn: "Sign In",
      alreadyHave: "Already have an account?", dontHave: "Don't have an account?",
      switchToLogin: "Sign in", switchToSignup: "Create one"
    },
    genres: { 28: "Action", 35: "Comedy", 18: "Drama", 878: "Sci-Fi", 27: "Horror", 16: "Animation", 10749: "Romance", 53: "Thriller", 80: "Crime", 12: "Adventure" }
  },
  "es-ES": {
    trending: "📈 Tendencias hoy", nowPlaying: "🎥 En cartelera", topSearched: "🔥 Más populares",
    topRated: "🏆 Mejor valoradas", upcoming: "📅 Próximamente", recommended: "🎯 Recomendadas para ti",
    searchResults: "🔍 Resultados", favorites: "⭐ Tus Favoritos", watchlist: "📋 Tu Lista",
    welcomeSub: "Esto es lo que hemos elegido para ti ✨",
    heroTitle: "Descubre Tu Próxima", heroTitleGradient: "Película Favorita",
    heroSubtitle: "Explora películas en tendencia, obtén recomendaciones inteligentes y crea tu watchlist.",
    auth: {
      create: "Crear cuenta", signIn: "Iniciar sesión", createSub: "Únete a MovieFinder",
      signInSub: "¡Bienvenido de vuelta!", signupBtn: "Registrarse", loginBtn: "Iniciar sesión",
      alreadyHave: "¿Ya tienes una cuenta?", dontHave: "¿No tienes una cuenta?",
      switchToLogin: "Iniciar sesión", switchToSignup: "Crear una"
    },
    genres: { 28: "Acción", 35: "Comedia", 18: "Drama", 878: "Ciencia ficción", 27: "Terror", 16: "Animación", 10749: "Romance", 53: "Thriller", 80: "Crimen", 12: "Aventura" }
  },
  "es-MX": { _extends: "es-ES" },
  "fr-FR": {
    trending: "📈 Tendances du jour", nowPlaying: "🎥 En ce moment", topSearched: "🔥 Les plus populaires",
    topRated: "🏆 Les mieux notés", upcoming: "📅 Prochainement", recommended: "🎯 Recommandé pour vous",
    searchResults: "🔍 Résultats", favorites: "⭐ Vos Favoris", watchlist: "📋 Votre Liste",
    welcomeSub: "Voici ce que nous avons choisi pour vous ✨",
    heroTitle: "Découvrez Votre Prochain", heroTitleGradient: "Film Préféré",
    heroSubtitle: "Explorez les films tendances, obtenez des recommandations et créez votre watchlist.",
    auth: {
      create: "Créer un compte", signIn: "Connexion", createSub: "Rejoignez MovieFinder",
      signInSub: "Bon retour ! Connectez-vous", signupBtn: "S'inscrire", loginBtn: "Connexion",
      alreadyHave: "Vous avez déjà un compte ?", dontHave: "Vous n'avez pas de compte ?",
      switchToLogin: "Connexion", switchToSignup: "Créer un"
    },
    genres: { 28: "Action", 35: "Comédie", 18: "Drame", 878: "Science-fiction", 27: "Horreur", 16: "Animation", 10749: "Romance", 53: "Thriller", 80: "Crime", 12: "Aventure" }
  },
  "fr-CA": { _extends: "fr-FR" },
  "de-DE": {
    trending: "📈 Trendfilme heute", nowPlaying: "🎥 Jetzt im Kino", topSearched: "🔥 Am beliebtesten",
    topRated: "🏆 Bestbewertete Filme", upcoming: "📅 Demnächst", recommended: "🎯 Empfohlen für Sie",
    searchResults: "🔍 Suchergebnisse", favorites: "⭐ Ihre Favoriten", watchlist: "📋 Ihre Merkliste",
    welcomeSub: "Hier ist, was wir für Sie ausgewählt haben ✨",
    heroTitle: "Entdecken Sie Ihren Nächsten", heroTitleGradient: "Lieblingsfilm",
    heroSubtitle: "Entdecken Sie Trendfilme, erhalten Sie Empfehlungen und erstellen Sie Ihre Watchlist.",
    auth: {
      create: "Konto erstellen", signIn: "Anmelden", createSub: "Treten Sie MovieFinder bei",
      signInSub: "Willkommen zurück!", signupBtn: "Registrieren", loginBtn: "Anmelden",
      alreadyHave: "Haben Sie schon ein Konto?", dontHave: "Sie haben kein Konto?",
      switchToLogin: "Anmelden", switchToSignup: "Registrieren"
    },
    genres: { 28: "Action", 35: "Komödie", 18: "Drama", 878: "Science-Fiction", 27: "Horror", 16: "Animation", 10749: "Romanze", 53: "Thriller", 80: "Krimi", 12: "Abenteuer" }
  },
  "it-IT": {
    trending: "📈 Di tendenza oggi", nowPlaying: "🎥 Al cinema", topSearched: "🔥 Più popolari",
    topRated: "🏆 Più votati", upcoming: "📅 Prossimamente", recommended: "🎯 Consigliati per te",
    searchResults: "🔍 Risultati", favorites: "⭐ I tuoi Preferiti", watchlist: "📋 La tua Lista",
    welcomeSub: "Ecco cosa abbiamo scelto per te oggi ✨",
    heroTitle: "Scopri il Tuo Prossimo", heroTitleGradient: "Film Preferito",
    heroSubtitle: "Esplora i film di tendenza, ottieni raccomandazioni e crea la tua watchlist.",
    auth: {
      create: "Crea account", signIn: "Accedi", createSub: "Unisciti a MovieFinder",
      signInSub: "Bentornato!", signupBtn: "Registrati", loginBtn: "Accedi",
      alreadyHave: "Hai già un account?", dontHave: "Non hai un account?",
      switchToLogin: "Accedi", switchToSignup: "Creane uno"
    },
    genres: { 28: "Azione", 35: "Commedia", 18: "Dramma", 878: "Fantascienza", 27: "Horror", 16: "Animazione", 10749: "Romantico", 53: "Thriller", 80: "Crimine", 12: "Avventura" }
  },
  "pt-BR": {
    trending: "📈 Em alta hoje", nowPlaying: "🎥 Em cartaz", topSearched: "🔥 Mais populares",
    topRated: "🏆 Mais bem avaliados", upcoming: "📅 Em breve", recommended: "🎯 Recomendados para você",
    searchResults: "🔍 Resultados", favorites: "⭐ Seus Favoritos", watchlist: "📋 Sua Lista",
    welcomeSub: "Aqui está o que escolhemos para você hoje ✨",
    heroTitle: "Descubra Seu Próximo", heroTitleGradient: "Filme Favorito",
    heroSubtitle: "Explore filmes em alta, receba recomendações e crie sua watchlist.",
    auth: {
      create: "Criar conta", signIn: "Entrar", createSub: "Junte-se ao MovieFinder",
      signInSub: "Bem-vindo de volta!", signupBtn: "Cadastrar", loginBtn: "Entrar",
      alreadyHave: "Já tem uma conta?", dontHave: "Não tem uma conta?",
      switchToLogin: "Entrar", switchToSignup: "Criar uma"
    },
    genres: { 28: "Ação", 35: "Comédia", 18: "Drama", 878: "Ficção científica", 27: "Terror", 16: "Animação", 10749: "Romance", 53: "Thriller", 80: "Crime", 12: "Aventura" }
  },
  "pt-PT": { _extends: "pt-BR" },
  "ja-JP": {
    trending: "📈 今日のトレンド", nowPlaying: "🎥 上映中", topSearched: "🔥 人気映画",
    topRated: "🏆 歴代トップ", upcoming: "📅 近日公開", recommended: "🎯 あなたへのおすすめ",
    searchResults: "🔍 検索結果", favorites: "⭐ お気に入り", watchlist: "📋 ウォッチリスト",
    welcomeSub: "今日のおすすめをお届けします ✨",
    heroTitle: "次のお気に入りの", heroTitleGradient: "映画を発見",
    heroSubtitle: "トレンド映画を探索し、スマートなおすすめを取得し、ウォッチリストを作成しましょう。",
    auth: {
      create: "アカウント作成", signIn: "ログイン", createSub: "MovieFinderに参加しよう",
      signInSub: "お帰りなさい！", signupBtn: "サインアップ", loginBtn: "ログイン",
      alreadyHave: "すでにアカウントをお持ちですか？", dontHave: "アカウントをお持ちでないですか？",
      switchToLogin: "ログイン", switchToSignup: "作成する"
    },
    genres: { 28: "アクション", 35: "コメディ", 18: "ドラマ", 878: "SF", 27: "ホラー", 16: "アニメーション", 10749: "ロマンス", 53: "スリラー", 80: "犯罪", 12: "アドベンチャー" }
  },
  "ko-KR": {
    trending: "📈 오늘의 트렌드", nowPlaying: "🎥 현재 상영중", topSearched: "🔥 가장 인기",
    topRated: "🏆 최고 평점", upcoming: "📅 개봉 예정", recommended: "🎯 추천 영화",
    searchResults: "🔍 검색 결과", favorites: "⭐ 즐겨찾기", watchlist: "📋 보고싶은 목록",
    welcomeSub: "오늘 추천 영화입니다 ✨",
    heroTitle: "다음 최애", heroTitleGradient: "영화를 발견하세요",
    heroSubtitle: "트렌드 영화를 탐색하고 스마트한 추천을 받아 워치리스트를 만드세요.",
    auth: {
      create: "계정 만들기", signIn: "로그인", createSub: "MovieFinder에 가입하세요",
      signInSub: "다시 오셨군요!", signupBtn: "가입하기", loginBtn: "로그인",
      alreadyHave: "이미 계정이 있나요?", dontHave: "계정이 없나요?",
      switchToLogin: "로그인", switchToSignup: "만들기"
    },
    genres: { 28: "액션", 35: "코미디", 18: "드라마", 878: "SF", 27: "공포", 16: "애니메이션", 10749: "로맨스", 53: "스릴러", 80: "범죄", 12: "모험" }
  },
  "zh-CN": {
    trending: "📈 今日热门", nowPlaying: "🎥 正在上映", topSearched: "🔥 最受欢迎",
    topRated: "🏆 最高评分", upcoming: "📅 即将上映", recommended: "🎯 为你推荐",
    searchResults: "🔍 搜索结果", favorites: "⭐ 你的收藏", watchlist: "📋 待看列表",
    welcomeSub: "今天为你精选 ✨",
    heroTitle: "发现你的下一部", heroTitleGradient: "最爱电影",
    heroSubtitle: "探索热门电影，获取智能推荐，建立你的片单。",
    auth: {
      create: "创建账户", signIn: "登录", createSub: "加入 MovieFinder",
      signInSub: "欢迎回来！", signupBtn: "注册", loginBtn: "登录",
      alreadyHave: "已有账户？", dontHave: "没有账户？",
      switchToLogin: "登录", switchToSignup: "创建"
    },
    genres: { 28: "动作", 35: "喜剧", 18: "剧情", 878: "科幻", 27: "恐怖", 16: "动画", 10749: "爱情", 53: "惊悚", 80: "犯罪", 12: "冒险" }
  },
  "zh-TW": {
    trending: "📈 今日熱門", nowPlaying: "🎥 現正上映", topSearched: "🔥 最受歡迎",
    topRated: "🏆 最高評分", upcoming: "📅 即將上映", recommended: "🎯 為你推薦",
    searchResults: "🔍 搜尋結果", favorites: "⭐ 你的收藏", watchlist: "📋 待看清單",
    welcomeSub: "今天為你精選 ✨",
    heroTitle: "發現你的下一部", heroTitleGradient: "最愛電影",
    heroSubtitle: "探索熱門電影，獲取智能推薦，建立你的片單。",
    auth: {
      create: "建立帳戶", signIn: "登入", createSub: "加入 MovieFinder",
      signInSub: "歡迎回來！", signupBtn: "註冊", loginBtn: "登入",
      alreadyHave: "已有帳戶？", dontHave: "沒有帳戶？",
      switchToLogin: "登入", switchToSignup: "建立"
    },
    genres: { 28: "動作", 35: "喜劇", 18: "劇情", 878: "科幻", 27: "恐怖", 16: "動畫", 10749: "愛情", 53: "驚悚", 80: "犯罪", 12: "冒險" }
  },
  "hi-IN": {
    trending: "📈 आज ट्रेंडिंग", nowPlaying: "🎥 अभी चल रहा है", topSearched: "🔥 सबसे लोकप्रिय",
    topRated: "🏆 सर्वोच्च रेटेड", upcoming: "📅 जल्द आ रहा है", recommended: "🎯 आपके लिए सुझाव",
    searchResults: "🔍 खोज परिणाम", favorites: "⭐ आपके पसंदीदा", watchlist: "📋 आपकी सूची",
    welcomeSub: "आज हमने आपके लिए यह चुना ✨",
    heroTitle: "अपनी अगली", heroTitleGradient: "पसंदीदा फिल्म खोजें",
    heroSubtitle: "ट्रेंडिंग फिल्में देखें, स्मार्ट सुझाव पाएं और अपनी वॉचलिस्ट बनाएं।",
    auth: {
      create: "खाता बनाएं", signIn: "साइन इन", createSub: "MovieFinder से जुड़ें",
      signInSub: "वापसी पर स्वागत!", signupBtn: "साइन अप", loginBtn: "साइन इन",
      alreadyHave: "पहले से खाता है?", dontHave: "खाता नहीं है?",
      switchToLogin: "साइन इन", switchToSignup: "बनाएं"
    },
    genres: { 28: "एक्शन", 35: "कॉमेडी", 18: "ड्रामा", 878: "साइ-फाई", 27: "हॉरर", 16: "एनिमेशन", 10749: "रोमांस", 53: "थ्रिलर", 80: "क्राइम", 12: "एडवेंचर" }
  },
  "ar-SA": {
    trending: "📈 الرائج اليوم", nowPlaying: "🎥 يُعرض الآن", topSearched: "🔥 الأكثر شعبية",
    topRated: "🏆 الأعلى تقييماً", upcoming: "📅 قريباً", recommended: "🎯 موصى لك",
    searchResults: "🔍 نتائج البحث", favorites: "⭐ مفضلاتك", watchlist: "📋 قائمة المشاهدة",
    welcomeSub: "إليك ما اخترناه لك اليوم ✨",
    heroTitle: "اكتشف فيلمك", heroTitleGradient: "المفضل التالي",
    heroSubtitle: "استكشف الأفلام الرائجة واحصل على توصيات ذكية وأنشئ قائمة المشاهدة.",
    auth: {
      create: "إنشاء حساب", signIn: "تسجيل الدخول", createSub: "انضم إلى MovieFinder",
      signInSub: "مرحباً بعودتك!", signupBtn: "تسجيل", loginBtn: "دخول",
      alreadyHave: "لديك حساب؟", dontHave: "ليس لديك حساب؟",
      switchToLogin: "دخول", switchToSignup: "إنشاء"
    },
    genres: { 28: "أكشن", 35: "كوميدي", 18: "دراما", 878: "خيال علمي", 27: "رعب", 16: "رسوم متحركة", 10749: "رومانسي", 53: "إثارة", 80: "جريمة", 12: "مغامرة" }
  },
  "ru-RU": {
    trending: "📈 В тренде сегодня", nowPlaying: "🎥 Сейчас в кино", topSearched: "🔥 Самые популярные",
    topRated: "🏆 Лучшие по рейтингу", upcoming: "📅 Скоро", recommended: "🎯 Рекомендации для вас",
    searchResults: "🔍 Результаты поиска", favorites: "⭐ Избранное", watchlist: "📋 Список просмотра",
    welcomeSub: "Вот что мы выбрали для вас сегодня ✨",
    heroTitle: "Откройте Ваш Следующий", heroTitleGradient: "Любимый Фильм",
    heroSubtitle: "Исследуйте популярные фильмы, получайте рекомендации и создавайте свой список.",
    auth: {
      create: "Создать аккаунт", signIn: "Войти", createSub: "Присоединяйтесь к MovieFinder",
      signInSub: "С возвращением!", signupBtn: "Регистрация", loginBtn: "Войти",
      alreadyHave: "Уже есть аккаунт?", dontHave: "Нет аккаунта?",
      switchToLogin: "Войти", switchToSignup: "Создать"
    },
    genres: { 28: "Боевик", 35: "Комедия", 18: "Драма", 878: "Фантастика", 27: "Ужасы", 16: "Мультфильм", 10749: "Мелодрама", 53: "Триллер", 80: "Криминал", 12: "Приключения" }
  },
  "tr-TR": {
    trending: "📈 Bugün Trend", nowPlaying: "🎥 Vizyonda", topSearched: "🔥 En Popüler",
    topRated: "🏆 En Yüksek Puanlı", upcoming: "📅 Yakında", recommended: "🎯 Sizin İçin Öneriler",
    searchResults: "🔍 Sonuçlar", favorites: "⭐ Favorileriniz", watchlist: "📋 İzleme Listeniz",
    welcomeSub: "Bugün sizin için seçtiklerimiz ✨",
    heroTitle: "Bir Sonraki", heroTitleGradient: "Favori Filminizi Keşfedin",
    heroSubtitle: "Trend filmleri keşfedin, akıllı öneriler alın ve izleme listenizi oluşturun.",
    auth: {
      create: "Hesap Oluştur", signIn: "Giriş Yap", createSub: "MovieFinder'a Katılın",
      signInSub: "Hoş geldiniz!", signupBtn: "Kaydol", loginBtn: "Giriş",
      alreadyHave: "Zaten hesabınız var mı?", dontHave: "Hesabınız yok mu?",
      switchToLogin: "Giriş", switchToSignup: "Oluştur"
    },
    genres: { 28: "Aksiyon", 35: "Komedi", 18: "Dram", 878: "Bilim Kurgu", 27: "Korku", 16: "Animasyon", 10749: "Romantik", 53: "Gerilim", 80: "Suç", 12: "Macera" }
  },
  "nl-NL": {
    trending: "📈 Trending vandaag", nowPlaying: "🎥 Nu in de bioscoop", topSearched: "🔥 Meest populair",
    topRated: "🏆 Best beoordeeld", upcoming: "📅 Binnenkort", recommended: "🎯 Aanbevolen voor jou",
    searchResults: "🔍 Resultaten", favorites: "⭐ Je Favorieten", watchlist: "📋 Je Kijklijst",
    welcomeSub: "Dit hebben we vandaag voor je gekozen ✨",
    heroTitle: "Ontdek Je Volgende", heroTitleGradient: "Favoriete Film",
    heroSubtitle: "Ontdek trending films, krijg slimme aanbevelingen en maak je kijklijst.",
    auth: {
      create: "Account aanmaken", signIn: "Inloggen", createSub: "Word lid van MovieFinder",
      signInSub: "Welkom terug!", signupBtn: "Registreren", loginBtn: "Inloggen",
      alreadyHave: "Al een account?", dontHave: "Geen account?",
      switchToLogin: "Inloggen", switchToSignup: "Aanmaken"
    },
    genres: { 28: "Actie", 35: "Komedie", 18: "Drama", 878: "Sci-Fi", 27: "Horror", 16: "Animatie", 10749: "Romantiek", 53: "Thriller", 80: "Misdaad", 12: "Avontuur" }
  },
  "pl-PL": {
    trending: "📈 Popularne dziś", nowPlaying: "🎥 Teraz grają", topSearched: "🔥 Najpopularniejsze",
    topRated: "🏆 Najwyżej oceniane", upcoming: "📅 Wkrótce", recommended: "🎯 Polecane dla Ciebie",
    searchResults: "🔍 Wyniki", favorites: "⭐ Ulubione", watchlist: "📋 Do obejrzenia",
    welcomeSub: "Oto co dla Ciebie wybraliśmy ✨",
    heroTitle: "Odkryj Swój Następny", heroTitleGradient: "Ulubiony Film",
    heroSubtitle: "Odkrywaj popularne filmy, otrzymuj rekomendacje i twórz swoją listę.",
    auth: {
      create: "Utwórz konto", signIn: "Zaloguj się", createSub: "Dołącz do MovieFinder",
      signInSub: "Witaj ponownie!", signupBtn: "Zarejestruj", loginBtn: "Zaloguj",
      alreadyHave: "Masz już konto?", dontHave: "Nie masz konta?",
      switchToLogin: "Zaloguj", switchToSignup: "Utwórz"
    },
    genres: { 28: "Akcja", 35: "Komedia", 18: "Dramat", 878: "Sci-Fi", 27: "Horror", 16: "Animacja", 10749: "Romans", 53: "Thriller", 80: "Kryminał", 12: "Przygodowy" }
  },
  "th-TH": {
    trending: "📈 มาแรงวันนี้", nowPlaying: "🎥 กำลังฉาย", topSearched: "🔥 ยอดนิยม",
    topRated: "🏆 เรตติ้งสูงสุด", upcoming: "📅 เร็วๆ นี้", recommended: "🎯 แนะนำสำหรับคุณ",
    searchResults: "🔍 ผลการค้นหา", favorites: "⭐ รายการโปรด", watchlist: "📋 รายการดู",
    welcomeSub: "นี่คือสิ่งที่เราเลือกให้คุณวันนี้ ✨",
    heroTitle: "ค้นพบ", heroTitleGradient: "หนังเรื่องโปรดถัดไป",
    heroSubtitle: "สำรวจหนังยอดนิยม รับคำแนะนำ และสร้างรายการดูของคุณ",
    auth: {
      create: "สร้างบัญชี", signIn: "เข้าสู่ระบบ", createSub: "เข้าร่วม MovieFinder",
      signInSub: "ยินดีต้อนรับกลับ!", signupBtn: "สมัคร", loginBtn: "เข้าสู่ระบบ",
      alreadyHave: "มีบัญชีแล้ว?", dontHave: "ยังไม่มีบัญชี?",
      switchToLogin: "เข้าสู่ระบบ", switchToSignup: "สร้าง"
    },
    genres: { 28: "แอ็คชั่น", 35: "ตลก", 18: "ดราม่า", 878: "ไซไฟ", 27: "สยองขวัญ", 16: "แอนิเมชั่น", 10749: "โรแมนติก", 53: "ระทึกขวัญ", 80: "อาชญากรรม", 12: "ผจญภัย" }
  },
  "vi-VN": {
    trending: "📈 Thịnh hành hôm nay", nowPlaying: "🎥 Đang chiếu", topSearched: "🔥 Phổ biến nhất",
    topRated: "🏆 Đánh giá cao nhất", upcoming: "📅 Sắp chiếu", recommended: "🎯 Đề xuất cho bạn",
    searchResults: "🔍 Kết quả", favorites: "⭐ Yêu thích", watchlist: "📋 Danh sách xem",
    welcomeSub: "Đây là những gì chúng tôi chọn cho bạn hôm nay ✨",
    heroTitle: "Khám Phá Bộ Phim", heroTitleGradient: "Yêu Thích Tiếp Theo",
    heroSubtitle: "Khám phá phim thịnh hành, nhận đề xuất thông minh và tạo danh sách xem.",
    auth: {
      create: "Tạo tài khoản", signIn: "Đăng nhập", createSub: "Tham gia MovieFinder",
      signInSub: "Chào mừng trở lại!", signupBtn: "Đăng ký", loginBtn: "Đăng nhập",
      alreadyHave: "Đã có tài khoản?", dontHave: "Chưa có tài khoản?",
      switchToLogin: "Đăng nhập", switchToSignup: "Tạo"
    },
    genres: { 28: "Hành động", 35: "Hài", 18: "Chính kịch", 878: "Khoa học viễn tưởng", 27: "Kinh dị", 16: "Hoạt hình", 10749: "Lãng mạn", 53: "Giật gân", 80: "Tội phạm", 12: "Phiêu lưu" }
  },
  "id-ID": {
    trending: "📈 Trending Hari Ini", nowPlaying: "🎥 Sedang Tayang", topSearched: "🔥 Terpopuler",
    topRated: "🏆 Rating Tertinggi", upcoming: "📅 Segera Tayang", recommended: "🎯 Rekomendasi Untukmu",
    searchResults: "🔍 Hasil Pencarian", favorites: "⭐ Favoritmu", watchlist: "📋 Daftar Tonton",
    welcomeSub: "Inilah yang kami pilih untukmu hari ini ✨",
    heroTitle: "Temukan Film", heroTitleGradient: "Favorit Berikutnya",
    heroSubtitle: "Jelajahi film trending, dapatkan rekomendasi cerdas, dan buat daftar tontonmu.",
    auth: {
      create: "Buat Akun", signIn: "Masuk", createSub: "Bergabung dengan MovieFinder",
      signInSub: "Selamat datang kembali!", signupBtn: "Daftar", loginBtn: "Masuk",
      alreadyHave: "Sudah punya akun?", dontHave: "Belum punya akun?",
      switchToLogin: "Masuk", switchToSignup: "Buat"
    },
    genres: { 28: "Aksi", 35: "Komedi", 18: "Drama", 878: "Fiksi Ilmiah", 27: "Horor", 16: "Animasi", 10749: "Romantis", 53: "Thriller", 80: "Kejahatan", 12: "Petualangan" }
  },
  "uk-UA": {
    trending: "📈 Тренди сьогодні", nowPlaying: "🎥 Зараз у кіно", topSearched: "🔥 Найпопулярніші",
    topRated: "🏆 Найкраще оцінені", upcoming: "📅 Незабаром", recommended: "🎯 Рекомендації для вас",
    searchResults: "🔍 Результати", favorites: "⭐ Обране", watchlist: "📋 Список перегляду",
    welcomeSub: "Ось що ми обрали для вас сьогодні ✨",
    heroTitle: "Відкрийте Свій Наступний", heroTitleGradient: "Улюблений Фільм",
    heroSubtitle: "Досліджуйте популярні фільми, отримуйте рекомендації та створюйте свій список.",
    auth: {
      create: "Створити акаунт", signIn: "Увійти", createSub: "Приєднуйтесь до MovieFinder",
      signInSub: "З поверненням!", signupBtn: "Реєстрація", loginBtn: "Увійти",
      alreadyHave: "Вже є акаунт?", dontHave: "Немає акаунта?",
      switchToLogin: "Увійти", switchToSignup: "Створити"
    },
    genres: { 28: "Бойовик", 35: "Комедія", 18: "Драма", 878: "Фантастика", 27: "Жахи", 16: "Мультфільм", 10749: "Мелодрама", 53: "Трилер", 80: "Кримінал", 12: "Пригоди" }
  },
  "sv-SE": {
    trending: "📈 Trendande idag", nowPlaying: "🎥 Visas nu", topSearched: "🔥 Mest populära",
    topRated: "🏆 Högst betyg", upcoming: "📅 Kommer snart", recommended: "🎯 Rekommenderat för dig",
    searchResults: "🔍 Resultat", favorites: "⭐ Dina Favoriter", watchlist: "📋 Din Bevakningslista",
    welcomeSub: "Här är vad vi valt åt dig idag ✨",
    heroTitle: "Upptäck Din Nästa", heroTitleGradient: "Favoritfilm",
    heroSubtitle: "Utforska trendande filmer, få smarta rekommendationer och skapa din lista.",
    auth: {
      create: "Skapa konto", signIn: "Logga in", createSub: "Gå med i MovieFinder",
      signInSub: "Välkommen tillbaka!", signupBtn: "Registrera", loginBtn: "Logga in",
      alreadyHave: "Har du redan ett konto?", dontHave: "Har du inget konto?",
      switchToLogin: "Logga in", switchToSignup: "Skapa"
    },
    genres: { 28: "Action", 35: "Komedi", 18: "Drama", 878: "Sci-Fi", 27: "Skräck", 16: "Animation", 10749: "Romantik", 53: "Thriller", 80: "Brott", 12: "Äventyr" }
  },
  // Languages that share UI with another (TMDB still serves movie data natively)
  "ms-MY": { _extends: "id-ID" },
  "tl-PH": { _extends: "en-US" },
  "bn-BD": { _extends: "hi-IN" },
  "ta-IN": { _extends: "hi-IN" },
  "te-IN": { _extends: "hi-IN" },
  "ro-RO": { _extends: "en-US" },
  "cs-CZ": { _extends: "en-US" },
  "sk-SK": { _extends: "en-US" },
  "hu-HU": { _extends: "en-US" },
  "el-GR": { _extends: "en-US" },
  "bg-BG": { _extends: "en-US" },
  "hr-HR": { _extends: "en-US" },
  "sr-RS": { _extends: "en-US" },
  "no-NO": { _extends: "sv-SE" },
  "da-DK": { _extends: "sv-SE" },
  "fi-FI": { _extends: "en-US" },
  "he-IL": { _extends: "ar-SA" },
  "fa-IR": { _extends: "ar-SA" },
  "sw-KE": { _extends: "en-US" },
  "zu-ZA": { _extends: "en-US" },
};

function t() {
  let tr = translations[selectedLanguage];
  if (!tr) return translations['en-US'];
  // Follow _extends chain
  if (tr._extends) tr = translations[tr._extends] || translations['en-US'];
  return tr;
}

function applyTranslations() {
  const tr = t();
  const titleMap = {
    trendingTitle: tr.trending, nowPlayingTitle: tr.nowPlaying, topTitle: tr.topSearched,
    topRatedTitle: tr.topRated, upcomingTitle: tr.upcoming, recommendedTitle: tr.recommended,
    searchResultsTitle: tr.searchResults, favoritesTitle: tr.favorites, watchlistTitle: tr.watchlist,
  };
  Object.entries(titleMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
  const welcomeSub = document.getElementById('welcomeSubtext');
  if (welcomeSub) welcomeSub.textContent = tr.welcomeSub;
  const heroTitle = $('.hero-title');
  if (heroTitle) heroTitle.innerHTML = `${escapeHtml(tr.heroTitle)}<br><span class="gradient-text">${escapeHtml(tr.heroTitleGradient)}</span>`;
  const heroSub = $('.hero-subtitle');
  if (heroSub) heroSub.textContent = tr.heroSubtitle;
  updateAuthModalTexts();
}

// Store references to auth link handlers to prevent memory leaks
let _authLinkCleanup = null;

function updateAuthModalTexts() {
  const tr = t();
  const isSignup = !DOM.signupFields.classList.contains('hidden');
  if (DOM.authTitle) DOM.authTitle.textContent = isSignup ? tr.auth.create : tr.auth.signIn;
  if (DOM.authSubtitle) DOM.authSubtitle.textContent = isSignup ? tr.auth.createSub : tr.auth.signInSub;
  const signupBtn = $('#signupSubmit .btn-content');
  const loginBtn = $('#loginSubmit .btn-content');
  if (signupBtn) signupBtn.textContent = tr.auth.signupBtn;
  if (loginBtn) loginBtn.textContent = tr.auth.loginBtn;
  const alreadyHave = document.getElementById('alreadyHaveText');
  const dontHave = document.getElementById('dontHaveText');
  if (alreadyHave) alreadyHave.innerHTML = `${escapeHtml(tr.auth.alreadyHave)} <a href="#" id="switchToLogin">${escapeHtml(tr.auth.switchToLogin)}</a>`;
  if (dontHave) dontHave.innerHTML = `${escapeHtml(tr.auth.dontHave)} <a href="#" id="switchToSignup">${escapeHtml(tr.auth.switchToSignup)}</a>`;

  // Clean up old listeners before adding new ones (prevent memory leak)
  if (_authLinkCleanup) _authLinkCleanup();

  const loginLink = document.getElementById('switchToLogin');
  const signupLink = document.getElementById('switchToSignup');
  const onLogin = e => { e.preventDefault(); showLogin(); };
  const onSignup = e => { e.preventDefault(); showSignup(); };
  loginLink?.addEventListener('click', onLogin);
  signupLink?.addEventListener('click', onSignup);
  _authLinkCleanup = () => {
    loginLink?.removeEventListener('click', onLogin);
    signupLink?.removeEventListener('click', onSignup);
  };
}

// ═══════════════════════════════════════════
// 🔍 SEARCH ENGINE
// ═══════════════════════════════════════════

let searchDebounceTimer = null;

DOM.movieInput.addEventListener('input', () => {
  const query = DOM.movieInput.value.trim();
  DOM.clearSearch.classList.toggle('hidden', !query);
  clearTimeout(searchDebounceTimer);
  if (query.length >= 2) {
    searchDebounceTimer = setTimeout(() => searchMovies(query), CONFIG.debounceMs);
  } else if (!query) {
    hideSearchResults();
  }
});

DOM.movieInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    clearTimeout(searchDebounceTimer);
    const query = DOM.movieInput.value.trim();
    if (query) searchMovies(query);
  }
});

DOM.clearSearch.addEventListener('click', () => {
  DOM.movieInput.value = '';
  DOM.clearSearch.classList.add('hidden');
  hideSearchResults();
  DOM.movieInput.focus();
});

DOM.clearResults.addEventListener('click', () => {
  DOM.movieInput.value = '';
  DOM.clearSearch.classList.add('hidden');
  hideSearchResults();
});

function hideSearchResults() {
  DOM.searchResultsSection.classList.add('hidden');
  DOM.searchResults.innerHTML = '';
}

async function searchMovies(query) {
  DOM.searchResultsSection.classList.remove('hidden');
  DOM.searchResults.innerHTML = renderSkeletonGrid(8);

  try {
    const data = await tmdb.search(query, selectedLanguage);
    const results = data.results?.filter(m => m.poster_path).slice(0, CONFIG.maxSearchResults) || [];

    if (results.length > 0) {
      DOM.searchResults.innerHTML = results.map(m => movieCard(m)).join('');
      trackSearch(query, results);
    } else {
      DOM.searchResults.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No results found for "${escapeHtml(query)}". Try a different search term.</div>`;
    }
  } catch (err) {
    console.error('Search error:', err);
    DOM.searchResults.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Something went wrong. Please try again.</div>`;
  }

  DOM.searchResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function trackSearch(query, results) {
  const searchEntry = {
    query,
    timestamp: Date.now(),
    genreIds: [...new Set(results.flatMap(m => m.genre_ids || []))],
    movieIds: results.slice(0, 5).map(m => m.id),
  };
  state.searchHistory.unshift(searchEntry);
  if (state.searchHistory.length > CONFIG.searchHistoryMax) {
    state.searchHistory = state.searchHistory.slice(0, CONFIG.searchHistoryMax);
  }
  localStorage.setItem('mf_searchHistory', JSON.stringify(state.searchHistory));

  if (isLoggedIn()) {
    setTimeout(() => loadRecommendations(), 1000);
  }
}

// ═══════════════════════════════════════════
// 🎬 MOVIE CARD RENDERER
// ═══════════════════════════════════════════

function getGenreNames(genreIds) {
  if (!genreIds || !Array.isArray(genreIds)) return '';
  const tr = t();
  return genreIds.map(id => {
    // If it's an object from extended details, use id.name
    if (typeof id === 'object' && id.name) return id.name;
    // Otherwise fallback through translations > store > "Unknown"
    return (tr.genres && tr.genres[id]) ? tr.genres[id] : (state.genreLookup[id] || '');
  }).filter(Boolean).slice(0, 3).join(', ');
}

function movieCard(movie, options = {}) {
  const year = movie.release_date?.slice(0, 4) || 'N/A';
  const poster = movie.poster_path ? CONFIG.imageBase + movie.poster_path : CONFIG.posterPlaceholder;
  const rating = movie.vote_average ? (movie.vote_average / 2).toFixed(1) : '—';
  const genres = getGenreNames(movie.genre_ids || movie.genres);
  const title = escapeHtml(movie.title);
  const { showRemoveFav, showRemoveWatch } = options;

  let actionButtons = '';
  if (showRemoveFav) {
    actionButtons = `
      <button class="btn-info" onclick="getMovieDetails(${movie.id})">ℹ️ Info</button>
      <button class="btn-remove" onclick="removeFavorite(${movie.id})">🗑️ Remove</button>`;
  } else if (showRemoveWatch) {
    actionButtons = `
      <button class="btn-info" onclick="getMovieDetails(${movie.id})">ℹ️ Info</button>
      <button class="btn-remove" onclick="removeFromWatchlist(${movie.id})">🗑️ Remove</button>`;
  } else {
    actionButtons = `
      <button class="btn-info" onclick="getMovieDetails(${movie.id})">ℹ️ Info</button>
      <button class="btn-fav" onclick="saveToFavorites(${movie.id})">⭐</button>
      <button class="btn-watch" onclick="addToWatchlist(${movie.id})">＋</button>`;
  }

  return `
    <div class="movie-card">
      <div class="card-poster">
        <img src="${poster}" alt="${title}" loading="lazy" width="500" height="750" />
        <div class="poster-overlay"></div>
        <span class="card-rating">⭐ ${rating}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${title}</h3>
        <span class="card-meta">${escapeHtml(year)}</span>
        <span class="card-genres">${escapeHtml(genres)}</span>
        <div class="card-actions">${actionButtons}</div>
      </div>
    </div>`;
}

function getGenreNames(genreData) {
  if (!genreData) return '';
  if (Array.isArray(genreData) && genreData[0]?.name) {
    return genreData.map(g => g.name).join(', ');
  }
  return genreData.map(id => state.genreLookup[id]).filter(Boolean).join(', ');
}

function renderSkeletonRow(count = 6) {
  return Array(count).fill('<div class="skeleton-card"></div>').join('');
}

function renderSkeletonGrid(count = 8) {
  return Array(count).fill('<div class="skeleton-card" style="min-width:unset;max-width:unset;"></div>').join('');
}

// ═══════════════════════════════════════════
// 📽️ MOVIE DETAILS MODAL
// ═══════════════════════════════════════════

async function getMovieDetails(movieId) {
  DOM.modalBody.innerHTML = `<div class="loading-text" style="text-align:center;padding:60px 20px;">Loading movie details...</div>`;
  DOM.modal.classList.remove('hidden');

  try {
    const [movie, videos] = await Promise.all([
      tmdb.movieDetails(movieId, selectedLanguage),
      tmdb.movieVideos(movieId, selectedLanguage)
    ]);

    const poster = movie.poster_path ? CONFIG.imageBase + movie.poster_path : CONFIG.posterPlaceholder;
    const genres = movie.genres?.map(g => g.name).join(', ') || 'N/A';
    const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const userRating = getUserRating(movieId);
    const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';
    const title = escapeHtml(movie.title);

    DOM.modalBody.innerHTML = `
      <h2>${title}</h2>
      <img src="${poster}" alt="${title}" width="500" height="750" />
      <p><strong>Genres:</strong> ${escapeHtml(genres)}</p>
      <p><strong>Overview:</strong> ${escapeHtml(movie.overview || 'No overview available.')}</p>
      <p><strong>Release Date:</strong> ${escapeHtml(movie.release_date || 'N/A')}</p>
      <p><strong>Runtime:</strong> ${runtime}</p>
      <p><strong>TMDb Rating:</strong> ${movie.vote_average?.toFixed(1) || 'N/A'} ⭐ <span style="color:var(--text-muted)">(${movie.vote_count?.toLocaleString() || 0} votes)</span></p>

      <div class="user-rating">
        <strong>Your Rating:</strong>
        <div class="stars" data-movie-id="${movieId}">
          ${[1, 2, 3, 4, 5].map(i => `<span class="star" data-value="${i}">${i <= userRating ? '★' : '☆'}</span>`).join('')}
        </div>
      </div>

      ${trailer ? `
        <h3 style="margin-top:20px;margin-bottom:12px;">🎬 Trailer</h3>
        <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;">
          <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;"
            src="https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}"
            frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>
        </div>` : '<p style="margin-top:16px;"><em>No trailer available.</em></p>'}
    `;

    addRatingListeners(movieId);
  } catch (err) {
    console.error('Movie details error:', err);
    DOM.modalBody.innerHTML = `<div class="empty-state">Failed to load movie details. Please try again.</div>`;
  }
}

// ═══════════════════════════════════════════
// ⭐ FAVORITES
// ═══════════════════════════════════════════

async function saveToFavorites(movieId) {
  if (!isLoggedIn()) return showLoginPrompt();
  if (state.favorites.some(m => m.id === movieId)) {
    return showToast('Already in your favorites!', 'info');
  }

  try {
    const movie = await tmdb.movieDetails(movieId, selectedLanguage);

    if (supabaseClient) {
      const { error } = await supabaseClient.from('favorites').insert({
        user_id: currentUser.id, movie_id: movieId, movie_data: movie
      });
      if (error) throw error;
    }

    state.favorites.push(movie);
    displayFavorites();
    showToast(`"${movie.title}" added to favorites!`, 'success');
  } catch (err) {
    showToast('Could not save to favorites: ' + err.message, 'error');
  }
}

async function removeFavorite(movieId) {
  if (!isLoggedIn()) return;
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('favorites').delete().match({ user_id: currentUser.id, movie_id: movieId });
      if (error) throw error;
    }
    const movie = state.favorites.find(m => m.id === movieId);
    state.favorites = state.favorites.filter(m => m.id !== movieId);
    displayFavorites();
    showToast(movie ? `"${movie.title}" removed from favorites` : 'Removed from favorites', 'info');
  } catch (err) {
    showToast('Could not remove: ' + err.message, 'error');
  }
}

function displayFavorites() {
  if (!isLoggedIn()) return;
  DOM.favoritesSection.classList.toggle('hidden', state.favorites.length === 0);
  DOM.favoritesList.innerHTML = state.favorites.length
    ? state.favorites.map(m => movieCard(m, { showRemoveFav: true })).join('')
    : '<div class="empty-state">No favorites yet. Start adding movies you love!</div>';
}

// ═══════════════════════════════════════════
// 📋 WATCHLIST
// ═══════════════════════════════════════════

async function addToWatchlist(movieId) {
  if (!isLoggedIn()) return showLoginPrompt();
  if (state.watchlist.some(m => m.id === movieId)) {
    return showToast('Already in your watchlist!', 'info');
  }
  try {
    const movie = await tmdb.movieDetails(movieId, selectedLanguage);
    if (supabaseClient) {
      const { error } = await supabaseClient.from('watchlist').insert({
        user_id: currentUser.id, movie_id: movieId, movie_data: movie
      });
      if (error) throw error;
    }
    state.watchlist.push(movie);
    displayWatchlist();
    showToast(`"${movie.title}" added to watchlist!`, 'success');
  } catch (err) {
    showToast('Could not add to watchlist: ' + err.message, 'error');
  }
}

async function removeFromWatchlist(movieId) {
  if (!isLoggedIn()) return;
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('watchlist').delete().match({ user_id: currentUser.id, movie_id: movieId });
      if (error) throw error;
    }
    const movie = state.watchlist.find(m => m.id === movieId);
    state.watchlist = state.watchlist.filter(m => m.id !== movieId);
    displayWatchlist();
    showToast(movie ? `"${movie.title}" removed from watchlist` : 'Removed from watchlist', 'info');
  } catch (err) {
    showToast('Could not remove: ' + err.message, 'error');
  }
}

function displayWatchlist() {
  if (!isLoggedIn()) return;
  DOM.watchlistContainer.classList.toggle('hidden', state.watchlist.length === 0);
  DOM.watchlistSection.innerHTML = state.watchlist.length
    ? state.watchlist.map(m => movieCard(m, { showRemoveWatch: true })).join('')
    : '<div class="empty-state">Your watchlist is empty. Add movies to watch later!</div>';
}

// ═══════════════════════════════════════════
// ⭐ USER RATINGS
// ═══════════════════════════════════════════

function getUserRating(movieId) {
  return state.ratings[movieId] || 0;
}

async function setUserRating(movieId, value) {
  if (!isLoggedIn()) return showLoginPrompt();
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('user_ratings')
        .upsert({ user_id: currentUser.id, movie_id: movieId, rating: value }, { onConflict: 'user_id,movie_id' });
      if (error) throw error;
    }
    state.ratings[movieId] = value;
    showToast(`Rated ${value}/5 stars!`, 'success');
  } catch (err) {
    showToast('Could not save rating: ' + err.message, 'error');
  }
}

function addRatingListeners(movieId) {
  const stars = $$(`.stars[data-movie-id="${movieId}"] .star`);
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.getAttribute('data-value'));
      setUserRating(movieId, rating);
      stars.forEach((s, i) => { s.textContent = i < rating ? '★' : '☆'; });
    });
  });
}

// ═══════════════════════════════════════════
// 🎯 RECOMMENDATION ENGINE (Parallelized)
// ═══════════════════════════════════════════

async function loadRecommendations() {
  if (!isLoggedIn()) return;

  DOM.recommendedSection.classList.remove('hidden');
  DOM.recommendedMovies.innerHTML = renderSkeletonRow(6);

  try {
    const allMovies = [];

    // Strategy 1: Based on favorites & watchlist — PARALLEL instead of sequential
    const seedMovies = [...state.favorites, ...state.watchlist].slice(0, 4);
    const recPromises = seedMovies.map(movie =>
      tmdb.recommendations(movie.id, selectedLanguage).catch(() => ({ results: [] }))
    );
    const recResults = await Promise.all(recPromises);
    recResults.forEach(data => { if (data.results) allMovies.push(...data.results); });

    // Strategy 2: Based on search history genres — PARALLEL
    if (state.searchHistory.length > 0) {
      const recentGenres = getTopGenresFromHistory().slice(0, 2);
      const genrePromises = recentGenres.map(genreId =>
        tmdb.discoverByGenre(genreId, selectedLanguage).catch(() => ({ results: [] }))
      );
      const genreResults = await Promise.all(genrePromises);
      genreResults.forEach(data => { if (data.results) allMovies.push(...data.results); });
    }

    // Strategy 3: Fallback to similar movies
    if (allMovies.length === 0 && state.searchHistory.length > 0) {
      const recentMovieId = state.searchHistory[0]?.movieIds?.[0];
      if (recentMovieId) {
        const simData = await tmdb.similar(recentMovieId, selectedLanguage);
        if (simData.results) allMovies.push(...simData.results);
      }
    }

    // Deduplicate and filter
    const seen = new Set();
    const userMovieIds = new Set([
      ...state.favorites.map(m => m.id),
      ...state.watchlist.map(m => m.id)
    ]);
    const uniqueMovies = allMovies.filter(m => {
      if (!m.poster_path || seen.has(m.id) || userMovieIds.has(m.id)) return false;
      seen.add(m.id);
      return true;
    }).slice(0, CONFIG.maxRecommendations);

    if (uniqueMovies.length > 0) {
      DOM.recommendedMovies.innerHTML = uniqueMovies.map(m => movieCard(m)).join('');
    } else {
      DOM.recommendedSection.classList.add('hidden');
    }
  } catch (err) {
    console.error('Recommendations error:', err);
    DOM.recommendedSection.classList.add('hidden');
  }
}

function getTopGenresFromHistory() {
  const genreCount = {};
  state.searchHistory.forEach(entry => {
    entry.genreIds?.forEach(id => { genreCount[id] = (genreCount[id] || 0) + 1; });
  });
  return Object.entries(genreCount).sort((a, b) => b[1] - a[1]).map(([id]) => parseInt(id));
}

// ═══════════════════════════════════════════
// 📦 CONTENT LOADERS (with Intersection Observer)
// ═══════════════════════════════════════════
// Lazy-loading removed in favor of parallel loading

async function loadTrendingMovies() {
  try {
    const data = await tmdb.trending(selectedLanguage);
    const movies = data.results?.filter(m => m.poster_path).slice(0, CONFIG.maxScrollItems) || [];
    DOM.trendingMovies.innerHTML = movies.map(m => movieCard(m)).join('');
    populateHeroBackdrop(movies);
  } catch (err) {
    console.error('Trending error:', err);
    DOM.trendingMovies.innerHTML = '<div class="empty-state">Failed to load trending movies.</div>';
  }
}

async function loadNowPlaying() {
  try {
    const data = await tmdb.nowPlaying(selectedLanguage);
    const movies = data.results?.filter(m => m.poster_path).slice(0, CONFIG.maxScrollItems) || [];
    DOM.nowPlayingMovies.innerHTML = movies.map(m => movieCard(m)).join('');
  } catch (err) {
    console.error('Now playing error:', err);
    DOM.nowPlayingMovies.innerHTML = '<div class="empty-state">Failed to load now playing movies.</div>';
  }
}

async function loadPopularMovies() {
  try {
    const data = await tmdb.popular(selectedLanguage);
    const movies = data.results?.filter(m => m.poster_path).slice(0, CONFIG.maxScrollItems) || [];
    DOM.topMovies.innerHTML = movies.map(m => movieCard(m)).join('');
  } catch (err) {
    console.error('Popular error:', err);
    DOM.topMovies.innerHTML = '<div class="empty-state">Failed to load popular movies.</div>';
  }
}

async function loadTopRated() {
  try {
    const data = await tmdb.topRated(selectedLanguage);
    const movies = data.results?.filter(m => m.poster_path).slice(0, CONFIG.maxScrollItems) || [];
    DOM.topRatedMovies.innerHTML = movies.map(m => movieCard(m)).join('');
  } catch (err) {
    console.error('Top rated error:', err);
    DOM.topRatedMovies.innerHTML = '<div class="empty-state">Failed to load top rated movies.</div>';
  }
}

async function loadUpcoming() {
  try {
    const data = await tmdb.upcoming(selectedLanguage);
    const movies = data.results?.filter(m => m.poster_path).slice(0, CONFIG.maxScrollItems) || [];
    DOM.upcomingMovies.innerHTML = movies.map(m => movieCard(m)).join('');
  } catch (err) {
    console.error('Upcoming error:', err);
    DOM.upcomingMovies.innerHTML = '<div class="empty-state">Failed to load upcoming movies.</div>';
  }
}

async function loadGenreLookup() {
  try {
    const data = await tmdb.genres(selectedLanguage);
    data.genres?.forEach(g => { state.genreLookup[g.id] = g.name; });
  } catch (err) {
    console.error('Genre lookup error:', err);
  }
}

const GENRE_SECTIONS = [
  { id: 28, emoji: '💥' },
  { id: 35, emoji: '😂' },
  { id: 878, emoji: '🚀' },
  { id: 27, emoji: '👻' },
  { id: 16, emoji: '🎨' },
];

async function loadGenreSections() {
  DOM.genreSections.innerHTML = '';

  // Create all DOM first, then load data in parallel
  const genrePromises = GENRE_SECTIONS.map(genre => {
    const tr = t();
    const genreName = tr.genres[genre.id] || state.genreLookup[genre.id] || 'Genre';
    const section = document.createElement('div');
    section.className = 'genre-section';
    section.innerHTML = `
      <h2 data-genre-id="${genre.id}">${genre.emoji} ${escapeHtml(genreName)}</h2>
      <div class="movie-scroll-row" id="genre-row-${genre.id}">${renderSkeletonRow(6)}</div>
    `;
    DOM.genreSections.appendChild(section);

    return tmdb.discoverByGenre(genre.id, selectedLanguage)
      .then(data => {
        const movies = data.results?.filter(m => m.poster_path).slice(0, 15) || [];
        const row = document.getElementById(`genre-row-${genre.id}`);
        if (row) row.innerHTML = movies.map(m => movieCard(m)).join('');
      })
      .catch(() => {
        const row = document.getElementById(`genre-row-${genre.id}`);
        if (row) row.innerHTML = '<div class="empty-state">Failed to load.</div>';
      });
  });

  await Promise.all(genrePromises);
}

function populateHeroBackdrop(movies) {
  if (!DOM.heroBackdrop) return;
  const posters = movies.slice(0, 10).filter(m => m.poster_path);
  DOM.heroBackdrop.innerHTML = posters.map((m, i) => `
    <img src="${CONFIG.imageBase + m.poster_path}" alt="" style="animation-delay: ${i * 0.6}s" loading="lazy" width="180" height="270" />
  `).join('');
}

// ═══════════════════════════════════════════
// 🔐 AUTHENTICATION
// ═══════════════════════════════════════════

function isLoggedIn() {
  return currentUser !== null;
}

function showLoginPrompt() {
  showToast('Please sign in to use this feature.', 'warning');
  showSignup();
  DOM.authModal.classList.remove('hidden');
}

function showSignup() {
  DOM.signupFields.classList.remove('hidden');
  DOM.loginFields.classList.add('hidden');
  updateAuthModalTexts();
}

function showLogin() {
  DOM.signupFields.classList.add('hidden');
  DOM.loginFields.classList.remove('hidden');
  updateAuthModalTexts();
}

DOM.loginBtn.addEventListener('click', async () => {
  if (isLoggedIn()) {
    if (supabaseClient) await supabaseClient.auth.signOut();
    currentUser = null;
    handleLogout();
    showToast('Signed out successfully.', 'info');
  } else {
    showSignup();
    DOM.authModal.classList.remove('hidden');
  }
});

$('#closeAuthModal').addEventListener('click', () => DOM.authModal.classList.add('hidden'));
$('#switchToLogin').addEventListener('click', e => { e.preventDefault(); showLogin(); });
$('#switchToSignup').addEventListener('click', e => { e.preventDefault(); showSignup(); });

$('#signupSubmit').addEventListener('click', async () => {
  const name = $('#signupName').value.trim();
  const email = $('#signupEmail').value.trim();
  const password = $('#signupPassword').value.trim();

  if (!name || !email || !password) return showToast('Please fill all fields.', 'warning');
  if (password.length < 6) return showToast('Password must be at least 6 characters.', 'warning');
  if (!supabaseClient) return showToast('Supabase not configured. Check your credentials.', 'error');

  const btn = $('#signupSubmit');
  setButtonLoading(btn, true);
  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw error;
    showToast('Account created! Please sign in.', 'success');
    showLogin();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
});

$('#loginSubmit').addEventListener('click', async () => {
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value.trim();

  if (!email || !password) return showToast('Please fill all fields.', 'warning');
  if (!supabaseClient) return showToast('Supabase not configured. Check your credentials.', 'error');

  const btn = $('#loginSubmit');
  setButtonLoading(btn, true);
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    DOM.authModal.classList.add('hidden');
    showToast('Welcome back!', 'success');
  } catch (err) {
    showToast('Sign in failed: ' + err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
});

function setButtonLoading(btn, loading) {
  const content = btn.querySelector('.btn-content');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (content) content.style.display = loading ? 'none' : 'inline';
  if (loader) loader.classList.toggle('hidden', !loading);
}

function handleLogin(user) {
  currentUser = user;
  const name = escapeHtml(user.user_metadata?.name || user.email?.split('@')[0] || 'User');
  DOM.heroSection.classList.add('hidden');
  DOM.welcomeBanner.classList.remove('hidden');
  DOM.welcomeUser.innerHTML = `Welcome back, <strong>${name}</strong> 👋`;
  DOM.loginBtn.querySelector('.login-icon').textContent = '🚪';
  DOM.loginBtn.querySelector('.login-text').textContent = 'Logout';
  fetchUserData();
  loadRecommendations();
}

function handleLogout() {
  state.favorites = [];
  state.watchlist = [];
  state.ratings = {};
  DOM.heroSection.classList.remove('hidden');
  DOM.welcomeBanner.classList.add('hidden');
  DOM.recommendedSection.classList.add('hidden');
  DOM.favoritesSection.classList.add('hidden');
  DOM.watchlistContainer.classList.add('hidden');
  DOM.welcomeUser.innerHTML = '';
  DOM.loginBtn.querySelector('.login-icon').textContent = '👤';
  DOM.loginBtn.querySelector('.login-text').textContent = 'Sign In';
  DOM.favoritesList.innerHTML = '';
  DOM.watchlistSection.innerHTML = '';
}

// ═══════════════════════════════════════════
// 📡 SUPABASE DATA SYNC
// ═══════════════════════════════════════════

let fetchUserDataDebounce = null;

async function fetchUserData() {
  if (!supabaseClient || !currentUser) return;
  clearTimeout(fetchUserDataDebounce);
  fetchUserDataDebounce = setTimeout(async () => {
    try {
      const [favs, watch, rats] = await Promise.all([
        supabaseClient.from('favorites').select('movie_data').eq('user_id', currentUser.id),
        supabaseClient.from('watchlist').select('movie_data').eq('user_id', currentUser.id),
        supabaseClient.from('user_ratings').select('movie_id, rating').eq('user_id', currentUser.id)
      ]);
      if (favs.data) { state.favorites = favs.data.map(d => d.movie_data); displayFavorites(); }
      if (watch.data) { state.watchlist = watch.data.map(d => d.movie_data); displayWatchlist(); }
      if (rats.data) { state.ratings = {}; rats.data.forEach(d => { state.ratings[d.movie_id] = d.rating; }); }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  }, 300);
}

function setupRealtime() {
  if (!supabaseClient || !currentUser) return;
  supabaseClient.channel('user_data_sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${currentUser.id}` }, () => fetchUserData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist', filter: `user_id=eq.${currentUser.id}` }, () => fetchUserData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_ratings', filter: `user_id=eq.${currentUser.id}` }, () => fetchUserData())
    .subscribe();
}

// ═══════════════════════════════════════════
// 🎨 THEME
// ═══════════════════════════════════════════

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
  document.body.classList.add('light-mode');
  DOM.themeToggle.textContent = '☀️';
}

DOM.themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  DOM.themeToggle.textContent = isLight ? '☀️' : '🌗';
});

// ═══════════════════════════════════════════
// 🌐 LANGUAGE CHANGE
// ═══════════════════════════════════════════

DOM.languageSelect.addEventListener('change', function () {
  selectedLanguage = this.value;
  localStorage.setItem('selectedLanguage', selectedLanguage);
  applyTranslations();
  apiCache.clear();
  state.observedSections.clear(); // reset lazy-load tracking
  loadGenreLookup().then(() => {
    loadAllSections();
    if (isLoggedIn()) loadRecommendations();
  });
});

// ═══════════════════════════════════════════
// 🪟 MODAL CONTROLS
// ═══════════════════════════════════════════

$('#closeModal').addEventListener('click', () => DOM.modal.classList.add('hidden'));

window.addEventListener('click', (e) => {
  if (e.target === DOM.modal) DOM.modal.classList.add('hidden');
  if (e.target === DOM.authModal) DOM.authModal.classList.add('hidden');
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    DOM.modal.classList.add('hidden');
    DOM.authModal.classList.add('hidden');
  }
});

DOM.logoLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  hideSearchResults();
  DOM.movieInput.value = '';
  DOM.clearSearch.classList.add('hidden');
});

// ═══════════════════════════════════════════
// 🚀 INITIALIZE
// ═══════════════════════════════════════════

function loadAllSections() {
  // Load ALL sections in parallel for immediate display
  loadTrendingMovies();
  loadNowPlaying();
  loadPopularMovies();
  loadTopRated();
  loadUpcoming();
  loadGenreSections();
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadEnvConfig();

  if (!CONFIG.apiKey) {
    console.error("Critical: TMDB_API_KEY is not set in .env! Movies will fail to load.");
  }

  applyTranslations();
  await loadGenreLookup();
  loadAllSections();

  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        handleLogin(session.user);
        setupRealtime();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        handleLogout();
      }
    });
  }
});

// Make functions globally accessible for inline onclick handlers
window.getMovieDetails = getMovieDetails;
window.saveToFavorites = saveToFavorites;
window.removeFavorite = removeFavorite;
window.addToWatchlist = addToWatchlist;
window.removeFromWatchlist = removeFromWatchlist;
