

# Pasos 5 y 6: Seed de Escuelas PBA + Auth UI + Dashboard

## Paso 5: Seed de Escuelas PBA

Migración SQL que inserta escuelas representativas de Provincia de Buenos Aires en la tabla `schools`:
- ~20 escuelas de distintos distritos (La Plata, Quilmes, Avellaneda, San Isidro, etc.)
- Mix de tipos COMUN y TECNICA
- Todas con `user_created = false` y `created_by = NULL` (oficiales, no editables por docentes)

## Paso 6: Auth UI + Protección de Rutas + Dashboard

### Archivos nuevos a crear

1. **`src/contexts/AuthContext.tsx`** — Context de autenticación
   - Listener `onAuthStateChange` para sesión
   - Estado de usuario, loading, y funciones login/signup/logout
   - Hook `useAuth()` para acceso desde cualquier componente

2. **`src/components/ProtectedRoute.tsx`** — Wrapper de rutas protegidas
   - Redirige a `/login` si no hay sesión
   - Muestra loading mientras verifica

3. **`src/pages/Login.tsx`** — Página de login
   - Formulario email + contraseña
   - Link a registro
   - Redirección al dashboard post-login
   - Mensaje de error en caso de credenciales incorrectas

4. **`src/pages/Register.tsx`** — Página de registro
   - Formulario con nombre, email, contraseña
   - Link a login
   - Mensaje post-registro indicando verificar email
   - El nombre se pasa como `raw_user_meta_data` para el trigger `handle_new_user`

5. **`src/pages/Dashboard.tsx`** — Dashboard del docente (Paso 7 inicial)
   - Lista de cursos activos con estado del plan (INCOMPLETE/VALIDATED)
   - Sección de cursos archivados (solo lectura)
   - Botón "Crear nuevo curso" (placeholder por ahora)
   - Nombre del usuario en header
   - Botón de logout

### Modificaciones

6. **`src/App.tsx`** — Actualizar rutas
   - Envolver todo en `AuthProvider`
   - Ruta `/login` y `/register` (públicas)
   - Ruta `/` redirige a `/dashboard` si autenticado
   - Ruta `/dashboard` protegida con `ProtectedRoute`

### Detalles Tecnicos

- Auth usa `supabase.auth.signUp()` con `options.data.name` para pasar el nombre al trigger
- Login usa `supabase.auth.signInWithPassword()`
- NO se habilita auto-confirm de email (el usuario debe verificar)
- El dashboard consulta `courses` con join a `schools` y `plans` para mostrar estado
- Se usan componentes shadcn/ui existentes (Card, Button, Input, Label, Form)
