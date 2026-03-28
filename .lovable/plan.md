

# Remove Number Input Spinners from Estimate Fields

## Change

Add CSS to hide the browser-default up/down arrows (spinners) on all `<input type="number">` elements within the estimate tabs.

## Technical Detail

Add a global CSS rule in `src/index.css` targeting number inputs:

```css
/* Hide number input spinners */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

This covers all number inputs across the estimate tabs (task rows, variables tab, scope fields) without touching individual components.

