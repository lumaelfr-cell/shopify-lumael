/* ==========================================================================
   Bundle Picker — sélection d'offre + ajout au panier
   Fonctionne dans un thème Shopify (Cart AJAX API) et en preview statique.
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

  BundlePicker.prototype.unitSelections = function (card) {
    var self = this;
    var locked = {};
    try {
      locked = JSON.parse(card.getAttribute("data-bp-locked") || "{}");
    } catch (e) {
      locked = {};
    }

    return Array.prototype.slice
      .call(card.querySelectorAll("[data-bp-unit]"))
      .map(function (unit) {
        var chosen = {};
        Object.keys(locked).forEach(function (name) {
          chosen[name] = locked[name];
        });
        unit.querySelectorAll("select[data-bp-option]").forEach(function (sel) {
          chosen[sel.getAttribute("data-bp-option")] = sel.value;
        });
        return {
          node: unit,
          options: chosen,
          variant: self.findVariant(chosen)
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

  BundlePicker.prototype.refresh = function () {
    var card = this.selectedCard();
    if (!card || !this.atc) return;

    var units = this.unitSelections(card);
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
    var items = [];

    units.forEach(function (unit, index) {
      if (!unit.variant) return;
      var properties = {};
      if (bundleName) properties._bundle = bundleName;
      if (units.length > 1) properties._bundle_item = "#" + (index + 1);

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

  // Rechargement d'une section depuis l'éditeur de thème.
  document.addEventListener("shopify:section:load", function (event) {
    init(event.target);
  });

  window.BundlePicker = BundlePicker;
})();
