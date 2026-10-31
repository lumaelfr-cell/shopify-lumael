// Panneau d'interaction en jeu (commerce, atelier, dialogue, sac) : liste de
// lignes avec boutons fonctionnels. Le contenu est recalculé après chaque
// action (argent, stock, état) via la fonction `build`.

import { h, clear } from './dom';

export interface PanelButton {
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface PanelRow {
  title: string;
  sub?: string;
  right?: string;
  buttons: PanelButton[];
}

export interface PanelContent {
  title: string;
  subtitle?: string;
  /** texte de dialogue (PNJ) */
  speech?: { who: string; text: string };
  rows: PanelRow[];
  footer?: string;
  actions?: PanelButton[];
}

export class Panel {
  el: HTMLElement | null = null;
  private build: (() => PanelContent) | null = null;

  constructor(private root: HTMLElement, private onClose: () => void) {}

  get open(): boolean {
    return !!this.el;
  }

  show(build: () => PanelContent): void {
    this.build = build;
    if (!this.el) {
      this.el = h('div', { class: 'screen dim', id: 'world-panel' });
      this.root.append(this.el);
    }
    this.render();
  }

  render(): void {
    if (!this.el || !this.build) return;
    const c = this.build();
    clear(this.el);
    const card = h('div', { class: 'card panel-card' });
    card.append(h('h2', {}, c.title));
    if (c.subtitle) card.append(h('div', { class: 'muted', style: 'margin:-6px 0 10px' }, c.subtitle));
    if (c.speech) {
      card.append(h('div', { class: 'speech' }, h('b', {}, c.speech.who), h('div', {}, `« ${c.speech.text} »`)));
    }
    if (c.rows.length) {
      const list = h('div', { class: 'panel-rows' });
      for (const r of c.rows) {
        const btns = h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;justify-content:flex-end' });
        for (const b of r.buttons) btns.append(this.button(b));
        list.append(h('div', { class: 'panel-row' },
          h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'pr-title' }, r.title), r.sub ? h('div', { class: 'muted pr-sub' }, r.sub) : null),
          r.right ? h('div', { class: 'pr-right' }, r.right) : null,
          btns));
      }
      card.append(list);
    }
    if (c.footer) card.append(h('div', { class: 'muted', style: 'font-size:13px;margin-top:8px' }, c.footer));
    const bottom = h('div', { class: 'row', style: 'gap:8px;margin-top:12px;flex-wrap:wrap' });
    for (const b of c.actions ?? []) bottom.append(this.button(b));
    bottom.append(this.button({ label: 'Fermer (Échap)', onClick: () => this.close() }));
    card.append(bottom);
    this.el.append(card);
  }

  private button(b: PanelButton): HTMLElement {
    return h('button', {
      class: `btn small ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}`,
      disabled: !!b.disabled,
      onclick: () => {
        b.onClick();
        this.render();
      },
    }, b.label);
  }

  close(): void {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    this.build = null;
    this.onClose();
  }
}
