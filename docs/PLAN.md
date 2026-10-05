# SíChef — Plan de trabajo (hasta las 16:30)

> 🇮🇹 **In breve:** tre gruppi, ognuno nella sua cartella, tutti con l'IA. Bogdan integra (unico che fa merge su `main`). Alle 15:30 si smette di aggiungere funzioni. Alle 16:15 si consegna.

Repo: https://github.com/Genodan/sichef · Reglas para la IA: `AGENTS.md` · Contrato de datos: `app/src/types.ts`

## Estado ahora
- ✅ Repo, estructura de carpetas, contrato de datos, reglas para la IA.
- ⏳ En construcción: primer template de la app (diseño del mockup) + datos reales de 5 recetas. Llega como PR desde la rama `app/template-v1`.

## Cómo empezar (todos, 5 min)
```bash
git clone https://github.com/Genodan/sichef
cd sichef/app && npm install && npm run dev
```
Decid a vuestra IA: «Lee AGENTS.md antes de empezar». Trabajad siempre en una rama vuestra y abrid PR.

---

## 📱 App — Bogdan (integrador) · Hugo
**Carpeta:** `app/src/`
| Prioridad | Tarea | Hecho cuando… |
|---|---|---|
| MUST | Revisar y mergear el template (`app/template-v1`) | La app carga en el móvil |
| MUST | Deploy en Vercel/Netlify conectado al repo | Hay URL pública que abre en el móvil |
| MUST | Swipe fluido + filtro de alergias + receta con precio/nutrición | La demo de 5 pasos funciona sin fallos |
| SHOULD | Cesta ordenada por pasillo + cambio de tienda | Al cambiar de tienda cambian los pasillos |
| SHOULD | «¿Qué cocino con esto?» (Buscar) | Buscar «garbanzos» muestra recetas |
| COULD | Pulir animaciones y textos | — |

Hugo puede llevar el deploy y la pantalla de Cesta; Bogdan revisa PRs e integra.

## 🗂️ Datos — Luigi · Onur
**Carpeta:** `data/`, `app/public/data/`, `app/public/img/`
| Prioridad | Tarea | Hecho cuando… |
|---|---|---|
| MUST | Partir de los scripts de `data/scripts/` del template y ampliar de 5 a **15–20 recetas** | `validate.py` pasa |
| MUST | Cada ingrediente → producto real de Mercadona (la IA propone, una persona valida) | Ningún `product_id` inventado |
| MUST | Foto real de cada plato con autor y licencia (Wikimedia Commons, fotos propias) | Ninguna imagen generada por IA |
| MUST | Al menos 1 receta con un producto de alérgenos «desconocido» | La demo enseña «dato no disponible» |
| SHOULD | Variedad: vegetariana, sin gluten, pescado, legumbres, económica | El swipe no repite tipo de plato |
| SHOULD | Tiendas simuladas con pasillos coherentes | Cada producto tiene ubicación en las 2 tiendas |

Reglas: la app **no** llama a la API en directo (no hay CORS); descargar con script, guardar JSON. Pausa entre peticiones.

## 🎤 Pitch — Martín · Andrés
**Carpeta:** `docs/` (y el Canva)
| Prioridad | Tarea | Hecho cuando… |
|---|---|---|
| MUST | Primera hora: ayudar a Datos a encontrar recetas y fotos con licencia | Datos tiene 15 recetas candidatas |
| MUST | Testers: probar la app en el móvil cada hora y apuntar bugs en un Issue de GitHub | Lista de bugs al día |
| MUST | Guion del pitch (3 min) + guion de la demo (persona: «el Jefe alérgico a frutos de cáscara») | Ensayado 2 veces con cronómetro |
| MUST | Arreglar el Canva: diapo 12 (poner URL real del deploy, quitar email inventado), diapo 9 (cifras sin fuente → hechos verificados o «hipótesis»), diapo 7 (alergias = MUST), diapo 6 («Sustituciones» = añadido) | Ningún dato inventado en el deck |
| MUST | 15:30: grabar vídeo de respaldo de la demo | Vídeo guardado en el móvil y en `docs/` |
| SHOULD | Preguntas del jurado preparadas (¿de dónde salen los datos?, ¿la IA inventa?, privacidad de alergias, ¿por qué en tienda física?) | Respuestas de 1 frase cada una |

---

## Cronograma
| Hora | Hito |
|---|---|
| ahora → 12:00 | Template mergeado y desplegado · Datos amplía recetas · Pitch busca fotos y arregla el deck |
| 12:00 | ✅ Checkpoint 1 (5 min): la app abre en el móvil con datos reales |
| 12:00 → 13:30 | App: pulir MUST · Datos: 15–20 recetas · Pitch: guion + pruebas |
| 13:30 → 14:00 | Comida |
| 14:00 | ✅ Checkpoint 2: demo completa de punta a punta |
| 14:00 → 15:30 | SHOULD + arreglar bugs de los testers |
| **15:30** | 🧊 **Congelación**: no más funciones. Vídeo de respaldo |
| 15:30 → 16:15 | Solo bugs, ensayo del pitch ×2 |
| **16:15** | 🚀 **Entrega** (15 min de margen) |

**Si vamos tarde, se recorta en este orden:** Buscar → mini-mapa de pasillos → cambio de tienda → cesta. Lo que **nunca** se recorta: swipe + alergias + receta con productos reales, precio y nutrición.

## Reglas de oro
1. Una rama por tarea, PR pequeño, solo Bogdan mergea a `main`.
2. La IA no inventa datos: todo sale de los JSON.
3. Probar en un móvil real, no solo en el portátil.
4. Si algo no funciona a las 14:30, se recorta.
