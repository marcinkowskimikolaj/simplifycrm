import { AuthService } from '../shared/auth.js';
import { DataService } from '../shared/data-service.js';
import { bootstrapProtectedPage } from '../shared/app-shell.js';

let allDefs = [];
let currentScope = 'company'; // company | contact | both
let editingRowIndex = null;
let editingDef = null;

function slugifyKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[ąćęłńóśżź]/g, (m) => ({
      'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ż':'z','ź':'z'
    }[m] || m))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function maskKey(key) {
  if (!key) return 'brak';
  if (key.length <= 6) return '••••••';
  return key.slice(0, 3) + '••••••' + key.slice(-2);
}

function byScope(def, scope) {
  if (scope === 'both') return def.entityType === 'both';
  return def.entityType === scope || def.entityType === 'both';
}

function renderNav() {
  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${section}`).classList.add('active');

      if (section === 'ai') {
        renderAiStatus();
      }
    });
  });
}

function renderScopeTabs() {
  document.querySelectorAll('.scope-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scope-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentScope = btn.dataset.scope;
      renderCustomFieldsTable();
    });
  });
}

async function loadDefs() {
  allDefs = await DataService.loadCustomFieldDefinitions(false);
  allDefs = Array.isArray(allDefs) ? allDefs : [];
}

function renderCustomFieldsTable() {
  const tbody = document.getElementById('customFieldsTbody');
  const defs = allDefs
    .filter(d => (d.enabled ?? true) || d.enabled === false)
    .filter(d => byScope(d, currentScope))
    .sort((a,b) => (a.order ?? 0) - (b.order ?? 0));

  if (!defs.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Brak pól własnych dla tej sekcji.</td></tr>`;
    return;
  }

  tbody.innerHTML = defs.map(d => {
    const req = d.required ? 'Tak' : 'Nie';
    const en = (d.enabled ?? true) ? 'Tak' : 'Nie';
    const type = d.fieldType || 'text';
    const actions = `
      <button class="btn btn-secondary btn-sm" data-act="edit" data-row="${d._rowIndex}">Edytuj</button>
      <button class="btn btn-secondary btn-sm" data-act="disable" data-row="${d._rowIndex}">Wyłącz</button>
    `;
    return `
      <tr>
        <td>${escapeHtml(d.label)}</td>
        <td><code>${escapeHtml(d.key)}</code></td>
        <td>${escapeHtml(type)}</td>
        <td>${req}</td>
        <td>${en}</td>
        <td>${escapeHtml(String(d.order ?? 0))}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const act = btn.dataset.act;
      const row = Number(btn.dataset.row);
      const def = allDefs.find(x => x._rowIndex === row);
      if (!def) return;

      if (act === 'edit') {
        openModalForEdit(def);
      }
      if (act === 'disable') {
        await DataService.disableCustomFieldDefinition(row);
        await loadDefs();
        renderCustomFieldsTable();
      }
    });
  });
}

function openModalForCreate() {
  editingRowIndex = null;
  editingDef = null;
  document.getElementById('customFieldModalTitle').textContent = 'Dodaj pole';
  document.getElementById('customFieldForm').reset();
  document.getElementById('cfOrder').value = '0';
  document.getElementById('cfEnabled').value = 'true';
  document.getElementById('cfRequired').value = 'false';
  document.getElementById('cfEntityType').value = currentScope === 'both' ? 'both' : currentScope;
  document.getElementById('cfOptionsGroup').style.display = 'none';
  document.getElementById('customFieldModal').classList.add('active');
}

function openModalForEdit(def) {
  editingRowIndex = def._rowIndex;
  editingDef = def;
  document.getElementById('customFieldModalTitle').textContent = 'Edytuj pole';
  document.getElementById('customFieldModal').classList.add('active');

  document.getElementById('cfLabel').value = def.label || '';
  document.getElementById('cfKey').value = def.key || '';
  document.getElementById('cfEntityType').value = def.entityType || 'both';
  document.getElementById('cfType').value = def.fieldType || 'text';
  document.getElementById('cfRequired').value = def.required ? 'true' : 'false';
  document.getElementById('cfEnabled').value = (def.enabled ?? true) ? 'true' : 'false';
  document.getElementById('cfOrder').value = String(def.order ?? 0);

  const isSelect = (def.fieldType || '').toLowerCase() === 'select';
  document.getElementById('cfOptionsGroup').style.display = isSelect ? '' : 'none';
  if (isSelect) {
    let opts = [];
    try { opts = def.optionsJson ? JSON.parse(def.optionsJson) : []; } catch (_) { opts = []; }
    document.getElementById('cfOptions').value = (opts || []).join('\n');
  } else {
    document.getElementById('cfOptions').value = '';
  }
}

function closeModal() {
  document.getElementById('customFieldModal').classList.remove('active');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function initModalInteractions() {
  document.getElementById('addCustomFieldBtn').addEventListener('click', openModalForCreate);
  document.getElementById('closeCustomFieldModalBtn').addEventListener('click', closeModal);
  document.getElementById('cancelCustomFieldBtn').addEventListener('click', closeModal);

  const typeEl = document.getElementById('cfType');
  typeEl.addEventListener('change', () => {
    const isSelect = typeEl.value === 'select';
    document.getElementById('cfOptionsGroup').style.display = isSelect ? '' : 'none';
  });

  const labelEl = document.getElementById('cfLabel');
  const keyEl = document.getElementById('cfKey');

  labelEl.addEventListener('input', () => {
    if (editingRowIndex !== null) return;
    const next = slugifyKey(labelEl.value);
    if (!keyEl.value) keyEl.value = next;
  });

  document.getElementById('customFieldForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const label = labelEl.value.trim();
    const key = keyEl.value.trim();
    const entityType = document.getElementById('cfEntityType').value;
    const fieldType = document.getElementById('cfType').value;
    const required = document.getElementById('cfRequired').value === 'true';
    const enabled = document.getElementById('cfEnabled').value === 'true';
    const order = Number(document.getElementById('cfOrder').value || 0);

    if (!label || !key) return;

    // uniqueness check (for create / for edit if key changed)
    const keyTaken = allDefs.some(d => d.key === key && d._rowIndex !== editingRowIndex);
    if (keyTaken) {
      alert('Ten klucz już istnieje. Zmień klucz (ID).');
      return;
    }

    let optionsJson = '';
    if (fieldType === 'select') {
      const lines = (document.getElementById('cfOptions').value || '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
      optionsJson = JSON.stringify(lines);
    }

    const base = editingDef ? { ...editingDef } : {};
    const payload = {
      ...base,
      label,
      key,
      entityType,
      fieldType,
      optionsJson,
      required,
      enabled,
      order,
      createdAt: base.createdAt || ''
    };

    await DataService.saveCustomFieldDefinition(payload, editingRowIndex);
    await loadDefs();
    renderCustomFieldsTable();
    closeModal();
  });
}

function renderAiStatus() {
  const provider = localStorage.getItem('ai_provider') || 'gemini';
  const key = localStorage.getItem('ai_api_key') || '';
  const consent = localStorage.getItem('ai_consent') || 'false';

  document.getElementById('aiProviderValue').textContent = provider;
  document.getElementById('aiKeyValue').textContent = key ? maskKey(key) : 'brak';
  document.getElementById('aiConsentValue').textContent = consent === 'true' ? 'TAK' : 'NIE';
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!AuthService.requireAuth()) return;

  await bootstrapProtectedPage({ logoAction: 'dashboard' });

  renderNav();
  renderScopeTabs();
  initModalInteractions();

  await loadDefs();
  renderCustomFieldsTable();
});
