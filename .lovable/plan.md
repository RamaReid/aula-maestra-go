Implementar exactamente este ajuste de unificación tipográfica global, sin tocar lógica ni APIs.

Archivos y cambios exactos:

1. `tailwind.config.ts`

Agregar `fontFamily` dentro de `theme.extend`:

```ts

fontFamily: {

  sans: ['"Inter"', 'system-ui', 'sans-serif'],

  serif: ['"Lora"', '"Georgia"', 'serif'],

},

```

2. `index.html`

Agregar en el `<head>`:

```html

<link rel="preconnect" href="[https://fonts.googleapis.com](https://fonts.googleapis.com)" />

<link rel="preconnect" href="[https://fonts.gstatic.com](https://fonts.gstatic.com)" crossorigin />

<link href="[https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@600;700&display=swap](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@600;700&display=swap)" rel="stylesheet" />

```

3. `src/components/ui/StepHeader.tsx`

Quitar `font-serif` del `h2`:

```tsx

- <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">

+ <h2 className="text-2xl font-semibold tracking-tight text-foreground">

```

4. `src/components/ui/EmptyState.tsx`

Quitar `font-serif` del texto principal:

```tsx

- <p className="font-serif text-2xl font-semibold tracking-tight text-foreground">

+ <p className="text-2xl font-semibold tracking-tight text-foreground">

```

5. `src/components/lesson/CopilotPanel.tsx`

Quitar `font-serif` del `h3`:

```tsx

- <h3 className="font-serif text-xl font-semibold tracking-tight text-foreground">

+ <h3 className="text-xl font-semibold tracking-tight text-foreground">

```

Conservar sin cambios:

- `src/index.css`: mantener `font-serif` en `.document-title`, `.document-section-heading` y `.editorial-prose h1-h3`.

- `src/components/ui/chart.tsx`: mantener `font-mono` para valores numéricos/tabulares.

Verificación obligatoria:

- `rg -n "font-serif" src` debe mostrar solo las 3 reglas documentales de `src/index.css`.

- `rg -n "font-mono" src` debe mostrar solo el uso técnico justificado en `chart.tsx`.

- `npm run build`

- `npm run test`

Entrega esperada:

- 5 archivos modificados.

- 0 cambios de lógica.

- Diff final + evidencia de verificación.