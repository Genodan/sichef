# SíChef

> **Tú dices sí. SíChef hace el resto.**
> Hackathon Mercadona · *Construye el supermercado del futuro*

SíChef une dos ideas en una sola app:
- **Puerta de entrada (Idea 2):** swipe de recetas tipo Tinder. Cada tarjeta muestra nombre, imagen real del plato, valores nutricionales y alérgenos. En tu perfil marcas tus alergias y esas recetas no te aparecen. Las recomendaciones aprenden de tus «sí».
- **Motor (Idea 1):** cada receta se convierte en productos reales de Mercadona, con todos los ingredientes, precio, valores nutricionales y posición (pasillo/lineal) en cada tienda.

**Regla de oro: la IA no inventa, reelabora.** Solo usamos datos que existen (catálogo, precios, alérgenos, nutrición, ubicación). Si falta un dato, la app muestra «dato no disponible».

## Equipo
| Área | Personas (GitHub) | Carpeta |
|---|---|---|
| 📱 App | Bogdan ([@Genodan](https://github.com/Genodan)) · Hugo ([@Hugog22](https://github.com/Hugog22)) | `app/` |
| 🗂️ Datos | Luigi ([@luicons01](https://github.com/luicons01)) · Onur ([@TuqRu1337](https://github.com/TuqRu1337)) | `data/` y `app/public/data/` |
| 🎤 Pitch | Martín ([@MartinLiarte](https://github.com/MartinLiarte)) · Andrés ([@AndresN1](https://github.com/AndresN1)) | `docs/` |

Integrador del código: **Bogdan**. Solo él mergea a `main`.

## Arrancar la app
```bash
cd app
npm install
npm run dev
```

## Estructura
```
app/                 Web app (Vite + React + TypeScript), mobile-first
app/public/data/     JSON que lee la app (products, recipes, stores, allergens)
data/scripts/        Scripts de descarga y limpieza de datos
data/raw/            Descargas brutas (no se suben al repo)
docs/                Pitch, guion, capturas, decisiones
```

## Reglas para trabajar juntos
- Cada grupo toca **solo su carpeta**.
- Trabaja en una rama (`app/swipe`, `data/catalogo`, `docs/pitch`…) y abre un Pull Request; el integrador mergea.
- Commits pequeños y frecuentes. Nada de claves ni `.env` en el repo.
- La app **no llama a la API de Mercadona en directo** (no permite CORS): usa los JSON de `app/public/data/`.

## Fuentes y atribuciones
- Catálogo y precios: API pública (no oficial) de tienda.mercadona.es, copiada en JSON para la demo.
- Valores nutricionales: [Open Food Facts](https://world.openfoodfacts.org), licencia ODbL.
- Fotos de platos: solo fotos reales con permiso o licencia (autor y licencia en `recipes.json`). Nunca imágenes generadas por IA.
