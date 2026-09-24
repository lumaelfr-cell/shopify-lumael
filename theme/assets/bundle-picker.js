/* ==========================================================================
   Bundle Picker — sélection d'offre + ajout au panier
   ========================================================================== */

(function () {
  "use strict";

  var ROOT_SELECTOR = "[data-bundle-picker]";
  var MONEY_PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/;

  /*
   * Le prix d'un pack vendu à l'exemplaire est une somme : aucune variante ne
   * porte ce montant, donc aucun libellé rendu par Liquid ne convient. On
   * reformate à partir du `money_format` de la boutique, comme le fait Shopify.
   */
  function formatMoney(cents, format) {
    var pattern = format || "{{ amount }}";

    function digits(precision, thousands, decimal) {
      var amount = (Number(cents) / 100).toFixed(precision);
      var parts = amount.split(".");
      var whole = parts[0].replace(/(\d)(?=(\d\d\d)+$)/g, "$1" + thousands);
      return parts[1] ? whole + decimal + parts[1] : whole;
    }

    var match = pattern.match(MONEY_PLACEHOLDER);
    var value;
    switch (match && match[1]) {
      case "amount_no_decimals":
        value = digits(0, ",", ".");
        break;
      case "amount_with_comma_separator":
        value = digits(2, ".", ",");
        break;
      case "amount_no_decimals_with_comma_separator":
        value = digits(0, ".", ",");
        break;
      case "amount_with_space_separator":
        value = digits(2, " ", ",");
        break;
      case "amount_no_decimals_with_space_separator":
        value = digits(0, " ", ",");
        break;
      case "amount_with_apostrophe_separator":
        value = digits(2, "'", ".");
        break;
      default:
        value = digits(2, ",", ".");
    }
    return pattern.replace(MONEY_PLACEHOLDER, value);
  }

  function parseJson(node) {
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (e) {
      return null;
    }
  }

  function parseConfig(root) {
    var node = root.querySelector("[data-bundle-picker-config]");
    if (!node) return null;
    var config = parseJson(node);
    if (!config) console.error("[bundle-picker] configuration JSON invalide");
    return config;
  }

  /* --- Grande photo de la page produit ------------------------------------ */

  /*
   * Le sélecteur d'édition masque le sélecteur de variantes natif : sans lui,
   * le thème n'a plus rien qui repeigne sa galerie. C'est donc la carte
   * sélectionnée qui pilote la grande photo, en plus de sa propre vignette.
   */
  function galleryImages() {
    var gallery =
      document.querySelector("main media-gallery") ||
      document.querySelector("media-gallery");
    if (!gallery) return [];

    // Une galerie en grille rend deux fois la première photo : une fois dans le
    // carrousel (mobile), une fois dans la grille (desktop). On repeint les deux.
    return [
      gallery.querySelector("slideshow-slide"),
      gallery.querySelector(".media-gallery__grid > li")
    ]
      .map(function (node) {
        return node ? node.querySelector(".product-media__image") : null;
      })
      .filter(Boolean);
  }

  /*
   * `src` vide remet la photo d'origine du produit — celle rendue par le thème
   * au chargement, mémorisée avant le premier remplacement.
   */
  function paintMainGallery(src) {
    galleryImages().forEach(function (image) {
      if (!image.dataset.bpGalleryOriginal) {
        image.dataset.bpGalleryOriginal = JSON.stringify({
          src: image.getAttribute("src") || "",
          srcset: image.getAttribute("srcset") || ""
        });
      }

      if (src) {
        if (image.getAttribute("src") === src) return;
        image.removeAttribute("srcset");
        image.setAttribute("src", src);
        return;
      }

      var original;
      try {
        original = JSON.parse(image.dataset.bpGalleryOriginal);
      } catch (e) {
        return;
      }
      if (original.src && image.getAttribute("src") !== original.src) {
        image.setAttribute("src", original.src);
      }
      if (original.srcset) image.setAttribute("srcset", original.srcset);
    });
  }

  function BundlePicker(root) {
    this.root = root;
    this.config = parseConfig(root) || {};
    this.variants = this.config.variants || [];
    this.optionNames = this.config.optionNames || [];
    this.colorOption = this.config.colorOption || "Couleur";
    this.modelOption = this.config.modelOption || "Modèle";
    this.isPreview = root.hasAttribute("data-preview");
    this.cards = Array.prototype.slice.call(
      root.querySelectorAll("[data-bp-card]")
    );
    this.atc = root.querySelector("[data-bp-atc]");
    this.errorNode = root.querySelector("[data-bp-error]");
    this.bind();
    this.refresh();
  }

  BundlePicker.prototype.bind = function () {
    var self = this;

    this.cards.forEach(function (card) {
      var radio = card.querySelector("[data-bp-radio]");
      if (radio) {
        radio.addEventListener("change", function () {
          self.select(card);
        });
      }
      // Un clic n'importe où sur la carte la sélectionne, sauf sur un select.
      card.addEventListener("click", function (event) {
        if (event.target.closest("select")) return;
        if (radio && !radio.checked) {
          radio.checked = true;
          self.select(card);
        }
      });
      card.querySelectorAll("select").forEach(function (select) {
        select.addEventListener("change", function () {
          self.refresh();
        });
      });
    });

    if (this.atc) {
      this.atc.addEventListener("click", function (event) {
        event.preventDefault();
        self.addToCart();
      });
    }
  };

  BundlePicker.prototype.select = function (card) {
    this.cards.forEach(function (item) {
      item.classList.toggle("is-selected", item === card);
      var radio = item.querySelector("[data-bp-radio]");
      if (radio) radio.checked = item === card;
    });
    this.clearError();
    this.refresh();
  };

  BundlePicker.prototype.selectedCard = function () {
    return (
      this.cards.filter(function (card) {
        return card.classList.contains("is-selected");
      })[0] || null
    );
  };

  /* --- Résolution des variantes ------------------------------------------ */

  /*
   * Chaque ligne « #N » porte deux familles de menus :
   *  - ceux qui désignent une vraie option produit sur un exemplaire vendu
   *    séparément, qui servent à retrouver la variante ;
   *  - ceux qui n'ont pas de variante derrière eux — menu marqué
   *    `data-bp-property`, ou n'importe quel menu d'un exemplaire
   *    `data-bp-property-only` (2e appareil d'un pack vendu à travers la
   *    variante de son palier) — qui partent en propriété de ligne.
   *
   * Un menu peut aussi porter `data-bp-maps-to` : il s'affiche sous un intitulé
   * (« Modèle ») mais choisit en réalité une autre option produit (« Édition »).
   * C'est ce qui fait changer le prix et la photo d'un exemplaire vendu.
   *
   * Enfin, une carte peut porter un bloc `data-bp-shared` : des menus valables
   * pour tout le pack plutôt que pour un appareil. Ils entrent dans la
   * résolution de chaque exemplaire, jamais dans les propriétés de ligne —
   * ils sont déjà lisibles dans le titre de la variante.
   */
  BundlePicker.prototype.unitSelections = function (card) {
    var self = this;
    var locked = {};
    try {
      locked = JSON.parse(card.getAttribute("data-bp-locked") || "{}");
    } catch (e) {
      locked = {};
    }

    var shared = {};
    card
      .querySelectorAll("[data-bp-shared] select[data-bp-option]")
      .forEach(function (sel) {
        shared[sel.getAttribute("data-bp-option")] = sel.value;
      });

    return Array.prototype.slice
      .call(card.querySelectorAll("[data-bp-unit]"))
      .map(function (unit) {
        var propertyOnly = unit.hasAttribute("data-bp-property-only");
        var resolve = {};
        var props = {};

        Object.keys(locked).forEach(function (name) {
          resolve[name] = locked[name];
        });
        Object.keys(shared).forEach(function (name) {
          resolve[name] = shared[name];
        });

        unit.querySelectorAll("select[data-bp-option]").forEach(function (sel) {
          var name = sel.getAttribute("data-bp-option");
          var mapsTo = sel.getAttribute("data-bp-maps-to");
          if (propertyOnly || sel.hasAttribute("data-bp-property")) {
            props[name] = sel.value;
          } else {
            resolve[mapsTo || name] = sel.value;
          }
        });

        var selected = {};
        Object.keys(resolve).forEach(function (name) {
          selected[name] = resolve[name];
        });
        Object.keys(props).forEach(function (name) {
          selected[name] = props[name];
        });

        return {
          node: unit,
          index: Number(unit.getAttribute("data-bp-index") || 0),
          propertyOnly: propertyOnly,
          props: props,
          selected: selected,
          options: selected,
          variant: propertyOnly ? null : self.findVariant(resolve)
        };
      });
  };

  BundlePicker.prototype.findVariant = function (chosen) {
    var names = this.optionNames;
    return (
      this.variants.filter(function (variant) {
        return names.every(function (name, index) {
          if (!(name in chosen)) return true;
          return variant.options[index] === chosen[name];
        });
      })[0] || null
    );
  };

  /* --- Images liées aux variantes ----------------------------------------- */

  /*
   * Les blocs « Image de variante » du bloc déposent chacun une balise
   * <script data-bp-variant-image> portant { color, model, image, imageLarge }.
   * On les relit à chaque repaint plutôt que de les mettre en cache : leur
   * nombre reste faible et ça évite tout risque de donnée obsolète.
   *
   * Sans bloc propre, on réutilise la table de la section « Images de
   * variantes » si la page en porte une : les associations n'ont alors à être
   * saisies qu'à un seul endroit pour la vignette comme pour la galerie.
   */
  BundlePicker.prototype.variantImageEntries = function () {
    var own = Array.prototype.slice
      .call(this.root.querySelectorAll("[data-bp-variant-image]"))
      .map(parseJson)
      .filter(Boolean);

    if (own.length) return own;

    var shared = parseJson(
      document.querySelector("[data-variant-image-map-config]")
    );
    return (shared && shared.entries) || [];
  };

  /*
   * Priorité : combinaison exacte couleur + modèle > modèle seul > couleur
   * seule. Renvoie `null` si rien ne correspond, pour que l'appelant retombe
   * sur l'image native de la variante résolue.
   *
   * `key` choisit le format rendu par le bloc : `image` pour la vignette de la
   * carte, `imageLarge` pour la grande photo de la page produit.
   */
  BundlePicker.prototype.resolveVariantImage = function (colorValue, modelValue, key) {
    var entries = this.variantImageEntries();
    var color = colorValue || "";
    var model = modelValue || "";

    function find(needColor, needModel) {
      return entries.filter(function (entry) {
        var colorOk = needColor
          ? entry.color === color && color !== ""
          : entry.color === "";
        var modelOk = needModel
          ? entry.model === model && model !== ""
          : entry.model === "";
        return colorOk && modelOk;
      })[0];
    }

    var match =
      (color && model && find(true, true)) ||
      (model && find(false, true)) ||
      (color && find(true, false)) ||
      null;

    if (!match) return null;
    return match[key] || match.image || null;
  };

  /*
   * Cherche une image pour la carte : d'abord par exemplaire (#1, #2…),
   * ensuite au niveau de la carte elle-même.
   *
   * Priorité :
   * 1. par exemplaire, bloc « Image de variante » associé au Couleur/Modèle
   *    choisi ;
   * 2. sur une carte à PLUSIEURS exemplaires (un pack), la photo du palier
   *    lui-même (`data-bp-tier-image[-large]`, calculée côté Liquid à partir
   *    de la variante du palier — ex. Duo Pack). La variante réellement
   *    résolue pour un exemplaire est celle d'un appareil (Standard/Pro), pas
   *    celle du pack : l'utiliser afficherait la photo d'un seul appareil à
   *    la place de la photo du pack ;
   * 3. sur une carte à UN exemplaire, l'image native de la variante Shopify
   *    résolue (`variant.image` / `variant.imageLarge`, assignée dans
   *    l'admin — aucun bloc à poser, ça fonctionne automatiquement pour toute
   *    nouvelle variante à qui on assigne une image).
   */
  BundlePicker.prototype.resolveCardImage = function (card, units, key) {
    var self = this;
    var imageKey = key || "image";
    var variantKey = imageKey === "imageLarge" ? "imageLarge" : "image";
    var i;

    for (i = 0; i < units.length; i++) {
      var unit = units[i];
      if (!unit || !unit.selected) continue;
      var mapped = self.resolveVariantImage(
        unit.selected[self.colorOption],
        unit.selected[self.modelOption],
        imageKey
      );
      if (mapped) return mapped;
    }

    if (units.length > 1 && card && card.dataset) {
      var tierImage =
        imageKey === "imageLarge"
          ? card.dataset.bpTierImageLarge
          : card.dataset.bpTierImage;
      if (tierImage) return tierImage;
    }

    for (i = 0; i < units.length; i++) {
      var single = units[i];
      if (!single) continue;
      var native = single.variant && (single.variant[variantKey] || single.variant.image);
      if (native) return native;
    }

    return null;
  };

  /* --- État de l'interface ------------------------------------------------ */

  BundlePicker.prototype.sellableUnits = function (card) {
    return this.unitSelections(card).filter(function (unit) {
      return !unit.propertyOnly;
    });
  };

  /*
   * Une carte affiche ce que coûte ce qu'elle met au panier : le prix de son
   * unique variante sur une carte simple, la somme des exemplaires sur un pack
   * vendu à l'exemplaire. Un prix forcé dans les réglages porte
   * `data-bp-static` et n'est jamais repeint.
   */
  BundlePicker.prototype.paint = function (card) {
    var units = this.sellableUnits(card);
    if (!units.length) return;

    var variants = units.map(function (unit) { return unit.variant; });
    var missing = variants.filter(function (variant) { return !variant; });
    if (missing.length) return;

    var total = 0;
    var compareTotal = 0;
    variants.forEach(function (variant) {
      total += Number(variant.price) || 0;
      compareTotal += Number(variant.compareAt || variant.price) || 0;
    });

    // Une seule variante : on garde le libellé rendu par Liquid, au format exact
    // de la boutique. Une somme n'existe nulle part, elle doit être reformatée.
    var single = variants.length === 1;
    var format = this.config.moneyFormat;
    var priceLabel =
      single && variants[0].priceLabel
        ? variants[0].priceLabel
        : formatMoney(total, format);

    var compareLabel = "";
    if (compareTotal > total) {
      compareLabel =
        single && variants[0].compareLabel
          ? variants[0].compareLabel
          : formatMoney(compareTotal, format);
    }

    var priceNode = card.querySelector("[data-bp-price]");
    if (priceNode && !priceNode.hasAttribute("data-bp-static")) {
      priceNode.textContent = priceLabel;
    }

    var compareNode = card.querySelector("[data-bp-compare]");
    if (compareNode && !compareNode.hasAttribute("data-bp-static")) {
      compareNode.textContent = compareLabel;
      compareNode.style.display = compareLabel ? "" : "none";
    }

    var imageNode = card.querySelector("[data-bp-image]");
    // Priorité : image de variante associée (combinaison > modèle > couleur),
    // sinon la photo du palier sur un pack, sinon l'image native de la
    // variante résolue, sinon l'image principale du produit.
    var source =
      this.resolveCardImage(card, this.unitSelections(card), "image") ||
      this.config.fallbackImage;
    if (imageNode && source && imageNode.getAttribute("src") !== source) {
      imageNode.removeAttribute("srcset");
      imageNode.setAttribute("src", source);
    }
  };

  BundlePicker.prototype.refresh = function () {
    var self = this;
    this.cards.forEach(function (item) { self.paint(item); });

    var card = this.selectedCard();
    if (!card) return;

    // La carte sélectionnée pilote aussi la grande photo de la page produit,
    // avec la même priorité que la vignette (bloc dédié > image native).
    var allUnits = this.unitSelections(card);
    paintMainGallery(this.resolveCardImage(card, allUnits, "imageLarge"));

    if (!this.atc) return;

    var units = allUnits.filter(function (unit) {
      return !unit.propertyOnly;
    });
    var resolved = units.every(function (unit) {
      return unit.variant;
    });
    var sellable = units.every(function (unit) {
      return unit.variant && unit.variant.available;
    });

    var label = this.atc.getAttribute("data-label-default") || "Ajouter à mon panier";
    var soldOut = this.atc.getAttribute("data-label-sold-out") || "Momentanément épuisé";
    var unavailable =
      this.atc.getAttribute("data-label-unavailable") || "Indisponible pour le moment";

    if (!resolved) {
      this.atc.textContent = unavailable;
      this.atc.disabled = true;
    } else if (!sellable && !this.config.allowOversell) {
      this.atc.textContent = soldOut;
      this.atc.disabled = true;
    } else {
      this.atc.textContent = label;
      this.atc.disabled = false;
    }
  };

  /* --- Panier -------------------------------------------------------------- */

  BundlePicker.prototype.buildItems = function (card) {
    var bundleName = card.getAttribute("data-bp-name") || "";
    var units = this.unitSelections(card);
    var cartUnits = units.filter(function (unit) { return !unit.propertyOnly; });
    var extraUnits = units.filter(function (unit) { return unit.propertyOnly; });
    var multiUnit = units.length > 1;
    var items = [];

    cartUnits.forEach(function (unit, position) {
      if (!unit.variant) return;
      var properties = {};
      if (multiUnit && bundleName) properties._bundle = bundleName;
      if (cartUnits.length > 1) properties._bundle_item = "#" + (position + 1);

      // Menus sans variante derrière eux (ex. Modèle) : propriétés de ligne.
      Object.keys(unit.props).forEach(function (name) {
        var label = multiUnit
          ? "#" + (unit.index || position + 1) + " " + name
          : name;
        properties[label] = unit.props[name];
      });

      var existing = items.filter(function (item) {
        return (
          item.id === unit.variant.id &&
          JSON.stringify(item.properties) === JSON.stringify(properties)
        );
      })[0];

      if (existing) {
        existing.quantity += 1;
      } else {
        items.push({
          id: unit.variant.id,
          quantity: 1,
          properties: properties
        });
      }
    });

    // Exemplaires non vendus séparément : leurs choix voyagent en propriétés de
    // ligne sur le premier article.
    if (items.length && extraUnits.length) {
      extraUnits.forEach(function (unit) {
        var label = "#" + (unit.index || 2);
        Object.keys(unit.props).forEach(function (name) {
          items[0].properties[label + " " + name] = unit.props[name];
        });
      });
    }

    return items;
  };

  BundlePicker.prototype.addToCart = function () {
    var self = this;
    var card = this.selectedCard();
    if (!card || this.atc.disabled) return;

    var items = this.buildItems(card);
    if (!items.length) {
      this.showError(
        this.config.strings && this.config.strings.unavailable
          ? this.config.strings.unavailable
          : "Cette combinaison n'est pas disponible pour le moment."
      );
      return;
    }

    this.clearError();
    this.setLoading(true);

    if (this.isPreview) {
      window.setTimeout(function () {
        self.setLoading(false);
        self.previewFeedback(card, items);
      }, 450);
      return;
    }

    fetch(this.routeCartAdd(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ items: items })
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.description || data.message);
          return data;
        });
      })
      .then(function () {
        self.setLoading(false);
        self.afterAdd(card);
      })
      .catch(function (error) {
        self.setLoading(false);
        self.showError(error.message || "Oups, l’ajout au panier n’a pas fonctionné. Pouvez-vous réessayer ?");
      });
  };

  BundlePicker.prototype.routeCartAdd = function () {
    var base = (this.config.routes && this.config.routes.cartAdd) || "/cart/add";
    return base.replace(/\.js$/, "") + ".js";
  };

  BundlePicker.prototype.afterAdd = function (card) {
    var discount = card.getAttribute("data-bp-discount");
    var cartUrl = (this.config.routes && this.config.routes.cart) || "/cart";

    // Un code promo automatise le prix bundle : on le pose puis on renvoie au panier.
    if (discount) {
      window.location.href =
        "/discount/" +
        encodeURIComponent(discount) +
        "?redirect=" +
        encodeURIComponent(cartUrl);
      return;
    }

    if (this.config.behaviour === "checkout") {
      window.location.href = "/checkout";
      return;
    }

    if (this.config.behaviour === "cart") {
      window.location.href = cartUrl;
      return;
    }

    // Par défaut : on laisse le thème rafraîchir son tiroir de panier.
    document.documentElement.dispatchEvent(
      new CustomEvent("cart:refresh", { bubbles: true })
    );
    document.documentElement.dispatchEvent(
      new CustomEvent("cart:build", { bubbles: true })
    );
    var drawer =
      document.querySelector("cart-drawer") ||
      document.querySelector("#CartDrawer");
    if (drawer && typeof drawer.open === "function") {
      drawer.open();
    } else if (drawer && drawer.classList) {
      drawer.classList.add("active", "is-open");
    } else {
      window.location.href = cartUrl;
    }
  };

  BundlePicker.prototype.previewFeedback = function (card, items) {
    var name = card.getAttribute("data-bp-name") || "Bundle";
    var lines = this.unitSelections(card).map(function (unit, index) {
      return "#" + (index + 1) + " · " + Object.keys(unit.options)
        .map(function (key) { return unit.options[key]; })
        .join(" / ");
    });
    var total = items.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
    this.showError("");
    window.alert(
      "Ajouté au panier (preview)\n\n" +
        name +
        " — " +
        total +
        " article(s)\n" +
        lines.join("\n")
    );
  };

  BundlePicker.prototype.setLoading = function (state) {
    if (!this.atc) return;
    this.atc.classList.toggle("is-loading", !!state);
    this.atc.disabled = !!state;
    if (!state) this.refresh();
  };

  BundlePicker.prototype.showError = function (message) {
    if (!this.errorNode) return;
    this.errorNode.textContent = message || "";
    this.errorNode.classList.toggle("is-visible", !!message);
  };

  BundlePicker.prototype.clearError = function () {
    this.showError("");
  };

  function init(scope) {
    (scope || document).querySelectorAll(ROOT_SELECTOR).forEach(function (root) {
      if (root.dataset.bpReady === "true") return;
      root.dataset.bpReady = "true";
      new BundlePicker(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); });
  } else {
    init();
  }

  // Rechargement d'un bloc depuis l'éditeur de thème.
  document.addEventListener("shopify:section:load", function (event) {
    init(event.target);
  });

  window.BundlePicker = BundlePicker;
})();
