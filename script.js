let database = [];
let currentResults = [];

const stopWords = new Set([
  'how', 'often', 'do', 'i', 'the', 'a', 'an', 'is', 'are', 'what',
  'when', 'where', 'should', 'can', 'for', 'with', 'about', 'to', 'at',
  'check', 'need', 'please', 'me'
]);

const fuzzyThreshold = 2;

function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

async function loadData() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/marksescon/Metis-Web/refs/heads/main/metis_data.json');
    database = await response.json();
    document.getElementById('resultsContainer').innerHTML = '';
    console.log(`Loaded ${database.length} entries`);
  } catch (error) {
    console.error('Error loading data:', error);
    document.getElementById('resultsContainer').innerHTML = 
      '<div class="empty-state">Error loading clinical guidelines. Please check your connection.</div>';
  }
}

function queryDatabase(searchText) {
  const cleanQuery = searchText.toLowerCase().trim();
  
  if (cleanQuery === '') {
    currentResults = [];
    renderResults();
    return;
  }

  const allTokens = cleanQuery.split(/\s+/).filter(t => t.length > 0);
  const clinicalAnchors = allTokens.filter(t => !stopWords.has(t));
  const searchTerms = clinicalAnchors.length > 0 ? clinicalAnchors : allTokens;
  const scoredResults = [];

  for (const entry of database) {
    let entryScore = 0;

    for (const term of searchTerms) {
      const keywordMatch = entry.keywords.some(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        return lowerKeyword.includes(term) || 
               levenshteinDistance(lowerKeyword, term) <= fuzzyThreshold;
      });

      const lowerCategory = entry.category.toLowerCase();
      const categoryMatch = lowerCategory.includes(term) || 
                            levenshteinDistance(lowerCategory, term) <= fuzzyThreshold;

      const idMatch = entry.id.toLowerCase().includes(term);
      const instructionMatch = entry.instruction.toLowerCase().includes(term);

      if (keywordMatch || categoryMatch || idMatch || instructionMatch) {
        entryScore++;
      }
    }

    if (entryScore > 0) {
      scoredResults.push({ entry, score: entryScore });
    }
  }

  currentResults = scoredResults
    .sort((a, b) => {
      if (a.score === b.score) {
        return a.entry.id.localeCompare(b.entry.id);
      }
      return b.score - a.score;
    })
    .map(item => item.entry);

  renderResults();
}

function renderResults() {
  const container = document.getElementById('resultsContainer');
  
  if (currentResults.length === 0 && document.getElementById('searchInput').value.trim() !== '') {
    container.innerHTML = '<div class="empty-state">No matching guidelines found.</div>';
    return;
  }

  if (currentResults.length === 0) {
    container.innerHTML = '';
    return;
  }

  const html = currentResults.map(entry => `
    <div class="result-card" onclick="showModal('${entry.id}')">
      <div class="category-tag">${escapeHtml(entry.category.toUpperCase())}</div>
      <div class="instruction">${escapeHtml(entry.instruction)}</div>
      <div class="policy-source">SOURCE: ${escapeHtml(entry.policy)}</div>
    </div>
  `).join('');

  container.innerHTML = `<div class="results">${html}</div>`;
}

function showModal(entryId) {
  const entry = database.find(e => e.id === entryId);
  if (!entry) return;

  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = `
    <div class="modal-category">${escapeHtml(entry.category.toUpperCase())}</div>
    <div class="modal-instruction">${escapeHtml(entry.instruction)}</div>
    <div class="modal-divider"></div>
    <div class="modal-policy">SOURCE: ${escapeHtml(entry.policy)}</div>
    <div class="modal-hint">↓ Click X or outside to close</div>
  `;

  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

setTimeout(() => {
  const searchInput = document.getElementById('searchInput');
  
  searchInput.addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('clearBtn').style.display = value ? 'flex' : 'none';
    queryDatabase(value);
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearBtn').style.display = 'none';
    queryDatabase('');
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearBtn').style.display = 'none';
    currentResults = [];
    renderResults();
  });

  document.getElementById('closeBtn').addEventListener('click', closeModal);

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') {
      closeModal();
    }
  });

  document.getElementById('modalCard').addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  loadData();
}, 100);