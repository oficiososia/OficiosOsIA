# Panel de OficiosOsIA

Panel interno de Miguel y Pablo, con cuatro pestañas:

- **La oficina** (`/`). Cada proyecto es una sala, a pantalla completa y sin scroll, y se cambia de una a otra con pestañas. Cada becario se sienta en su mesa con su avatar pixel-art. Los becarios son los agentes de IA del plugin `becarios`: cto, frontend, backend-datos, backend-servicios, qa-funcional, qa-tecnico y delivery. Lo que hace cada uno sale de las tareas de Notion: la tarea que tiene ahora (propiedad «Becario»), su fase y su estado. Si está En progreso aparece trabajando y si está En espera sale con una alerta. Si no tiene nada en marcha, duerme en su mesa (ojos cerrados y zetas); el montón de papeles azul indica cuántas tareas tiene pendientes. Cada oficina tiene el aspecto de su proyecto: color, suelo, mesas, objetos del sector y el logo o un cartel con el nombre en la pared (`site/panel/temas.js`). Desde cada sala se elige qué equipo de becarios trabaja en ese proyecto («Equipo») y qué tareas por hacer pasan a ese equipo («Asignar tareas»). La asignación sigue siempre el flujo del equipo entero: la tarea la recibe el `cto` en Preparación (columnas «Becario» y «Fase» de Notion; las de Inbox pasan a «Por hacer») y es él quien decide qué becario la coge después. Desde el panel no se elige becario, y las tareas que ya tienen uno no se tocan.
- **El equipo de producto** (`/#producto`). Tiene tres subpestañas para no hacer scroll: **Nueva petición**, **Peticiones** (con cuántas siguen en marcha) y **Chat** (con cuántos mensajes esperan respuesta). Se puede enlazar cada una (`/#producto/pedir`, `/#producto/peticiones`, `/#producto/chat`) y el panel recuerda la última que usaste. Escribes en texto plano lo que necesitas para un proyecto y la petición se guarda en la base «Peticiones» de Notion. Después, en Claude Code y con tu suscripción, `/producto` la pasa por tres agentes. La **PO** escribe las historias de usuario con sus criterios de aceptación. El **PM** las prioriza, las estima, las ordena y avisa si alguna ya existe en Notion. El **CTO** añade el plan técnico y qué becarios intervienen. Tú confirmas y se crean en «Oficios OS», en Inbox, fase Preparación y con becario `cto`: toda tarea entra al equipo por el CTO, que decide quién la coge después. El panel muestra cada petición con su estado (Guardada, Pendiente, En curso, Con dudas, Hecha o Descartada). Con «Guardar para más tarde» la petición queda en `Guardada` y `/producto` no la toca hasta que se pulsa «Enviar al equipo» en la lista. En **Chat** hablas con el equipo: preguntas cómo van las tareas (en general o de un proyecto) y el mensaje se guarda en la base «Chat» de Notion. Al ejecutar `/producto`, el equipo contesta primero el chat mirando las tareas en Notion (estado, fase, becario, bloqueo) y la respuesta sale en el mismo hilo, con enlaces a las tareas. No es al momento: contesta cuando ejecutas `/producto` (o `/producto chat` para contestar solo el chat).
- **Tareas** (`/#tareas`). El kanban de «OficiosOS» dentro del panel. Tiene una columna por fase del flujo de los becarios (Preparación, Desarrollo y unitarias, Despliegue DEMO, QA DEMO, PR y revisión, Despliegue PROD, QA PROD), más «Sin empezar» delante y «Cerrada» al final, con las del último mes. Se filtra por proyecto y por becario. En Notion está la misma vista: «Flujo de becarios».
- **Becarios** (`/#becarios`). Una ficha por becario. Desde «Configurar» se cambian su nombre y su papel, cómo trabaja (modelo de IA y esfuerzo, con los atajos Rápido = Haiku y esfuerzo bajo, Equilibrado = Sonnet y medio, A fondo = Opus y alto, o como venga en el plugin), su avatar (peinado, accesorios y colores, con vista previa), sus instrucciones y si está pausado. Debajo hay una tabla becario × oficina para elegir en qué oficinas trabaja cada uno; es lo mismo que el botón «Equipo» de cada sala. Las fichas se guardan en la base «Becarios» de Notion y las oficinas en «Proyectos». Un becario pausado no tiene mesa en las oficinas, salvo donde aún tenga tareas abiertas. Si el CTO está pausado no se pueden pasar tareas a ninguna oficina, porque todas entran por él (el panel lo avisa y la API responde 409). El modelo, el esfuerzo, las instrucciones y la pausa los tiene que aplicar el propio plugin: ver «Modelo, esfuerzo, instrucciones y pausa en el plugin». El modo rápido de Claude Code (`/fast`) no se puede elegir por becario: va por sesión, solo con Opus, y se paga aparte con créditos de uso.

Siguen públicas, sin login, `/entrenos` y `/legal`: son la «Website URL» y la política de privacidad que revisan intervals.icu y Garmin.

## Cómo está hecho

Es un sitio estático en Vercel, sin paso de build, con funciones en `api/`:

| Ruta | Qué hace |
|---|---|
| `middleware.js` | Exige sesión en todo salvo `/login`, `/entrenos`, `/legal`, `/logo/` y `styles.css`. |
| `api/login.js`, `api/logout.js` | Crean y borran la cookie de sesión (`panel_sesion`, firmada con HMAC, 7 días). |
| `api/oficina.js` | Lee de Notion las tareas abiertas, los proyectos y las fichas de los becarios, y monta las salas (`lib/oficina.js`). |
| `api/equipos.js` | Guarda el equipo de becarios de un proyecto en la base «Proyectos» de Notion. |
| `api/asignar.js` | Pasa tareas por hacer al equipo: las recibe el `cto` en Preparación (solo páginas de la base de tareas sin becario). |
| `api/peticiones.js` | Lista las peticiones al equipo de producto, guarda las nuevas en la base «Peticiones» de Notion y envía al equipo las guardadas. |
| `api/becarios.js` | Lee las fichas de los becarios y las oficinas de cada uno, y guarda una ficha en la base «Becarios» (crea la fila si falta). |
| `api/chat.js` | Lee los últimos mensajes del chat con el equipo de producto y guarda los nuevos en la base «Chat» (autor = usuario de la sesión, estado `Pendiente`). |
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
| `NOTION_BECARIOS_DS` | No | Id de la base «Becarios». Por defecto es la de la página «Panel OficiosOsIA» (`7d90c32f-ede0-42ca-8732-2c80134f885b`). |
| `NOTION_CHAT_DS` | No | Id de la base «Chat». Por defecto es la de la página «Panel OficiosOsIA» (`5a4ba784-8970-49b7-a9cb-5125630cecb0`). |
| `NOTION_PETICIONES_DS` | No | Id de la base «Peticiones». Por defecto es la de la página «Panel OficiosOsIA» (`7faed1fa-0f84-4078-8800-9350d4746262`). |

Sin `NOTION_TOKEN` el panel abre igual, con las salas vacías y un aviso. El panel no usa la API de Claude: el equipo de producto trabaja en Claude Code con tu suscripción.

## Conectar Notion

1. En Notion → Configuración → Conexiones → «Añadir conexión» → «Conexión de desarrollador», crea una conexión interna («Panel OficiosOsIA») con permisos para leer, actualizar e insertar contenido. Su token va en `NOTION_TOKEN`.
2. En la pestaña «Content access» de la conexión (o con `···` → Conexiones en cada página), dale acceso a la base **OficiosOS** (tareas) y a la página **Panel OficiosOsIA**, que contiene las bases **Proyectos**, **Peticiones**, **Becarios** y **Chat**.
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

6. La base **Chat** también existe. Columnas: Mensaje (título, la primera línea), Texto (el mensaje completo), Autor (Miguel, Pablo, CTO, PM o PO), De (`persona` o `equipo`), Estado (`Pendiente` hasta que el equipo contesta, luego `Respondido`; los mensajes del equipo van en `Respuesta`), Proyecto (vacío: pregunta general) y Tareas (relación con OficiosOS).

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

## Tickets de demostración

En OficiosOS hay 14 tickets cuyo título empieza por «[Demo]», repartidos por las fases y los proyectos para enseñar el flujo en la oficina y en el kanban. No son trabajo real (lo dicen sus Notas) y se pueden borrar cuando haya tareas reales en marcha. Las tareas reales no se han tocado.

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
```

## Seguridad

- Las contraseñas viven solo en Vercel (`PANEL_USUARIOS`) y nunca en el repositorio, que es público. Conviene que sean largas: cualquiera que conozca la URL puede intentar entrar.
- El panel puede escribir en Notion (peticiones y equipos). Por eso todas las funciones de `api/` comprueban la sesión por su cuenta, además del middleware.

## Marca

`project/` y `chats/` son la entrega original de Claude Design: manual de marca, logotipos y combinaciones de color y tipografía. El panel usa la combinación «Turno de noche» (Sora + IBM Plex Mono, ámbar `#ffb000` sobre `#18191b`).
