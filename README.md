# Panel de OficiosOsIA

Panel interno de Miguel y Pablo, con dos piezas:

- **La oficina** (`/`). Cada proyecto es una sala y cada becario se sienta en su mesa con su avatar pixel-art. Los becarios son los agentes de IA del plugin `becarios`: cto, frontend, backend-datos, backend-servicios, qa-funcional, qa-tecnico y delivery. Lo que hace cada uno sale de las tareas de Notion: la tarea que tiene ahora (propiedad «Becario»), su fase y su estado. Si está En progreso aparece trabajando, si está En espera sale con una alerta, y si no tiene nada está libre. Desde cada sala se elige qué equipo de becarios trabaja en ese proyecto.
- **El equipo de producto** (`/#producto`). Escribes en texto plano lo que necesitas para un proyecto y trabajan tres roles, cada uno con una llamada a Claude: la **PO** escribe las historias de usuario con sus criterios de aceptación, el **PM** las prioriza, las estima y las ordena (y avisa si alguna ya existe en Notion) y el **CTO** añade el plan técnico y decide qué becario empieza. Revisas las tareas propuestas y se crean en la base «Oficios OS» de Notion, en Inbox y fase Preparación.

Siguen públicas, sin login, `/entrenos` y `/legal`: son la «Website URL» y la política de privacidad que revisan intervals.icu y Garmin.

## Cómo está hecho

Es un sitio estático en Vercel, sin paso de build, con funciones en `api/`:

| Ruta | Qué hace |
|---|---|
| `middleware.js` | Exige sesión en todo salvo `/login`, `/entrenos`, `/legal`, `/logo/` y `styles.css`. |
| `api/login.js`, `api/logout.js` | Crean y borran la cookie de sesión (`panel_sesion`, firmada con HMAC, 7 días). |
| `api/oficina.js` | Lee de Notion las tareas abiertas y los proyectos, y monta las salas (`lib/oficina.js`). |
| `api/equipos.js` | Guarda el equipo de becarios de un proyecto en la base «Proyectos» de Notion. |
| `api/equipo-producto.js` | Ejecuta un paso del equipo de producto (`po`, `pm` o `cto`) con Claude (`lib/equipo-producto.js`). |
| `api/tareas.js` | Crea en Notion las tareas revisadas (`lib/tickets.js` arma el Markdown). |

El frontend está en `site/`: `index.html` y `site/panel/` (el panel), y `login.html`. Los avatares son propios (`site/panel/sprites.js`) y no usan sprites de terceros.

## Variables de entorno en Vercel

Se configuran en Vercel → proyecto → Settings → Environment Variables, para **Production** y **Preview**. Ninguna va en el repositorio, porque es público.

| Variable | Obligatoria | Valor |
|---|---|---|
| `PANEL_USUARIOS` | Sí | Usuarios y contraseñas, separados por comas: `Miguel:<contraseña>,Pablo:<contraseña>`. |
| `SESION_SECRETO` | Sí | Texto aleatorio largo para firmar las sesiones. Se genera con `openssl rand -base64 32`. Si cambia, se cierran todas las sesiones. |
| `NOTION_TOKEN` | Para la oficina y para crear tareas | El «Internal Integration Secret» de una integración de Notion (ver abajo). |
| `ANTHROPIC_API_KEY` | Para el equipo de producto | Clave de la API de Claude (console.anthropic.com). |
| `NOTION_PROYECTOS_DS` | Para guardar equipos | Id de la fuente de datos de la base «Proyectos» (ver abajo). |
| `NOTION_TAREAS_DS` | No | Id de la base de tareas. Por defecto es «Oficios OS» (`2ad3221d-8eb7-8065-904d-000b57a0fe2a`). |

Sin `NOTION_TOKEN` el panel abre igual, con las salas vacías y un aviso. Sin `ANTHROPIC_API_KEY`, el equipo de producto avisa de que falta la clave.

## Conectar Notion

1. En notion.so/profile/integrations, crea una integración interna («Panel OficiosOsIA») con permisos para leer, actualizar e insertar contenido. Copia su secreto en `NOTION_TOKEN`.
2. Abre la base **OficiosOS** (la de las tareas) → `···` → Conexiones → añade la integración.
3. Para guardar los equipos hace falta una base **Proyectos**, compartida también con la integración, con estas propiedades:

   | Propiedad | Tipo | Para qué |
   |---|---|---|
   | Nombre | Título | Nombre de la sala. |
   | Proyecto en tareas | Texto | Texto exacto de «Proyecto relacionado» en las tareas (p. ej. `OficiosOS — Interno`). Si se deja vacío, se usa el Nombre. |
   | Becarios | Selección múltiple | cto, frontend, backend-datos, backend-servicios, qa-funcional, qa-tecnico, delivery. |
   | Repositorio | URL | Se enlaza en la sala y se da como contexto al CTO. |
   | Orden | Número | Orden de las salas. |

   Su id de fuente de datos va en `NOTION_PROYECTOS_DS`. Mientras no exista, el panel usa la lista de proyectos de `lib/becarios.js` y en cada sala muestra solo a los becarios que ya tienen tareas en ese proyecto.

## Trabajar en local

Requiere Node 20 o superior.

```bash
npm install
npm test
npm run dev
```

`npm run dev` levanta el panel en http://localhost:3000 imitando a Vercel (URLs limpias, middleware y funciones de `api/`). Lee las variables de un `.env.local`, que no se sube a Git:

```
PANEL_USUARIOS=Miguel:<contraseña>,Pablo:<contraseña>
SESION_SECRETO=un-texto-aleatorio-largo
NOTION_TOKEN=ntn_...
ANTHROPIC_API_KEY=sk-ant-...
```

## Seguridad

- Las contraseñas viven solo en Vercel (`PANEL_USUARIOS`) y nunca en el repositorio, que es público. Conviene que sean largas: cualquiera que conozca la URL puede intentar entrar.
- El panel puede crear tareas en Notion y gastar crédito de la API de Claude. Por eso todas las funciones de `api/` comprueban la sesión por su cuenta, además del middleware.

## Marca

`project/` y `chats/` son la entrega original de Claude Design: manual de marca, logotipos y combinaciones de color y tipografía. El panel usa la combinación «Turno de noche» (Sora + IBM Plex Mono, ámbar `#ffb000` sobre `#18191b`).
