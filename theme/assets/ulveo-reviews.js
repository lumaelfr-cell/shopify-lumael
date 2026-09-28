/*
 * Ulvéo — page « Avis clients » (sections/ulveo-reviews.liquid)
 *
 * Un seul élément personnalisé, <ulveo-reviews>, sans dépendance :
 *  - filtre (tous, avec photo, par note) et tri (récents, mieux notés) ;
 *  - visionneuse photo accessible, construite sur <dialog> (piège du focus,
 *    Échap et rendu du focus gérés par le navigateur) ;
 *  - apparition douce des cartes au défilement.
 *
 * Tout est facultatif : sans ce script, la page reste complète et lisible.
 * Les animations sont coupées si le visiteur a demandé moins de mouvement.
 */
(() => {
  if (customElements.get('ulveo-reviews')) return;

  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inThemeEditor = () =>
    document.documentElement.classList.contains('shopify-design-mode') || Boolean(window.Shopify && window.Shopify.designMode);

  /* ---------------------------------------------------------------------- */
  /* Visionneuse photo                                                       */
  /* ---------------------------------------------------------------------- */

  class ReviewLightbox {
    constructor(dialog, root) {
      this.dialog = dialog;
      this.root = root;
      this.index = 0;
      this.closeTimer = null;

      this.img = dialog.querySelector('[data-lightbox-img]');
      this.stage = dialog.querySelector('[data-lightbox-stage]');
      this.caption = dialog.querySelector('[data-lightbox-caption]');
      this.captionPanel = dialog.querySelector('.ulveo-lightbox__caption');
      this.counter = dialog.querySelector('[data-lightbox-counter]');
      this.prevButton = dialog.querySelector('[data-lightbox-prev]');
      this.nextButton = dialog.querySelector('[data-lightbox-next]');

      this.onClick = this.onClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onCancel = this.onCancel.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      this.onImageLoad = () => this.img.classList.remove('is-loading');

      dialog.addEventListener('click', this.onClick);
      dialog.addEventListener('keydown', this.onKeydown);
      dialog.addEventListener('cancel', this.onCancel);
      this.stage.addEventListener('touchstart', this.onTouchStart, { passive: true });
      this.stage.addEventListener('touchend', this.onTouchEnd, { passive: true });
      this.img.addEventListener('load', this.onImageLoad);
      this.img.addEventListener('error', this.onImageLoad);
    }

    destroy() {
      clearTimeout(this.closeTimer);
      if (this.dialog.open) this.dialog.close();
      document.documentElement.classList.remove('ulveo-lightbox-open');
    }

    /* Les photos parcourues suivent l'ordre et le filtre affichés. */
    get triggers() {
      return Array.from(this.root.querySelectorAll('[data-review]:not([hidden]) [data-lightbox-open]'));
    }

    open(trigger) {
      const triggers = this.triggers;
      const index = triggers.indexOf(trigger);
      if (index === -1) return;

      clearTimeout(this.closeTimer);
      this.dialog.classList.remove('is-closing');
      this.show(index);

      if (!this.dialog.open) {
        this.dialog.showModal();
        document.documentElement.classList.add('ulveo-lightbox-open');
      }
    }

    show(index) {
      const triggers = this.triggers;
      if (!triggers.length) return;

      this.index = (index + triggers.length) % triggers.length;
      const trigger = triggers[this.index];
      const data = trigger.dataset;

      const width = Number(data.width) || 1200;
      const height = Number(data.height) || 1500;
      this.ratio = width / height;

      this.img.classList.add('is-loading');
      this.img.removeAttribute('srcset');
      this.img.width = width;
      this.img.height = height;
      this.img.style.setProperty('--uvr-ratio', String(this.ratio));
      this.img.alt = data.alt || '';
      this.img.sizes = '(min-width: 750px) 62vw, 100vw';
      if (data.srcset) this.img.srcset = data.srcset;
      this.img.src = data.src;
      if (this.img.complete && this.img.naturalWidth) this.img.classList.remove('is-loading');

      /* La légende reprend l'avis de la carte (note, auteur, texte). */
      const body = trigger.closest('[data-review]')?.querySelector('.ulveo-review__body');
      if (body) {
        const copy = body.cloneNode(true);
        copy.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
        this.caption.replaceChildren(copy);
        if (this.captionPanel) this.captionPanel.scrollTop = 0;
      }

      if (data.label) this.dialog.setAttribute('aria-label', data.label);

      const several = triggers.length > 1;
      this.prevButton.hidden = !several;
      this.nextButton.hidden = !several;
      this.counter.textContent = several ? `${this.index + 1} / ${triggers.length}` : '';
    }

    step(delta) {
      this.show(this.index + delta);
    }

    close() {
      if (!this.dialog.open || this.dialog.classList.contains('is-closing')) return;

      if (reduceMotion()) {
        this.finishClose();
        return;
      }
      this.dialog.classList.add('is-closing');
      this.closeTimer = setTimeout(() => this.finishClose(), 200);
    }

    finishClose() {
      this.dialog.classList.remove('is-closing');
      if (this.dialog.open) this.dialog.close();
      document.documentElement.classList.remove('ulveo-lightbox-open');

      /* Le focus revient sur la photo affichée en dernier. */
      const trigger = this.triggers[this.index];
      if (trigger) trigger.focus({ preventScroll: true });
    }

    onCancel(event) {
      event.preventDefault();
      this.close();
    }

    onClick(event) {
      const target = event.target;
      if (target.closest('[data-lightbox-close]')) return this.close();
      if (target.closest('[data-lightbox-prev]')) return this.step(-1);
      if (target.closest('[data-lightbox-next]')) return this.step(1);
      /* Clic en dehors de la photo et de l'avis (fond sombre) : on ferme. */
      if (target.closest('.ulveo-lightbox__caption')) return;
      if (target.closest('a')) return;
      if (target === this.img && this.isOnPhoto(event)) return;
      this.close();
    }

    /* Sur téléphone, l'image est « contenue » dans toute la zone : les bandes
       sombres autour de la photo appartiennent à l'élément <img>. On ne
       garde ouvert que si le clic tombe sur la photo elle-même. */
    isOnPhoto(event) {
      const box = this.img.getBoundingClientRect();
      const ratio = this.ratio || box.width / box.height;
      let width = box.width;
      let height = width / ratio;
      if (height > box.height) {
        height = box.height;
        width = height * ratio;
      }
      const left = box.left + (box.width - width) / 2;
      const top = box.top + (box.height - height) / 2;
      return event.clientX >= left && event.clientX <= left + width && event.clientY >= top && event.clientY <= top + height;
    }

    onKeydown(event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.step(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.step(1);
      }
    }

    onTouchStart(event) {
      const touch = event.changedTouches[0];
      this.touchX = touch.clientX;
      this.touchY = touch.clientY;
    }

    onTouchEnd(event) {
      if (this.touchX == null) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - this.touchX;
      const dy = touch.clientY - this.touchY;
      this.touchX = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && this.triggers.length > 1) {
        this.step(dx < 0 ? 1 : -1);
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Liste d'avis                                                            */
  /* ---------------------------------------------------------------------- */

  class UlveoReviews extends HTMLElement {
    connectedCallback() {
      this.list = this.querySelector('[data-reviews-list]');
      if (!this.list) return;

      this.items = Array.from(this.list.querySelectorAll(':scope > [data-review]'));
      this.items.forEach((item, index) => {
        item.dataset.order = String(index);
      });

      this.filter = 'all';
      this.sort = 'recent';
      this.status = this.querySelector('[data-reviews-status]');
      this.empty = this.querySelector('[data-reviews-empty]');
      this.sortSelect = this.querySelector('[data-reviews-sort]');

      this.onClick = this.onClick.bind(this);
      this.onSortChange = this.onSortChange.bind(this);
      this.addEventListener('click', this.onClick);
      if (this.sortSelect) {
        this.sortSelect.value = 'recent';
        this.sortSelect.addEventListener('change', this.onSortChange);
      }

      const dialog = this.querySelector('[data-lightbox]');
      if (dialog && typeof dialog.showModal === 'function') {
        this.lightbox = new ReviewLightbox(dialog, this);
      }

      /* Si des avis sont datés, « Les plus récents » les remet dans l'ordre
         chronologique ; sinon l'ordre choisi dans l'éditeur est conservé. */
      if (this.items.some((item) => item.dataset.date)) this.apply({ animate: false, announce: false });

      this.setupReveal();
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      if (this.sortSelect) this.sortSelect.removeEventListener('change', this.onSortChange);
      if (this.observer) this.observer.disconnect();
      if (this.lightbox) this.lightbox.destroy();
    }

    onClick(event) {
      const filterButton = event.target.closest('[data-reviews-filter]');
      if (filterButton && this.contains(filterButton)) {
        this.setFilter(filterButton.dataset.reviewsFilter);
        return;
      }

      const photo = event.target.closest('[data-lightbox-open]');
      if (photo && this.contains(photo) && this.lightbox) {
        event.preventDefault();
        this.lightbox.open(photo);
      }
    }

    onSortChange() {
      this.sort = this.sortSelect.value;
      this.apply({ animate: true, announce: true });
    }

    setFilter(value) {
      if (!value || value === this.filter) return;
      this.filter = value;
      this.querySelectorAll('[data-reviews-filter]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.reviewsFilter === value));
      });
      this.apply({ animate: true, announce: true });
    }

    matches(item) {
      if (this.filter === 'all') return true;
      if (this.filter === 'photo') return item.dataset.photo === 'true';
      return item.dataset.rating === this.filter;
    }

    /* Avis datés d'abord, du plus récent au plus ancien, puis les autres dans
       l'ordre de l'éditeur. « Les mieux notés » trie d'abord par note. */
    compare(a, b) {
      if (this.sort === 'rating') {
        const byRating = Number(b.dataset.rating) - Number(a.dataset.rating);
        if (byRating) return byRating;
      }
      const dateA = a.dataset.date || '';
      const dateB = b.dataset.date || '';
      if (dateA && dateB && dateA !== dateB) return dateA < dateB ? 1 : -1;
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return Number(a.dataset.order) - Number(b.dataset.order);
    }

    apply({ animate, announce }) {
      const sorted = this.items.slice().sort((a, b) => this.compare(a, b));
      const fragment = document.createDocumentFragment();
      sorted.forEach((item) => fragment.appendChild(item));
      this.list.appendChild(fragment);

      const motion = animate && !reduceMotion();
      let visible = 0;

      sorted.forEach((item) => {
        const show = this.matches(item);
        item.hidden = !show;
        if (!show) return;

        /* Après un filtre, on ne rejoue plus l'apparition au défilement :
           les cartes arrivent toutes ensemble, en fondu. */
        item.classList.add('is-visible');
        if (motion && typeof item.animate === 'function') {
          item.animate(
            [
              { opacity: 0, transform: 'translateY(8px)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 320, delay: Math.min(visible, 5) * 40, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'backwards' }
          );
        }
        visible += 1;
      });

      if (this.empty) this.empty.hidden = visible > 0;
      if (announce && this.status) {
        this.status.textContent = visible === 1 ? '1 avis affiché.' : `${visible} avis affichés.`;
      }
    }

    setupReveal() {
      if (inThemeEditor() || reduceMotion() || !('IntersectionObserver' in window)) return;

      const targets = [...this.items, ...this.querySelectorAll('[data-reveal]')];

      /* Les cartes déjà à l'écran au chargement ne clignotent pas : seules
         celles qui arrivent au défilement sont animées. Les barres de la note
         globale, elles, se remplissent dans tous les cas. */
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      this.items.forEach((item) => {
        if (item.getBoundingClientRect().top < viewport * 0.92) item.classList.add('is-visible');
      });

      this.classList.add('is-animated');

      this.observer = new IntersectionObserver(
        (entries) => {
          let batch = 0;
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.style.setProperty('--uvr-delay', `${Math.min(batch, 4) * 90}ms`);
            entry.target.classList.add('is-visible');
            this.observer.unobserve(entry.target);
            batch += 1;
          });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }
      );

      targets.forEach((target) => {
        if (!target.classList.contains('is-visible')) this.observer.observe(target);
      });
    }
  }

  customElements.define('ulveo-reviews', UlveoReviews);

  /* Éditeur de thème : un avis sélectionné doit toujours être visible. */
  document.addEventListener('shopify:block:select', (event) => {
    const root = event.target instanceof Element ? event.target.closest('ulveo-reviews') : null;
    if (root && typeof root.setFilter === 'function') root.setFilter('all');
  });
})();
