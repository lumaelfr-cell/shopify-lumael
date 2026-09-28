/*
 * Ulvéo — page Contact (sections/ulveo-contact.liquid)
 *
 * Amélioration progressive, sans dépendance. Sans ce script, le formulaire
 * Shopify fonctionne tel quel (validation native du navigateur).
 *  - Les cartes « sujet » préremplissent l'objet et amènent au formulaire.
 *  - Validation en ligne, messages sous chaque champ, focus sur la première
 *    erreur ; état « Envoi en cours » pour éviter les doubles envois.
 *  - Après envoi, la confirmation reçoit le focus.
 *  - Bouton « Copier » l'adresse e-mail.
 *  - Apparition douce des cartes, coupée si le visiteur réduit les animations.
 */
(() => {
  if (customElements.get('ulveo-contact')) return;

  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inThemeEditor = () =>
    document.documentElement.classList.contains('shopify-design-mode') || Boolean(window.Shopify && window.Shopify.designMode);

  class UlveoContact extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form.ulveo-contact-form');
      this.select = this.querySelector('[data-contact-subject-select]');
      this.formCard = this.querySelector('.ulveo-contact__form-card');

      this.onClick = this.onClick.bind(this);
      this.addEventListener('click', this.onClick);

      if (this.form) {
        this.form.setAttribute('novalidate', '');
        this.onSubmit = this.onSubmit.bind(this);
        this.onInput = this.onInput.bind(this);
        this.form.addEventListener('submit', this.onSubmit);
        this.form.addEventListener('input', this.onInput);
        this.form.addEventListener('change', this.onInput);
      }

      this.setupCopy();
      this.focusFeedback();
      this.setupReveal();
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      if (this.observer) this.observer.disconnect();
    }

    /* ---- Cartes « sujet » ---------------------------------------------- */

    onClick(event) {
      const link = event.target.closest('[data-contact-subject]');
      if (!link || !this.contains(link) || !this.formCard) return;

      event.preventDefault();
      const subject = link.dataset.contactSubject;
      if (subject && this.select) {
        let option = Array.from(this.select.options).find((opt) => opt.value === subject);
        if (!option) {
          option = new Option(subject, subject);
          this.select.add(option);
        }
        this.select.value = subject;
        this.clearError(this.select);
      }

      this.formCard.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      const target = this.form && (this.form.querySelector('textarea') || this.form.querySelector('input:not([type=hidden])'));
      if (target) {
        /* Laisse le défilement se terminer avant de placer le curseur. */
        window.setTimeout(() => target.focus({ preventScroll: true }), reduceMotion() ? 0 : 450);
      }
    }

    /* ---- Validation ---------------------------------------------------- */

    fields() {
      return Array.from(this.form.querySelectorAll('.ulveo-field__control[required]'));
    }

    errorFor(field) {
      const ids = (field.getAttribute('aria-describedby') || '').split(/\s+/);
      for (const id of ids) {
        const node = id && document.getElementById(id);
        if (node && node.hasAttribute('data-field-error')) return node;
      }
      return null;
    }

    showError(field) {
      field.setAttribute('aria-invalid', 'true');
      const node = this.errorFor(field);
      if (node) node.textContent = field.dataset.error || field.validationMessage;
    }

    clearError(field) {
      field.removeAttribute('aria-invalid');
      const node = this.errorFor(field);
      if (node) node.textContent = '';
    }

    isValid(field) {
      if (field.value.trim() === '') return false;
      return field.checkValidity();
    }

    onInput(event) {
      const field = event.target;
      if (field.getAttribute('aria-invalid') === 'true' && this.isValid(field)) this.clearError(field);
    }

    onSubmit(event) {
      const invalid = this.fields().filter((field) => {
        const ok = this.isValid(field);
        if (ok) this.clearError(field);
        else this.showError(field);
        return !ok;
      });

      if (invalid.length) {
        event.preventDefault();
        invalid[0].focus();
        return;
      }

      const button = this.form.querySelector('[data-contact-submit]');
      if (button) {
        button.setAttribute('aria-busy', 'true');
        const label = button.querySelector('[data-submit-label]');
        if (label) label.textContent = 'Envoi en cours…';
      }
    }

    /* ---- Retour après envoi -------------------------------------------- */

    focusFeedback() {
      const feedback = this.querySelector('[data-contact-success], [data-contact-alert]');
      if (!feedback) return;
      window.requestAnimationFrame(() => {
        this.formCard.scrollIntoView({ block: 'start' });
        feedback.focus({ preventScroll: true });
      });
    }

    /* ---- Copier l'adresse ---------------------------------------------- */

    setupCopy() {
      const button = this.querySelector('[data-copy]');
      if (!button || !navigator.clipboard || !window.isSecureContext) return;

      const label = button.querySelector('[data-copy-label]');
      const status = this.querySelector('[data-copy-status]');
      button.hidden = false;
      button.addEventListener('click', () => {
        navigator.clipboard.writeText(button.dataset.copy).then(() => {
          if (label) label.textContent = 'Copié';
          if (status) status.textContent = 'Adresse e-mail copiée.';
          window.clearTimeout(this.copyTimer);
          this.copyTimer = window.setTimeout(() => {
            if (label) label.textContent = 'Copier';
            if (status) status.textContent = '';
          }, 2000);
        });
      });
    }

    /* ---- Apparition ---------------------------------------------------- */

    setupReveal() {
      if (inThemeEditor() || reduceMotion() || !('IntersectionObserver' in window)) return;
      const items = Array.from(this.querySelectorAll('[data-uct-reveal]'));
      if (!items.length) return;

      /* Ce qui est déjà à l'écran ne clignote pas. */
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      items.forEach((item) => {
        if (item.getBoundingClientRect().top < viewport * 0.9) item.classList.add('is-visible');
      });
      this.classList.add('is-animated');

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            this.observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }
      );
      items.forEach((item) => {
        if (!item.classList.contains('is-visible')) this.observer.observe(item);
      });
    }
  }

  customElements.define('ulveo-contact', UlveoContact);
})();
