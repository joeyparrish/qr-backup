/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { parseOtpauthUrl } from '../parse/otpauth.js';
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
    const title = document.createElement('h2');
    title.className = 'result-card__title';
    title.textContent = `Migration backup (${result.accounts.length} accounts)`;
    header.appendChild(title);
    header.appendChild(this._makeActions([
      this._copyButton('Copy URL', result.input),
      this._printButton(result.input),
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
      this._copyButton('Copy text', result.input),
      this._printButton(result.input),
    ]));
    card.appendChild(body);

    this.container.replaceChildren(card);
  }

  _renderAccountRow(otpauthUrl) {
    const parsed = parseOtpauthUrl(otpauthUrl);
    const row = document.createElement('div');
    row.className = 'result-card__row';

    const title = document.createElement('div');
    title.className = 'result-row__title';
    title.textContent = parsed.issuer || '(no issuer)';
    row.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'result-row__sub';
    sub.textContent = parsed.label;
    row.appendChild(sub);

    row.appendChild(this._makeActions([
      this._copyButton('Copy URL', otpauthUrl),
      this._copyButton('Copy key', parsed.secret),
      this._printButton(otpauthUrl),
    ]));

    return row;
  }

  _makeActions(buttons) {
    const div = document.createElement('div');
    div.className = 'result-row__actions';
    for (const b of buttons) div.appendChild(b);
    return div;
  }

  _copyButton(label, text) {
    const btn = document.createElement('button');
    btn.className = 'button button--copy';
    btn.textContent = label;
    btn.addEventListener('click', () => copyToClipboard(text, btn));
    return btn;
  }

  _printButton(text) {
    const btn = document.createElement('button');
    btn.className = 'button button--print';
    btn.textContent = 'Print QR';
    btn.addEventListener('click', () => this.printer.print(text));
    return btn;
  }
}
