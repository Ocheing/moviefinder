const apiKey = "cfe8cced2385dacd2680a9f065bbef60";
const imageBase = "https://image.tmdb.org/t/p/w500";

// === SELECTORS ===
const movieInput = document.getElementById("movieInput");
const searchBtn = document.getElementById("searchBtn");
const movieList = document.getElementById("movieList");
const favoritesList = document.getElementById("favoritesList");
const favoritesSection = document.getElementById("favoritesSection");
const watchlistSection = document.getElementById("watchlistSection");
const watchlistContainer = document.getElementById("watchlistContainer");

const modal = document.getElementById("movieModal");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");

const themeToggle = document.getElementById("toggleTheme");
const loginBtn = document.getElementById("loginBtn");
const welcomeUser = document.getElementById("welcomeUser");

const authModal = document.getElementById("authModal");
const closeAuthModal = document.getElementById("closeAuthModal");
const authTitle = document.getElementById("authTitle");
const signupFields = document.getElementById("signupFields");
const loginFields = document.getElementById("loginFields");

const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupSubmit = document.getElementById("signupSubmit");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginSubmit = document.getElementById("loginSubmit");

const switchToLogin = document.getElementById("switchToLogin");
const switchToSignup = document.getElementById("switchToSignup");

const translations = {
  "en-US": {
    topSearched: "🔥 Top Searched Movies",
    suggested: "🎯 Suggested for You",
    suggestionsSidebar: "Search for a movie to begin...",
    favorites: "Your Favorites",
    watchlist: "Your Watchlist",
    auth: {
      create: "Create Account",
      signupBtn: "Sign Up",
      loginBtn: "Sign In",
      alreadyHave: "Already have an account?",
      dontHave: "Don't have an account?",
      switchToLogin: "Sign in",
      switchToSignup: "Create one"
    },
    genres: {
      Action: "Action",
      Comedy: "Comedy",
      Drama: "Drama",
      SciFi: "Sci-Fi",
      Horror: "Horror"
    }
  },
  "fr-FR": {
    topSearched: "🔥 Films les plus recherchés",
    suggested: "🎯 Suggéré pour vous",
    suggestionsSidebar: "Recherchez un film pour commencer...",
    favorites: "Vos Favoris",
    watchlist: "Votre Liste",
    auth: {
      create: "Créer un compte",
      signupBtn: "S'inscrire",
      loginBtn: "Connexion",
      alreadyHave: "Vous avez déjà un compte ?",
      dontHave: "Vous n'avez pas de compte ?",
      switchToLogin: "Connexion",
      switchToSignup: "Créer un"
    },
    genres: {
      Action: "Action",
      Comedy: "Comédie",
      Drama: "Drame",
      SciFi: "Science-fiction",
      Horror: "Horreur"
    }
  },
  "de-DE": {
    topSearched: "🔥 Meistgesuchte Filme",
    suggested: "🎯 Vorgeschlagen für Sie",
    suggestionsSidebar: "Suche einen Film, um zu beginnen...",
    favorites: "Ihre Favoriten",
    watchlist: "Ihre Merkliste",
    auth: {
      create: "Konto erstellen",
      signupBtn: "Registrieren",
      loginBtn: "Anmelden",
      alreadyHave: "Haben Sie schon ein Konto?",
      dontHave: "Sie haben kein Konto?",
      switchToLogin: "Anmelden",
      switchToSignup: "Registrieren"
    },
    genres: {
      Action: "Action",
      Comedy: "Komödie",
      Drama: "Drama",
      SciFi: "Science-Fiction",
      Horror: "Horror"
    }
  },
  "ja-JP": {
    topSearched: "🔥 人気の検索映画",
    suggested: "🎯 あなたへのおすすめ",
    suggestionsSidebar: "映画を検索して始めましょう...",
    favorites: "お気に入り",
    watchlist: "ウォッチリスト",
    auth: {
      create: "アカウントを作成",
      signupBtn: "サインアップ",
      loginBtn: "ログイン",
      alreadyHave: "すでにアカウントをお持ちですか？",
      dontHave: "アカウントをお持ちでないですか？",
      switchToLogin: "ログイン",
      switchToSignup: "作成する"
    },
    genres: {
      Action: "アクション",
      Comedy: "コメディ",
      Drama: "ドラマ",
      SciFi: "SF",
      Horror: "ホラー"
    }
  },
  "es-ES": {
    topSearched: "🔥 Películas más buscadas",
    suggested: "🎯 Sugerido para ti",
    suggestionsSidebar: "Busca una película para comenzar...",
    favorites: "Tus Favoritos",
    watchlist: "Tu Lista",
    auth: {
      create: "Crear cuenta",
      signupBtn: "Registrarse",
      loginBtn: "Iniciar sesión",
      alreadyHave: "¿Ya tienes una cuenta?",
      dontHave: "¿No tienes una cuenta?",
      switchToLogin: "Iniciar sesión",
      switchToSignup: "Crear una"
    },
    genres: {
      Action: "Acción",
      Comedy: "Comedia",
      Drama: "Drama",
      SciFi: "Ciencia ficción",
      Horror: "Terror"
    }
  }
};



// === SEARCH ===
searchBtn.addEventListener("click", () => {
  const query = movieInput.value.trim();
  if (query) {
    searchMovies(query);
    movieInput.value = "";
  }
});

async function searchMovies(query) {
  movieList.innerHTML = "<p>Loading...</p>";
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=${selectedLanguage}`);
    const data = await res.json();
    if (data.results.length > 0) displayMovies(data.results);
    else movieList.innerHTML = `<p>No results found for "${query}".</p>`;
  } catch {
    movieList.innerHTML = "<p>Something went wrong.</p>";
  }
}

function displayMovies(movies) {
  movieList.innerHTML = movies.map(movie => `
    <div class="movie-card">
      <img src="${movie.poster_path ? imageBase + movie.poster_path : "https://via.placeholder.com/150"}" alt="${movie.title}" />
      <h3>${movie.title}</h3>
      <p>Year: ${movie.release_date ? movie.release_date.slice(0, 4) : "N/A"}</p>
       <p class="user-stars">${renderStars(rating)}</p>
      <button onclick="getMovieDetails(${movie.id})">ℹ️ More Info</button>
      <button onclick="saveToFavorites(${movie.id})">⭐ Favorite</button>
      <button onclick="addToWatchlist(${movie.id})">➕ WatchList</button>
    </div>
  `).join("");
}

// === MOVIE DETAILS ===
async function getMovieDetails(movieId) {
  try {
    const [movieRes, videoRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&language=${selectedLanguage}`),
      fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${apiKey}&language=${selectedLanguage}`)
    ]);
    
    const movie = await movieRes.json();
    const videos = await videoRes.json();
    const trailer = videos.results.find(v => v.type === "Trailer" && v.site === "YouTube");

    const poster = movie.poster_path ? imageBase + movie.poster_path : "https://via.placeholder.com/150";
    const genres = movie.genres.map(g => g.name).join(", ");
    const userRating = getUserRating(movieId); // Local rating

    modalBody.innerHTML = `
      <h2>${movie.title}</h2>
      <img src="${poster}" alt="${movie.title}" />
      <p><strong>Genres:</strong> ${genres}</p>
      <p><strong>Overview:</strong> ${movie.overview}</p>
      <p><strong>Release Date:</strong> ${movie.release_date}</p>
      <p><strong>TMDb Rating:</strong> ${movie.vote_average} ⭐</p>
      
      <div class="user-rating">
        <strong>Your Rating:</strong>
        <div class="stars" data-movie-id="${movieId}">
          ${[1, 2, 3, 4, 5].map(i => `
            <span class="star" data-value="${i}">${i <= userRating ? "★" : "☆"}</span>
          `).join("")}
        </div>
      </div>

      ${trailer ? `
        <h3>🎬 Trailer</h3>
        <iframe width="100%" height="315" 
          src="https://www.youtube.com/embed/${trailer.key}" 
          frameborder="0" allow="autoplay; encrypted-media" allowfullscreen>
        </iframe>` : "<p><em>No trailer available.</em></p>"}
    `;
    
    addRatingListeners(movieId);
    modal.classList.remove("hidden");
  } catch {
    alert("Failed to load movie details.");
  }
}



// === FAVORITES ===
async function saveToFavorites(movieId) {
  if (!isLoggedIn()) return showLoginAlert();
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  if (favorites.some(m => m.id === movieId)) return alert("Already saved!");

  try {
   const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}&language=${selectedLanguage}`);
    const movie = await res.json();
    favorites.push(movie);
    localStorage.setItem("favorites", JSON.stringify(favorites));
    displayFavorites();
  } catch {
    alert("Could not save movie.");
  }
}

function removeFavorite(movieId) {
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favorites = favorites.filter(movie => movie.id !== movieId);
  localStorage.setItem("favorites", JSON.stringify(favorites));
  displayFavorites();
}

function displayFavorites() {
  const favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favoritesList.innerHTML = favorites.length
    ? favorites.map(movie => `
      <div class="movie-card">
        <img src="${movie.poster_path ? imageBase + movie.poster_path : "https://via.placeholder.com/150"}" />
        <h3>${movie.title}</h3>
        <p>Year: ${movie.release_date ? movie.release_date.slice(0, 4) : "N/A"}</p>
        <button onclick="getMovieDetails(${movie.id})">ℹ️ More Info</button>
        <button onclick="removeFavorite(${movie.id})">🗑 Remove</button>
      </div>`).join("")
    : "<p>No favorites yet.</p>";
}

// === WATCHLIST ===
async function addToWatchlist(movieId) {
  if (!isLoggedIn()) return showLoginAlert();
  let watchlist = JSON.parse(localStorage.getItem("watchlist")) || [];
  if (watchlist.some(m => m.id === movieId)) return alert("Already in watchlist!");

  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}&language=${selectedLanguage}`);
    const movie = await res.json();
    watchlist.push(movie);
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
    displayWatchlist();
  } catch {
    alert("Could not add to watchlist.");
  }
}

function removeFromWatchlist(movieId) {
  let watchlist = JSON.parse(localStorage.getItem("watchlist")) || [];
  watchlist = watchlist.filter(movie => movie.id !== movieId);
  localStorage.setItem("watchlist", JSON.stringify(watchlist));
  displayWatchlist();
}

function displayWatchlist() {
  const watchlist = JSON.parse(localStorage.getItem("watchlist")) || [];
  watchlistSection.innerHTML = watchlist.length
    ? watchlist.map(movie => `
      <div class="movie-card">
        <img src="${movie.poster_path ? imageBase + movie.poster_path : "https://via.placeholder.com/150"}" />
        <h3>${movie.title}</h3>
        <p>${movie.release_date ? movie.release_date.slice(0, 4) : "N/A"}</p>
        <button onclick="getMovieDetails(${movie.id})">ℹ️ More Info</button>
        <button onclick="removeFromWatchlist(${movie.id})">🗑 Remove</button>
      </div>`).join("")
    : "<p>No watchlist items.</p>";
}

// === UTILITIES ===
function isLoggedIn() {
  return localStorage.getItem("isLoggedIn") === "true";
}

function showLoginAlert() {
  alert("Please log in to use this feature.");
  authModal.classList.remove("hidden");
}

// === THEME ===
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-mode");
  themeToggle.textContent = "🌙 Dark Mode";
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  const mode = document.body.classList.contains("light-mode") ? "light" : "dark";
  localStorage.setItem("theme", mode);
  themeToggle.textContent = mode === "light" ? "🌙" : "☀️";
});


//LANGUAGES
let selectedLanguage = localStorage.getItem("selectedLanguage") || "en-US";

// Set the dropdown to match the saved/default language
document.getElementById("languageSelect").value = selectedLanguage;

// When the user selects a new language
document.getElementById("languageSelect").addEventListener("change", function () {
  selectedLanguage = this.value;
  localStorage.setItem("selectedLanguage", selectedLanguage);

  applyTranslations(); // ✅ Updates UI labels

  // Refresh content in new language
  if (movieInput.value.trim()) {
    searchMovies(movieInput.value.trim());
  } else {
    loadGenreLookup().then(() => {
      loadTopMovies();
      loadGenreSections();
    });
  }
});



function applyTranslations() {
  const t = translations[selectedLanguage];
  console.log("Translating authTitle to:", t.auth.create);;

  if (!t) return;

    // UI updates...
  const authTitleEl = document.getElementById("authTitle");
  if (authTitleEl && t.auth?.create) {
    authTitleEl.textContent = t.auth.create;
  }

  // Section Titles
  document.getElementById("topTitle").textContent = t.topSearched;
  document.getElementById("suggestedTitle").textContent = t.suggested;
  document.getElementById("suggestionsSidebar").textContent = t.suggestionsSidebar;
  document.getElementById("favoritesTitle").textContent = t.favorites;
  document.getElementById("watchlistTitle").textContent = t.watchlist;

  // Auth Modal
  document.getElementById("authTitle").textContent = t.auth.create;
  document.getElementById("signupSubmit").textContent = t.auth.signupBtn;
  document.getElementById("loginSubmit").textContent = t.auth.loginBtn;
  document.getElementById("alreadyHaveText").innerHTML = `${t.auth.alreadyHave} <a href="#" id="switchToLogin">${t.auth.switchToLogin}</a>`;
  document.getElementById("dontHaveText").innerHTML = `${t.auth.dontHave} <a href="#" id="switchToSignup">${t.auth.switchToSignup}</a>`;

   // Re-attach event listeners for auth links
  setTimeout(() => {
    document.getElementById("switchToLogin")?.addEventListener("click", e => { e.preventDefault(); showLogin(); });
    document.getElementById("switchToSignup")?.addEventListener("click", e => { e.preventDefault(); showSignup(); });
  }, 0);

  // Genre Section Titles
  const genreTitles = document.querySelectorAll(".genre-section h2");
  genreTitles.forEach(h2 => {
    const genreKey = h2.dataset.genre;
    if (t.genres[genreKey]) {
      h2.textContent = t.genres[genreKey];
    }
  });
}



// === AUTH ===
loginBtn.addEventListener("click", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user && isLoggedIn()) {
    localStorage.removeItem("isLoggedIn");
    welcomeUser.innerHTML = "";
    loginBtn.textContent = "👤 Login";
    favoritesSection.style.display = "none";
    watchlistContainer.style.display = "none";
    movieList.innerHTML = "";
  } else {
    showSignup();
    authModal.classList.remove("hidden");
  }
});

closeAuthModal.addEventListener("click", () => authModal.classList.add("hidden"));
switchToLogin.addEventListener("click", e => { e.preventDefault(); showLogin(); });
switchToSignup.addEventListener("click", e => { e.preventDefault(); showSignup(); });

function showSignup() {
  authTitle.textContent = "Create Account";
  signupFields.style.display = "block";
  loginFields.style.display = "none";
}

function showLogin() {
  authTitle.textContent = "Sign In";
  signupFields.style.display = "none";
  loginFields.style.display = "block";
}

signupSubmit.addEventListener("click", () => {
  const name = signupName.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value.trim();

  if (name && email && password) {
    localStorage.setItem("user", JSON.stringify({ name, email, password }));
    localStorage.setItem("isLoggedIn", "true");
    authModal.classList.add("hidden");
    showWelcome(name);
  } else alert("Please fill all fields.");
});

loginSubmit.addEventListener("click", () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();
  const user = JSON.parse(localStorage.getItem("user"));

  if (user && user.email === email && user.password === password) {
    localStorage.setItem("isLoggedIn", "true");
    authModal.classList.add("hidden");
    showWelcome(user.name);
  } else alert("Invalid login.");
});

function showWelcome(name) {
  welcomeUser.innerHTML = `Hi, <strong>${name}</strong> 👋`;
  loginBtn.textContent = "🚪 Logout";
  favoritesSection.style.display = "block";
  watchlistContainer.style.display = "block";
  displayFavorites();
  displayWatchlist();
}


// === GENRE LOOKUP ===
let genreLookup = {};

async function loadGenreLookup() {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}&language=${selectedLanguage}`);
    const data = await res.json();
    data.genres.forEach(g => genreLookup[g.id] = g.name);
  } catch (err) {
    console.error("Failed to load genres", err);
  }
}



// === Load TMDb Genres ===
async function loadGenreLookup() {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}&language=${selectedLanguage}`);
    const data = await res.json();
    data.genres.forEach(g => genreLookup[g.id] = g.name);
  } catch (err) {
    console.error("Failed to load genres", err);
  }
}

// === Render Movie Card ===
function movieCard(movie) {
  const year = movie.release_date?.slice(0, 4) || "N/A";
  const poster = movie.poster_path ? imageBase + movie.poster_path : "https://via.placeholder.com/150";
  const genres = movie.genre_ids
    ? movie.genre_ids.map(id => genreLookup[id]).filter(Boolean).join(", ")
    : movie.genres?.map(g => g.name).join(", ");

  const averageRating = movie.vote_average ? (movie.vote_average / 2).toFixed(1) : "N/A"; // Convert to 5-star scale if desired
  const stars = renderStars(Math.round(movie.vote_average / 2)); // optional

  return `
    <div class="movie-card">
      <img src="${poster}" alt="${movie.title}" />
      <h3>${movie.title}</h3>
      <p>${year}</p>
      <p><em>${genres}</em></p>
      <p class="movie-rating">⭐ ${averageRating} / 5</p> <!-- or /10 if you prefer -->
      <!-- Optional: <p class="user-stars">${stars}</p> -->
      <button onclick="getMovieDetails(${movie.id})">ℹ️ More Info</button>
      <button onclick="saveToFavorites(${movie.id})">⭐Favorite</button>
      <button onclick="addToWatchlist(${movie.id})">➕ Watchlist</button>
    </div>
  `;
}

function getUserRating(movieId) {
  const ratings = JSON.parse(localStorage.getItem("userRatings")) || {};
  return ratings[movieId] || 0;
}
function renderStars(rating) {
  return [...Array(5)].map((_, i) => i < rating ? "★" : "☆").join("");
}

// === Top & Genre Movies ===
const topMovies = [{ id: 27205 }, { id: 24428 }, { id: 299534 }, { id: 155 }, { id: 157336 }];
const genreMap = {
  Action: [24428, 299534, 155],
  SciFi: [157336, 27205],
  Drama: [278, 13],
  Comedy: [496243, 512200],
  Horror: [4232, 381288]
};

// === LOAD TOP MOVIES ===
async function loadTopMovies() {
  const topContainer = document.getElementById("topMovies");
  topContainer.innerHTML = "<p>Loading top picks...</p>";

  const movies = await Promise.all(
    topMovies.map(m => fetch(`https://api.themoviedb.org/3/movie/${m.id}?api_key=${apiKey}`).then(r => r.json()))
  );

  topContainer.innerHTML = movies.map(movieCard).join("");
}

// === LOAD GENRE SECTIONS ===
async function loadGenreSections() {
  const genreSections = document.getElementById("genreSections");
  genreSections.innerHTML = "";

  for (const [genre, ids] of Object.entries(genreMap)) {
    if (ids.length === 0) continue;

    const section = document.createElement("div");
    section.className = "genre-section";
    section.innerHTML = `<h2 data-genre="${genre}">${translations[selectedLanguage].genres[genre] || genre}</h2><div class="movie-row" id="row-${genre}">Loading...</div>`;

    genreSections.appendChild(section);

    const movies = await Promise.all(
      ids.map(id => fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`).then(r => r.json()))
    );

    document.getElementById(`row-${genre}`).innerHTML = movies.map(movieCard).join("");
  }
}

// Close on X button
document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("movieModal").classList.add("hidden");
});

// Close on outside click
window.addEventListener("click", (e) => {
  const modal = document.getElementById("movieModal");
  const content = document.getElementById("modalContent");
  if (e.target === modal) {
    modal.classList.add("hidden");
  }
});

// Close on Escape key
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.getElementById("movieModal").classList.add("hidden");
  }
});

//helper functions for user ratings
function getUserRating(movieId) {
  const ratings = JSON.parse(localStorage.getItem("userRatings")) || {};
  return ratings[movieId] || 0;
}

function setUserRating(movieId, value) {
  const ratings = JSON.parse(localStorage.getItem("userRatings")) || {};
  ratings[movieId] = value;
  localStorage.setItem("userRatings", JSON.stringify(ratings));
}

// star click listener
function addRatingListeners(movieId) {
  const stars = document.querySelectorAll(`.stars[data-movie-id="${movieId}"] .star`);
  stars.forEach(star => {
    star.addEventListener("click", () => {
      const rating = parseInt(star.getAttribute("data-value"));
      setUserRating(movieId, rating);
      updateStarDisplay(stars, rating);
    });
  });
}

function updateStarDisplay(stars, rating) {
  stars.forEach((star, i) => {
    star.textContent = i < rating ? "★" : "☆";
  });
}


// === INIT ===
window.addEventListener("DOMContentLoaded", async () => {
   applyTranslations();        // ✅ now it's safe to apply translations
  await loadGenreLookup();
 loadTopMovies();             // in case it's asynchronous (make it await if needed)
 loadGenreSections();         // wait until genre sections are rendered
                

  const user = JSON.parse(localStorage.getItem("user"));
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  if (user && isLoggedIn) {
    showWelcome(user.name);
    favoritesSection.style.display = "block";
    watchlistContainer.style.display = "block";
    displayFavorites();
    displayWatchlist();
  } else {
    favoritesSection.style.display = "none";
    watchlistContainer.style.display = "none";
  }
});
