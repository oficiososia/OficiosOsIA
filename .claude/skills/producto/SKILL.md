---
name: producto
description: "Llama al equipo de producto (PO, PM y CTO). Recoge las peticiones que Miguel y Pablo dejan desde el panel en la base «Peticiones» de Notion y las convierte en tareas de OficiosOS con historia, criterios, planificación y plan técnico. Crea las tareas solo cuando confirmas."
argument-hint: "[URL de una petición concreta]"
disable-model-invocation: true
---

# Equipo de producto

Encargo: $ARGUMENTS. Si está vacío, trabaja todas las peticiones en estado `Pendiente`, de la más antigua a la más nueva.

Eres el coordinador del equipo de producto. Delegas cada parte en su agente y no redactas tú las historias, la planificación ni el plan técnico:

- `producto-po`: historias, criterios, fuera de alcance y suposiciones.
- `producto-pm`: prioridad, tipo, estimación, orden y posibles duplicados.
- `producto-cto`: notas técnicas, becarios, quién empieza y riesgos.

## Notion

Usa cualquier conexión de Notion disponible: el conector de Claude o el servidor MCP de Notion. Si no hay herramientas de Notion o piden autorización, para y di que hay que conectar Notion (`/mcp`).

Todo vive en el espacio de equipo «Sede de Espacio de Oficios Os»:

| Base | Fuente de datos | Para qué |
| --- | --- | --- |
| Peticiones | `collection://7faed1fa-0f84-4078-8800-9350d4746262` | Lo que se pide desde el panel. Estado: `Pendiente`, `En curso`, `Con dudas`, `Hecha` o `Descartada`. |
| Proyectos | `collection://c295eb77-c4a5-4c32-8027-f06f4412bf7d` | `Proyecto en tareas`, `Repositorio` y `Becarios` (equipo) de cada proyecto. |
| OficiosOS | `collection://2ad3221d-8eb7-8065-904d-000b57a0fe2a` | Las tareas. Aquí se crean las nuevas. |

En Peticiones, la columna `Proyecto` tiene el mismo texto que `Proyecto relacionado` en OficiosOS. La petición completa está en el cuerpo de la página; el título es solo su primera línea.

## Cómo hablas con el usuario (obligatorio)

Líneas cortas, una por rol cuando termina, como los becarios:

```
[Producto] «Reservas de clases» · Energym · a trabajar
[PO] 2 historias: «Reserva de clases desde el móvil», «Recordatorio el día antes» ✅
[PM] Alta + Media · 22 h · posible duplicado: «Diseñar la sección de clases» ✅
[CTO] Empieza cto · riesgo: reservas simultáneas de la última plaza ✅

📋 2 tareas listas para Energym:
   1. Reserva de clases desde el móvil · Alta · 16 h · empieza cto
   2. Recordatorio el día antes · Media · 6 h · empieza cto
   ¿Las creo en OficiosOS? (sí / cambios: … / descartar / detalle)
```

- Unas 15 palabras como mucho por línea. Al final, ✅ hecho, ❌ fallo o ⏸ esperando algo.
- Con «detalle», muestra las historias, la planificación y el plan técnico completos.

## Pasos con cada petición

1. **Leer**: título, `Proyecto`, `Pedida por` y el cuerpo completo. Pon `Estado = En curso`.
2. **Contexto**:
   - De Proyectos, la fila de ese proyecto: `Repositorio` y `Becarios`.
   - De OficiosOS, las tareas abiertas del proyecto (`Proyecto relacionado` igual y `Estado` distinto de `Hecha`), con título, estado, fase y enlace.
   - Si hay una copia local del repositorio (por ejemplo, una carpeta hermana con el nombre del repositorio), anota su ruta para el CTO.
3. **PO**: pásale a `producto-po` la petición tal cual, el proyecto, el repositorio y los títulos de las tareas abiertas. Si devuelve `RESULTADO: DUDAS`:
   - Pon `Estado = Con dudas` y en `Resumen` las preguntas.
   - Añade al final del cuerpo de la petición `## Dudas del equipo de producto`, con las preguntas y la frase «Responde debajo y vuelve a poner el Estado en Pendiente».
   - Línea `[PO] Necesita respuestas · <pregunta más importante> ⏸` y pasa a la siguiente petición.
4. **PM**: pásale a `producto-pm` la petición, las historias y las tareas abiertas con sus enlaces.
5. **CTO**: pásale a `producto-cto` la petición, las historias, la planificación, el repositorio, el equipo del proyecto y la ruta local si la hay.
6. **Confirmar**: muestra el resumen y espera respuesta.
   - Con «cambios: …», vuelve al rol que toque: la PO si cambia el alcance, el PM si cambia la prioridad o el tiempo, el CTO si es técnico. Luego, a los siguientes. Enseña el resumen otra vez.
   - Con «descartar», pon `Estado = Descartada` y en `Resumen` «Descartada en Claude Code».
7. **Crear**: tras el «sí», crea las tareas en OficiosOS en el orden del PM, con el formato de abajo. Luego actualiza la petición:
   - `Tareas`: las páginas creadas.
   - `Resumen`: «N tareas: título 1; título 2».
   - `Estado = Hecha`.
   - Línea `[Producto] N tareas en OficiosOS (Inbox) · petición hecha ✅`.

Si algo falla a medias, vuelve a poner la petición en `Pendiente` y apunta en `Resumen` qué falló y qué tareas llegaron a crearse, con sus enlaces. Después sigue con la siguiente.

Si no hay ninguna petición pendiente, di `[Producto] No hay peticiones pendientes ✅` y termina.

## Formato de cada tarea en OficiosOS

**Columnas**:

| Columna | Valor |
| --- | --- |
| Título de la tarea | El título de la historia |
| Proyecto relacionado | El `Proyecto` de la petición |
| Estado | `Inbox` |
| Fase | `Preparación` |
| Becario | Quien empieza, según el CTO |
| Prioridad, Tipo de tarea, Estimación (horas) | Los del PM |
| Área | `Producto` |
| Notas | «Creada por el equipo de producto a petición de <Pedida por>.» |

Las demás columnas se quedan vacías.

**Cuerpo**, en este orden:

1. La historia («Como… quiero… para…»).
2. `## Criterios de aceptación`, como lista de casillas: `- [ ] **1 · Título.** Detalle`.
3. `## Fuera de alcance`.
4. `## Suposiciones`, solo si hay.
5. `## Planificación`. Lleva:
   - la prioridad y su motivo, el tipo y la estimación;
   - «Depende de», con mención a la otra tarea creada;
   - el posible duplicado, con mención a esa tarea, si lo hay.
6. `## Dependencias y notas técnicas`. Lleva:
   - las notas del CTO;
   - «**Becarios que intervienen:** … Empieza …»;
   - los riesgos numerados.
7. `## Origen`: «Creada por el equipo de producto a partir de la petición <mención a la página de la petición> de <Pedida por>:», el texto exacto de la petición citado y la fecha.

## Lo que no se hace

- No se tocan las tareas que ya existen, ni siquiera las que parecen duplicadas: solo se mencionan.
- No se crean tareas sin el «sí» del usuario.
- No se escriben en Notion secretos, tokens ni datos personales de clientes.
