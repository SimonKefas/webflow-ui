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
