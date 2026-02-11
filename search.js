let allData = [];
let mobDrops = [];
let mapMonsters = [];
const BONUS_STAT_LABELS = {
  'Weapon Def': 'Weapon Def',
  'Magic Def': 'Magic Def',
  'Weapon Attack': 'Attack Power',
  'Attack Power': 'Attack Power',
  'Magic Attack': 'Magic Attack',
  'STR': 'STR',
  'DEX': 'DEX',
  'INT': 'INT',
  'LUK': 'LUK',
  'HP': 'HP',
  'MP': 'MP',
  'Crit Rate ': 'Crit Rate',
  'Crit Damage': 'Crit Damage',
  'Speed': 'Speed',
  'Jump': 'Jump',
  'Accuracy': 'Accuracy',
  'Avoidability': 'Avoidability',
  'Knockback': 'Knockback'
};

function getUseItemStats(item) {
  const statKeys = ['Attack Power', 'Magic Attack', 'Weapon Def', 'Magic Def', 'STR', 'DEX', 'INT', 'LUK', 'HP', 'MP', 'Crit Rate ', 'Crit Damage', 'Speed', 'Jump', 'Accuracy', 'Avoidability', 'Knockback'];

  const stats = statKeys.filter(stat => {
    const value = item[stat];
    return value !== undefined && value !== null && value !== '' && Number(value) !== 0;
  });

  if (stats.length === 0) return '';

  return `
    <div class="use-item-stats">
      ${stats
        .map(stat => `<p><strong>${stat}:</strong> +${item[stat]}</p>`)
        .join('')}
    </div>
  `;
}

function getVerifiedBadge(item) {
  const isVerified = item.Verified === "TRUE";

  return `
    <div class="verified-badge ${isVerified ? 'verified' : 'unverified'}">
      <span class="verified-check">✔</span>
      <span class="verified-text">
        ${isVerified ? 'Verified in Game' : 'Unverified in Game'}
      </span>
    </div>
  `;
}

function getVerifiedDropBorderStyle(drop) {
  return drop && (drop.Verified === true || drop.Verified === "TRUE")
    ? 'style="border:3px solid green;"'
    : '';
}

function getVerifiedMonsterBadge(monster) {
  const isVerified = monster && (monster.Verified === true || monster.Verified === "TRUE");

  return `
    <div class="verified-badge ${isVerified ? 'verified' : 'unverified'}">
      <span class="verified-check">✔</span>
      <span class="verified-text">
        ${isVerified ? 'Verified mob stats in game' : 'Unverified mob stats in game'}
      </span>
    </div>
  `;
}

function getVerifiedMapMonsterBorderStyle(mm) {
  return mm && (mm.Verified === true || mm.Verified === "TRUE")
    ? 'style="border:3px solid green;"'
    : '';
}

// Load all data
Promise.all([
  fetch("JSONS/mobs.json").then(res => res.json()),
  fetch("JSONS/items.json").then(res => res.json()),
  fetch("JSONS/maps.json").then(res => res.json()),
  fetch("JSONS/MobDrops.json").then(res => res.json()),
  fetch("JSONS/MapMonsters.json").then(res => res.json()),
  fetch("JSONS/MapConnections.json").then(res => res.json())
])
.then(([monstersData, itemsData, mapsData, dropsData, mapMonstersData, mapConnectionsData]) => {
  // Add type and displayName to each
  monstersData.forEach(item => {
    item.type = 'monster';
    item.displayName = item.Name;
  });
  itemsData.forEach(item => {
    item.type = 'item';
    item.displayName = item['Item Name'];
  });
  mapsData.forEach(item => {
    item.type = 'map';
    item.displayName = item['Map Name'];
  });
  allData = [...monstersData, ...itemsData, ...mapsData];
  mobDrops = dropsData;
  mapMonsters = mapMonstersData;
  mapConnections = mapConnectionsData;
  console.log("All data loaded:", allData.length, "Drops:", mobDrops.length, "MapMonsters:", mapMonsters.length, "MapConnections:", mapConnections.length);

  updateSubFilters();

  // Check URL parameters for pre-selected type
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');
  if (type) {
    if (type === 'items') {
      document.getElementById('filter-item').checked = true;
    } else if (type === 'maps') {
      document.getElementById('filter-map').checked = true;
    } else if (type === 'monsters') {
      document.getElementById('filter-monster').checked = true;
    }
    updateSubFilters();
    applyFilters();
  }

  // Add event listeners after data loads
  searchInput.addEventListener("input", applyFilters);
  document.querySelectorAll('input[name="entity-type"]').forEach(rb => rb.addEventListener("change", () => { updateSubFilters(); applyFilters(); }));
  document.querySelectorAll('.level-filter').forEach(cb => cb.addEventListener("change", applyFilters));
  document.querySelectorAll('.category-filter').forEach(cb => cb.addEventListener("change", () => { updateReqLevelVisibility(); applyFilters(); }));
  document.querySelectorAll('.req-level-filter').forEach(cb => cb.addEventListener("change", applyFilters));
  document.querySelectorAll('.job-filter').forEach(cb => cb.addEventListener("change", applyFilters));
})
.catch(err => console.error("Failed to load data", err));

// Function to show item details
window.showItem = (itemid) => {
  const item = allData.find(d => d.ITEMID === itemid);
  if (!item) return;
  
  // Get monsters that drop this item
  const droppers = mobDrops.filter(drop => drop.ITEMID === itemid);
  let droppersHTML = '<div class="dropped-by-section"><h4>Dropped By</h4><div class="dropped-by-grid">';
  droppers.forEach(drop => {
    const monster = allData.find(d => d.type === 'monster' && d.MOBID === drop.MOBID);
    if (monster) {
      droppersHTML += `
        <div class="drop-card" ${getVerifiedDropBorderStyle(drop)} onclick="showMonster('${monster.MOBID}')">
          <img src="${monster.Picture}" alt="${monster.Name}" style="width:40px; height:40px;">
          <p>${monster.Name}</p>
          ${drop.Chance ? `<p>Chance: ${drop.Chance}</p>` : ''}
        </div>
      `;
    }
  });
  droppersHTML += '</div></div>';
  
  let detailsHTML = `<div class="item-details">`;
  
  if (item.Category === 'ETC') {
    detailsHTML += `
      <div class="item-header">
        ${getVerifiedBadge(item)}
        <h3>${item['Item Name']}</h3>
        <img src="${item['Item Icon']}" alt="${item['Item Name']}" class="item-icon">
      </div>
      <div class="entity-stats">
        <p><strong>Category:</strong> ${item.Category}</p>
        <p><strong>Etc Type:</strong> ${item['Etc Type']}</p>
        <p><strong>Description:</strong> ${item.Description}</p>
      </div>
      ${droppersHTML}
    `;
  } else if (item.Category === 'USE') {
    detailsHTML += `
      <div class="item-header">
        ${getVerifiedBadge(item)}
        <h3>${item['Item Name']}</h3>
        <img src="${item['Item Icon']}" alt="${item['Item Name']}" class="item-icon">
      </div>
      <div class="entity-stats">
        <p><strong>Category:</strong> ${item.Category}</p>
        <p><strong>Use Type:</strong> ${item['Use Type']}</p>
        <p><strong>Description:</strong> ${item.Description}</p>
        ${getUseItemStats(item)}
      </div>
      ${droppersHTML}
    `;
  } else if (item.Category === 'EQUIPMENT') {
    detailsHTML += `
    <div class="item-header">
      ${getVerifiedBadge(item)}
      <h3>${item['Item Name']}</h3>
      <img src="${item['Item Icon']}" alt="${item['Item Name']}" class="item-icon">
      <p><strong>Equip Type:</strong> ${item['Equip Type'] || 'N/A'}</p>
      <p><strong>Job:</strong> ${item.Job || 'N/A'}</p>
    </div>
    <div class="item-stats">
      <div class="req-stats">
        <h4>Requirements</h4>
        <p><strong>Level:</strong> ${item['Req Level'] || '0'}</p>
        <p><strong>STR:</strong> ${item['Req Str'] || '0'}</p>
        <p><strong>DEX:</strong> ${item['Req Dex'] || '0'}</p>
        <p><strong>INT:</strong> ${item['Req Int'] || '0'}</p>
        <p><strong>LUK:</strong> ${item['Req Luk'] || '0'}</p>
        <p><strong>Fame:</strong> ${item['Req Fame'] || '0'}</p>`;
    if (item['Upgrade Slots']) detailsHTML += `<p><strong>Upgrade Slots:</strong> ${item['Upgrade Slots']}</p>`;
    detailsHTML += `</div>
      <div class="bonus-stats">
        <h4>Stats</h4>`;
    // Show weapon-specific stats first
    if (item['Weapon Category']) detailsHTML += `<p><strong>Category:</strong> ${item['Weapon Category']}</p>`;
    if (item['Attack Speed']) detailsHTML += `<p><strong>Attack Speed:</strong> ${item['Attack Speed']}</p>`;
    if (item['Attack Power']) detailsHTML += `<p><strong>Attack Power:</strong> ${item['Attack Power']}</p>`;
    if (item['Magic Attack']) detailsHTML += `<p><strong>Magic Attack:</strong> ${item['Magic Attack']}</p>`;

    // Dynamically show any other bonus stats
    const bonusStats = [];
    Object.keys(BONUS_STAT_LABELS).forEach(statKey => {
      // Skip Attack Power since it's already shown in weapon-specific stats
      if (statKey === 'Attack Power') return;
      // Skip Magic Attack since it's already shown in weapon-specific stats
      if (statKey === 'Magic Attack') return;
      const value = item[statKey];
      if (value != null && value !== '' && value !== '0' && value !== 0) {
        bonusStats.push(`<p><strong>${BONUS_STAT_LABELS[statKey]}:</strong> ${value}</p>`);
      }
    });
    
    // Add bonus stats to the HTML
    bonusStats.forEach(stat => {
      detailsHTML += stat;
    });
    detailsHTML += `</div>
    </div>
    ${droppersHTML}`;
  }
  
  detailsHTML += `</div>`;
  resultsContainer.innerHTML = detailsHTML;
};

// Function to show monster details
window.showMonster = (mobid) => {
  const item = allData.find(d => d.MOBID === mobid);
  if (!item) return;
  
  // Get drops for this monster
  const drops = mobDrops.filter(drop => drop.MOBID === item.MOBID);
  let dropsHTML = '<div class="drops-section"><h4>Drops</h4><div class="drops-grid">';
  drops.forEach(drop => {
    const droppedItem = allData.find(d => d.type === 'item' && d.ITEMID === drop.ITEMID);
    if (droppedItem) {
      dropsHTML += `
        <div class="drop-card" ${getVerifiedDropBorderStyle(drop)} onclick="showItem('${drop.ITEMID}')">
          <img src="${droppedItem['Item Icon']}" alt="${droppedItem['Item Name']}" style="width:40px; height:40px;">
          <p>${droppedItem['Item Name']}</p>
          ${drop.Chance ? `<p>Chance: ${drop.Chance}</p>` : ''}
        </div>
      `;
    }
  });
  dropsHTML += '</div></div>';

  // Get maps for this monster
  const mapEntries = mapMonsters.filter(mm => mm.MOBID === item.MOBID);
  let mapHTML = '';
  if (mapEntries.length > 0) {
    mapHTML = '<div class="map-section"><h4>Found In</h4><div class="map-grid">';
    mapEntries.forEach(me => {
      const map = allData.find(d => d.type === 'map' && d.MAPID === me.MAPID);
      if (map) {
        mapHTML += `
          <div class="drop-card" ${getVerifiedMapMonsterBorderStyle(me)} onclick="showMap('${map.MAPID}')">
            <img src="${map['Map Picture']}" alt="${map['Map Name']}" style="width:40px; height:40px;">
            <p>${map['Map Name']}</p>
          </div>
        `;
      }
    });
    mapHTML += '</div></div>';
  }

  const detailsHTML = `
    <div class="monster-details">
      <div class="entity-header">
        ${getVerifiedMonsterBadge(item)}
        <h3>${item.Name}</h3>
        <img src="${item.Picture}" alt="${item.Name}" class="item-icon">
      </div>
      <div class="entity-stats">
        <p><strong>Level:</strong> ${item.Level}</p>
        <p><strong>XP:</strong> ${item.XP}</p>
        <p><strong>HP:</strong> ${item.HP}</p>
        <p><strong>XP Cost:</strong> ${item.XPCost}</p>
      </div>
      ${dropsHTML}
      ${mapHTML}
    </div>
  `;
  resultsContainer.innerHTML = detailsHTML;
};

// Function to show map details
window.showMap = (mapid) => {
  const item = allData.find(d => d.MAPID === mapid);
  if (!item) return;
  
  // Get monsters in this map
  const monstersInMap = mapMonsters.filter(mm => mm.MAPID === item.MAPID);
  let monstersHTML = '<div class="monsters-section"><h4>Monsters</h4><div class="monsters-grid">';
  monstersInMap.forEach(mm => {
    const monster = allData.find(d => d.type === 'monster' && d.MOBID === mm.MOBID);
    if (monster) {
      monstersHTML += `
        <div class="drop-card" ${getVerifiedMapMonsterBorderStyle(mm)} onclick="showMonster('${mm.MOBID}')">
          <img src="${monster.Picture}" alt="${monster.Name}" style="width:40px; height:40px;">
          <p>${monster.Name}</p>
          ${mm.NumberOfMobs ? `<p>Mobs: ${mm.NumberOfMobs}</p>` : ''}
        </div>
      `;
    }
  });
  monstersHTML += '</div></div>';

    const connected = mapConnections.filter(mc => mc.FromMapID === item.MAPID);
  let connectionsHTML = '';
  if (connected.length > 0) {
    connectionsHTML = '<div class="map-section"><h4>Connecting Maps</h4><div class="map-grid">';
    connected.forEach(mc => {
      const map = allData.find(d => d.type === 'map' && d.MAPID === mc.ToMapID);
      if (map) {
        connectionsHTML += `
          <div class="drop-card" onclick="showMap('${map.MAPID}')">
            <img src="${map['Map Picture']}" alt="${map['Map Name']}" style="width:40px; height:40px;">
            <p>${map['Map Name']}</p>
          </div>
        `;
      }
    });
    connectionsHTML += '</div></div>';
  }

  const detailsHTML = `
      <div class="map-details">
        <div class="entity-header">
          <h3>${item['Map Name']}</h3>
          <img 
            src="${item['Map Picture']}" 
            alt="${item['Map Name']}" 
            class="item-icon"
            style="width: 100%; height: 100%; object-fit: cover;"
          >
        </div>
        ${monstersHTML}
        ${connectionsHTML}
      </div>
    `;
  resultsContainer.innerHTML = detailsHTML;
};

const resultsContainer = document.getElementById("searchResults");
const filterAll = document.getElementById("filter-all");
const filterMonster = document.getElementById("filter-monster");
const filterItem = document.getElementById("filter-item");
const filterMap = document.getElementById("filter-map");
const monsterFilters = document.getElementById("monster-filters");
const itemFilters = document.getElementById("item-filters");

function updateSubFilters() {
  const selectedType = document.querySelector('input[name="entity-type"]:checked');
  if (selectedType.id === 'filter-monster') {
    monsterFilters.style.display = 'block';
    itemFilters.style.display = 'none';
  } else if (selectedType.id === 'filter-item') {
    monsterFilters.style.display = 'none';
    itemFilters.style.display = 'block';
    updateReqLevelVisibility();
  } else {
    monsterFilters.style.display = 'none';
    itemFilters.style.display = 'none';
  }
}

function updateReqLevelVisibility() {
  const selectedCategory = document.querySelector('.category-filter:checked');
  const reqLevelSection = document.getElementById('req-level-section');
  reqLevelSection.style.display = (selectedCategory && selectedCategory.value === 'EQUIPMENT') ? 'block' : 'none';
}

function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();
  resultsContainer.innerHTML = "";

  let filtered = allData;

  // Type filters
  const selectedType = document.querySelector('input[name="entity-type"]:checked');
  let allowedTypes = [];
  if (selectedType.id === 'filter-all') {
    allowedTypes = ['monster', 'item', 'map'];
  } else if (selectedType.id === 'filter-monster') {
    allowedTypes = ['monster'];
  } else if (selectedType.id === 'filter-item') {
    allowedTypes = ['item'];
  } else if (selectedType.id === 'filter-map') {
    allowedTypes = ['map'];
  }
  filtered = filtered.filter(item => allowedTypes.includes(item.type));

  // Sub-filters
  let hasActiveFilters = selectedType.id === 'filter-map'; // Maps always show suggestions

  if (selectedType.id === 'filter-monster') {
    const selectedLevel = document.querySelector('.level-filter:checked');
    if (selectedLevel && selectedLevel.value) {
      hasActiveFilters = true;
      const range = selectedLevel.value;
      filtered = filtered.filter(item => {
        if (item.type !== 'monster') return true;
        const level = item.Level;
        if (range === '51+') return level >= 51;
        const [min, max] = range.split('-').map(Number);
        return level >= min && level <= max;
      });
    }
  }

  if (selectedType.id === 'filter-item') {
    const selectedCategory = document.querySelector('.category-filter:checked');
    if (selectedCategory && selectedCategory.value) {
      hasActiveFilters = true;
      const category = selectedCategory.value;
      filtered = filtered.filter(item => {
        if (item.type !== 'item') return true;
        return item.Category === category;
      });
    }

    const selectedReqLevel = document.querySelector('.req-level-filter:checked');
    if (selectedReqLevel && selectedReqLevel.value) {
      hasActiveFilters = true;
      const range = selectedReqLevel.value;
      filtered = filtered.filter(item => {
        if (item.type !== 'item') return true;
        const reqLevelStr = item['Req Level'];
        if (reqLevelStr == null) return false; // exclude if no req level
        const reqLevel = parseFloat(reqLevelStr);
        if (isNaN(reqLevel)) return false; // exclude if invalid
        if (range === '51+') return reqLevel >= 51;
        const [min, max] = range.split('-').map(Number);
        return reqLevel >= min && reqLevel <= max;
      });
    }

    const selectedJob = document.querySelector('.job-filter:checked');
    if (selectedJob && selectedJob.value) {
      hasActiveFilters = true;
      const job = selectedJob.value;
      filtered = filtered.filter(item => {
        if (item.type !== 'item') return true;
        return item.Job === job;
      });
    }
  }

  // Text search
  if (query.length > 0) {
    filtered = filtered.filter(item =>
      item.displayName && typeof item.displayName === 'string' && item.displayName.toLowerCase().includes(query)
    );
  } else if (!hasActiveFilters) {
    // If no query and no filters, show nothing
    return;
  }

  filtered = filtered.slice(0, 8);

  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "search-result-item";
    
    let iconSrc = '';
    if (item.type === 'monster') iconSrc = item.Picture;
    else if (item.type === 'item') iconSrc = item['Item Icon'];
    else if (item.type === 'map') iconSrc = item['Map Picture'];
    
    div.innerHTML = `${iconSrc ? `<img src="${iconSrc}" alt="" style="width:20px; height:20px; margin-right:5px; vertical-align:middle;">` : ''} ${item.displayName} (${item.type})`;

    div.onclick = () => {
      let detailsHTML = '';
      if (item.type === 'monster') {
        // Get drops for this monster
        const drops = mobDrops.filter(drop => drop.MOBID === item.MOBID);
        let dropsHTML = '<div class="drops-section"><h4>Drops</h4><div class="drops-grid">';
        drops.forEach(drop => {
          const droppedItem = allData.find(d => d.type === 'item' && d.ITEMID === drop.ITEMID);
          if (droppedItem) {
            dropsHTML += `
              <div class="drop-card" ${getVerifiedDropBorderStyle(drop)} onclick="showItem('${drop.ITEMID}')">
                <img src="${droppedItem['Item Icon']}" alt="${droppedItem['Item Name']}" style="width:40px; height:40px;">
                <p>${droppedItem['Item Name']}</p>
                ${drop.Chance ? `<p>Chance: ${drop.Chance}</p>` : ''}
              </div>
            `;
          }
        });
        dropsHTML += '</div></div>';

        // Get maps for this monster
        const mapEntries = mapMonsters.filter(mm => mm.MOBID === item.MOBID);
        let mapHTML = '';
        if (mapEntries.length > 0) {
          mapHTML = '<div class="map-section"><h4>Found In</h4><div class="map-grid">';
          mapEntries.forEach(me => {
            const map = allData.find(d => d.type === 'map' && d.MAPID === me.MAPID);
            if (map) {
              mapHTML += `
                <div class="drop-card" ${getVerifiedMapMonsterBorderStyle(me)} onclick="showMap('${map.MAPID}')">
                  <img src="${map['Map Picture']}" alt="${map['Map Name']}" style="width:40px; height:40px;">
                  <p>${map['Map Name']}</p>
                </div>
              `;
            }
          });
          mapHTML += '</div></div>';
        }

        detailsHTML = `
          <div class="monster-details">
            <div class="item-header">
              ${getVerifiedMonsterBadge(item)}
              <h3>${item.Name}</h3>
              <img src="${item.Picture}" alt="${item.Name}" class="item-icon">
            </div>
            <div class="entity-stats">
              <p><strong>Level:</strong> ${item.Level}</p>
              <p><strong>XP:</strong> ${item.XP}</p>
              <p><strong>HP:</strong> ${item.HP}</p>
              <p><strong>XP Cost:</strong> ${item.XPCost}</p>
            </div>
            ${dropsHTML}
            ${mapHTML}
          </div>
        `;
        resultsContainer.innerHTML = detailsHTML;
      } else if (item.type === 'item') {
        let detailsHTML = `<div class="item-details">`;
        
        if (item.Category === 'ETC') {
          detailsHTML += `
            <div class="item-header">
            ${getVerifiedBadge(item)}
              <h3>${item['Item Name']}</h3>
              <img src="${item['Item Icon']}" alt="${item['Item Name']}" class="item-icon">
            </div>
            <div class="entity-stats">
              <p><strong>Category:</strong> ${item.Category}</p>
              <p><strong>Etc Type:</strong> ${item['Etc Type']}</p>
              <p><strong>Description:</strong> ${item.Description}</p>
            </div>
          `;
        } else if (item.Category === 'USE') {
          detailsHTML += `
            <div class="item-header">
            ${getVerifiedBadge(item)}
              <h3>${item['Item Name']}</h3>
              <img src="${item['Item Icon']}" alt="${item['Item Name']}" class="item-icon">
            </div>
            <div class="entity-stats">
              <p><strong>Category:</strong> ${item.Category}</p>
              <p><strong>Use Type:</strong> ${item['Use Type']}</p>
              <p><strong>Description:</strong> ${item.Description}</p>
              ${getUseItemStats(item)}
            </div>
          `;
        } else if (item.Category === 'EQUIPMENT') {
          detailsHTML += `
          <div class="item-header">
            ${getVerifiedBadge(item)}
            <h3>${item['Item Name']}</h3>
            <img src="${item['Item Icon']}" alt="${item['Item Name']}" class="item-icon">
            <p><strong>Equip Type:</strong> ${item['Equip Type'] || 'N/A'}</p>
            <p><strong>Job:</strong> ${item.Job || 'N/A'}</p>
          </div>
          <div class="item-stats">
            <div class="req-stats">
              <h4>Requirements</h4>
              <p><strong>Level:</strong> ${item['Req Level'] || '0'}</p>
              <p><strong>STR:</strong> ${item['Req Str'] || '0'}</p>
              <p><strong>DEX:</strong> ${item['Req Dex'] || '0'}</p>
              <p><strong>INT:</strong> ${item['Req Int'] || '0'}</p>
              <p><strong>LUK:</strong> ${item['Req Luk'] || '0'}</p>
              <p><strong>Fame:</strong> ${item['Req Fame'] || '0'}</p>`;
          if (item['Upgrade Slots']) detailsHTML += `<p><strong>Upgrade Slots:</strong> ${item['Upgrade Slots']}</p>`;
          detailsHTML += `</div>
            <div class="bonus-stats">
              <h4>Stats</h4>`;
            // Show weapon-specific stats first
            if (item['Weapon Category']) detailsHTML += `<p><strong>Category:</strong> ${item['Weapon Category']}</p>`;
            if (item['Attack Speed']) detailsHTML += `<p><strong>Attack Speed:</strong> ${item['Attack Speed']}</p>`;
            if (item['Attack Power']) detailsHTML += `<p><strong>Attack Power:</strong> ${item['Attack Power']}</p>`;
            if (item['Magic Attack']) detailsHTML += `<p><strong>Magic Attack:</strong> ${item['Magic Attack']}</p>`;

            // Dynamically show any other bonus stats
            const bonusStats = [];
            Object.keys(BONUS_STAT_LABELS).forEach(statKey => {
              // Skip Attack Power since it's already shown in weapon-specific stats
              if (statKey === 'Attack Power') return;
              // Skip Magic Attack since it's already shown in weapon-specific stats
              if (statKey === 'Magic Attack') return;
              const value = item[statKey];
              if (value != null && value !== '' && value !== '0' && value !== 0) {
                bonusStats.push(`<p><strong>${BONUS_STAT_LABELS[statKey]}:</strong> ${value}</p>`);
              }
            });
            
            // Add bonus stats to the HTML
            bonusStats.forEach(stat => {
              detailsHTML += stat;
            });
          detailsHTML += `</div>
          </div>`;
        }
        
        // Get monsters that drop this item
        const droppers = mobDrops.filter(drop => drop.ITEMID === item.ITEMID);
        let droppersHTML = '<div class="dropped-by-section"><h4>Dropped By</h4><div class="dropped-by-grid">';
        droppers.forEach(drop => {
          const monster = allData.find(d => d.type === 'monster' && d.MOBID === drop.MOBID);
          if (monster) {
            droppersHTML += `
              <div class="drop-card" ${getVerifiedDropBorderStyle(drop)} onclick="showMonster('${monster.MOBID}')">
                <img src="${monster.Picture}" alt="${monster.Name}" style="width:40px; height:40px;">
                <p>${monster.Name}</p>
                ${drop.Chance ? `<p>Chance: ${drop.Chance}</p>` : ''}
              </div>
            `;
          }
        });
        droppersHTML += '</div></div>';
        
        detailsHTML += droppersHTML + `</div>`;
        resultsContainer.innerHTML = detailsHTML;
      } else if (item.type === 'map') {
        // Get monsters in this map
        const monstersInMap = mapMonsters.filter(mm => mm.MAPID === item.MAPID);
        let monstersHTML = '<div class="monsters-section"><h4>Monsters</h4><div class="monsters-grid">';
        monstersInMap.forEach(mm => {
          const monster = allData.find(d => d.type === 'monster' && d.MOBID === mm.MOBID);
          if (monster) {
            monstersHTML += `
              <div class="drop-card" ${getVerifiedMapMonsterBorderStyle(mm)} onclick="showMonster('${mm.MOBID}')">
                <img src="${monster.Picture}" alt="${monster.Name}" style="width:40px; height:40px;">
                <p>${monster.Name}</p>
                ${mm.NumberOfMobs ? `<p>Mobs: ${mm.NumberOfMobs}</p>` : ''}
              </div>
            `;
          }
        });
        monstersHTML += '</div></div>';

          const connected = mapConnections.filter(mc => mc.FromMapID === item.MAPID);
  let connectionsHTML = '';
  if (connected.length > 0) {
    connectionsHTML = '<div class="map-section"><h4>Connecting Maps</h4><div class="map-grid">';
    connected.forEach(mc => {
      const map = allData.find(d => d.type === 'map' && d.MAPID === mc.ToMapID);
      if (map) {
        connectionsHTML += `
          <div class="drop-card" onclick="showMap('${map.MAPID}')">
            <img src="${map['Map Picture']}" alt="${map['Map Name']}" style="width:40px; height:40px;">
            <p>${map['Map Name']}</p>
          </div>
        `;
      }
    });
    connectionsHTML += '</div></div>';
  }

      const detailsHTML = `
        <div class="map-details">
          <div class="entity-header">
            <h3>${item['Map Name']}</h3>
            <img 
              src="${item['Map Picture']}" 
              alt="${item['Map Name']}" 
              class="item-icon"
              style="width: 100%; height: 100%; object-fit: cover;"
            >
          </div>
          ${monstersHTML}
          ${connectionsHTML}
        </div>
      `;
      resultsContainer.innerHTML = detailsHTML;
    }
    };

    resultsContainer.appendChild(div);
  });
};
