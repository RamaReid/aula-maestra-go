

# Pasos 5 y 6: Seed de Escuelas de Tandil (verificado) + Auth UI + Dashboard

## Paso 5: Seed de Escuelas de Tandil -- Fuentes oficiales

Datos cruzados entre:
- **Dataset Datos Abiertos PBA** (DGCyE, actualizado 24/02/2026): `catalogo.datos.gba.gob.ar/dataset/establecimientos-educativos`
- **Guia escuelasyjardines.com.ar** (basada en padron oficial)

### Escuelas estatales secundarias verificadas en el distrito Tandil

**EES (Escuela de Educacion Secundaria) -- tipo COMUN:**

| N.o | Nombre oficial | Localidad | Direccion |
|-----|---------------|-----------|-----------|
| 1 | EES N.o 1 | Tandil | - |
| 2 | EES N.o 2 | Tandil | 4 DE ABRIL 890 |
| 3 | EES N.o 3 | Tandil | AVDA. MARCONI E/ MONTIEL Y MORENO 1550 |
| 4 | EES N.o 6 | Tandil | AMEGHINO/QUINTANA Y VTE. LOPEZ 355 |
| 5 | EES N.o 7 | Tandil | PALACIOS E/ UGALDE Y DARREGUEIRA 1597 |
| 6 | EES N.o 8 | Tandil | DANTE ALIGHIERI 590 |
| 7 | EES N.o 9 | Tandil | 11 DE SETIEMBRE E/ URIBURU Y ARANA 1461 |
| 8 | EES N.o 10 "Gral. Jose de San Martin" | Tandil | AV. SANTAMARINA 851 |
| 9 | EES N.o 11 "Centro Polivalente de Arte" | Tandil | LEANDRO N. ALEM 474 |
| 10 | EES N.o 12 "Rene Geronimo Favaloro" | Tandil (rural) | LOS JAZMINES S/N |
| 11 | EES N.o 13 | Tandil | J.A. CABRAL 629 |
| 12 | EES N.o 14 | Tandil | COLECTORA NORTE L.MA. MACAYA 2094 |
| 13 | EES N.o 15 | Tandil | AVDA. JUAN B. JUSTO 874 |
| 14 | EES N.o 25 | Tandil | AV. RIVADAVIA 102 |

**EET (Escuela de Educacion Tecnica) -- tipo TECNICA:**

| N.o | Nombre oficial | Localidad | Direccion |
|-----|---------------|-----------|-----------|
| 1 | EET N.o 1 "VI Brigada Aerea" | Tandil | COLECTORA NORTE L.M. MACAYA 2094 |
| 2 | EET N.o 2 "Ing. Felipe Senillosa" | Tandil | L.N. ALEM 285 |
| 3 | EET N.o 3 | Tandil | H. YRIGOYEN 636 |

**EEA (Escuela de Educacion Agraria) -- tipo COMUN (no hay enum AGRARIA):**

| N.o | Nombre oficial | Localidad | Direccion |
|-----|---------------|-----------|-----------|
| 1 | EEA N.o 1 "Ing. Ramon Santamarina" | Tandil (rural) | Pje. La Portena, CC N.o 6 |

**Total: 18 escuelas estatales** (14 EES + 3 EET + 1 EEA)

Nota: No se incluye la Escuela Nacional Ernesto Sabato (UNICEN) porque es jurisdiccion nacional, no provincial.

### Migracion SQL

Se crea una migracion que inserta las 18 escuelas con:
- `district = 'Tandil'`
- `locality` segun corresponda (mayoria 'Tandil')
- `school_type` = 'COMUN' o 'TECNICA'
- `user_created = false`, `created_by = NULL`
- `source_url = 'https://catalogo.datos.gba.gob.ar/dataset/establecimientos-educativos'`

---

## Paso 6: Auth UI + Proteccion de Rutas + Dashboard

### Archivos nuevos

1. **`src/contexts/AuthContext.tsx`**
   - Listener `onAuthStateChange` para sesion
   - Estado: user, loading, profile (nombre desde tabla profiles)
   - Funciones: login, signup (con nombre en raw_user_meta_data), logout
   - Hook `useAuth()` exportado

2. **`src/components/ProtectedRoute.tsx`**
   - Si loading: spinner
   - Si no hay user: redirige a `/login`
   - Si hay user: renderiza children

3. **`src/pages/Login.tsx`**
   - Formulario email + password con componentes shadcn (Input, Label, Button, Card)
   - Mensaje de error en credenciales incorrectas
   - Link "Crear cuenta" hacia `/register`
   - Post-login: redirige a `/dashboard`

4. **`src/pages/Register.tsx`**
   - Formulario nombre + email + password
   - Usa `supabase.auth.signUp({ email, password, options: { data: { name } } })`
   - Post-registro: muestra mensaje "Revisa tu email para verificar tu cuenta"
   - Link "Ya tengo cuenta" hacia `/login`

5. **`src/pages/Dashboard.tsx`**
   - Header con nombre del usuario (desde profile) y boton logout
   - Seccion "Mis cursos activos": consulta `courses` con join a `schools` (nombre) y `plans` (status)
   - Muestra cards con materia, escuela, anio, estado del plan (INCOMPLETE/VALIDATED)
   - Seccion "Cursos archivados" colapsable (solo lectura)
   - Boton "Crear nuevo curso" (placeholder, sin funcionalidad aun)
   - Estado vacio amigable si no hay cursos

### Modificacion

6. **`src/App.tsx`**
   - Envolver en `AuthProvider`
   - Rutas publicas: `/login`, `/register`
   - Ruta `/` redirige a `/dashboard` si autenticado, a `/login` si no
   - Ruta `/dashboard` protegida con `ProtectedRoute`

### Detalles tecnicos

- Email auto-confirm deshabilitado (usuario debe verificar)
- Login: `supabase.auth.signInWithPassword()`
- Signup: pasa nombre como metadata para el trigger `handle_new_user` existente
- Dashboard query: `courses` con `schools(official_name)` y `plans(status)` via relaciones FK
- Componentes shadcn/ui usados: Card, Button, Input, Label, Separator, Badge

