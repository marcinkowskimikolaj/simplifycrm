/**
 * SIMPLIFY CRM - Custom Fields UI helpers
 * ======================================
 * Render + collect values for dynamic custom fields.
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

  static buildField(def, value, idPrefix = '') {
    const key = def.key;
    const safeKey = this.safeId(key);
    const inputId = `${idPrefix}${safeKey}`;
    const requiredAttr = def.required ? 'required' : '';
    const labelHtml = `<label for="${inputId}">${this.escape(def.label)}${def.required ? ' *' : ''}</label>`;
    const dataAttrs = `data-cf-key="${this.escapeAttr(key)}" data-cf-type="${this.escapeAttr(def.fieldType)}"`;

    const wrapStart = `<div class="form-group custom-field" ${dataAttrs}>${labelHtml}`;
    const wrapEnd = `</div>`;

    const v = value ?? '';
    switch ((def.fieldType || 'text').toLowerCase()) {
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

  static mount(containerEl, defs, values, idPrefix = '') {
    const sorted = [...defs].sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    containerEl.innerHTML = sorted.map(def => this.buildField(def, values?.[def.key], idPrefix)).join('');
  }

  static collect(containerEl, defs, idPrefix = '') {
    const result = {};
    for (const def of defs) {
      const safeKey = this.safeId(def.key);
      const inputId = `${idPrefix}${safeKey}`;
      const el = containerEl.querySelector(`#${CSS.escape(inputId)}`);
      if (!el) continue;

      switch ((def.fieldType || 'text').toLowerCase()) {
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

  static detailRows(defs, values) {
    const sorted = [...defs].sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    const rows = [];
    for (const def of sorted) {
      const v = values?.[def.key];
      if (v === undefined || v === null || v === '' || (def.fieldType === 'checkbox' && v === false)) continue;
      rows.push(`<div class="detail-info-row"><div class="detail-info-label">${this.escape(def.label)}</div><div class="detail-info-value">${this.escape(this.valueToString(def, v))}</div></div>`);
    }
    return rows.join('');
  }

  static valueToString(def, v) {
    if ((def.fieldType || '').toLowerCase() === 'checkbox') {
      return v ? 'Tak' : 'Nie';
    }
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  static escape(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }
  static escapeAttr(str) {
    return this.escape(str).replace(/\n/g,' ');
  }
}
