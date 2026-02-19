/**
 * WebflowUI.dropdown
 * - Works on Webflow native dropdowns (w-dropdown)
 * - Root element must have data-wf-api-name
 */
(function () {
  if (window.WebflowUI.dropdown) return;

  var core = window.WebflowUI._core;
  var NAME_ATTR = core.NAME_ATTR;
  var TYPE_ATTR = core.TYPE_ATTR;
  var TYPE_DROPDOWN = "dropdown";
  var WF_DROPDOWN_CLASS = "w-dropdown";
  var WF_TOGGLE_SELECTOR = ".w-dropdown-toggle";
  var WF_LIST_SELECTOR = ".w-dropdown-list";
  var OPEN_CLASS = "w--open";

  function DropdownInstance(root) {
    this.root = root;
    this.name = root.getAttribute(NAME_ATTR) || null;
    this.toggleEl = root.querySelector(WF_TOGGLE_SELECTOR);
    this.listEl = root.querySelector(WF_LIST_SELECTOR);
    this._listeners = new Set();
    this._mutationObserver = null;

    if (!this.toggleEl || !this.listEl) {
      console.warn(
        "[WebflowUI.dropdown] Missing .w-dropdown-toggle or .w-dropdown-list for",
        root
      );
      return;
    }

    this._watchStateChanges();
  }

  DropdownInstance.prototype.isOpen = function () {
    return (
      this.toggleEl.classList.contains(OPEN_CLASS) ||
      this.listEl.classList.contains(OPEN_CLASS)
    );
  };

  DropdownInstance.prototype.open = function (options) {
    options = options || {};
    if (this.isOpen()) return;
    var useNative = options.useNative !== false;

    if (useNative && this._nativeOpen()) return;

    this._forceOpen();
  };

  DropdownInstance.prototype.close = function (options) {
    options = options || {};
    if (!this.isOpen()) return;
    var useNative = options.useNative !== false;

    if (useNative && this._nativeClose()) return;
    if (useNative && this._nativeToggleClose()) return;

    this._forceClose();
  };

  DropdownInstance.prototype.toggle = function (options) {
    if (this.isOpen()) {
      this.close(options);
    } else {
      this.open(options);
    }
  };

  DropdownInstance.prototype.onChange = function (callback) {
    if (typeof callback !== "function") return function () {};
    this._listeners.add(callback);
    var self = this;
    return function () {
      self._listeners.delete(callback);
    };
  };

  DropdownInstance.prototype.destroy = function () {
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
    this._listeners.clear();
  };

  DropdownInstance.prototype._watchStateChanges = function () {
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
          (m.target === self.toggleEl || m.target === self.listEl)
        ) {
          changed = true;
          break;
        }
      }
      if (changed) emit();
    });

    observer.observe(this.toggleEl, {
      attributes: true,
      attributeFilter: ["class"]
    });
    observer.observe(this.listEl, {
      attributes: true,
      attributeFilter: ["class"]
    });

    this._mutationObserver = observer;
  };

  DropdownInstance.prototype._emitChange = function () {
    var open = this.isOpen();
    this.root.classList.toggle("wf-api-open", open);
    this._listeners.forEach(function (cb) {
      try {
        cb(open, this);
      } catch (err) {
        console.error("[WebflowUI.dropdown] onChange callback error", err);
      }
    }, this);
  };

  DropdownInstance.prototype._nativeOpen = function () {
    if (this.isOpen()) return true;
    this._simulateClick(this.toggleEl);
    return this.isOpen();
  };

  DropdownInstance.prototype._nativeClose = function () {
    var $ = window.jQuery;
    if (!$ || !this.root.classList.contains(WF_DROPDOWN_CLASS)) return false;

    try {
      $(this.root).triggerHandler("w-close.w-dropdown");
      return !this.isOpen();
    } catch (err) {
      console.warn("[WebflowUI.dropdown] Error calling w-close.w-dropdown", err);
      return false;
    }
  };

  DropdownInstance.prototype._nativeToggleClose = function () {
    if (!this.isOpen()) return true;
    this._simulateClick(this.toggleEl);
    return !this.isOpen();
  };

  DropdownInstance.prototype._simulateClick = function (el) {
    if (!el) return;
    el.click();
  };

  DropdownInstance.prototype._forceOpen = function () {
    this.toggleEl.classList.add(OPEN_CLASS);
    this.listEl.classList.add(OPEN_CLASS);
    this.root.classList.add("wf-api-open");
    this.toggleEl.setAttribute("aria-expanded", "true");
    this._emitChange();
  };

  DropdownInstance.prototype._forceClose = function () {
    this.toggleEl.classList.remove(OPEN_CLASS);
    this.listEl.classList.remove(OPEN_CLASS);
    this.root.classList.remove("wf-api-open");
    this.toggleEl.setAttribute("aria-expanded", "false");
    this._emitChange();
  };

  function isDropdownRoot(el) {
    var explicitType = el.getAttribute(TYPE_ATTR);
    if (explicitType === TYPE_DROPDOWN) return true;
    if (!explicitType && el.classList.contains(WF_DROPDOWN_CLASS)) return true;
    return false;
  }

  var reg = core.createRegistry(DropdownInstance, function (inst) {
    return !!inst.toggleEl && !!inst.listEl;
  });

  core.registerComponent({
    type: TYPE_DROPDOWN,
    isMatch: isDropdownRoot,
    createInstance: reg.createInstance
  });

  window.WebflowUI.dropdown = {
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
        console.warn("[WebflowUI.dropdown] No instance found for", target);
        return function () {};
      }
      return inst.onChange(callback);
    },
    refresh: function () {
      core.scan();
    }
  };
})();
