/* ═══════════════════════════════════════════════
   LUMAEL — interactions
   ═══════════════════════════════════════════════ */

(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ─── Préloader ─── */
  const preloader = document.getElementById("preloader");
  const hidePreloader = () => {
    preloader.classList.add("is-done");
    setTimeout(() => preloader.remove(), 800);
  };
  if (prefersReducedMotion) {
    hidePreloader();
  } else {
    window.addEventListener("load", () => setTimeout(hidePreloader, 900));
    // Filet de sécurité si "load" tarde (police lente, etc.)
    setTimeout(hidePreloader, 3500);
  }

  /* ─── Navigation : fond au scroll ─── */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ─── Menu mobile ─── */
  const burger = document.getElementById("navBurger");
  const navLinks = document.getElementById("navLinks");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("menu-open");
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    document.body.style.overflow = open ? "hidden" : "";
  });
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A" && nav.classList.contains("menu-open")) {
      burger.click();
    }
  });

  /* ─── Curseur lumineux (desktop, pointeur fin) ─── */
  const glow = document.getElementById("cursorGlow");
  if (!prefersReducedMotion && window.matchMedia("(pointer: fine)").matches) {
    let raf = null;
    let x = 0, y = 0;
    document.addEventListener("mousemove", (e) => {
      x = e.clientX;
      y = e.clientY;
      document.body.classList.add("has-cursor");
      if (!raf) {
        raf = requestAnimationFrame(() => {
          glow.style.transform = `translate(${x - 240}px, ${y - 240}px)`;
          raf = null;
        });
      }
    }, { passive: true });
  }

  /* ─── Révélation au scroll ─── */
  const reveals = document.querySelectorAll(".reveal");
  if (prefersReducedMotion) {
    reveals.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    // Décalage progressif au sein des grilles
    document.querySelectorAll(".collections__grid, .quotes__grid, .craft__stats").forEach((grid) => {
      [...grid.children].forEach((child, i) => {
        child.style.setProperty("--reveal-delay", `${Math.min(i * 70, 350)}ms`);
      });
    });

    reveals.forEach((el) => io.observe(el));
  }

  /* ─── Compteurs animés ─── */
  const stats = document.querySelectorAll(".stat__number");
  const animateCount = (el) => {
    const target = parseInt(el.dataset.count, 10);
    if (prefersReducedMotion) { el.textContent = target; return; }
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        statIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  stats.forEach((el) => statIO.observe(el));

  /* ─── Inclinaison 3D des cartes ─── */
  if (!prefersReducedMotion && window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll("[data-tilt]").forEach((card) => {
      let raf = null;
      card.addEventListener("mousemove", (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform =
            `perspective(900px) rotateY(${px * 6}deg) rotateX(${py * -6}deg) translateY(-4px)`;
          raf = null;
        });
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ─── Variateur d'ambiance ─── */
  const range = document.getElementById("dimmerRange");
  const output = document.getElementById("dimmerValue");
  const mood = document.getElementById("dimmerMood");

  const moods = [
    [15, "Ambiance — Nuit étoilée"],
    [35, "Ambiance — Cinéma à la maison"],
    [60, "Ambiance — Dîner aux chandelles"],
    [85, "Ambiance — Soirée conviviale"],
    [100, "Ambiance — Plein éclat"],
  ];

  const updateDimmer = () => {
    const v = parseInt(range.value, 10);
    document.documentElement.style.setProperty("--dim", v / 100);
    output.textContent = `${v} %`;
    mood.textContent = moods.find(([max]) => v <= max)[1];
  };
  range.addEventListener("input", updateDimmer);
  updateDimmer();

  /* ─── Newsletter ─── */
  const form = document.getElementById("newsletterForm");
  const feedback = document.getElementById("formFeedback");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    feedback.classList.remove("is-ok", "is-err");
    if (!valid) {
      feedback.textContent = "Merci d'indiquer une adresse e-mail valide.";
      feedback.classList.add("is-err");
      form.email.focus();
      return;
    }
    feedback.textContent = "Merci ! Vous recevrez notre prochain lookbook très bientôt. ✦";
    feedback.classList.add("is-ok");
    form.reset();
  });

  /* ─── Année du pied de page déjà statique (2026) ─── */
})();
