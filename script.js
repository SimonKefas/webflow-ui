/**
 * WebflowUI Core
 * - Handles DOM ready, mutation observing, and component registration.
 * - All components use data-wf-api-name for opt-in.
 * - Provides createRegistry() to eliminate per-module boilerplate.
 */
(function () {
  window.WebflowUI = window.WebflowUI || {};
  if (window.WebflowUI._core) return; // prevent double-init

  var NAME_ATTR = "data-wf-api-name";
  var TYPE_ATTR = "data-wf-api";

  var components = [];

  function registerComponent(def) {
    // def: { type, isMatch(el), createInstance(el) }
    components.push(def);
    scan();
  }

  function scan() {
    var named = document.querySelectorAll("[" + NAME_ATTR + "]");
    named.forEach(function (el) {
      components.forEach(function (comp) {
        try {
          if (comp.isMatch(el)) {
            comp.createInstance(el);
          }
        } catch (err) {
          console.error("[WebflowUI._core] Component scan error:", err);
        }
      });
    });
  }

  // Debounced scan for MutationObserver — coalesce rapid DOM changes
  var _scanScheduled = false;

  function _scheduleScan() {
    if (_scanScheduled) return;
    _scanScheduled = true;
    requestAnimationFrame(function () {
      _scanScheduled = false;
      scan();
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  var docObserver = new MutationObserver(function (mutations) {
    var shouldScan = false;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.addedNodes && m.addedNodes.length) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) _scheduleScan();
  });

  ready(function () {
    scan();
    docObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });

  /**
   * createRegistry(InstanceClass, isValid)
   * Returns { getInstance, createInstance, all, destroy } for a module.
   * Eliminates ~30 lines of per-module boilerplate.
   */
  function createRegistry(InstanceClass, isValid) {
    var registry = new Map();

    function getInstance(target) {
      if (!target) return null;

      if (target instanceof InstanceClass) return target;

      if (target instanceof Element) {
        return registry.get(target) || null;
      }

      if (typeof target === "string") {
        var values = registry.values();
        var next = values.next();
        while (!next.done) {
          var inst = next.value;
          if (inst.name === target) return inst;
          next = values.next();
        }
        return null;
      }

      return null;
    }

    function createInstance(root) {
      if (registry.has(root)) return;
      var instance = new InstanceClass(root);
      if (isValid(instance)) {
        registry.set(root, instance);
      }
    }

    function all() {
      return Array.from(registry.values());
    }

    function destroy(target) {
      var inst = getInstance(target);
      if (!inst) return false;
      if (typeof inst.destroy === "function") inst.destroy();
      registry.delete(inst.root);
      return true;
    }

    return {
      getInstance: getInstance,
      createInstance: createInstance,
      all: all,
      destroy: destroy
    };
  }

  window.WebflowUI._core = {
    NAME_ATTR: NAME_ATTR,
    TYPE_ATTR: TYPE_ATTR,
    registerComponent: registerComponent,
    scan: scan,
    createRegistry: createRegistry
  };
})();
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
/**
 * WebflowUI.radio
 * - Group-level API for radios
 * - Root element: any container with data-wf-api-name that wraps Webflow .w-radio inputs
 */
(function () {
  if (window.WebflowUI.radio) return;

  var core = window.WebflowUI._core;
  var NAME_ATTR = core.NAME_ATTR;
  var TYPE_ATTR = core.TYPE_ATTR;
  var TYPE_RADIO = "radio-group";

  function RadioGroupInstance(root) {
    this.root = root;
    this.name = root.getAttribute(NAME_ATTR) || null;
    this.inputs = Array.from(
      root.querySelectorAll('input[type="radio"]')
    );
    this._listeners = new Set();

    if (!this.inputs.length) {
      console.warn("[WebflowUI.radio] No radio inputs found in", root);
      return;
    }

    var self = this;
    this._boundOnChange = function () {
      self._emitChange();
    };

    this.inputs.forEach(function (input) {
      input.addEventListener("change", self._boundOnChange);
    });
  }

  RadioGroupInstance.prototype.getValue = function () {
    var checked = this.inputs.find(function (i) {
      return i.checked;
    });
    return checked ? checked.value : null;
  };

  RadioGroupInstance.prototype.setValue = function (value, options) {
    options = options || {};
    var useNative = options.useNative !== false;

    var target = this.inputs.find(function (i) {
      return i.value === value;
    });
    if (!target) return;

    if (useNative) {
      if (!target.checked) {
        target.click();
      }
    } else {
      this.inputs.forEach(function (i) {
        i.checked = i === target;
      });
      this._emitChange();
    }
  };

  RadioGroupInstance.prototype.clear = function (options) {
    options = options || {};
    var useNative = options.useNative !== false;

    if (useNative) {
      this.inputs.forEach(function (input) {
        if (!input.checked) return;
        input.checked = false;
        var evt = new Event("change", { bubbles: true });
        input.dispatchEvent(evt);
      });
    } else {
      this.inputs.forEach(function (i) {
        i.checked = false;
      });
      this._emitChange();
    }
  };

  RadioGroupInstance.prototype.onChange = function (callback) {
    if (typeof callback !== "function") return function () {};
    this._listeners.add(callback);
    var self = this;
    return function () {
      self._listeners.delete(callback);
    };
  };

  RadioGroupInstance.prototype.destroy = function () {
    var self = this;
    this.inputs.forEach(function (input) {
      input.removeEventListener("change", self._boundOnChange);
    });
    this._listeners.clear();
  };

  RadioGroupInstance.prototype._emitChange = function () {
    var value = this.getValue();
    this.root.classList.toggle("wf-api-has-value", value != null);
    this._listeners.forEach(function (cb) {
      try {
        cb(value, this);
      } catch (err) {
        console.error("[WebflowUI.radio] onChange callback error", err);
      }
    }, this);
  };

  function isRadioRoot(el) {
    var explicitType = el.getAttribute(TYPE_ATTR);
    if (explicitType === "radio" || explicitType === TYPE_RADIO) return true;
    if (!explicitType && el.querySelector('.w-radio input[type="radio"]')) {
      return true;
    }
    return false;
  }

  var reg = core.createRegistry(RadioGroupInstance, function (inst) {
    return !!inst.inputs && inst.inputs.length > 0;
  });

  core.registerComponent({
    type: TYPE_RADIO,
    isMatch: isRadioRoot,
    createInstance: reg.createInstance
  });

  window.WebflowUI.radio = {
    all: function () {
      return reg.all();
    },
    get: function (target) {
      return reg.getInstance(target);
    },
    destroy: function (target) {
      return reg.destroy(target);
    },
    getValue: function (target) {
      var inst = reg.getInstance(target);
      return inst ? inst.getValue() : null;
    },
    setValue: function (target, value, options) {
      var inst = reg.getInstance(target);
      if (inst) inst.setValue(value, options);
    },
    clear: function (target, options) {
      var inst = reg.getInstance(target);
      if (inst) inst.clear(options);
    },
    onChange: function (target, callback) {
      var inst = reg.getInstance(target);
      if (!inst) {
        console.warn("[WebflowUI.radio] No instance found for", target);
        return function () {};
      }
      return inst.onChange(callback);
    },
    refresh: function () {
      core.scan();
    }
  };
})();
/**
 * WebflowUI.checkbox
 * - Group-level API for checkboxes
 * - Root element: any container with data-wf-api-name that wraps Webflow .w-checkbox inputs
 */
(function () {
  if (window.WebflowUI.checkbox) return;

  var core = window.WebflowUI._core;
  var NAME_ATTR = core.NAME_ATTR;
  var TYPE_ATTR = core.TYPE_ATTR;
  var TYPE_CHECKBOX = "checkbox-group";

  function CheckboxGroupInstance(root) {
    this.root = root;
    this.name = root.getAttribute(NAME_ATTR) || null;
    this.inputs = Array.from(
      root.querySelectorAll('input[type="checkbox"]')
    );
    this._listeners = new Set();

    if (!this.inputs.length) {
      console.warn("[WebflowUI.checkbox] No checkbox inputs found in", root);
      return;
    }

    var self = this;
    this._boundOnChange = function () {
      self._emitChange();
    };

    this.inputs.forEach(function (input) {
      input.addEventListener("change", self._boundOnChange);
    });
  }

  CheckboxGroupInstance.prototype.getValues = function () {
    return this.inputs
      .filter(function (i) {
        return i.checked;
      })
      .map(function (i) {
        return i.value;
      });
  };

  CheckboxGroupInstance.prototype.setValues = function (values, options) {
    options = options || {};
    var useNative = options.useNative !== false;
    if (!Array.isArray(values)) values = [values];

    var valueSet = new Set(values);

    if (useNative) {
      this.inputs.forEach(function (input) {
        var shouldBeChecked = valueSet.has(input.value);
        if (input.checked !== shouldBeChecked) {
          input.click();
        }
      });
    } else {
      this.inputs.forEach(function (input) {
        input.checked = valueSet.has(input.value);
      });
      this._emitChange();
    }
  };

  CheckboxGroupInstance.prototype.clear = function (options) {
    options = options || {};
    var useNative = options.useNative !== false;

    if (useNative) {
      this.inputs.forEach(function (input) {
        if (!input.checked) return;
        input.checked = false;
        var evt = new Event("change", { bubbles: true });
        input.dispatchEvent(evt);
      });
    } else {
      this.inputs.forEach(function (input) {
        input.checked = false;
      });
      this._emitChange();
    }
  };

  CheckboxGroupInstance.prototype.onChange = function (callback) {
    if (typeof callback !== "function") return function () {};
    this._listeners.add(callback);
    var self = this;
    return function () {
      self._listeners.delete(callback);
    };
  };

  CheckboxGroupInstance.prototype.destroy = function () {
    var self = this;
    this.inputs.forEach(function (input) {
      input.removeEventListener("change", self._boundOnChange);
    });
    this._listeners.clear();
  };

  CheckboxGroupInstance.prototype._emitChange = function () {
    var values = this.getValues();
    this.root.classList.toggle("wf-api-has-value", values.length > 0);
    this._listeners.forEach(function (cb) {
      try {
        cb(values, this);
      } catch (err) {
        console.error("[WebflowUI.checkbox] onChange callback error", err);
      }
    }, this);
  };

  function isCheckboxRoot(el) {
    var explicitType = el.getAttribute(TYPE_ATTR);
    if (explicitType === "checkbox" || explicitType === TYPE_CHECKBOX) return true;
    if (!explicitType && el.querySelector('.w-checkbox input[type="checkbox"]')) {
      return true;
    }
    return false;
  }

  var reg = core.createRegistry(CheckboxGroupInstance, function (inst) {
    return !!inst.inputs && inst.inputs.length > 0;
  });

  core.registerComponent({
    type: TYPE_CHECKBOX,
    isMatch: isCheckboxRoot,
    createInstance: reg.createInstance
  });

  window.WebflowUI.checkbox = {
    all: function () {
      return reg.all();
    },
    get: function (target) {
      return reg.getInstance(target);
    },
    destroy: function (target) {
      return reg.destroy(target);
    },
    getValues: function (target) {
      var inst = reg.getInstance(target);
      return inst ? inst.getValues() : [];
    },
    setValues: function (target, values, options) {
      var inst = reg.getInstance(target);
      if (inst) inst.setValues(values, options);
    },
    clear: function (target, options) {
      var inst = reg.getInstance(target);
      if (inst) inst.clear(options);
    },
    onChange: function (target, callback) {
      var inst = reg.getInstance(target);
      if (!inst) {
        console.warn("[WebflowUI.checkbox] No instance found for", target);
        return function () {};
      }
      return inst.onChange(callback);
    },
    refresh: function () {
      core.scan();
    }
  };
})();
/**
 * WebflowUI.form
 * - Works on Webflow native forms (w-form)
 * - Root element: .w-form with data-wf-api-name
 * - Detects Webflow form success / failure via DOM observation
 * - Provides a flexible API: values, events, validators
 */
(function () {
  if (window.WebflowUI.form) return;

  var core = window.WebflowUI._core;
  var NAME_ATTR = core.NAME_ATTR;
  var TYPE_ATTR = core.TYPE_ATTR;
  var TYPE_FORM = "form";
  var WF_FORM_CLASS = "w-form";
  var SUCCESS_SELECTOR = ".w-form-done";
  var ERROR_SELECTOR = ".w-form-fail";
  var ERROR_SLOT_ATTR = "data-wf-error-slot";

  var globalValidators = new Set();

  function FormInstance(root) {
    this.root = root;
    this.name = root.getAttribute(NAME_ATTR) || null;
    this.action = root.getAttribute("data-wf-api-action") || null;
    this.formEl = root.querySelector("form");
    this.successEl = root.querySelector(SUCCESS_SELECTOR);
    this.errorEl = root.querySelector(ERROR_SELECTOR);
    this.errorSlotEl = this.errorEl
      ? this.errorEl.querySelector("[" + ERROR_SLOT_ATTR + "]") ||
        this.errorEl.firstElementChild ||
        this.errorEl
      : null;
    this._defaultErrorHTML = this.errorSlotEl
      ? this.errorSlotEl.innerHTML
      : null;

    this._submitListeners = new Set();
    this._successListeners = new Set();
    this._errorListeners = new Set();
    this._validators = new Set();

    this.inputs = this.formEl
      ? Array.from(this.formEl.querySelectorAll("input, textarea, select"))
      : [];
    this._fieldsByName = {};

    var self = this;
    this.inputs.forEach(function (field) {
      var name = field.name;
      if (!name) return;
      if (!self._fieldsByName[name]) {
        self._fieldsByName[name] = [];
      }
      self._fieldsByName[name].push(field);
    });

    this._handleSubmit = null;
    this._successObserver = null;
    this._failObserver = null;

    if (!this.formEl) {
      console.warn("[WebflowUI.form] No <form> inside .w-form for", root);
      return;
    }

    this._bindEvents();
  }

  FormInstance.prototype._bindEvents = function () {
    var self = this;

    this._handleSubmit = function (event) {
      self._onSubmit(event);
    };

    // Use capture phase to intercept before Webflow's native handler
    this.formEl.addEventListener("submit", this._handleSubmit, true);

    // Webflow does not dispatch custom events — it toggles display on the
    // .w-form-done / .w-form-fail sibling divs.  Watch for style changes
    // with a MutationObserver so we reliably detect success/failure.
    if (this.successEl) {
      this._successObserver = new MutationObserver(function () {
        if (self.successEl.style.display === "block") {
          self._onSuccess(new CustomEvent("w-form-success"));
        }
      });
      this._successObserver.observe(this.successEl, {
        attributes: true,
        attributeFilter: ["style"]
      });
    }

    if (this.errorEl) {
      this._failObserver = new MutationObserver(function () {
        if (self.errorEl.style.display === "block") {
          self._onFail(new CustomEvent("w-form-fail"));
        }
      });
      this._failObserver.observe(this.errorEl, {
        attributes: true,
        attributeFilter: ["style"]
      });
    }
  };

  FormInstance.prototype.destroy = function () {
    if (this.formEl && this._handleSubmit) {
      this.formEl.removeEventListener("submit", this._handleSubmit, true);
    }
    if (this._successObserver) {
      this._successObserver.disconnect();
      this._successObserver = null;
    }
    if (this._failObserver) {
      this._failObserver.disconnect();
      this._failObserver = null;
    }
    this._submitListeners.clear();
    this._successListeners.clear();
    this._errorListeners.clear();
    this._validators.clear();
  };

  // --- Values API ---

  FormInstance.prototype.getValues = function () {
    var values = {};
    this.inputs.forEach(function (field) {
      var name = field.name;
      if (!name) return;

      var tag = field.tagName.toLowerCase();
      var type = (field.type || "").toLowerCase();

      if (type === "radio") {
        if (!field.checked) return;
        values[name] = field.value;
        return;
      }

      if (type === "checkbox") {
        if (!field.checked) return;
        if (!Array.isArray(values[name])) {
          values[name] = [];
        }
        values[name].push(field.value);
        return;
      }

      if (tag === "select" && field.multiple) {
        var selected = [];
        for (var i = 0; i < field.options.length; i++) {
          var opt = field.options[i];
          if (opt.selected) selected.push(opt.value);
        }
        values[name] = selected;
        return;
      }

      values[name] = field.value;
    });
    return values;
  };

  FormInstance.prototype.setValues = function (obj) {
    if (!obj || typeof obj !== "object") return;
    for (var name in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, name)) continue;
      var value = obj[name];
      var fields = this._fieldsByName[name];
      if (!fields || !fields.length) continue;

      var isArray = Array.isArray(value);
      fields.forEach(function (field) {
        var tag = field.tagName.toLowerCase();
        var type = (field.type || "").toLowerCase();

        if (type === "radio") {
          field.checked = field.value == value;
          return;
        }

        if (type === "checkbox") {
          if (isArray) {
            field.checked = value.indexOf(field.value) !== -1;
          } else {
            field.checked = !!value;
          }
          return;
        }

        if (tag === "select" && field.multiple && isArray) {
          for (var i = 0; i < field.options.length; i++) {
            var opt = field.options[i];
            opt.selected = value.indexOf(opt.value) !== -1;
          }
          return;
        }

        field.value = value;
      });
    }
  };

  FormInstance.prototype.getField = function (name) {
    var list = this._fieldsByName[name];
    return list && list.length ? list[0] : null;
  };

  FormInstance.prototype.getFields = function (name) {
    var list = this._fieldsByName[name];
    return list ? list.slice() : [];
  };

  // --- Submission API ---

  FormInstance.prototype.submit = function (options) {
    options = options || {};
    var bypassValidation = options.bypassValidation === true;

    if (!bypassValidation) {
      // Trigger normal submit so our handler + browser validation run
      if (typeof this.formEl.requestSubmit === "function") {
        this.formEl.requestSubmit();
      } else {
        var evt = new Event("submit", { bubbles: true, cancelable: true });
        this.formEl.dispatchEvent(evt);
      }
    } else {
      // Force native submit, skipping our validators
      this.formEl.submit();
    }
  };

  // --- Hooks / events ---

  FormInstance.prototype.onSubmit = function (callback) {
    if (typeof callback !== "function") return function () {};
    this._submitListeners.add(callback);
    var self = this;
    return function () {
      self._submitListeners.delete(callback);
    };
  };

  FormInstance.prototype.onSuccess = function (callback) {
    if (typeof callback !== "function") return function () {};
    this._successListeners.add(callback);
    var self = this;
    return function () {
      self._successListeners.delete(callback);
    };
  };

  FormInstance.prototype.onError = function (callback) {
    if (typeof callback !== "function") return function () {};
    this._errorListeners.add(callback);
    var self = this;
    return function () {
      self._errorListeners.delete(callback);
    };
  };

  // --- Validators ---

  // Per-form validator
  FormInstance.prototype.addValidator = function (fn) {
    if (typeof fn !== "function") return function () {};
    this._validators.add(fn);
    var self = this;
    return function () {
      self._validators.delete(fn);
    };
  };

  // Internal: run validators and show error if needed
  FormInstance.prototype._runValidators = function (ctx) {
    var sets = [this._validators, globalValidators];

    for (var s = 0; s < sets.length; s++) {
      var set = sets[s];
      var iter = set.values();
      var next = iter.next();
      while (!next.done) {
        var fn = next.value;
        var res;
        try {
          res = fn(ctx);
        } catch (err) {
          console.error("[WebflowUI.form] validator error", err);
          res = true;
        }

        if (res === undefined || res === true) {
          next = iter.next();
          continue;
        }

        var message = null;
        var field = null;
        if (typeof res === "string") {
          message = res;
        } else if (res && typeof res === "object") {
          message = res.message || null;
          field = res.field || null;
        }

        this._showValidationError(message, field);
        return false;
      }
    }
    return true;
  };

  FormInstance.prototype._showValidationError = function (message, field) {
    if (field && field.classList) {
      field.classList.add("wf-api-invalid");
    }

    if (this.errorEl) {
      if (this.errorSlotEl) {
        if (message != null) {
          this.errorSlotEl.textContent = String(message);
        } else {
          this.errorSlotEl.innerHTML = this._defaultErrorHTML || "";
        }
      }
      this.errorEl.style.display = "block";
    }
  };

  FormInstance.prototype.showError = function (message) {
    if (this.errorEl) {
      if (this.errorSlotEl && message) {
        this.errorSlotEl.textContent = String(message);
      }
      this.errorEl.style.display = "block";
    }
    if (this.successEl) {
      this.successEl.style.display = "none";
    }
  };

  FormInstance.prototype.showSuccess = function (message) {
    if (this.formEl) {
      this.formEl.style.display = "none";
    }
    if (this.errorEl) {
      this.errorEl.style.display = "none";
    }
    if (this.successEl) {
      if (message != null) {
        this.successEl.textContent = String(message);
      }
      this.successEl.style.display = "block";
    }
  };

  FormInstance.prototype.hideError = function () {
    if (this.errorEl) {
      this.errorEl.style.display = "none";
      if (this.errorSlotEl && this._defaultErrorHTML) {
        this.errorSlotEl.innerHTML = this._defaultErrorHTML;
      }
    }
  };

  FormInstance.prototype.reset = function () {
    if (this.formEl) {
      this.formEl.reset();
      this.formEl.style.display = "block";
    }
    this.hideError();
    if (this.successEl) {
      this.successEl.style.display = "none";
    }
  };

  // --- Internal event handlers ---

  FormInstance.prototype._onSubmit = function (event) {
    // Custom action forms always block Webflow's native submission
    if (this.action === "custom") {
      event.preventDefault();
    }

    var ctx = {
      event: event,
      form: this.formEl,
      instance: this,
      values: this.getValues()
    };

    var valid = this._runValidators(ctx);
    if (!valid) {
      // Full event blocking to prevent Webflow's native submission
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    this._submitListeners.forEach(function (cb) {
      try {
        cb(ctx);
      } catch (err) {
        console.error("[WebflowUI.form] onSubmit callback error", err);
      }
    });

    // If anything prevented default (custom action, validator, or onSubmit
    // listener), block Webflow's native handler from firing.
    if (event.defaultPrevented) {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  };

  FormInstance.prototype._onSuccess = function (event) {
    var ctx = {
      event: event,
      form: this.formEl,
      instance: this,
      values: this.getValues()
    };
    this._successListeners.forEach(function (cb) {
      try {
        cb(ctx);
      } catch (err) {
        console.error("[WebflowUI.form] onSuccess callback error", err);
      }
    });
  };

  FormInstance.prototype._onFail = function (event) {
    var ctx = {
      event: event,
      form: this.formEl,
      instance: this,
      values: this.getValues()
    };
    this._errorListeners.forEach(function (cb) {
      try {
        cb(ctx);
      } catch (err) {
        console.error("[WebflowUI.form] onError callback error", err);
      }
    });
  };

  // --- Root detection + registration ---

  function isFormRoot(el) {
    var explicitType = el.getAttribute(TYPE_ATTR);
    if (explicitType === TYPE_FORM) return true;
    if (!explicitType && el.classList.contains(WF_FORM_CLASS)) return true;
    return false;
  }

  var reg = core.createRegistry(FormInstance, function (inst) {
    return !!inst.formEl;
  });

  core.registerComponent({
    type: TYPE_FORM,
    isMatch: isFormRoot,
    createInstance: reg.createInstance
  });

  window.WebflowUI.form = {
    all: function () {
      return reg.all();
    },
    get: function (target) {
      return reg.getInstance(target);
    },
    destroy: function (target) {
      return reg.destroy(target);
    },
    getValues: function (target) {
      var inst = reg.getInstance(target);
      return inst ? inst.getValues() : {};
    },
    setValues: function (target, values) {
      var inst = reg.getInstance(target);
      if (inst) inst.setValues(values);
    },
    submit: function (target, options) {
      var inst = reg.getInstance(target);
      if (inst) inst.submit(options);
    },
    onSubmit: function (target, callback) {
      var inst = reg.getInstance(target);
      if (!inst) {
        console.warn("[WebflowUI.form] No instance found for", target);
        return function () {};
      }
      return inst.onSubmit(callback);
    },
    onSuccess: function (target, callback) {
      var inst = reg.getInstance(target);
      if (!inst) {
        console.warn("[WebflowUI.form] No instance found for", target);
        return function () {};
      }
      return inst.onSuccess(callback);
    },
    onError: function (target, callback) {
      var inst = reg.getInstance(target);
      if (!inst) {
        console.warn("[WebflowUI.form] No instance found for", target);
        return function () {};
      }
      return inst.onError(callback);
    },
    addValidator: function (target, fn) {
      var inst = reg.getInstance(target);
      if (!inst) {
        console.warn("[WebflowUI.form] No instance found for", target);
        return function () {};
      }
      return inst.addValidator(fn);
    },
    registerValidator: function (fn) {
      if (typeof fn !== "function") return function () {};
      globalValidators.add(fn);
      return function () {
        globalValidators.delete(fn);
      };
    },
    getField: function (target, name) {
      var inst = reg.getInstance(target);
      return inst ? inst.getField(name) : null;
    },
    getFields: function (target, name) {
      var inst = reg.getInstance(target);
      return inst ? inst.getFields(name) : [];
    },
    showSuccess: function (target, message) {
      var inst = reg.getInstance(target);
      if (inst) inst.showSuccess(message);
    },
    showError: function (target, message) {
      var inst = reg.getInstance(target);
      if (inst) inst.showError(message);
    },
    hideError: function (target) {
      var inst = reg.getInstance(target);
      if (inst) inst.hideError();
    },
    reset: function (target) {
      var inst = reg.getInstance(target);
      if (inst) inst.reset();
    },
    refresh: function () {
      core.scan();
    }
  };
})();
/**
 * WebflowUI.gate
 * - Generic content gating with localStorage persistence
 * - Integrates with WebflowUI.form for validation
 * - Fully attribute-driven, no hardcoded selectors or validators
 *
 * Attributes:
 *   data-wf-gate              - Marks element as gate root
 *   data-wf-api-name          - Gate identifier (also used for storage key)
 *   data-wf-gate-key          - Custom localStorage key (optional)
 *   data-wf-gate-overlay      - Element to hide when unlocked
 *   data-wf-gate-form         - Form wrapper element (optional, auto-detects .w-form)
 *   data-wf-gate-input        - Input name to validate (optional)
 *   data-wf-gate-validator    - Validator name to use (optional)
 *   data-wf-gate-unlock-on    - When to unlock: "success" (default, after Webflow success) or "submit" (immediate, blocks Webflow submission)
 */
(function () {
  if (window.WebflowUI.gate) return;

  var core = window.WebflowUI._core;
  var NAME_ATTR = core.NAME_ATTR;
  var TYPE_ATTR = core.TYPE_ATTR;
  var TYPE_GATE = "gate";

  var STORAGE_KEY_PREFIX = "wf-gate-access-";
  var UNLOCKED_CLASS = "wf-gate-unlocked";
  var LOCKED_CLASS = "wf-gate-locked";

  var validators = {};

  function GateInstance(root) {
    this.root = root;
    this.name = root.getAttribute(NAME_ATTR) || null;
    this.storageKey =
      root.getAttribute("data-wf-gate-key") ||
      STORAGE_KEY_PREFIX + (this.name || "default");
    this.overlayEl = root.querySelector("[data-wf-gate-overlay]");
    this.formWrapperEl =
      root.querySelector("[data-wf-gate-form]") ||
      (this.overlayEl ? this.overlayEl.querySelector(".w-form") : null);
    this.inputName = root.getAttribute("data-wf-gate-input") || null;
    this.validatorName = root.getAttribute("data-wf-gate-validator") || null;
    this.unlockOn =
      (root.getAttribute("data-wf-gate-unlock-on") || "success").toLowerCase();
    this._listeners = new Set();
    this._formInstance = null;
    this._unsubscribeValidator = null;
    this._unsubscribeSuccess = null;

    if (!this.overlayEl) {
      console.warn("[WebflowUI.gate] No [data-wf-gate-overlay] found for", root);
      return;
    }

    this._init();
  }

  GateInstance.prototype._init = function () {
    this.root.classList.add(LOCKED_CLASS);
    this.root.classList.remove(UNLOCKED_CLASS);

    if (this._hasStoredAccess()) {
      this._unlock(false);
      return;
    }

    this._hookForm();
  };

  GateInstance.prototype._hookForm = function () {
    var self = this;

    if (!this.formWrapperEl) return;

    if (!this.formWrapperEl.hasAttribute(NAME_ATTR)) {
      var formName = (this.name || "gate") + "-form";
      this.formWrapperEl.setAttribute(NAME_ATTR, formName);
    }

    // Synchronous scan ensures the form instance is created immediately
    core.scan();

    var formInst = window.WebflowUI.form.get(this.formWrapperEl);
    if (formInst) {
      this._formInstance = formInst;
      this._attachValidator();
      this._attachUnlockOnSuccess();
      return;
    }

    // Single rAF fallback in case scan ran before form module registered
    requestAnimationFrame(function () {
      var formInst = window.WebflowUI.form.get(self.formWrapperEl);
      if (formInst) {
        self._formInstance = formInst;
        self._attachValidator();
        self._attachUnlockOnSuccess();
      }
    });
  };

  GateInstance.prototype._attachUnlockOnSuccess = function () {
    var self = this;
    if (!this._formInstance) return;
    if (this.unlockOn !== "success") return;
    if (this._unsubscribeSuccess) return;

    this._unsubscribeSuccess = this._formInstance.onSuccess(function () {
      self._grantAccess();
    });
  };

  GateInstance.prototype._attachValidator = function () {
    var self = this;

    this._unsubscribeValidator = this._formInstance.addValidator(function (ctx) {
      // If already unlocked, skip gate validation and allow normal form submission
      if (self.isUnlocked()) {
        return true;
      }

      // If no validator specified, just grant access on submit
      if (!self.validatorName) {
        ctx.event.preventDefault();
        self._grantAccess();
        return true;
      }

      var validator = validators[self.validatorName];
      if (!validator) {
        console.warn("[WebflowUI.gate] Validator not found:", self.validatorName);
        ctx.event.preventDefault();
        self._grantAccess();
        return true;
      }

      var value = self.inputName ? ctx.values[self.inputName] || "" : null;
      var result = validator(value, ctx.values, self);

      if (result !== true) {
        return {
          message: typeof result === "string" ? result : "Invalid input",
          field: self.inputName
            ? ctx.form.querySelector('[name="' + self.inputName + '"]')
            : null
        };
      }

      // Valid input:
      // - If unlockOn="submit": unlock immediately and block Webflow submission
      // - If unlockOn="success": allow Webflow submission, unlock only on w-form-success
      if (self.unlockOn === "submit") {
        ctx.event.preventDefault();
        self._grantAccess();
      }

      return true;
    });
  };

  GateInstance.prototype._hasStoredAccess = function () {
    try {
      return localStorage.getItem(this.storageKey) === "true";
    } catch (e) {
      return false;
    }
  };

  GateInstance.prototype._storeAccess = function () {
    try {
      localStorage.setItem(this.storageKey, "true");
    } catch (e) {
      console.warn("[WebflowUI.gate] localStorage unavailable", e);
    }
  };

  GateInstance.prototype._grantAccess = function () {
    this._storeAccess();
    this._unlock(true);
  };

  GateInstance.prototype._unlock = function (emit) {
    this.root.classList.remove(LOCKED_CLASS);
    this.root.classList.add(UNLOCKED_CLASS);

    if (this.overlayEl) {
      this.overlayEl.style.display = "none";
      this.overlayEl.setAttribute("aria-hidden", "true");
    }

    if (emit !== false) {
      this._emitChange(true);
    }
  };

  GateInstance.prototype.isUnlocked = function () {
    return (
      this._hasStoredAccess() || this.root.classList.contains(UNLOCKED_CLASS)
    );
  };

  GateInstance.prototype.unlock = function () {
    this._grantAccess();
  };

  GateInstance.prototype.lock = function () {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {}

    this.root.classList.add(LOCKED_CLASS);
    this.root.classList.remove(UNLOCKED_CLASS);

    if (this.overlayEl) {
      this.overlayEl.style.display = "";
      this.overlayEl.removeAttribute("aria-hidden");
    }

    this._emitChange(false);
  };

  GateInstance.prototype.onChange = function (callback) {
    if (typeof callback !== "function") return function () {};
    this._listeners.add(callback);
    var self = this;
    return function () {
      self._listeners.delete(callback);
    };
  };

  GateInstance.prototype.destroy = function () {
    if (this._unsubscribeValidator) {
      this._unsubscribeValidator();
      this._unsubscribeValidator = null;
    }
    if (this._unsubscribeSuccess) {
      this._unsubscribeSuccess();
      this._unsubscribeSuccess = null;
    }
    this._listeners.clear();
  };

  GateInstance.prototype._emitChange = function (unlocked) {
    var self = this;
    this._listeners.forEach(function (cb) {
      try {
        cb(unlocked, self);
      } catch (err) {
        console.error("[WebflowUI.gate] onChange callback error", err);
      }
    });
  };

  function isGateRoot(el) {
    var explicitType = el.getAttribute(TYPE_ATTR);
    if (explicitType === TYPE_GATE || explicitType === "gate") return true;
    if (el.hasAttribute("data-wf-gate")) return true;
    return false;
  }

  var reg = core.createRegistry(GateInstance, function (inst) {
    return !!inst.overlayEl;
  });

  core.registerComponent({
    type: TYPE_GATE,
    isMatch: isGateRoot,
    createInstance: reg.createInstance
  });

  window.WebflowUI.gate = {
    all: function () {
      return reg.all();
    },
    get: function (target) {
      return reg.getInstance(target);
    },
    destroy: function (target) {
      return reg.destroy(target);
    },
    isUnlocked: function (target) {
      var inst = reg.getInstance(target);
      return inst ? inst.isUnlocked() : false;
    },
    unlock: function (target) {
      var inst = reg.getInstance(target);
      if (inst) inst.unlock();
    },
    lock: function (target) {
      var inst = reg.getInstance(target);
      if (inst) inst.lock();
    },
    onChange: function (target, callback) {
      var inst = reg.getInstance(target);
      if (!inst) {
        console.warn("[WebflowUI.gate] No instance found for", target);
        return function () {};
      }
      return inst.onChange(callback);
    },
    registerValidator: function (name, fn) {
      if (typeof fn !== "function") return;
      validators[name] = fn;
    },
    getValidator: function (name) {
      return validators[name] || null;
    },
    clearAccess: function (key) {
      try {
        localStorage.removeItem(STORAGE_KEY_PREFIX + (key || "default"));
      } catch (e) {}
    },
    refresh: function () {
      core.scan();
    }
  };
})();
