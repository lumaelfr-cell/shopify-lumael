/* ==========================================================================
   Bundle Picker — sélection d'offre + ajout au panier
   ========================================================================== */

(function () {
  "use strict";

  var ROOT_SELECTOR = "[data-bundle-picker]";

  function parseConfig(root) {
    var node = root.querySelector("[data-bundle-picker-config]");
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (e) {
      console.error("[bundle-picker] configuration JSON invalide", e);
      return null;
    }
  }

  function BundlePicker(root) {
    this.root = root;
    this.config = parseConfig(root) || {};
    this.variants = this.config.variants || [];
    this.optionNames = this.config.optionNames || [];
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
   *    `data-bp-property-only` (2e appareil d'un Duo Pack) — qui partent en
   *    propriété de ligne.
   *
   * Un menu peut aussi porter `data-bp-maps-to` : il s'affiche sous un intitulé
   * (« Modèle ») mais choisit en réalité une autre option produit (« Édition »).
   * C'est ce qui fait changer le prix et la photo d'une carte à un exemplaire.
   *
   * Enfin, une carte peut porter un bloc `data-bp-shared` : des menus valables
   * pour tout le pack (la gravure) plutôt que pour un appareil. Ils entrent dans
   * la résolution de chaque exemplaire, jamais dans les propriétés de ligne —
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

  /* --- État de l'interface ------------------------------------------------ */

  BundlePicker.prototype.sellableUnits = function (card) {
    return this.unitSelections(card).filter(function (unit) {
      return !unit.propertyOnly;
    });
  };

  /*
   * Prix, prix barré et photo d'une carte suivent la variante que ses menus
   * désignent. Un prix forcé dans les réglages porte `data-bp-static` et n'est
   * jamais repeint.
   */
  BundlePicker.prototype.paint = function (card) {
    var units = this.sellableUnits(card);
    var variant = units.length ? units[0].variant : null;
    if (!variant) return;

    var priceNode = card.querySelector("[data-bp-price]");
    if (priceNode && !priceNode.hasAttribute("data-bp-static") && variant.priceLabel) {
      priceNode.textContent = variant.priceLabel;
    }

    var compareNode = card.querySelector("[data-bp-compare]");
    if (compareNode && !compareNode.hasAttribute("data-bp-static")) {
      compareNode.textContent = variant.compareLabel || "";
      compareNode.style.display = variant.compareLabel ? "" : "none";
    }

    var imageNode = card.querySelector("[data-bp-image]");
    var source = variant.image || this.config.fallbackImage;
    if (imageNode && source && imageNode.getAttribute("src") !== source) {
      imageNode.removeAttribute("srcset");
      imageNode.setAttribute("src", source);
    }
  };

  BundlePicker.prototype.refresh = function () {
    var self = this;
    this.cards.forEach(function (item) { self.paint(item); });

    var card = this.selectedCard();
    if (!card || !this.atc) return;

    var units = this.sellableUnits(card);
    var resolved = units.every(function (unit) {
      return unit.variant;
    });
    var sellable = units.every(function (unit) {
      return unit.variant && unit.variant.available;
    });

    var label = this.atc.getAttribute("data-label-default") || "ADD TO CART";
    var soldOut = this.atc.getAttribute("data-label-sold-out") || "SOLD OUT";
    var unavailable =
      this.atc.getAttribute("data-label-unavailable") || "UNAVAILABLE";

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

    // Exemplaires non vendus séparément (ex. 2e appareil d'un Duo Pack) :
    // leurs choix voyagent en propriétés de ligne sur le premier article.
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
          : "Cette combinaison n'est pas disponible."
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
        self.showError(error.message || "Ajout au panier impossible.");
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
