

## Opciones para resolver el problema SSL con abc.gob.ar

### Diagnóstico del problema
El servidor de `abc.gob.ar` usa protocolos SSL/TLS antiguos o mal configurados que Deno (el runtime de Supabase Edge Functions) rechaza por sus estándares de seguridad estrictos. Esto causa `HandshakeFailure` en cualquier intento de conexión directa.

### Opción recomendada: Firecrawl como proxy

**Firecrawl** es un servicio de scraping que usa sus propios servidores con compatibilidad SSL más amplia. Puede actuar como intermediario para descargar los PDFs de ABC.

**Flujo propuesto:**
```text
Usuario → Edge Function → Firecrawl API → abc.gob.ar → PDF
                              ↓
                    Devuelve contenido/base64
                              ↓
              Edge Function procesa e ingesta
```

**Ventajas:**
- Firecrawl maneja la negociación SSL en sus servidores
- Puede scrapear tanto páginas índice como descargar PDFs directos
- Tiene formato `rawHtml` que permite obtener binarios

**Implementación:**
1. Conectar Firecrawl al proyecto (requiere cuenta/API key)
2. Crear edge function `firecrawl-proxy-abc` que:
   - Recibe URL de abc.gob.ar
   - Usa Firecrawl para obtener el contenido
   - Retorna el PDF en base64
3. Modificar `import-curriculum-pdf` para usar este proxy cuando la URL sea de abc.gob.ar

---

### Alternativas adicionales

| Opción | Complejidad | Costo | Viabilidad |
|--------|-------------|-------|------------|
| **Firecrawl** | Baja | Tiene plan gratuito limitado | ✅ Alta |
| **Proxy HTTP externo** | Alta | Variable | ⚠️ Requiere infraestructura propia |
| **Cloudflare Worker como proxy** | Media | Gratuito hasta límites | ⚠️ Requiere cuenta Cloudflare |
| **Mantener solo subida manual** | Ninguna | Gratis | ✅ Ya funciona |

---

### Recomendación

Si quieres automatizar la descarga desde ABC, **Firecrawl es la opción más rápida** ya que está disponible como conector en Lovable. Solo necesitas:

1. Conectar Firecrawl al proyecto
2. Implementar una función proxy (~50 líneas)
3. Actualizar el flujo de importación

¿Procedemos con Firecrawl o prefieres mantener el flujo manual actual?

