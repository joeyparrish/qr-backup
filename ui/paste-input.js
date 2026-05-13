/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

const DEBOUNCE_MS = 300;

export class PasteInput {
  constructor(container, { onResult } = {}) {
    this.container = container;
    this.onResult = onResult || (() => {});

    const label = document.createElement('label');
    label.textContent = 'Paste a URL';
    label.className = 'paste-input__label';
    label.htmlFor = 'paste-input-field';

    this.textarea = document.createElement('textarea');
    this.textarea.id = 'paste-input-field';
    this.textarea.className = 'paste-input__field';
    this.textarea.placeholder = 'otpauth://... or otpauth-migration://...';
    this.textarea.rows = 3;
    this.textarea.spellcheck = false;
    this.textarea.autocapitalize = 'none';
    this.textarea.autocomplete = 'off';

    container.appendChild(label);
    container.appendChild(this.textarea);

    this._timer = null;
    this.textarea.addEventListener('input', () => {
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => this._fire(), DEBOUNCE_MS);
    });
  }

  set(text) {
    this.textarea.value = text;
  }

  _fire() {
    const text = this.textarea.value.trim();
    if (text) {
      this.onResult(text);
    }
  }
}
