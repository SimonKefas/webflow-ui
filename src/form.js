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

    // If a validator/plugin intentionally prevented default (e.g. gate unlock),
    // treat the submission as "handled" and stop Webflow's native handler too.
    if (event.defaultPrevented) {
      // Ensure default is prevented (idempotent) and block any other handlers
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
