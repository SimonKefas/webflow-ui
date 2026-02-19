#!/bin/bash
# Concatenate source modules into script.js (CDN entry point)
# Order matters: core first, gate last (depends on form)
cat \
  src/core.js \
  src/dropdown.js \
  src/navbar.js \
  src/radio.js \
  src/checkbox.js \
  src/form.js \
  src/gate.js \
  > script.js

echo "Built script.js ($(wc -l < script.js | tr -d ' ') lines)"
