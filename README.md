# Panel de OficiosOsIA

Panel interno de Miguel y Pablo, con cinco pestañas:

- **La oficina** (`/`). Cada proyecto es una sala, a pantalla completa, y se cambia de una a otra con pestañas. Cada sala se divide en **habitaciones**, una por departamento: **Producto** (siempre, con la PO, el PM y el CTO de `/producto` y las peticiones de ese proyecto) y los que trabajen en él: **Desarrollo** (cto, diseño UX/UI, frontend, backend-datos, backend-servicios, IA y automatizaciones, qa-funcional, qa-tecnico y delivery), **Ciberseguridad** (Responsable de seguridad, seguridad de aplicaciones, nube y datos, pentesting, dependencias y secretos, cumplimiento y privacidad, y detección y respuesta), **Marketing** (Dirección de marketing, SEO técnico, contenidos, redes sociales, SEO local y analítica) y **Soporte IT** (Jefatura de soporte IT, soporte a usuarios, infraestructura, sistemas, comunicaciones y conectividad). Cada becario se sienta en su mesa con su avatar pixel-art. Lo que hace cada uno sale de las tareas de Notion: la tarea que tiene ahora (propiedad «Becario»), su fase y su estado. Si está En progreso aparece trabajando y si está En espera sale con una alerta. Si no tiene nada en marcha, duerme en su mesa (ojos cerrados y zetas); el montón de papeles azul indica cuántas tareas tiene pendientes. Las habitaciones y las mesas se reparten solas para que la sala quepa sin scroll; si no caben con un tamaño legible (en el móvil, por ejemplo), se apilan y el suelo se desplaza. Cada oficina tiene el aspecto de su proyecto: color, suelo, objetos del sector y el logo o un cartel con el nombre en la pared (`site/panel/temas.js`). Desde cada sala se eligen los departamentos y quién de cada uno trabaja en ese proyecto («Equipo») y qué tareas por hacer pasan a qué departamento («Asignar tareas»). La asignación sigue siempre el flujo del departamento entero: la tarea la recibe su **entrada** (`cto`, `sec-lead`, `mk-lead` o `it-lead`) en Preparación (columnas «Becario» y «Fase» de Notion; las de Inbox pasan a «Por hacer») y es ella quien decide qué becario la coge después. Desde el panel no se elige becario, y las tareas que ya tienen uno no se tocan. Con «Lanzarlas ya en la nube», además, cada tarea se hace en la nube con tu suscripción de Claude hasta abrir el PR (ver «Lanzar tareas en la nube»); una tarea que ya está en un departamento se lanza con «☁ Lanzar» desde su mesa o desde «Asignar tareas».
- **El equipo de producto** (`/#producto`). Tiene tres subpestañas para no hacer scroll: **Nueva petición**, **Peticiones** (con cuántas siguen en marcha) y **Chat** (con cuántos mensajes esperan respuesta). Se puede enlazar cada una (`/#producto/pedir`, `/#producto/peticiones`, `/#producto/chat`) y el panel recuerda la última que usaste. Escribes en texto plano lo que necesitas para un proyecto y la petición se guarda en la base «Peticiones» de Notion. Después, en Claude Code y con tu suscripción, `/producto` la pasa por tres agentes. La **PO** escribe las historias de usuario con sus criterios de aceptación. El **PM** las prioriza, las estima, las ordena y avisa si alguna ya existe en Notion. El **CTO** añade el plan técnico y qué becarios intervienen. Tú confirmas y se crean en «Oficios OS», en Inbox, fase Preparación y con becario `cto`: toda tarea entra al equipo por el CTO, que decide quién la coge después. El panel muestra cada petición con su estado (Guardada, Pendiente, En curso, Con dudas, Hecha o Descartada). Con «Guardar para más tarde» la petición queda en `Guardada` y `/producto` no la toca hasta que se pulsa «Enviar al equipo» en la lista. En **Chat** hablas con el equipo: preguntas cómo van las tareas (en general o de un proyecto) y el mensaje se guarda en la base «Chat» de Notion. Al ejecutar `/producto`, el equipo contesta primero el chat mirando las tareas en Notion (estado, fase, becario, bloqueo) y la respuesta sale en el mismo hilo, con enlaces a las tareas. No es al momento: contesta cuando ejecutas `/producto` (o `/producto chat` para contestar solo el chat).
- **Tareas** (`/#tareas`). El kanban de «OficiosOS» dentro del panel. Tiene una columna por fase del flujo de los becarios (Preparación, Desarrollo y unitarias, Auditoría, Producción, Intervención, Despliegue DEMO, QA DEMO, PR y revisión, Despliegue PROD, QA PROD), más «Sin empezar» delante y «Cerrada» al final, con las del último mes. Desarrollo pasa por todas menos Auditoría, Producción e Intervención; Ciberseguridad va de Preparación a Auditoría y a PR y revisión, Marketing de Preparación a Producción y a PR y revisión, y Soporte IT de Preparación a Intervención y a PR y revisión. Se filtra por proyecto, por departamento (y entonces salen solo sus fases) y por becario. Las tarjetas con PR lo enlazan. En Notion está la misma vista: «Flujo de becarios». Solo salen las **tareas padre**: las subtareas (las que tienen «Tarea padre» en Notion, como las que abren los becarios a partir de las incidencias de una historia) no salen ni en el kanban ni en la oficina, y la tarjeta del padre dice cuántas tiene. Una tarea padre puede tenerla **uno o varios becarios a la vez** (por ejemplo, datos y frontend en paralelo, o los dos QA): sale en la mesa de cada uno y con todos sus avatares en la tarjeta.
- **Becarios** (`/#becarios`). Una ficha por becario, agrupadas por departamento. Desde «Configurar» se cambian su nombre y su papel, cómo trabaja (modelo de IA y esfuerzo, con los atajos Rápido = Haiku y esfuerzo bajo, Equilibrado = Sonnet y medio, A fondo = Opus y alto, o como venga en el plugin), su avatar (peinado, accesorios y colores, con vista previa), sus instrucciones y si está pausado. Debajo hay una tabla becario × oficina para elegir en qué oficinas trabaja cada uno; es lo mismo que el botón «Equipo» de cada sala. Las fichas se guardan en la base «Becarios» de Notion y las oficinas en «Proyectos». Lo que se cambie en Notion aparece solo: la pestaña se recarga cada minuto, como el resto del panel, salvo mientras hay una ficha abierta o cambios sin guardar en la tabla. Un becario pausado no tiene mesa en las oficinas, salvo donde aún tenga tareas abiertas. Si la entrada de un departamento (CTO, Responsable de seguridad, Dirección de marketing o Jefatura de soporte IT) está pausada, no se le pueden pasar tareas de ese departamento a ninguna oficina, porque todas entran por ella (el panel lo avisa y la API responde 409). El modelo, el esfuerzo, las instrucciones y la pausa los tiene que aplicar el propio plugin: ver «Modelo, esfuerzo, instrucciones y pausa en el plugin». El modo rápido de Claude Code (`/fast`) no se puede elegir por becario: va por sesión, solo con Opus, y se paga aparte con créditos de uso.

- **Conexiones** (`/#conexiones`). La tarea programada de Claude Code de quien está en el panel, una por proyecto: la URL de su disparador por API y su token. Cada persona ve y usa solo las suyas, así que lo que lanza Pablo va con la suscripción de Pablo y lo de Miguel con la de Miguel. El token se guarda cifrado y no vuelve al navegador. Ver «Lanzar tareas en la nube».

Siguen públicas, sin login, `/entrenos` y `/legal`: son la «Website URL» y la política de privacidad que revisan intervals.icu y Garmin.

## Cómo está hecho

Es un sitio estático en Vercel, sin paso de build, con funciones en `api/`:

| Ruta | Qué hace |
|---|---|
| `middleware.js` | Exige sesión en todo salvo `/login`, `/entrenos`, `/legal`, `/logo/` y `styles.css`. |
| `api/login.js`, `api/logout.js` | Crean y borran la cookie de sesión (`panel_sesion`, firmada con HMAC, 7 días). |
| `api/oficina.js` | Lee de Notion las tareas abiertas, los proyectos y las fichas de los becarios, y monta las salas (`lib/oficina.js`). |
| `api/equipos.js` | Guarda el equipo de becarios de un proyecto en la base «Proyectos» de Notion. |
| `api/asignar.js` | Pasa tareas por hacer a un departamento: las recibe su entrada (`cto`, `sec-lead`, `mk-lead` o `it-lead`) en Preparación (solo páginas de la base de tareas sin becario). Con `lanzar: true`, además las lanza en la nube (`lib/lanzar.js`). |
| `api/lanzar.js` | Lanza en la nube una tarea que ya está en un departamento, con la tarea programada de Claude Code de quien está en el panel. |
| `api/conexiones.js` | Lee, guarda (cifradas, `lib/cifrado.js`) y quita las conexiones de quien está en el panel, en la base «Conexiones». |
| `api/peticiones.js` | Lista las peticiones al equipo de producto, guarda las nuevas en la base «Peticiones» de Notion y envía al equipo las guardadas. |
| `api/becarios.js` | Lee las fichas de los becarios y las oficinas de cada uno, y guarda una ficha en la base «Becarios» (crea la fila si falta). |
| `api/chat.js` | Lee los últimos mensajes del chat con el equipo de producto y guarda los nuevos en la base «Chat» (autor = usuario de la sesión, estado `Pendiente`). |
| `api/tablero.js` | Devuelve las tareas para el kanban, repartidas por fase (`lib/tablero.js`). |

El frontend está en `site/`: `index.html` y `site/panel/` (el panel), y `login.html`. Los avatares son propios (`site/panel/sprites.js`) y no usan sprites de terceros.

Los departamentos y sus becarios por defecto están en `lib/becarios.js` (`DEPARTAMENTOS` y `BECARIOS`). Los agentes de ciberseguridad, marketing y soporte IT, y el skill `encargo` que trabaja en la nube, están en el marketplace de plugins [oficiososia/becarios](https://github.com/oficiososia/becarios).

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
| `NOTION_BECARIOS_DS` | No | Id de la base «Becarios». Por defecto es la de la página «Panel OficiosOsIA» (`7d90c32f-ede0-42ca-8732-2c80134f885b`). |
| `NOTION_CHAT_DS` | No | Id de la base «Chat». Por defecto es la de la página «Panel OficiosOsIA» (`5a4ba784-8970-49b7-a9cb-5125630cecb0`). |
| `NOTION_PETICIONES_DS` | No | Id de la base «Peticiones». Por defecto es la de la página «Panel OficiosOsIA» (`7faed1fa-0f84-4078-8800-9350d4746262`). |
| `CONEXIONES_SECRETO` | Para lanzar en la nube | Texto aleatorio largo (32 caracteres o más) con el que se cifran los tokens de las conexiones. Se genera con `openssl rand -base64 32`. Si cambia, hay que volver a pegar los tokens en «Conexiones». |
| `NOTION_CONEXIONES_DS` | No | Id de la base «Conexiones». Por defecto es la de la página «Panel OficiosOsIA» (`24bc0291-e1ad-4e97-9cc0-e180b21aa173`). |

Sin `NOTION_TOKEN` el panel abre igual, con las salas vacías y un aviso. Sin `CONEXIONES_SECRETO` todo funciona menos guardar conexiones y lanzar en la nube. El panel no usa nunca la API de pago de Claude: el equipo de producto trabaja en Claude Code con tu suscripción, y lo que se lanza en la nube corre en tu tarea programada de Claude Code, también con tu suscripción.

## Conectar Notion

1. En Notion → Configuración → Conexiones → «Añadir conexión» → «Conexión de desarrollador», crea una conexión interna («Panel OficiosOsIA») con permisos para leer, actualizar e insertar contenido. Su token va en `NOTION_TOKEN`.
2. En la pestaña «Content access» de la conexión (o con `···` → Conexiones en cada página), dale acceso a la base **OficiosOS** (tareas) y a la página **Panel OficiosOsIA**, que contiene las bases **Proyectos**, **Peticiones**, **Becarios** y **Chat**.
3. La base **Proyectos** ya existe, con una fila por sala. Sus propiedades:

   | Propiedad | Tipo | Para qué |
   |---|---|---|
   | Nombre | Título | Nombre de la sala. |
   | Proyecto en tareas | Texto | Texto exacto de «Proyecto relacionado» en las tareas (p. ej. `OficiosOS — Interno`). Si son varios, separados por comas: `Atletas, Nexo` junta en la sala Nexo las tareas de los dos; el primero es el que llevan las tareas nuevas. Si se deja vacío, se usa el Nombre. |
   | Becarios | Selección múltiple | El equipo, de todos los departamentos: cto, diseno, frontend, backend-datos, backend-servicios, ia-automatizacion, qa-funcional, qa-tecnico, delivery; sec-lead, sec-aplicaciones, sec-nube, sec-pentest, sec-dependencias, sec-cumplimiento, sec-respuesta; mk-lead, mk-seo, mk-contenidos, mk-rrss, mk-local, mk-analitica; it-lead, it-soporte, it-infraestructura, it-sistemas, it-comunicaciones, it-conectividad. Un departamento está en la oficina si tiene a alguien aquí. |
   | Repositorio | URL | Se enlaza en la sala, se da como contexto al CTO y es donde trabaja la sesión al lanzar en la nube (sin él no se puede lanzar). |
   | Orden | Número | Orden de las salas. |
   | Logo | URL | Imagen (https) que se cuelga en la pared de la oficina. Si está vacío, sale un cartel con el nombre (Casa Tomás y OficiosOS ya traen el suyo). |
   | Color | Texto | Color de la oficina en hexadecimal (p. ej. `#D4A574`). Si está vacío, el de su tema. |

   Para añadir un proyecto, se añade una fila. Si el panel no puede leer la base, usa la lista de proyectos de `lib/becarios.js` y en cada sala muestra solo a los becarios que ya tienen tareas en ese proyecto.
4. La base **Peticiones** también existe. Columnas: Petición (título, la primera línea), Proyecto, Estado, Pedida por, Resumen, Tareas (relación con OficiosOS) y Creada. El texto completo de cada petición va en el cuerpo de la página.
5. La base **Becarios** también existe, con una fila por becario. Se edita desde la pestaña «Becarios», pero también se puede cambiar a mano:

   | Propiedad | Tipo | Para qué |
   |---|---|---|
   | Nombre | Título | Nombre que sale en el panel. |
   | Id | Selección | El agente del plugin (`cto`, `frontend`…). No se cambia. |
   | Papel | Texto | Qué hace, en una línea. |
   | Pausado | Casilla | Fuera de las oficinas y sin trabajo nuevo. |
   | Instrucciones | Texto | Reglas extra que el becario sigue en todas sus tareas (hasta 6000 caracteres). |
   | Modelo | Selección | haiku, sonnet, opus o fable. Vacío: el de la cabecera de su fichero en el plugin (CTO en Opus, el resto en Sonnet). |
   | Esfuerzo | Selección | low, medium, high, xhigh o max. Vacío: el de la cabecera del plugin (CTO en high; el resto, el de la sesión). |
   | Peinado | Selección | corto, largo, rizado, mono, gorra o gorro. |
   | Accesorios | Selección múltiple | gafas, cascos, barba, corbata, placa. |
   | Piel, Pelo, Ropa, Detalle | Texto | Colores del avatar en `#rrggbb`. Detalle es el color de la gorra, el gorro, los cascos, la corbata o la placa. |

   Lo que falte o esté mal escrito se queda como viene por defecto (`lib/becarios.js`). Si el panel no puede leer la base, los becarios salen como vienen por defecto, con un aviso.

6. La base **Conexiones** también existe. Una fila por persona y proyecto: Nombre (título, «Pablo · Energym»), Usuario, Proyecto (id de la página en «Proyectos»), Disparador (URL), Token (cifrado por el panel) y Pista (los últimos caracteres del token). Se rellena desde la pestaña «Conexiones»; no se edita a mano.
7. La base **Chat** también existe. Columnas: Mensaje (título, la primera línea), Texto (el mensaje completo), Autor (Miguel, Pablo, CTO, PM o PO), De (`persona` o `equipo`), Estado (`Pendiente` hasta que el equipo contesta, luego `Respondido`; los mensajes del equipo van en `Respuesta`), Proyecto (vacío: pregunta general) y Tareas (relación con OficiosOS).

## Lanzar tareas en la nube

Al asignar una tarea (o con «☁ Lanzar»), el panel llama al **disparador por API de tu tarea programada de Claude Code** para ese proyecto. La sesión se abre en la nube de Anthropic, en tu cuenta de claude.ai y **con tu suscripción** (no con la API de pago). Clona el repositorio del proyecto, lee la tarea de Notion, la trabaja con el departamento que toca y termina con un **PR** que revisas y fusionas tú. La tarea pasa a «PR y revisión», en «En espera» y con el enlace en «PR». Los fallos que encuentren Ciberseguridad o Soporte IT y no se arreglen en el PR salen como subtareas. No fusiona, no despliega a producción, no aplica migraciones en producción y no publica en redes.

Cómo se configura, cada persona y en cada proyecto (los pasos también están en la pestaña «Conexiones» y en el [README de oficiososia/becarios](https://github.com/oficiososia/becarios)):

1. **GitHub.** En [claude.ai/code](https://claude.ai/code), que tu cuenta llegue al repositorio del proyecto, aunque sea de otra cuenta de GitHub: con la app de Claude instalada en ese repositorio o con `/web-setup` (si eres colaborador).
2. **Entorno en la nube**, uno por proyecto. Así cada proyecto lleva los tokens de su propia cuenta de Vercel y Supabase:
   - Acceso a red «Custom»: la lista por defecto más `api.vercel.com`, `*.vercel.app`, `api.supabase.com`, `*.supabase.co` y `api.notion.com`.
   - Secretos de red (tipo Bearer): tu token de Vercel para `api.vercel.com` y tu token personal de Supabase para `api.supabase.com`. La sesión los usa sin verlos.
   - Variables de entorno: `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `SUPABASE_PROJECT_REF` y las variables públicas que necesite la app para compilar y probar.
   - Script de configuración (opcional): `plugins/oficina/rutina/setup.sh` de oficiososia/becarios.
3. **Tarea programada** en [claude.ai/code/routines](https://claude.ai/code/routines): el repositorio del proyecto, ese entorno, el modelo que quieras, el conector de Notion (quita los que no hagan falta) y, como instrucciones, el [prompt de la oficina](https://github.com/oficiososia/becarios/blob/HEAD/plugins/oficina/rutina/prompt.md).
4. **Disparador por API.** Añádeselo, genera el token (solo se ve una vez) y pega la URL y el token en la pestaña «Conexiones», en ese proyecto.

Lo que viaja en cada lanzamiento es el encargo `ENCARGO OFICIOSOSIA v1` (`lib/nube.js`): la tarea, el repositorio, el departamento, su entrada, los becarios del equipo sin pausar, quién lanza y una nota opcional. La sesión solo actúa si el encargo empieza así y el repositorio es el suyo.

Límites de Claude: 30 lanzamientos por hora en cada tarea programada y 100 por cuenta. Cada sesión gasta la suscripción como una sesión normal de Claude Code. Las tareas programadas están en *research preview*: Anthropic puede cambiar el disparador; si lo hace, se toca `lib/nube.js`.

Seguridad: el panel solo dispara contra `https://api.anthropic.com/v1/claude_code/routines/trig_…/fire`. El token va cifrado con AES-256-GCM (`CONEXIONES_SECRETO`), atado a su persona y su proyecto, y solo se descifra en el servidor al lanzar. Un token de disparador solo sirve para lanzar esa tarea programada: no da acceso a la cuenta ni a sus datos.

## Modelo, esfuerzo, instrucciones y pausa en el plugin

El panel lo guarda todo en Notion, pero quien trabaja es el plugin `becarios`, en tu ordenador. Para que lo tenga en cuenta hacen falta dos cambios en el plugin (o en cada repositorio que lo lleve).

1. Al final de `.claude/becarios/reference/notion.md`, para que cada becario lea su ficha:

```markdown
## Ficha del becario (panel OficiosOsIA)

Antes de empezar cualquier tarea, busca tu fila en la base «Becarios» de Notion
(data source `7d90c32f-ede0-42ca-8732-2c80134f885b`, en la página «Panel OficiosOsIA»): la que tiene
en la columna `Id` tu nombre de agente (`cto`, `frontend`, `backend-datos`, `backend-servicios`,
`qa-funcional`, `qa-tecnico` o `delivery`).

- Si `Pausado` está marcado, no trabajes: termina con resultado BLOQUEADO y el motivo
  «Becario pausado en el panel».
- Si hay `Instrucciones`, síguelas en toda la tarea, salvo que contradigan `proceso.md`
  o las reglas del repositorio (CLAUDE.md); en ese caso mandan esas y lo dices en tu informe.
- Si no encuentras la base o tu fila, sigue como siempre.
```

2. En `.claude/skills/becarios/SKILL.md`, para que el coordinador lance a cada becario con el modelo y el esfuerzo de su ficha. Sustituye la frase «Al lanzar un becario **no** pases `model`: sustituiría al de la ficha.» por:

```markdown
Antes de lanzar un becario, lee su fila en la base «Becarios» de Notion (data source
`7d90c32f-ede0-42ca-8732-2c80134f885b`, columna `Id`). Si `Modelo` tiene valor, pásalo como `model`;
si `Esfuerzo` tiene valor, pásalo como `effort`. Si están vacíos, o no encuentras la base o la fila,
no pases ninguno de los dos: manda la cabecera de su fichero en `.claude/agents/`.
```

## Tareas padre y subtareas

La base OficiosOS tiene la relación **Tarea padre ↔ Subtareas**. Una tarea con «Tarea padre» es una subtarea: el panel no la enseña (ni en la oficina, ni en el kanban, ni en «Asignar tareas») y las vistas de trabajo de Notion (Pendientes, Flujo de becarios, Por proyecto, Inbox, En espera y Completadas) tampoco. «Todas las tareas» sí las enseña, para consultarlas. En la página de la tarea padre se ven sus subtareas en la columna «Subtareas».

«Becario» dice quién tiene la tarea ahora. El panel lo lee tanto si la columna es de selección (uno) como de selección múltiple (varios), y al pasar una tarea al equipo escribe `cto` en el formato que tenga.

## Equipo de producto en Claude Code

1. Abre Claude Code en tu copia de este repositorio (`git pull` para tener `.claude/`).
2. Comprueba que Claude Code tiene acceso a Notion: el conector de Notion de Claude o el servidor MCP de los becarios (`/mcp`).
3. Escribe `/producto`. Primero contesta los mensajes del chat sin respuesta; luego coge las peticiones en `Pendiente`, de la más antigua a la más nueva. También acepta la URL de una petición concreta (`/producto <URL>`) o `chat` para contestar solo el chat (`/producto chat`).
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
CONEXIONES_SECRETO=otro-texto-aleatorio-largo
```

## Seguridad

- Las contraseñas viven solo en Vercel (`PANEL_USUARIOS`) y nunca en el repositorio, que es público. Conviene que sean largas: cualquiera que conozca la URL puede intentar entrar.
- El panel puede escribir en Notion (peticiones y equipos) y lanzar sesiones con la suscripción de cada uno. Por eso todas las funciones de `api/` comprueban la sesión por su cuenta, además del middleware, y cada persona solo ve y usa sus conexiones.
- Los tokens de Vercel, Supabase y GitHub de los proyectos no pasan por el panel ni por Notion: viven en el entorno de la nube de cada persona en claude.ai.

## Marca

`project/` y `chats/` son la entrega original de Claude Design: manual de marca, logotipos y combinaciones de color y tipografía. El panel usa la combinación «Turno de noche» (Sora + IBM Plex Mono, ámbar `#ffb000` sobre `#18191b`).
