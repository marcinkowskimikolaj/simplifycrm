import { AuthService } from '../shared/auth.js';
import { DataService } from '../shared/data-service.js';
import { bootstrapProtectedPage } from '../shared/app-shell.js';

if (!AuthService.requireAuth()) {
  throw new Error('Unauthorized');
}

let allFields = [];
let currentFilter = 'company'; // company | contact | both
let editingRowIndex = null;

function $(id) { return document.getElementById(id); }

function normalizeKey(key) {
  return (key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function showSection(sectionKey) {
  const sections = ['customFields', 'pipeline', 'ai'];
  sections.forEach(k => {
    const el = $(`section-${k}`);
    if (!el) return;
    el.style.display = (k === sectionKey) ? 'block' : 'none';
  });

  document.querySelectorAll('.settings-nav button[data-section]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === sectionKey);
  });
}

function openModal() {
  $('fieldModal').classList.add('active');
  $('fieldModal').setAttribute('aria-hidden', 'false');
}

function closeModal() {
  $('fieldModal').classList.remove('active');
  $('fieldModal').setAttribute('aria-hidden', 'true');
  $('fieldForm').reset();
  $('fieldOptions').value = '';
  $('fieldRowIndex').value = '';
  editingRowIndex = null;
}

function parseOptionsFromTextarea() {
  const raw = ($('fieldOptions').value || '').trim();
  if (!raw) return '';
  const list = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return JSON.stringify(list);
}

function optionsToTextarea(optionsJson) {
  if (!optionsJson) return '';
  try {
    const parsed = JSON.parse(optionsJson);
    if (Array.isArray(parsed)) return parsed.join('\n');
    return '';
  } catch (_) {
    return '';
  }
}

function renderTable() {
  const tbody = $('fieldsTbody');
  const visible = allFields.filter(f => f.entityType === currentFilter || f.entityType === 'both' || currentFilter === 'both');

  if (!visible.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">Brak pól dla wybranego filtra.</td></tr>';
    return;
  }

  tbody.innerHTML = visible.map(f => `
    <tr>
      <td><b>${escapeHtml(f.name)}</b></td>
      <td><code>${escapeHtml(f.key)}</code></td>
      <td>${escapeHtml(humanType(f.type))}</td>
      <td>${f.required ? 'Tak' : 'Nie'}</td>
      <td>${f.enabled ? 'Tak' : 'Nie'}</td>
      <td>${Number.isFinite(f.order) ? f.order : 0}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit" data-row="${f.rowIndex}" title="Edytuj">✏️</button>
          <button type="button" data-action="delete" data-row="${f.rowIndex}" title="Usuń">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const rowIndex = parseInt(btn.dataset.row, 10);
      const field = allFields.find(x => x.rowIndex === rowIndex);
      if (!field) return;

      if (action === 'edit') {
        openEdit(field);
      } else if (action === 'delete') {
        await deleteField(field);
      }
    });
  });
}

function humanType(type) {
  const t = (type || 'text').toLowerCase();
  if (t === 'textarea') return 'Tekst (wiele linii)';
  if (t === 'number') return 'Liczba';
  if (t === 'date') return 'Data';
  if (t === 'select') return 'Lista wyboru';
  return 'Tekst (1 linia)';
}

function escapeHtml(str) {
  return (str ?? '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadCustomFields() {
  const tbody = $('fieldsTbody');
  tbody.innerHTML = '<tr><td colspan="7" class="muted">Ładowanie…</td></tr>';

  try {
    allFields = await DataService.loadCustomFields(true);
    renderTable();
  } catch (err) {
    console.error('Błąd ładowania CustomFields:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="muted">
          Nie udało się załadować pól własnych. <br/>
          Sprawdź, czy arkusze <code>CustomFields</code> i <code>CustomFieldValues</code> istnieją w Google Sheets oraz czy masz do nich dostęp.
        </td>
      </tr>`;
  }
}

function openCreate() {
  $('fieldModalTitle').textContent = 'Dodaj pole';
  editingRowIndex = null;
  $('fieldRowIndex').value = '';
  $('fieldName').value = '';
  $('fieldKey').value = '';
  $('fieldEntityType').value = currentFilter === 'both' ? 'both' : currentFilter;
  $('fieldType').value = 'text';
  $('fieldRequired').value = 'false';
  $('fieldEnabled').value = 'true';
  $('fieldOrder').value = '0';
  $('fieldOptions').value = '';
  openModal();
}

function openEdit(field) {
  $('fieldModalTitle').textContent = 'Edytuj pole';
  editingRowIndex = field.rowIndex;
  $('fieldRowIndex').value = String(field.rowIndex);
  $('fieldName').value = field.name || '';
  $('fieldKey').value = field.key || '';
  $('fieldEntityType').value = field.entityType || 'both';
  $('fieldType').value = field.type || 'text';
  $('fieldRequired').value = field.required ? 'true' : 'false';
  $('fieldEnabled').value = field.enabled ? 'true' : 'false';
  $('fieldOrder').value = String(field.order || 0);
  $('fieldOptions').value = optionsToTextarea(field.optionsJson);
  openModal();
}

async function deleteField(field) {
  const ok = confirm(`Usunąć pole „${field.name}”?`);
  if (!ok) return;

  try {
    await DataService.deleteCustomField(field.rowIndex);
    await loadCustomFields();
  } catch (err) {
    console.error('Błąd usuwania pola:', err);
    alert('Nie udało się usunąć pola. Sprawdź konsolę.');
  }
}

async function handleSaveField(e) {
  e.preventDefault();

  const name = ($('fieldName').value || '').trim();
  const key = normalizeKey($('fieldKey').value);
  const entityType = $('fieldEntityType').value;
  const type = $('fieldType').value;
  const required = $('fieldRequired').value === 'true';
  const enabled = $('fieldEnabled').value === 'true';
  const order = parseInt(($('fieldOrder').value || '0'), 10) || 0;
  const optionsJson = (type === 'select') ? parseOptionsFromTextarea() : '';

  if (!name || !key) {
    alert('Uzupełnij nazwę i klucz pola.');
    return;
  }

  // Unique key check
  const dup = allFields.find(f => f.key === key && f.rowIndex !== editingRowIndex);
  if (dup) {
    alert(`Klucz „${key}” już istnieje (pole: ${dup.name}). Wybierz unikalny klucz.`);
    return;
  }

  const payload = {
    entityType,
    key,
    name,
    type,
    required,
    enabled,
    order,
    optionsJson,
  };

  try {
    await DataService.saveCustomField(payload, editingRowIndex);
    closeModal();
    await loadCustomFields();
  } catch (err) {
    console.error('Błąd zapisu pola:', err);
    alert('Nie udało się zapisać pola. Sprawdź konsolę.');
  }
}

async function init() {
  await bootstrapProtectedPage({ logoAction: 'dashboard' });

  // Logo click already handled by app-shell if logoBlock exists, but keep safe
  const logoBlock = document.getElementById('logoBlock');
  if (logoBlock) {
    logoBlock.addEventListener('click', () => window.location.href = '/simplifycrm/index.html');
  }

  // Sidebar navigation
  document.querySelectorAll('.settings-nav button[data-section]').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
  });

  // Tabs (filters)
  document.querySelectorAll('.tab[data-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll('.tab[data-filter]').forEach(t => t.classList.toggle('active', t === tab));
      renderTable();
    });
  });

  // Modal controls
  $('addFieldBtn').addEventListener('click', openCreate);
  $('closeFieldModalBtn').addEventListener('click', closeModal);
  $('cancelFieldBtn').addEventListener('click', closeModal);
  $('fieldModal').addEventListener('click', (e) => {
    if (e.target === $('fieldModal')) closeModal();
  });

  $('fieldForm').addEventListener('submit', handleSaveField);

  await loadCustomFields();
}

document.addEventListener('DOMContentLoaded', init);
