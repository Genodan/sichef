# SíChef — reglas para la IA (todos los asistentes de código leen este archivo)

## Producto
SíChef: app web mobile-first para el hackathon de Mercadona («Construye el supermercado del futuro»).
Eslogan: «Tú dices sí. SíChef hace el resto.»
- **Puerta (Idea 2):** swipe de recetas tipo Tinder. Tarjeta = nombre, foto real, valores nutricionales, alérgenos (+ €/ración). Perfil con alergias: las recetas con esos alérgenos NO aparecen. Recomendación según los «sí» anteriores.
- **Motor (Idea 1):** la receta se convierte en productos reales de Mercadona: todos los ingredientes, precio, valores nutricionales y posición (pasillo/lineal) en cada tienda.
- Flujo: Descubre → Desliza → Confirma → Ajusta cesta → Traza ruta → Compra.
- Pestañas: Descubre · Buscar («¿Qué cocino con esto?») · Recetario · Cesta · Perfil.

## Reglas duras (no negociables)
1. **La IA no inventa datos.** Precios, nutrición, alérgenos, fotos y pasos de receta salen SOLO de los JSON de `app/public/data/`. Nunca escribas cifras, productos o recetas "de ejemplo" en el código.
2. Si falta un dato → mostrar **«dato no disponible»**. Nunca rellenar ni estimar.
3. **Alérgenos con reglas fijas, no con IA.** Filtro duro ANTES de recomendar. Trazas («Puede contener») se excluyen por defecto. Si un producto tiene alérgenos `desconocido` y el usuario tiene alergias → la receta se oculta y se explica por qué.
4. Precio y nutrición de la receta los **calcula el código** (suma de productos), y se dice «calculado», nunca «estimado».
5. Nada de «ofertas» ni «% OFF»: Mercadona es Siempre Precios Bajos. Solo el badge «Ha bajado de precio» si `price_decreased` es true.
6. Fotos de platos: solo reales con licencia y atribución. Nunca imágenes generadas por IA.
7. La app **no llama a la API de Mercadona en directo** (no permite CORS). Solo lee los JSON estáticos.
8. Las tiendas son **simuladas** (`stores.json`) y la UI lo indica.

## Stack
- `app/`: Vite + React 19 + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`) + `motion` (swipe) + `lucide-react` (iconos).
- Sin backend, sin login. Estado del usuario en `localStorage`.
- Textos de la interfaz en **español**.
- Contrato de datos: `app/src/types.ts` (fuente de verdad). Si cambias el contrato, avisa a App y Datos.

## Diseño
Inspirado en el mockup del equipo: fondo verde `#1f8a4c`, logo «Sí» blanco + «Chef» amarillo, tarjeta blanca redondeada con foto grande, barras de nutrientes, botones circulares (✕ rojo «Paso», ↑ «Ver receta», → verde «¡Sí!»), CTA naranja `#f7a21b`, barra inferior con 5 pestañas. En escritorio la app se muestra dentro de un marco de móvil.

## Organización del repo
| Carpeta | Grupo | Quién la toca |
|---|---|---|
| `app/` | 📱 App (Bogdan · Hugo) | solo App |
| `data/`, `app/public/data/`, `app/public/img/` | 🗂️ Datos (Luigi · Onur) | solo Datos |
| `docs/` | 🎤 Pitch (Martín · Andrés) | solo Pitch |

- Trabaja en una rama (`app/…`, `data/…`, `docs/…`) y abre un PR. Solo el integrador mergea a `main`.
- Antes de un PR: `cd app && npm run build` sin errores.
- Nunca subas `.env`, claves ni `data/raw/`.
