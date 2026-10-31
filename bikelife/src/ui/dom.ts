// Mini-utilitaires DOM pour l'interface.

type Attrs = Record<string, string | number | boolean | ((e: any) => void) | undefined | null>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function clear(el: HTMLElement): HTMLElement {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function medalStr(n: number): string {
  return ['☆☆☆', '★☆☆', '★★☆', '★★★'][Math.max(0, Math.min(3, n))];
}

/** Boîte de confirmation intégrée (remplace window.confirm, bloqué dans certains cadres). */
export function confirmDialog(text: string, ok = 'Confirmer', cancel = 'Annuler'): Promise<boolean> {
  return new Promise((resolve) => {
    const close = (v: boolean) => {
      wrap.remove();
      resolve(v);
    };
    const wrap = h('div', { class: 'screen dim', style: 'z-index:90' },
      h('div', { class: 'card', style: 'width:min(420px,100%);text-align:center' },
        h('div', { style: 'font-size:18px;font-weight:700;margin-bottom:14px' }, text),
        h('div', { class: 'row', style: 'justify-content:center' },
          h('button', { class: 'btn primary', onclick: () => close(true) }, ok),
          h('button', { class: 'btn', onclick: () => close(false) }, cancel))));
    document.body.append(wrap);
  });
}

/** Message bref intégré (remplace window.alert). */
export function infoDialog(text: string): void {
  void confirmDialog(text, 'OK', 'Fermer');
}
