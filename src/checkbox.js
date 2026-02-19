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
