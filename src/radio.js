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
