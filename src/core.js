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
