# WebflowUI

A lightweight JavaScript API for programmatically controlling Webflow native UI components. No dependencies, works seamlessly with Webflow's built-in elements.

## Installation

Add the following script to your Webflow project's **Custom Code** section (Site Settings → Custom Code → Footer Code):

```html
<script src="https://cdn.jsdelivr.net/gh/SimonKefas/webflow-ui@latest/script.js"></script>
```

### Version Pinning (Recommended for Production)

For production sites, pin to a specific version to avoid unexpected changes:

```html
<script src="https://cdn.jsdelivr.net/gh/SimonKefas/webflow-ui@1.4.0/script.js"></script>
```

---

## Quick Start

1. Add the script to your Webflow project
2. Add `data-wf-api-name="myComponent"` to any supported Webflow element
3. Control it via JavaScript:

```javascript
// Open a dropdown
WebflowUI.dropdown.open("myDropdown");

// Get form values
const values = WebflowUI.form.getValues("contactForm");

// Listen for changes
WebflowUI.radio.onChange("planSelector", (value) => {
  console.log("Selected plan:", value);
});
```

---

## Supported Components

| Component | Webflow Class | API Namespace |
|-----------|---------------|---------------|
| Dropdown | `.w-dropdown` | `WebflowUI.dropdown` |
| Navbar | `.w-nav` | `WebflowUI.navbar` |
| Radio Group | `.w-radio` | `WebflowUI.radio` |
| Checkbox Group | `.w-checkbox` | `WebflowUI.checkbox` |
| Form | `.w-form` | `WebflowUI.form` |
| Gate | Attribute-driven | `WebflowUI.gate` |

---

## Configuration

### Required Attribute

Add `data-wf-api-name` to any element you want to control:

```html
<div class="w-dropdown" data-wf-api-name="mainMenu">
  <!-- Webflow dropdown content -->
</div>
```

### Optional Type Override

Use `data-wf-api` to explicitly set the component type (useful for custom implementations):

```html
<div data-wf-api-name="customDropdown" data-wf-api="dropdown">
  <!-- Custom dropdown structure -->
</div>
```

---

## API Reference

### Common Patterns

All components share similar patterns:

```javascript
// Get all instances
WebflowUI.{component}.all();

// Get specific instance by name (string) or element (Element)
WebflowUI.{component}.get("name");
WebflowUI.{component}.get(domElement);

// Force re-scan for dynamically added elements
WebflowUI.{component}.refresh();

// Destroy an instance (removes listeners, disconnects observers)
WebflowUI.{component}.destroy("name");
WebflowUI.{component}.destroy(domElement);
```

---

## Dropdown API

Control Webflow native dropdowns (`.w-dropdown`).

### Methods

```javascript
// Open dropdown
WebflowUI.dropdown.open("menuName");
WebflowUI.dropdown.open("menuName", { useNative: false }); // Force class-based

// Close dropdown
WebflowUI.dropdown.close("menuName");

// Toggle dropdown
WebflowUI.dropdown.toggle("menuName");

// Check state
const isOpen = WebflowUI.dropdown.isOpen("menuName");

// Listen for changes
const unsubscribe = WebflowUI.dropdown.onChange("menuName", (isOpen, instance) => {
  console.log("Dropdown is now:", isOpen ? "open" : "closed");
});

// Stop listening
unsubscribe();

// Get all dropdown instances
const allDropdowns = WebflowUI.dropdown.all();

// Get specific instance
const instance = WebflowUI.dropdown.get("menuName");

// Destroy instance (disconnects observer, removes listeners)
WebflowUI.dropdown.destroy("menuName");
```

### Instance Properties

```javascript
const dropdown = WebflowUI.dropdown.get("menuName");

dropdown.root      // The root .w-dropdown element
dropdown.name      // The data-wf-api-name value
dropdown.toggleEl  // The .w-dropdown-toggle element
dropdown.listEl    // The .w-dropdown-list element
```

### CSS Classes

The library automatically adds/removes:
- `wf-api-open` — Added to root when dropdown is open

---

## Navbar API

Control Webflow native navbars (`.w-nav`) — particularly the mobile menu.

### Methods

```javascript
// Open mobile menu
WebflowUI.navbar.open("mainNav");

// Close mobile menu
WebflowUI.navbar.close("mainNav");

// Toggle mobile menu
WebflowUI.navbar.toggle("mainNav");

// Check state
const isOpen = WebflowUI.navbar.isOpen("mainNav");

// Listen for changes
const unsubscribe = WebflowUI.navbar.onChange("mainNav", (isOpen, instance) => {
  console.log("Menu is now:", isOpen ? "open" : "closed");
});
```

### Instance Properties

```javascript
const navbar = WebflowUI.navbar.get("mainNav");

navbar.root     // The root .w-nav element
navbar.name     // The data-wf-api-name value
navbar.buttonEl // The .w-nav-button (hamburger) element
navbar.menuEl   // The .w-nav-menu element
```

### CSS Classes

- `wf-api-open` — Added to root when menu is open

---

## Radio Group API

Control groups of Webflow radio buttons.

### Setup

Wrap your radio buttons in a container with `data-wf-api-name`:

```html
<div data-wf-api-name="planSelector">
  <label class="w-radio">
    <input type="radio" name="plan" value="basic">
    <span class="w-form-label">Basic</span>
  </label>
  <label class="w-radio">
    <input type="radio" name="plan" value="pro">
    <span class="w-form-label">Pro</span>
  </label>
</div>
```

### Methods

```javascript
// Get selected value
const value = WebflowUI.radio.getValue("planSelector");
// Returns: "basic", "pro", or null

// Set value
WebflowUI.radio.setValue("planSelector", "pro");
WebflowUI.radio.setValue("planSelector", "pro", { useNative: false }); // Skip click simulation

// Clear selection
WebflowUI.radio.clear("planSelector");

// Listen for changes
const unsubscribe = WebflowUI.radio.onChange("planSelector", (value, instance) => {
  console.log("Selected:", value);
});
```

### CSS Classes

- `wf-api-has-value` — Added to root when a radio is selected

---

## Checkbox Group API

Control groups of Webflow checkboxes.

### Setup

Wrap your checkboxes in a container with `data-wf-api-name`:

```html
<div data-wf-api-name="features">
  <label class="w-checkbox">
    <input type="checkbox" name="features" value="dark-mode">
    <span class="w-form-label">Dark Mode</span>
  </label>
  <label class="w-checkbox">
    <input type="checkbox" name="features" value="notifications">
    <span class="w-form-label">Notifications</span>
  </label>
</div>
```

### Methods

```javascript
// Get all checked values
const values = WebflowUI.checkbox.getValues("features");
// Returns: ["dark-mode", "notifications"] or []

// Set values (checks matching, unchecks others)
WebflowUI.checkbox.setValues("features", ["dark-mode"]);
WebflowUI.checkbox.setValues("features", ["dark-mode", "notifications"]);

// Clear all
WebflowUI.checkbox.clear("features");

// Listen for changes
const unsubscribe = WebflowUI.checkbox.onChange("features", (values, instance) => {
  console.log("Checked:", values);
});
```

### CSS Classes

- `wf-api-has-value` — Added to root when at least one checkbox is checked

---

## Form API

Control Webflow native forms (`.w-form`) with validation, value management, and event hooks.

### Setup

```html
<div class="w-form" data-wf-api-name="contactForm">
  <form>
    <input type="text" name="email" placeholder="Email">
    <input type="text" name="name" placeholder="Name">
    <button type="submit">Submit</button>
  </form>
  <div class="w-form-done">Thanks!</div>
  <div class="w-form-fail">
    <span data-wf-error-slot>Something went wrong.</span>
  </div>
</div>
```

### Methods

```javascript
// Get all form values
const values = WebflowUI.form.getValues("contactForm");
// Returns: { email: "user@example.com", name: "John" }

// Set form values
WebflowUI.form.setValues("contactForm", {
  email: "new@example.com",
  name: "Jane"
});

// Get specific field element
const emailField = WebflowUI.form.getField("contactForm", "email");

// Get all fields with a name (for radio/checkbox groups)
const planFields = WebflowUI.form.getFields("contactForm", "plan");

// Programmatic submit
WebflowUI.form.submit("contactForm");
WebflowUI.form.submit("contactForm", { bypassValidation: true }); // Skip validators

// Show custom error message
WebflowUI.form.showError("contactForm", "Custom error message");

// Hide error message
WebflowUI.form.hideError("contactForm");

// Reset form (clears values and hides error/success)
WebflowUI.form.reset("contactForm");
```

### Event Hooks

```javascript
// Before submit (after validation passes)
const unsubscribe = WebflowUI.form.onSubmit("contactForm", (ctx) => {
  console.log("Submitting:", ctx.values);
});

// After successful submission
WebflowUI.form.onSuccess("contactForm", (ctx) => {
  console.log("Success!", ctx.values);
  // Redirect, show message, etc.
});

// After failed submission
WebflowUI.form.onError("contactForm", (ctx) => {
  console.error("Form submission failed");
});
```

### Custom Validation

```javascript
// Add validator to specific form
const removeValidator = WebflowUI.form.addValidator("contactForm", (ctx) => {
  if (!ctx.values.email.includes("@")) {
    return "Please enter a valid email"; // String = error message
  }
  
  if (ctx.values.name.length < 2) {
    return {
      message: "Name must be at least 2 characters",
      field: ctx.instance.getField("name") // Highlights field
    };
  }
  
  return true; // Valid
});

// Remove validator later
removeValidator();

// Global validator (applies to ALL forms)
const removeGlobal = WebflowUI.form.registerValidator((ctx) => {
  // Block certain email domains
  if (ctx.values.email && ctx.values.email.endsWith("@spam.com")) {
    return "This email domain is not allowed";
  }
  return true;
});
```

### Custom Error Messages

Validator error messages are automatically displayed inside the `.w-form-fail` block. The system auto-detects the text element using this fallback chain:

1. An element with `data-wf-error-slot` (explicit target)
2. The first child element of `.w-form-fail`
3. The `.w-form-fail` element itself

This means standard Webflow forms work out of the box with no extra attributes:

```html
<div class="w-form-fail">
  <div>Default error message</div>  <!-- automatically used as error slot -->
</div>
```

For explicit control, use `data-wf-error-slot`:

```html
<div class="w-form-fail">
  <span data-wf-error-slot>Default error message</span>
</div>
```

When a validator returns a message, it replaces the slot content. When the error clears, the original text is restored.

### Custom Action Forms

Use `data-wf-api-action="custom"` to fully bypass Webflow's native form submission. This is ideal for forms that call your own API endpoints, perform client-side actions, or redirect the user.

```html
<div class="w-form" data-wf-api-name="searchForm" data-wf-api-action="custom">
  <form>
    <input type="text" name="query" placeholder="Search...">
    <button type="submit">Go</button>
  </form>
  <div class="w-form-done">Success!</div>
  <div class="w-form-fail"><span data-wf-error-slot>Error</span></div>
</div>
```

```javascript
WebflowUI.form.onSubmit("searchForm", function(ctx) {
  fetch("/api/search", { method: "POST", body: JSON.stringify(ctx.values) })
    .then(function(res) { return res.json(); })
    .then(function(data) { ctx.instance.showSuccess("Done!"); })
    .catch(function(err) { ctx.instance.showError("Something went wrong"); });
});
```

**`showSuccess(message)`** — hides the form and error block, shows the `.w-form-done` block. If a `message` is provided, it replaces the success block content.

```javascript
// Via public API
WebflowUI.form.showSuccess("searchForm", "Results loaded!");

// Via instance
ctx.instance.showSuccess("Results loaded!");
```

### Blocking Webflow Submission from Listeners

Even without `data-wf-api-action`, `onSubmit` listeners can call `ctx.event.preventDefault()` to block Webflow's native submission on a per-submit basis:

```javascript
WebflowUI.form.onSubmit("contactForm", function(ctx) {
  if (someCondition) {
    ctx.event.preventDefault(); // Blocks Webflow for this submission
    doCustomAction(ctx.values);
  }
  // Otherwise, Webflow handles the submission normally
});
```

### CSS Classes

- `wf-api-invalid` — Added to fields that fail validation

---

## Gate API

Content gating with localStorage persistence. Perfect for protecting content behind forms, validating access codes, or creating paywalls.

### Setup

```html
<div data-wf-api-name="contentGate" data-wf-gate>
  <!-- Overlay with form (hidden when unlocked) -->
  <div data-wf-gate-overlay>
    <div class="w-form" data-wf-gate-form>
      <form>
        <input type="text" name="accessCode" placeholder="Enter code">
        <button type="submit">Unlock</button>
      </form>
      <div class="w-form-done">Access granted!</div>
      <div class="w-form-fail">
        <span data-wf-error-slot>Invalid code</span>
      </div>
    </div>
  </div>
  
  <!-- Protected content (visible when unlocked) -->
  <div class="protected-content">
    <h1>Premium Content</h1>
    <p>This is only visible after unlocking.</p>
  </div>
</div>
```

### Attributes

- `data-wf-gate` — Marks element as gate root
- `data-wf-api-name` — Gate identifier (also used for localStorage key)
- `data-wf-gate-key` — Custom localStorage key (optional)
- `data-wf-gate-overlay` — Element to hide when unlocked
- `data-wf-gate-form` — Form wrapper (optional, auto-detects `.w-form`)
- `data-wf-gate-input` — Input name to validate (optional)
- `data-wf-gate-validator` — Validator name to use (optional)
- `data-wf-gate-unlock-on` — When to unlock: `"success"` (default) waits for Webflow submission to succeed, `"submit"` unlocks immediately and blocks Webflow submission

### Methods

```javascript
// Check if unlocked
const unlocked = WebflowUI.gate.isUnlocked("contentGate");

// Manually unlock
WebflowUI.gate.unlock("contentGate");

// Lock again (removes localStorage entry)
WebflowUI.gate.lock("contentGate");

// Listen for unlock/lock changes
const unsubscribe = WebflowUI.gate.onChange("contentGate", (isUnlocked, instance) => {
  console.log("Gate is now:", isUnlocked ? "unlocked" : "locked");
});

// Clear stored access for a specific key
WebflowUI.gate.clearAccess("contentGate");
```

### Custom Validators

Register validators to control access logic:

```javascript
// Register a validator
WebflowUI.gate.registerValidator("accessCode", function (value, allValues, gateInstance) {
  // Return true to grant access
  if (value === "SECRET123") {
    return true;
  }
  
  // Return string for custom error message
  return "Invalid access code";
});
```

Then reference it in HTML:

```html
<div 
  data-wf-api-name="contentGate" 
  data-wf-gate
  data-wf-gate-input="accessCode"
  data-wf-gate-validator="accessCode"
>
  <!-- ... -->
</div>
```

### No Validator (Simple Unlock)

If you omit `data-wf-gate-validator`, the gate unlocks on any form submission:

```html
<div data-wf-api-name="emailGate" data-wf-gate>
  <div data-wf-gate-overlay>
    <!-- Any form submission unlocks -->
    <div class="w-form">
      <form>
        <input type="email" name="email" placeholder="Enter email">
        <button type="submit">Continue</button>
      </form>
    </div>
  </div>
  <div class="content">Protected content here</div>
</div>
```

### CSS Classes

- `wf-gate-locked` — Added to root when locked
- `wf-gate-unlocked` — Added to root when unlocked

### Instance Properties

```javascript
const gate = WebflowUI.gate.get("contentGate");

gate.root           // The root element
gate.name           // The data-wf-api-name value
gate.overlayEl      // The overlay element
gate.formWrapperEl  // The form wrapper
gate.storageKey     // localStorage key used
```

---

## Advanced Usage

### Dynamic Elements

WebflowUI automatically detects new elements added to the DOM. If you need to manually trigger a scan:

```javascript
WebflowUI.dropdown.refresh();
WebflowUI.form.refresh();
// etc.
```

### Working with Instances Directly

```javascript
const dropdown = WebflowUI.dropdown.get("menuName");

// Access instance methods directly
dropdown.open();
dropdown.close();
dropdown.toggle();
dropdown.isOpen();
dropdown.onChange((isOpen) => { /* ... */ });
```

### Using Element References

You can pass DOM elements instead of names:

```javascript
const element = document.querySelector(".my-dropdown");
WebflowUI.dropdown.open(element);

const isOpen = WebflowUI.dropdown.isOpen(element);
```

### Native vs Forced Behavior

By default, the API uses Webflow's native behaviors (click simulation, jQuery events). You can bypass this:

```javascript
// Force class-based toggle (no click simulation)
WebflowUI.dropdown.open("menu", { useNative: false });
WebflowUI.navbar.close("nav", { useNative: false });
```

---

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- No IE11 support (uses ES6 features like `Map`, `Set`, arrow functions)

---

## Troubleshooting

### Component not found

Make sure:
1. The element has `data-wf-api-name` attribute
2. The element has the correct Webflow class (e.g., `.w-dropdown`)
3. The script is loaded before your custom code runs

### Changes not detected

If you're adding elements dynamically after page load, call `.refresh()`:

```javascript
WebflowUI.dropdown.refresh();
```

### Conflicts with Webflow

If native Webflow behavior conflicts with the API:

```javascript
// Use forced mode
WebflowUI.dropdown.open("menu", { useNative: false });
```

---

## License

MIT License - Free for personal and commercial use.

---

## Contributing

Issues and pull requests welcome at [GitHub](https://github.com/SimonKefas/webflow-ui).

