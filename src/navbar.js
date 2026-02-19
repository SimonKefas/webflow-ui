/**
 * WebflowUI.navbar
 * - Works on Webflow native navbars (w-nav)
 * - Root element must have data-wf-api-name
 */
(function () {
  if (window.WebflowUI.navbar) return;

  var core = window.WebflowUI._core;
  var NAME_ATTR = core.NAME_ATTR;
  var TYPE_ATTR = core.TYPE_ATTR;
  var TYPE_NAVBAR = "navbar";
  var WF_NAV_CLASS = "w-nav";
  var WF_BUTTON_SELECTOR = ".w-nav-button";
  var WF_MENU_SELECTOR = ".w-nav-menu";
  var OPEN_CLASS = "w--open";
  var BODY_OPEN_CLASS = "w-nav-open";

  function NavbarInstance(root) {
    this.root = root;
    this.name = root.getAttribute(NAME_ATTR) || null;
    this.buttonEl = root.querySelector(WF_BUTTON_SELECTOR);
    this.menuEl = root.querySelector(WF_MENU_SELECTOR);
    this._listeners = new Set();
    this._mutationObserver = null;

    if (!this.buttonEl || !this.menuEl) {
      console.warn(
        "[WebflowUI.navbar] Missing .w-nav-button or .w-nav-menu for",
        root
      );
      return;
    }

    this._watchStateChanges();
  }

  NavbarInstance.prototype.isOpen = function () {
    return (
      this.buttonEl.classList.contains(OPEN_CLASS) ||
      this.menuEl.classList.contains(OPEN_CLASS) ||
      document.body.classList.contains(BODY_OPEN_CLASS)
    );
  };

  NavbarInstance.prototype.open = function (options) {
    options = options || {};
    if (this.isOpen()) return;
    var useNative = options.useNative !== false;

    if (useNative && this._nativeToggle(true)) return;

    this._forceOpen();
  };

  NavbarInstance.prototype.close = function (options) {
    options = options || {};
    if (!this.isOpen()) return;
    var useNative = options.useNative !== false;

    if (useNative && this._nativeToggle(false)) return;

    this._forceClose();
  };

  NavbarInstance.prototype.toggle = function (options) {
    if (this.isOpen()) {
      this.close(options);
    } else {
      this.open(options);
    }
  };

  NavbarInstance.prototype.onChange = function (callback) {
    if (typeof callback !== "function") return function () {};
    this._listeners.add(callback);
    var self = this;
    return function () {
      self._listeners.delete(callback);
    };
  };

  NavbarInstance.prototype.destroy = function () {
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
    this._listeners.clear();
  };

  NavbarInstance.prototype._watchStateChanges = function () {
    var self = this;

    function emit() {
      self._emitChange();
    }

    var observer = new MutationObserver(function (mutations) {
      var changed = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (
          m.type === "attributes" &&
          m.attributeName === "class" &&
          (m.target === self.buttonEl || m.target === self.menuEl)
        ) {
          changed = true;
          break;
        }
      }
      if (changed) emit();
    });

    observer.observe(this.buttonEl, {
      attributes: true,
      attributeFilter: ["class"]
    });
    observer.observe(this.menuEl, {
      attributes: true,
      attributeFilter: ["class"]
    });

    this._mutationObserver = observer;
  };

  NavbarInstance.prototype._emitChange = function () {
    var open = this.isOpen();
    this.root.classList.toggle("wf-api-open", open);
    this._listeners.forEach(function (cb) {
      try {
        cb(open, this);
      } catch (err) {
        console.error("[WebflowUI.navbar] onChange callback error", err);
      }
    }, this);
  };

  NavbarInstance.prototype._nativeToggle = function (shouldOpen) {
    var initiallyOpen = this.isOpen();
    if (shouldOpen === initiallyOpen) return true;

    if (!this.buttonEl) return false;
    this.buttonEl.click();
    return this.isOpen() === shouldOpen;
  };

  NavbarInstance.prototype._forceOpen = function () {
    this.buttonEl.classList.add(OPEN_CLASS);
    this.menuEl.classList.add(OPEN_CLASS);
    document.body.classList.add(BODY_OPEN_CLASS);
    this._emitChange();
  };

  NavbarInstance.prototype._forceClose = function () {
    this.buttonEl.classList.remove(OPEN_CLASS);
    this.menuEl.classList.remove(OPEN_CLASS);
    document.body.classList.remove(BODY_OPEN_CLASS);
    this._emitChange();
  };

  function isNavbarRoot(el) {
    var explicitType = el.getAttribute(TYPE_ATTR);
    if (explicitType === TYPE_NAVBAR) return true;
    if (!explicitType && el.classList.contains(WF_NAV_CLASS)) return true;
    return false;
  }

  var reg = core.createRegistry(NavbarInstance, function (inst) {
    return !!inst.buttonEl && !!inst.menuEl;
  });

  core.registerComponent({
    type: TYPE_NAVBAR,
    isMatch: isNavbarRoot,
    createInstance: reg.createInstance
  });

  window.WebflowUI.navbar = {
    all: function () {
      return reg.all();
    },
    get: function (target) {
      return reg.getInstance(target);
    },
    destroy: function (target) {
      return reg.destroy(target);
    },
    open: function (target, options) {
      var inst = reg.getInstance(target);
      if (inst) inst.open(options);
    },
    close: function (target, options) {
      var inst = reg.getInstance(target);
      if (inst) inst.close(options);
    },
    toggle: function (target, options) {
      var inst = reg.getInstance(target);
      if (inst) inst.toggle(options);
    },
    isOpen: function (target) {
      var inst = reg.getInstance(target);
      return inst ? inst.isOpen() : false;
    },
    onChange: function (target, callback) {
      var inst = reg.getInstance(target);
      if (!inst) {
        console.warn("[WebflowUI.navbar] No instance found for", target);
        return function () {};
      }
      return inst.onChange(callback);
    },
    refresh: function () {
      core.scan();
    }
  };
})();
