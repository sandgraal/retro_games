// app.js

let rawData = [], owned = {}, importedCollection = null;
let filterPlatform = '', filterGenre = '', searchValue = '';

function csvToArray(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/(^"|"$)/g,'').trim());
  return lines.slice(1).map(line => {
    let values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    return headers.reduce((o, h, i) => (o[h]=values[i]?values[i].replace(/(^"|"$)/g,'').trim():'' ,o), {});
  });
}

function loadOwned() {
  try { owned = JSON.parse(localStorage.getItem('roms_owned') || '{}'); } catch { owned = {}; }
}
function saveOwned() {
  localStorage.setItem('roms_owned', JSON.stringify(owned));
}

function setupFilters(data) {
  const platforms = [...new Set(data.map(row => row["Platform"]).filter(Boolean))].sort();
  const platSel = document.getElementById('platformFilter');
  platSel.innerHTML = `<option value="">All Platforms</option>` + platforms.map(p => `<option>${p}</option>`).join('');
  let allGenres = [];
  data.forEach(row => {
    if(row["Genre"]) row["Genre"].split(',').map(g => g.trim()).forEach(g => allGenres.push(g));
  });
  const genres = [...new Set(allGenres)].sort();
  const genreSel = document.getElementById('genreFilter');
  genreSel.innerHTML = `<option value="">All Genres</option>` + genres.map(g => `<option>${g}</option>`).join('');
}

function applyFilters(data) {
  let filterOwned = importedCollection;
  return data.filter(row => {
    if (filterPlatform && row["Platform"] !== filterPlatform) return false;
    if (filterGenre) {
      if (!(row["Genre"] && row["Genre"].split(',').map(g=>g.trim()).includes(filterGenre))) return false;
    }
    if (searchValue) {
      if (!Object.values(row).some(v => v && v.toLowerCase().includes(searchValue))) return false;
    }
    if (filterOwned && !filterOwned[row["Game Name"] + "___" + row["Platform"]]) return false;
    return true;
  });
}

function renderTable(data) {
  const headers = Object.keys(data[0]);
  const thead = document.querySelector('#romTable thead');
  const tbody = document.querySelector('#romTable tbody');
  thead.innerHTML = "<tr><th>Owned?</th>" + headers.map(h => `<th>${h}</th>`).join('') + "</tr>";
  tbody.innerHTML = data.map((row, idx) => {
    const key = row["Game Name"] + "___" + row["Platform"];
    let checked = importedCollection
      ? (importedCollection[key] ? "checked disabled" : "disabled")
      : (owned[key] ? "checked" : "");
    return `<tr data-row="${idx}" class="${(owned[key]||importedCollection&&importedCollection[key]) ? 'owned-row' : ''} game-row">` +
      `<td class="center"><input type="checkbox" class="checkbox-own" data-key="${key}" ${checked}></td>` +
      headers.map(h =>
        h === "Cover" && row[h] ? `<td><img src="${row[h]}"></td>` :
        h === "Details" && row[h] ? `<td><a href="${row[h]}" target="_blank" rel="noopener noreferrer">Info</a></td>` :
        `<td>${row[h]||''}</td>`
      ).join('') +
    "</tr>";
  }).join('');
  document.getElementById('result').style.display = 'none';
  document.getElementById('romTable').style.display = '';
  if (!importedCollection) {
    tbody.querySelectorAll('.checkbox-own').forEach(cb => {
      cb.onchange = function() {
        const k = this.getAttribute('data-key');
        if(this.checked) owned[k] = true;
        else delete owned[k];
        saveOwned();
        renderTable(applyFilters(rawData));
        updateStats(applyFilters(rawData));
      }
    });
  }
  // Modal: click a row, show details
  tbody.querySelectorAll('tr.game-row').forEach(tr => {
    tr.onclick = function(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "A" || e.target.classList.contains('checkbox-own')) return;
      const rowIdx = parseInt(tr.getAttribute("data-row"), 10);
      showGameModal(data[rowIdx]);
    };
  });
}

function updateStats(data) {
  const total = data.length;
  let ratings = data.map(row => parseFloat(row["Rating"])).filter(n => !isNaN(n));
  let avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '-';
  let platforms = new Set(data.map(row => row["Platform"]));
  let useOwned = importedCollection || owned;
  const ownedCount = data.filter(row => useOwned[row["Game Name"] + "___" + row["Platform"]]).length;
  document.getElementById('stats').textContent =
    `Games: ${total} | Owned: ${ownedCount} | Average Rating: ${avg} | Platforms: ${platforms.size}`;
}

// ---- Export/Import/Share Features ----

function exportOwnedGames() {
  const rows = rawData.filter(row => owned[row["Game Name"] + "___" + row["Platform"]]);
  if (!rows.length) { alert("No owned games to export!"); return; }
  let out = Object.keys(rawData[0]).join(',') + '\n' +
    rows.map(row => Object.values(row).map(cell =>
      `"${(cell||'').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  let blob = new Blob([out], {type:'text/csv'});
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url; a.download = 'sandgraal-collection.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function showShareSection() {
  let codes = [];
  Object.keys(owned).forEach(k => { if (owned[k]) codes.push(k); });
  let code = btoa(unescape(encodeURIComponent(codes.join('|'))));
  document.getElementById('shareSection').style.display = '';
  document.getElementById('shareCode').value = code;
  document.getElementById('importCode').value = '';
  document.getElementById('importResult').textContent = '';
}

function showImportSection() {
  document.getElementById('shareSection').style.display = '';
  document.getElementById('shareCode').value = '';
  document.getElementById('importCode').value = '';
  document.getElementById('importResult').textContent = '';
}

function importCollection() {
  let code = document.getElementById('importCode').value.trim();
  if (!code) {
    document.getElementById('importResult').textContent = "Paste a code first.";
    return;
  }
  let coll = {};
  try {
    let decoded = decodeURIComponent(escape(atob(code)));
    decoded.split('|').forEach(k => coll[k]=true);
    importedCollection = coll;
    renderTable(applyFilters(rawData));
    updateStats(applyFilters(rawData));
    document.getElementById('importResult').textContent = "Imported! Viewing shared collection.";
  } catch(e) {
    document.getElementById('importResult').textContent = "Invalid code.";
  }
}

function closeShareSection() {
  importedCollection = null;
  document.getElementById('shareSection').style.display = 'none';
  renderTable(applyFilters(rawData));
  updateStats(applyFilters(rawData));
}

// ---- Modal Feature ----
function showGameModal(game) {
  const modal = document.getElementById('gameModal');
  const modalBg = document.getElementById('modalBg');
  // Build modal HTML
  let html = `<button class="modal-close" title="Close">&times;</button>`;
  html += `<div class="modal-title">${game["Game Name"] || "(No Name)"}</div>`;
  if (game["Cover"]) html += `<img src="${game["Cover"]}" alt="cover">`;
  html += `<dl>`;
  for (let k in game) {
    if (k === "Game Name" || k === "Cover") continue;
    if (!game[k]) continue;
    html += `<dt>${k}:</dt><dd>${game[k]}</dd>`;
  }
  html += `</dl>`;
  const query = encodeURIComponent((game["Game Name"]||"") + " " + (game["Platform"]||""));
  html += `<div class="external-links">`;
  html += `<a href="https://www.google.com/search?q=${query}" target="_blank" rel="noopener">Google</a>`;
  html += `<a href="https://www.youtube.com/results?search_query=${query} gameplay" target="_blank" rel="noopener">YouTube</a>`;
  html += `<a href="https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(game["Game Name"]||"")}" target="_blank" rel="noopener">GameFAQs</a>`;
  html += `</div>`;

  modal.innerHTML = html;
  modalBg.style.display = modal.style.display = '';
  setTimeout(()=>{modalBg.style.display = "block"; modal.style.display = "block";},1);

  // Close logic
  modal.querySelector('.modal-close').onclick = closeModal;
  modalBg.onclick = closeModal;
  function closeModal() {
    modal.style.display = modalBg.style.display = "none";
    modal.innerHTML = "";
  }
}

// ---- App Bootstrap ----
fetch('games.csv')
  .then(r => r.ok ? r.text() : Promise.reject('CSV not found!'))
  .then(txt => {
    rawData = csvToArray(txt);
    if (!rawData.length) throw "CSV is empty!";
    loadOwned();
    setupFilters(rawData);
    renderTable(applyFilters(rawData));
    updateStats(applyFilters(rawData));

    document.getElementById('platformFilter').addEventListener('change', e => {
      filterPlatform = e.target.value;
      renderTable(applyFilters(rawData));
      updateStats(applyFilters(rawData));
    });
    document.getElementById('genreFilter').addEventListener('change', e => {
      filterGenre = e.target.value;
      renderTable(applyFilters(rawData));
      updateStats(applyFilters(rawData));
    });
    document.getElementById('search').addEventListener('input', e => {
      searchValue = e.target.value.trim().toLowerCase();
      renderTable(applyFilters(rawData));
      updateStats(applyFilters(rawData));
    });

    document.getElementById('exportBtn').onclick = exportOwnedGames;
    document.getElementById('shareBtn').onclick = showShareSection;
    document.getElementById('showImport').onclick = showImportSection;
    document.getElementById('copyShare').onclick = function() {
      let code = document.getElementById('shareCode').value;
      navigator.clipboard.writeText(code);
      this.textContent = "Copied!";
      setTimeout(()=>{this.textContent="Copy"},1200);
    };
    document.getElementById('importBtn').onclick = importCollection;
    document.getElementById('closeShare').onclick = closeShareSection;
    document.getElementById('importCode').addEventListener('keydown', function(e){
      if(e.key==='Enter') importCollection();
    });
  })
  .catch(err => {
    document.getElementById('result').textContent = 'Error: ' + err;
  });
