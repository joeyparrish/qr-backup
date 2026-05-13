/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { parseOtpauthUrl, assembleOtpauthUrl } from '../parse/otpauth.js';
import { copyToClipboard } from './clipboard.js';

export class ResultView {
  constructor(container, { printer } = {}) {
    this.container = container;
    this.printer = printer;
    this._renderEmpty();
  }

  show(result) {
    if (!result) {
      this._renderEmpty();
      return;
    }
    switch (result.kind) {
      case 'migration': this._renderMigration(result); break;
      case 'otpauth':   this._renderOtpauth(result); break;
      case 'other':     this._renderOther(result); break;
      default:          this._renderEmpty();
    }
  }

  _renderEmpty() {
    const hint = document.createElement('p');
    hint.className = 'result-hint';
    hint.textContent = 'Scan a QR with the camera or paste a URL above to begin.';
    this.container.replaceChildren(hint);
  }

  _renderMigration(result) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card__header';

    const title = this._editableField(
        'result-card__title',
        `Full backup - ${(new Date()).toDateString()} - ${result.accounts.length} accounts`,
        // Nothing to update here, but provide a dummy callback for editability.
        (value) => {});
    header.appendChild(title);

    const urlLabel = this._label('URL');
    header.appendChild(urlLabel);

    const url = this._editableField(
        'result-row__url', result.input);
    header.appendChild(url);

    header.appendChild(this._makeActions([
      this._copyButton('Copy URL', () => result.input),
      this._printButton(
          () => title.value,
          () => result.input),
    ]));
    card.appendChild(header);

    for (const accountUrl of result.accounts) {
      card.appendChild(this._renderAccountRow(accountUrl));
    }
    this.container.replaceChildren(card);
  }

  _renderOtpauth(result) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.appendChild(this._renderAccountRow(result.input));
    this.container.replaceChildren(card);
  }

  _renderOther(result) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card__header';
    const title = document.createElement('h2');
    title.className = 'result-card__title';
    title.textContent = 'Plain text or unknown URL';
    header.appendChild(title);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'result-card__row';
    const text = document.createElement('pre');
    text.className = 'result-card__text';
    text.textContent = result.input;
    body.appendChild(text);
    body.appendChild(this._makeActions([
      this._copyButton('Copy text', () => result.input),
      this._printButton(
          () => '',
          () => result.input),
    ]));
    card.appendChild(body);

    this.container.replaceChildren(card);
  }

  _editableField(className, initialValue, writeChanges) {
    const input = document.createElement('input');
    input.classList.add('result-card__editable');
    input.classList.add(className);

    input.value = initialValue;

    if (writeChanges) {
      input.oninput = () => writeChanges(input.value);
    } else {
      input.disabled = true;
    }
    return input;
  }

  _label(text) {
    const label = document.createElement('label');
    label.className = 'result-row__label';
    label.textContent = text;
    return label;
  }

  _renderAccountRow(otpauthUrl) {
    const parsed = parseOtpauthUrl(otpauthUrl);
    const row = document.createElement('div');
    row.className = 'result-card__row';

    const urlLabel = this._label('URL');
    row.appendChild(urlLabel);

    const url = this._editableField(
        'result-row__url', otpauthUrl);
    row.appendChild(url);

    const titleLabel = this._label('issuer');
    row.appendChild(titleLabel);

    const title = this._editableField(
        'result-row__title',
        parsed.params.get('issuer') || '(no issuer)',
        (value) => {
          parsed.params.set('issuer', value);
          url.value = assembleOtpauthUrl(parsed);
        });
    row.appendChild(title);

    const subLabel = this._label('subject');
    row.appendChild(subLabel);

    const sub = this._editableField(
        'result-row__sub',
        parsed.label,
        (value) => {
          parsed.label = value;
          url.value = assembleOtpauthUrl(parsed);
        });
    row.appendChild(sub);

    row.appendChild(this._makeActions([
      this._copyButton('Copy URL', () => assembleOtpauthUrl(parsed)),
      this._copyButton('Copy key', () => parsed.params.get('secret')),
      this._printButton(
          () => `${parsed.label} @ ${parsed.params.get('issuer')}`,
          () => assembleOtpauthUrl(parsed)),
    ]));

    return row;
  }

  _makeActions(buttons) {
    const div = document.createElement('div');
    div.className = 'result-row__actions';
    for (const b of buttons) div.appendChild(b);
    return div;
  }

  _copyButton(label, textCallback) {
    const btn = document.createElement('button');
    btn.className = 'button button--copy';
    btn.textContent = label;
    btn.addEventListener('click', () => copyToClipboard(textCallback(), btn));
    return btn;
  }

  _printButton(titleCallback, textCallback) {
    const btn = document.createElement('button');
    btn.className = 'button button--print';
    btn.textContent = 'Print QR';
    btn.addEventListener('click', () => {
      this.printer.print(titleCallback(), textCallback());
    });
    return btn;
  }
}
