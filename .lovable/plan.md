

## Plan: Polish responsive design of /billing page

### Issues identified from the screenshot and code

1. **CTA text** — Lines 76, 82: "Pagar con Mercado Pago" should be just "Mercado Pago"
2. **Metric grid overflow** — The `metric-grid` CSS class uses `xl:grid-cols-4`, but inside the left column of a 2-column layout, `xl` breakpoint still renders 4 cols in a narrow container, causing cramped cards (visible in screenshot: "Proveedor" and "Estado de cobro" row looks tight)
3. **Plan cards grid** — Line 495: `md:grid-cols-2 xl:grid-cols-3` inside the left column causes overflow; 3 columns never fit
4. **Plan card min-height** — `min-h-[22rem]` is excessive for the content
5. **Main layout** — Needs `overflow-hidden` to prevent horizontal scroll on resize

### Changes

**File: `src/pages/Billing.tsx`**

| Line | Change |
|------|--------|
| 76 | `cta: "Pagar con Mercado Pago"` → `cta: "Mercado Pago"` |
| 82 | `cta: "Pagar con Mercado Pago"` → `cta: "Mercado Pago"` |
| 402 | Add `overflow-hidden` to main element |
| 432 | Change `metric-grid` to `metric-grid` + override: `grid gap-3 grid-cols-2 lg:grid-cols-2` (cap at 2 cols since it's inside a constrained column) |
| 495 | `md:grid-cols-2 xl:grid-cols-3` → `sm:grid-cols-3` (3 plan cards side by side only on wider screens, otherwise stack) |
| 503 | `min-h-[22rem]` → `min-h-0` (remove forced height, let content dictate) |

**File: `src/index.css`** (line 318)

| Change |
|--------|
| `metric-grid`: change `xl:grid-cols-4` to `lg:grid-cols-4` so it adapts better, but this is a global class — instead, override inline in Billing only |

Actually, keep CSS global unchanged. Override only in Billing via inline classes on line 432.

### Summary
- 6 small edits in `Billing.tsx` to fix text, grid responsiveness, and overflow

