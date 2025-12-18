/**
 * SIMPLIFY CRM - Custom Fields UI helpers
 * ======================================
 * Render + collect values for dynamic custom fields.
 * 
 * POPRAWKI:
 * - Ujednolicono nazwy: def.name (zamiast def.label), def.type (zamiast def.fieldType)
 * - Dodano obsługę wszystkich typów pól z data-service
 */

export class CustomFieldsUI {
  static safeId(str) {
    return String(str || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  static parseOptions(def) {
    try {
      if (def.optionsJson) {
        const parsed = JSON.parse(def.optionsJson);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (_) {}
    return [];
  }

  /**
   * Buduje HTML pojedynczego pola custom field
   * @param {Object} def - Definicja pola z data-service (ma: id, name, type, key, required, enabled, etc.)
   * @param {*} value - Aktualna wartość pola
   * @param {string} idPrefix - Prefix dla ID inputa
   */
  static buildField(def, value, idPrefix = 'cf_') {
    if (!def.enabled) return ''; // Nie renderuj wyłączonych pól
    
    const key = def.key;
    const safeKey = this.safeId(key);
    const inputId = `${idPrefix}${safeKey}`;
    const requiredAttr = def.required ? 'required' : '';
    const labelHtml = `<label for="${inputId}">${this.escape(def.name)}${def.required ? ' *' : ''}</label>`;
    const dataAttrs = `data-cf-key="${this.escapeAttr(key)}" data-cf-type="${this.escapeAttr(def.type)}"`;

    const wrapStart = `<div class="form-group custom-field" ${dataAttrs}>${labelHtml}`;
    const wrapEnd = `</div>`;

    const v = value ?? '';
    
    switch ((def.type || 'text').toLowerCase()) {
      case 'textarea':
        return `${wrapStart}<textarea id="${inputId}" ${requiredAttr} placeholder="">${this.escape(String(v))}</textarea>${wrapEnd}`;
      
      case 'number':
        return `${wrapStart}<input id="${inputId}" type="number" ${requiredAttr} value="${this.escapeAttr(String(v))}">${wrapEnd}`;
      
      case 'date':
        return `${wrapStart}<input id="${inputId}" type="date" ${requiredAttr} value="${this.escapeAttr(String(v))}">${wrapEnd}`;
      
      case 'email':
        return `${wrapStart}<input id="${inputId}" type="email" ${requiredAttr} value="${this.escapeAttr(String(v))}">${wrapEnd}`;
      
      case 'url':
        return `${wrapStart}<input id="${inputId}" type="url" ${requiredAttr} value="${this.escapeAttr(String(v))}">${wrapEnd}`;
      
      case 'checkbox': {
        const checked = v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
        return `${wrapStart}<div class="custom-field-checkbox"><input id="${inputId}" type="checkbox" ${checked ? 'checked' : ''}></div>${wrapEnd}`;
      }
      
      case 'select': {
        const options = this.parseOptions(def);
        const opts = [`<option value="">—</option>`].concat(options.map(o => {
          const s = String(o);
          const selected = String(v) === s ? 'selected' : '';
          return `<option value="${this.escapeAttr(s)}" ${selected}>${this.escape(s)}</option>`;
        })).join('');
        return `${wrapStart}<select id="${inputId}" ${requiredAttr}>${opts}</select>${wrapEnd}`;
      }
      
      case 'text':
      default:
        return `${wrapStart}<input id="${inputId}" type="text" ${requiredAttr} value="${this.escapeAttr(String(v))}">${wrapEnd}`;
    }
  }

  /**
   * Renderuje wszystkie custom fields w kontenerze
   * @param {HTMLElement} containerEl - Element DOM gdzie będą wstawione pola
   * @param {Array} defs - Tablica definicji pól
   * @param {Object} values - Obiekt z wartościami {key: value}
   * @param {string} idPrefix - Prefix dla ID
   */
  static mount(containerEl, defs, values = {}, idPrefix = 'cf_') {
    if (!containerEl) {
      console.warn('CustomFieldsUI.mount: brak kontenera');
      return;
    }
    
    // Filtruj tylko enabled fields i sortuj
    const sorted = [...defs]
      .filter(def => def.enabled)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    containerEl.innerHTML = sorted
      .map(def => this.buildField(def, values?.[def.key], idPrefix))
      .join('');
  }

  /**
   * Zbiera wartości ze wszystkich custom fields w kontenerze
   * @param {HTMLElement} containerEl - Element DOM z polami
   * @param {Array} defs - Tablica definicji pól
   * @param {string} idPrefix - Prefix dla ID
   * @returns {Object} Obiekt {key: value}
   */
  static collect(containerEl, defs, idPrefix = 'cf_') {
    if (!containerEl) {
      console.warn('CustomFieldsUI.collect: brak kontenera');
      return {};
    }
    
    const result = {};
    for (const def of defs) {
      if (!def.enabled) continue; // Pomiń wyłączone pola
      
      const safeKey = this.safeId(def.key);
      const inputId = `${idPrefix}${safeKey}`;
      const el = containerEl.querySelector(`#${CSS.escape(inputId)}`);
      
      if (!el) continue;

      switch ((def.type || 'text').toLowerCase()) {
        case 'checkbox':
          result[def.key] = !!el.checked;
          break;
        case 'number': {
          const raw = el.value;
          result[def.key] = raw === '' ? '' : Number(raw);
          break;
        }
        default:
          result[def.key] = el.value ?? '';
      }
    }
    return result;
  }

  /**
   * Generuje HTML dla wyświetlania wartości w detail view
   * @param {Array} defs - Definicje pól
   * @param {Object} values - Wartości {key: value}
   * @returns {string} HTML
   */
  static detailRows(defs, values = {}) {
    const sorted = [...defs]
      .filter(def => def.enabled)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    const rows = [];
    for (const def of sorted) {
      const v = values?.[def.key];
      
      // Pomiń puste wartości i unchecked checkboxy
      if (v === undefined || v === null || v === '' || (def.type === 'checkbox' && v === false)) {
        continue;
      }
      
      rows.push(`
        <div class="detail-info-row">
          <div class="detail-info-label">${this.escape(def.name)}</div>
          <div class="detail-info-value">${this.escape(this.valueToString(def, v))}</div>
        </div>
      `);
    }
    
    return rows.join('');
  }

  /**
   * Konwertuje wartość do stringa do wyświetlenia
   */
  static valueToString(def, v) {
    if ((def.type || '').toLowerCase() === 'checkbox') {
      return v ? 'Tak' : 'Nie';
    }
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  // Escape helpers
  static escape(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  static escapeAttr(str) {
    return this.escape(str).replace(/\n/g, ' ');
  }
}

// Export dla window
if (typeof window !== 'undefined') {
  window.CustomFieldsUI = CustomFieldsUI;
}
