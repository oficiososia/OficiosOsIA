# Panel de OficiosOsIA

Panel interno de Miguel y Pablo, con tres pestañas:

- **La oficina** (`/`). Cada proyecto es una sala, a pantalla completa y sin scroll, y se cambia de una a otra con pestañas. Cada becario se sienta en su mesa con su avatar pixel-art. Los becarios son los agentes de IA del plugin `becarios`: cto, frontend, backend-datos, backend-servicios, qa-funcional, qa-tecnico y delivery. Lo que hace cada uno sale de las tareas de Notion: la tarea que tiene ahora (propiedad «Becario»), su fase y su estado. Si está En progreso aparece trabajando y si está En espera sale con una alerta. Si no tiene nada en marcha, duerme en su mesa (ojos cerrados y zetas); el montón de papeles azul indica cuántas tareas tiene pendientes. Cada oficina tiene el aspecto de su proyecto: color, suelo, mesas, objetos del sector y el logo o un cartel con el nombre en la pared (`site/panel/temas.js`). Desde cada sala se elige qué equipo de becarios trabaja en ese proyecto («Equipo») y a qué becario va cada tarea por hacer («Asignar tareas»: cambia la columna «Becario» en Notion y pasa las de Inbox a «Por hacer»).
- **El equipo de producto** (`/#producto`). Escribes en texto plano lo que necesitas para un proyecto y la petición se guarda en la base «Peticiones» de Notion. Después, en Claude Code y con tu suscripción, `/producto` la pasa por tres agentes. La **PO** escribe las historias de usuario con sus criterios de aceptación. El **PM** las prioriza, las estima, las ordena y avisa si alguna ya existe en Notion. El **CTO** añade el plan técnico y decide qué becario empieza. Tú confirmas y se crean en «Oficios OS», en Inbox y fase Preparación. El panel muestra cada petición con su estado (Guardada, Pendiente, En curso, Con dudas, Hecha o Descartada). Con «Guardar para más tarde» la petición queda en `Guardada` y `/producto` no la toca hasta que se pulsa «Enviar al equipo» en la lista.
- **Tareas** (`/#tareas`). El kanban de «OficiosOS» dentro del panel. Tiene una columna por fase del flujo de los becarios (Preparación, Desarrollo y unitarias, Despliegue DEMO, QA DEMO, PR y revisión, Despliegue PROD, QA PROD), más «Sin empezar» delante y «Cerrada» al final, con las del último mes. Se filtra por proyecto y por becario. En Notion está la misma vista: «Flujo de becarios».

Siguen públicas, sin login, `/entrenos` y `/legal`: son la «Website URL» y la política de privacidad que revisan intervals.icu y Garmin.

## Cómo está hecho

Es un sitio estático en Vercel, sin paso de build, con funciones en `api/`:

| Ruta | Qué hace |
|---|---|
| `middleware.js` | Exige sesión en todo salvo `/login`, `/entrenos`, `/legal`, `/logo/` y `styles.css`. |
| `api/login.js`, `api/logout.js` | Crean y borran la cookie de sesión (`panel_sesion`, firmada con HMAC, 7 días). |
| `api/oficina.js` | Lee de Notion las tareas abiertas y los proyectos, y monta las salas (`lib/oficina.js`). |
| `api/equipos.js` | Guarda el equipo de becarios de un proyecto en la base «Proyectos» de Notion. |
| `api/asignar.js` | Asigna becario a las tareas por hacer (solo páginas de la base de tareas). |
| `api/peticiones.js` | Lista las peticiones al equipo de producto, guarda las nuevas en la base «Peticiones» de Notion y envía al equipo las guardadas. |
| `api/tablero.js` | Devuelve las tareas para el kanban, repartidas por fase (`lib/tablero.js`). |

El frontend está en `site/`: `index.html` y `site/panel/` (el panel), y `login.html`. Los avatares son propios (`site/panel/sprites.js`) y no usan sprites de terceros.

El equipo de producto está en `.claude/`. Hay tres agentes: `producto-po`, `producto-pm` y `producto-cto`. Los coordina el skill `/producto`, que lleva el formato de las tareas.

## Variables de entorno en Vercel

Se configuran en Vercel → proyecto → Settings → Environment Variables, para **Production** y **Preview**. Ninguna va en el repositorio, porque es público.

| Variable | Obligatoria | Valor |
|---|---|---|
| `PANEL_USUARIOS` | Sí | Usuarios y contraseñas, separados por comas: `Miguel:<contraseña>,Pablo:<contraseña>`. |
| `SESION_SECRETO` | Sí | Texto aleatorio largo para firmar las sesiones. Se genera con `openssl rand -base64 32`. Si cambia, se cierran todas las sesiones. |
| `NOTION_TOKEN` | Para la oficina y las peticiones | El token de la conexión interna de Notion (ver abajo). |
| `NOTION_PROYECTOS_DS` | No | Id de la base «Proyectos». Por defecto es la de la página «Panel OficiosOsIA» (`c295eb77-c4a5-4c32-8027-f06f4412bf7d`). |
| `NOTION_TAREAS_DS` | No | Id de la base de tareas. Por defecto es «Oficios OS» (`2ad3221d-8eb7-8065-904d-000b57a0fe2a`). |
| `NOTION_PETICIONES_DS` | No | Id de la base «Peticiones». Por defecto es la de la página «Panel OficiosOsIA» (`7faed1fa-0f84-4078-8800-9350d4746262`). |

Sin `NOTION_TOKEN` el panel abre igual, con las salas vacías y un aviso. El panel no usa la API de Claude: el equipo de producto trabaja en Claude Code con tu suscripción.

## Conectar Notion

1. En Notion → Configuración → Conexiones → «Añadir conexión» → «Conexión de desarrollador», crea una conexión interna («Panel OficiosOsIA») con permisos para leer, actualizar e insertar contenido. Su token va en `NOTION_TOKEN`.
2. En la pestaña «Content access» de la conexión (o con `···` → Conexiones en cada página), dale acceso a la base **OficiosOS** (tareas) y a la página **Panel OficiosOsIA**, que contiene las bases **Proyectos** y **Peticiones**.
3. La base **Proyectos** ya existe, con una fila por sala. Sus propiedades:

   | Propiedad | Tipo | Para qué |
   |---|---|---|
   | Nombre | Título | Nombre de la sala. |
   | Proyecto en tareas | Texto | Texto exacto de «Proyecto relacionado» en las tareas (p. ej. `OficiosOS — Interno`). Si son varios, separados por comas: `Atletas, Nexo` junta en la sala Nexo las tareas de los dos; el primero es el que llevan las tareas nuevas. Si se deja vacío, se usa el Nombre. |
   | Becarios | Selección múltiple | cto, frontend, backend-datos, backend-servicios, qa-funcional, qa-tecnico, delivery. |
   | Repositorio | URL | Se enlaza en la sala y se da como contexto al CTO. |
   | Orden | Número | Orden de las salas. |
   | Logo | URL | Imagen (https) que se cuelga en la pared de la oficina. Si está vacío, sale un cartel con el nombre (Casa Tomás y OficiosOS ya traen el suyo). |
   | Color | Texto | Color de la oficina en hexadecimal (p. ej. `#D4A574`). Si está vacío, el de su tema. |

   Para añadir un proyecto, se añade una fila. Si el panel no puede leer la base, usa la lista de proyectos de `lib/becarios.js` y en cada sala muestra solo a los becarios que ya tienen tareas en ese proyecto.
4. La base **Peticiones** también existe. Columnas: Petición (título, la primera línea), Proyecto, Estado, Pedida por, Resumen, Tareas (relación con OficiosOS) y Creada. El texto completo de cada petición va en el cuerpo de la página.

## Tickets de demostración

En OficiosOS hay 14 tickets cuyo título empieza por «[Demo]», repartidos por las fases y los proyectos para enseñar el flujo en la oficina y en el kanban. No son trabajo real (lo dicen sus Notas) y se pueden borrar cuando haya tareas reales en marcha. Las tareas reales no se han tocado.

## Equipo de producto en Claude Code

1. Abre Claude Code en tu copia de este repositorio (`git pull` para tener `.claude/`).
2. Comprueba que Claude Code tiene acceso a Notion: el conector de Notion de Claude o el servidor MCP de los becarios (`/mcp`).
3. Escribe `/producto`. Coge las peticiones en `Pendiente`, de la más antigua a la más nueva. También acepta la URL de una petición concreta: `/producto <URL>`.
4. Por cada petición, la PO, el PM y el CTO informan en una línea y te enseñan las tareas propuestas. Responde `sí`, `cambios: …`, `descartar` o `detalle`.

Si a la PO le falta algo, la petición queda en `Con dudas`, con las preguntas al final de su página. Responde debajo y vuelve a ponerla en `Pendiente`.

Si tienes clonado el repositorio de un proyecto en una carpeta hermana (por ejemplo `../energym-demo`), el CTO lo mira para que el plan técnico sea realista.

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
```

## Seguridad

- Las contraseñas viven solo en Vercel (`PANEL_USUARIOS`) y nunca en el repositorio, que es público. Conviene que sean largas: cualquiera que conozca la URL puede intentar entrar.
- El panel puede escribir en Notion (peticiones y equipos). Por eso todas las funciones de `api/` comprueban la sesión por su cuenta, además del middleware.

## Marca

`project/` y `chats/` son la entrega original de Claude Design: manual de marca, logotipos y combinaciones de color y tipografía. El panel usa la combinación «Turno de noche» (Sora + IBM Plex Mono, ámbar `#ffb000` sobre `#18191b`).
