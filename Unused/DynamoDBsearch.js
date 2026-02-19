const API_BASE = "https://t0qwrlg7vc.execute-api.us-east-1.amazonaws.com"; // <-- PUT YOUR API BASE URL HERE

let allData = [];
let mobDrops = [];
let mapMonsters = [];
let mapConnections = [];

const resultsContainer = document.getElementById("searchResults");
const searchInput = document.getElementById("searchInput");

const filterAll = document.getElementById("filter-all");
const filterMonster = document.getElementById("filter-monster");
const filterItem = document.getElementById("filter-item");
const filterMap = document.getElementById("filter-map");

const monsterFilters = document.getElementById("monster-filters");
const itemFilters = document.getElementById("item-filters");


// ============================
// 🔎 DATABASE SEARCH
// ============================

async function fetchSearchResults() {
  const query = searchInput.value.trim();

  const selectedType = document.querySelector('input[name="entity-type"]:checked');
  const type = selectedType?.id.replace("filter-", "").toUpperCase() || "";

  const levelRange =
    document.querySelector('.level-filter:checked')?.value || "";

  const category =
    document.querySelector('.category-filter:checked')?.value || "";

  const reqLevel =
    document.querySelector('.req-level-filter:checked')?.value || "";

  const job =
    document.querySelector('.job-filter:checked')?.value || "";

  const params = new URLSearchParams({
    q: query,
    type,
    levelRange,
    category,
    reqLevel,
    job
  });

  if (!query && !levelRange && !category && !reqLevel && !job && type === "ALL") {
    resultsContainer.innerHTML = "";
    return;
  }

  const response = await fetch(`${API_BASE}/search?${params}`);
  const data = await response.json();

  allData = data; // Now coming from DB

  renderResults();
}


// ============================
// 🎨 RENDER SEARCH RESULTS
// ============================

function renderResults() {
  resultsContainer.innerHTML = "";

  allData.slice(0, 8).forEach(item => {
    const div = document.createElement("div");
    div.className = "search-result-item";

    let iconSrc = item.picture || item.icon || item.mapPicture || "";

    div.innerHTML = `
      ${iconSrc ? `<img src="${iconSrc}" style="width:20px;height:20px;margin-right:5px;">` : ""}
      ${item.name} (${item.entityType.toLowerCase()})
    `;

    div.onclick = () => {
      loadDetails(item.PK);
    };

    resultsContainer.appendChild(div);
  });
}

// ============================
// 🔁 DETAIL LOADERS (FROM DB)
// ============================

async function fetchDetails(pk) {
  const response = await fetch(`${API_BASE}/details?pk=${pk}`);
  return await response.json();
}

async function loadDetails(pk) {
  const response = await fetch(`${API_BASE}/details?pk=${encodeURIComponent(pk)}`);
  const data = await response.json();

  if (pk.startsWith("MOB#")) showMonsterDetails(data);
  if (pk.startsWith("ITEM#")) showItemDetails(data);
  if (pk.startsWith("MAP#")) showMapDetails(data);
}

// ============================
// 🗺 SHOW MAP
// ============================
function showMapDetails(data) {
  const map = data.metadata;
  const monsters = data.monsters || [];
  const connections = data.connections || [];

  let monstersHTML = '<div class="monsters-section"><h4>Monsters</h4><div class="monsters-grid">';
  monsters.forEach(m => {
    monstersHTML += `
      <div class="drop-card" onclick="loadDetails('${m.PK}')">
        <img src="${m.picture}" style="width:40px;height:40px;">
        <p>${m.name}</p>
        ${m.numberOfMobs ? `<p>Mobs: ${m.numberOfMobs}</p>` : ''}
      </div>
    `;
  });
  monstersHTML += '</div></div>';

  let connectionsHTML = '<div class="map-section"><h4>Connecting Maps</h4><div class="map-grid">';
  connections.forEach(c => {
    connectionsHTML += `
      <div class="drop-card" onclick="loadDetails('${c.PK}')">
        <p>${c.name}</p>
      </div>
    `;
  });
  connectionsHTML += '</div></div>';

  resultsContainer.innerHTML = `
    <div class="map-details">
      <h3>${map.name}</h3>
      <img src="${map.mapPicture}" style="width:100%;">
      ${monstersHTML}
      ${connectionsHTML}
    </div>
  `;
}

// ============================
// 👹 SHOW MONSTER
// ============================

function showMonsterDetails(data) {
  const monster = data.metadata || {};
  const drops = data.drops || [];
  const maps = data.maps || [];

  // =========================
  // DROPS
  // =========================
  let dropsHTML = '<div class="drops-section"><h4>Drops</h4><div class="drops-grid">';
  drops.forEach(d => {
    dropsHTML += `
      <div class="drop-card" onclick="loadDetails('${d.PK}')">
        ${d.icon ? `<img src="${d.icon}" class="item-icon">` : ""}
        <p>${d.name || d.Name || "Unknown Item"}</p>
        ${d.chance ? `<p>Chance: ${d.chance}</p>` : ''}
      </div>
    `;
  });
  dropsHTML += '</div></div>';

  // =========================
  // MAPS
  // =========================
  let mapHTML = '<div class="map-section"><h4>Found In</h4><div class="map-grid">';
  maps.forEach(m => {
    mapHTML += `
      <div class="drop-card" onclick="loadDetails('${m.PK}')">
        <p>${m.name || "Unknown Map"}</p>
      </div>
    `;
  });
  mapHTML += '</div></div>';

  // =========================
  // FINAL HTML
  // =========================
  resultsContainer.innerHTML = `
    <div class="monster-details">
      <div class="entity-header">
        ${typeof getVerifiedMonsterBadge === "function" ? getVerifiedMonsterBadge(monster) : ""}
        <h3>${monster.name || ""}</h3>
        <img src="${monster.picture || ""}" alt="${monster.name || ""}" class="item-icon">
      </div>

      <div class="entity-stats">
        <p><strong>Level:</strong> ${monster.level ?? "-"}</p>
        <p><strong>XP:</strong> ${monster.xp ?? "-"}</p>
        <p><strong>HP:</strong> ${monster.hp ?? "-"}</p>
        <p><strong>XP Cost:</strong> ${monster.xpCost ?? "-"}</p>
      </div>

      ${dropsHTML}
      ${mapHTML}
    </div>
  `;
}

// ============================
// 🧪 SHOW ITEM
// ============================

function showItemDetails(data) {
  const item = data.metadata;
  const droppers = data.droppers || [];

  let droppersHTML = '<div class="dropped-by-section"><h4>Dropped By</h4><div class="dropped-by-grid">';
  droppers.forEach(d => {
    droppersHTML += `
      <div class="drop-card" onclick="loadDetails('${d.PK}')">
        <p>${d.name}</p>
      </div>
    `;
  });
  droppersHTML += '</div></div>';

  resultsContainer.innerHTML = `
    <div class="item-details">
      <h3>${item.name}</h3>
      <img src="${item.icon}" style="width:100px;">
      <p>${item.description || ""}</p>
      ${droppersHTML}
    </div>
  `;
};


// ============================
// 🎛 FILTER EVENTS
// ============================

let debounce;

searchInput.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(fetchSearchResults, 300);
});

document.querySelectorAll("input[type=radio]").forEach(radio => {
  radio.addEventListener("change", fetchSearchResults);
});


// ============================
// SUB FILTER UI TOGGLE
// ============================

function updateSubFilters() {
  const selectedType = document.querySelector('input[name="entity-type"]:checked');
  if (selectedType.id === 'filter-monster') {
    monsterFilters.style.display = 'block';
    itemFilters.style.display = 'none';
  } else if (selectedType.id === 'filter-item') {
    monsterFilters.style.display = 'none';
    itemFilters.style.display = 'block';
  } else {
    monsterFilters.style.display = 'none';
    itemFilters.style.display = 'none';
  }
}

document.querySelectorAll('input[name="entity-type"]').forEach(rb =>
  rb.addEventListener("change", updateSubFilters)
);
