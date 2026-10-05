# data/ — Grupo 🗂️ Datos (Luigi · Onur)

Datos **reales y verificables** del template de SíChef. La app solo lee los JSON estáticos de `app/public/data/` (contrato: `app/src/types.ts`).

| Salida | Contenido |
|---|---|
| `app/public/data/allergens.json` | Los 14 alérgenos UE (Reglamento 1169/2011, Anexo II) con `code`, `name` y `emoji` |
| `app/public/data/products.json` | 20 productos reales de tienda.mercadona.es (almacén `vlc1`, descargados el 2026-10-05) |
| `app/public/data/recipes.json` | 5 recetas reales de Wikilibros, cada ingrediente mapeado a un producto |
| `app/public/data/stores.json` | 2 tiendas **simuladas** con pasillos, ubicación y stock de todos los productos |
| `app/public/img/recipes/<id>.jpg` | Fotos reales de Wikimedia Commons (lado mayor 1000 px) |
| `app/public/img/products/<id>.jpg` | Miniaturas de producto de Mercadona (lado mayor 300 px) |

## Cómo regenerar

```bash
python3 data/scripts/build_template_data.py            # usa la caché de data/raw/
python3 data/scripts/build_template_data.py --refresh  # vuelve a descargarlo todo (precios del día)
python3 data/scripts/validate.py                       # comprueba contra app/src/types.ts (sale con 1 si hay errores)
```

- Solo biblioteca estándar de Python 3.9+ y `sips` (macOS) para redimensionar. Fuera de macOS las imágenes se copian sin redimensionar.
- Descargas brutas en `data/raw/` (ignorado por git): `mercadona/`, `off/`, `ciqual/`, `recipes/`, `commons/`.
- Pausas entre peticiones (0,3 s Mercadona; 1 s Wikimedia/OFF; 3 s al descargar fotos) y reintentos con espera creciente si responden 429.
- `validate.py` lee `types.ts` directamente: si el contrato cambia, la validación cambia con él. Comprueba campos exactos (ni falta ni sobra ninguno), tipos, códigos de alérgeno, que todos los `product_id` de recetas existen, que cada producto tiene ubicación y stock en todas las tiendas, que las imágenes locales existen y que hay al menos un producto «desconocido» usado en una receta.
- `calc.py` es el cálculo de referencia de precio y nutrición (ver más abajo). El script lo usa para imprimir el resumen y el grupo App puede portarlo tal cual.

## Fuentes, licencias y atribuciones

| Dato | Fuente | Licencia / condiciones |
|---|---|---|
| Recetas (ingredientes y pasos) | [Wikilibros · Artes culinarias/Recetas](https://es.wikibooks.org/wiki/Artes_culinarias/Recetas), colaboradores de Wikilibros. Cada receta guarda la URL con `oldid` (revisión exacta). | **CC BY-SA 4.0**. Los textos de `recipes.json` son obra derivada: se comparten con la misma licencia y la app debe citar la fuente. |
| Fotos de los platos | Wikimedia Commons (tabla de abajo) | CC BY / CC BY-SA. Hay que mostrar autor y licencia (`image.author`, `image.license`, `image.source_url`). |
| Productos, precios, formatos, alérgenos, miniaturas | API **no oficial** de `tienda.mercadona.es` (`/api/categories/`, `/api/products/{id}/`, `lang=es`, `wh=vlc1`) | Datos e imágenes © Mercadona. Copia estática solo para la demo del hackathon. La app no llama a la API en directo (no permite CORS). |
| Nutrición (prioridad 1) | [Open Food Facts](https://world.openfoodfacts.org), API v2 por EAN | **ODbL**. La app debe mostrar «Open Food Facts (ODbL)» cuando use estos datos. |
| Nutrición (respaldo, solo frescos) | [CIQUAL 2020](https://ciqual.anses.fr) (ANSES), tabla XML | **Licence Ouverte / Etalab 2.0**. Atribución: «Anses. Table de composition nutritionnelle des aliments Ciqual 2020». |
| Tiendas | Simuladas por este script | Datos inventados a propósito y marcados `simulated: true` / «(simulada)». |

### Recetas y fotos

| Receta (`id`) | Fuente (Wikilibros) | Raciones | Foto (Commons) | Autor · licencia | Por qué sabemos que no es IA |
|---|---|---|---|---|---|
| Pollo con pimientos (`pollo-con-pimientos`) | [Pollo al chilindrón](https://es.wikibooks.org/w/index.php?title=Artes_culinarias/Recetas/Pollo_al_chilindr%C3%B3n&oldid=426798) | 2 | [Pollo al chilindrón-01.jpg](https://commons.wikimedia.org/wiki/File:Pollo_al_chilindr%C3%B3n-01.jpg) | Josue Mendivil · CC BY-SA 2.0 | Importada de Flickr, subida en 2012, EXIF de cámara Olympus µ800 |
| Tortilla de patatas (`tortilla-de-patatas`) | [Tortilla de patatas](https://es.wikibooks.org/w/index.php?title=Artes_culinarias/Recetas/Tortilla_de_patatas&oldid=426812) | 4 | [Tortilla de Patatas (Corte transversal).jpg](https://commons.wikimedia.org/wiki/File:Tortilla_de_Patatas_(Corte_transversal).jpg) | Tamorlan · CC BY-SA 3.0 | Subida en 2012, EXIF Canon EOS 400D |
| Lentejas con chorizo (`lentejas-con-chorizo`) | [Lentejas con chorizo](https://es.wikibooks.org/w/index.php?title=Artes_culinarias/Recetas/Lentejas_con_chorizo&oldid=423975) | 4 | [Quick Lentils with Chorizo (7017166123).jpg](https://commons.wikimedia.org/wiki/File:Quick_Lentils_with_Chorizo_(7017166123).jpg) | Jonathan Pincas · CC BY 2.0 | Foto de Flickr de 2012 |
| Mejillones al vapor (`mejillones-al-vapor`) | [Mejillones al vapor](https://es.wikibooks.org/w/index.php?title=Artes_culinarias/Recetas/Mejillones_al_vapor&oldid=426766) | 1 | [Mejillones cocidos al vapor.jpg](https://commons.wikimedia.org/wiki/File:Mejillones_cocidos_al_vapor.jpg) | Juan Emilio Prades Bel · CC BY-SA 4.0 | Foto de 2021, EXIF Sony DSC-W110 |
| Champiñones al ajillo (`champinones-al-ajillo`) | [Champiñones al ajillo](https://es.wikibooks.org/w/index.php?title=Artes_culinarias/Recetas/Champi%C3%B1ones_al_ajillo&oldid=426712) | 6 | [Champiñones al ajillo (Madrid).jpg](https://commons.wikimedia.org/wiki/File:Champi%C3%B1ones_al_ajillo_(Madrid).jpg) | Tamorlan · CC BY 3.0 | Subida en 2010, EXIF Canon EOS 400D |

- **«Pollo con pimientos»** es el nombre que se muestra (como en el mockup) para el *Pollo al chilindrón* de Wikilibros: pollo guisado con pimientos verdes y rojo, tomate, cebolla y ajo. El título original se conserva en `source.name` y el subtítulo dice «Al chilindrón». No hay ninguna receta titulada exactamente «Pollo con pimientos» con licencia libre clara: la del Community Recipe Dataset de Zenodo procede de recetasgratis.net, así que su licencia CC BY 4.0 es dudosa y no la usamos.
- Pasos: el texto de la fuente con el marcado wiki eliminado. No se ha añadido ni reescrito ningún paso. En el chilindrón se omite el bloque «Variantes», que no es un paso.
- `servings` y `time_min` salen de la ficha de la receta: `comensales` y `tiempo`, convertido a minutos. `tags` salen de las categorías de la página.
- El script comprueba que cada ingrediente mapeado aparece literalmente en la lista de ingredientes de la fuente (campo `src` de `RECIPES`). Si alguien edita un ingrediente que no está en la fuente, el script falla.

## Mapeo ingrediente → producto

Lo elige una persona en la tabla `RECIPES` de `build_template_data.py`. Criterios: el producto más parecido a lo que dice la receta, priorizando Hacendado o fresco y el envase más normal para casa. Ante productos equivalentes, se elige el que tiene ficha nutricional completa en OFF. Por eso se usa el aceite de oliva 1º 1 L (4640) y no el 0,4º, que no está en OFF, y el AOVE Gran Selección 0,75 L (4706) y no el AOVE 1 L (4740), cuya ficha en OFF pone 6 g de hidratos y no tiene sal.

| Receta | Ingrediente (fuente) | Producto Mercadona | Alérgenos | Nutrición |
|---|---|---|---|---|
| Pollo con pimientos | 1 pollo | Pollo entero · 2781 | producto_fresco | sin dato (se vende con hueso) |
| | 1 cebolla | Cebollas 1 kg · 69089 | producto_fresco | CIQUAL |
| | 2 pimientos verdes | Pimiento verde freír · 69320 | producto_fresco | CIQUAL |
| | 1 pimiento rojo | Pimiento rojo · 69310 | producto_fresco | CIQUAL |
| | 4 tomates maduros | Tomate pera · 69912 | producto_fresco | CIQUAL |
| | 3 dientes de ajo | Ajos morados · 69297 | producto_fresco | CIQUAL |
| | aceite de oliva (sin cantidad) · *opcional* | Aceite de oliva 1º Hacendado · 4640 | **desconocido** | OFF |
| | sal · *opcional* | — | — | — |
| Tortilla de patatas | 8 huevos | Huevos grandes L · 31504 | declarado (huevos) | CIQUAL |
| | 1 kg de patatas | Patatas especial para freír · 69448 | producto_fresco | CIQUAL |
| | 1 cebolla | Cebollas · 69089 | producto_fresco | CIQUAL |
| | 1/2 litro de aceite de oliva | Aceite de oliva 1º Hacendado · 4640 | **desconocido** | OFF |
| | sal · *opcional* | — | — | — |
| Lentejas con chorizo | 20 ml de aceite de oliva | Aceite de oliva 1º Hacendado · 4640 | **desconocido** | OFF |
| | 4 dientes de ajo | Ajos morados · 69297 | producto_fresco | CIQUAL |
| | 1 patata | Patata (pieza) · 69066 | producto_fresco | CIQUAL |
| | 1/2 cebolla | Cebollas · 69089 | producto_fresco | CIQUAL |
| | 1 tomate | Tomate pera · 69912 | producto_fresco | CIQUAL |
| | 2 hojas de laurel | Hoja de laurel Hacendado · 47994 | **desconocido** | sin dato |
| | 300 g de chorizo | Chorizo dulce extra Hacendado · 54209 | **desconocido** | OFF |
| | 1 cucharada pequeña de pimentón | Pimentón dulce Hacendado · 60573 | **desconocido** | sin dato |
| | sal, agua · *opcionales* | — | — | — |
| | 1 zanahoria | Zanahorias 0,5 kg · 69669 | producto_fresco | CIQUAL |
| | 1 frasco de lentejas en conserva | Lenteja cocida Hacendado 570 g · 26030 | **desconocido** | OFF |
| Mejillones al vapor | 1 kg de mejillones | Mejillón vivo · 85144 | declarado (moluscos) | sin dato (se vende con concha) |
| | 10 g de sal · *opcional* | — | — | — |
| | 1 limón | Limón (pieza) · 3210 | producto_fresco | CIQUAL |
| Champiñones al ajillo | 1,5 kg de champiñones | Champiñones blancos · 26951 | producto_fresco | CIQUAL |
| | 9 cucharadas soperas de AOVE | AOVE Hacendado Gran Selección · 4706 | **desconocido** | OFF |
| | 3 dientes de ajo | Ajos morados · 69297 | producto_fresco | CIQUAL |
| | 2 cucharadas soperas de perejil picado | Perejil troceado lavado · 69701 | producto_fresco | OFF |
| | limón para zumo (sin cantidad) · *opcional* | Limón · 3210 | producto_fresco | CIQUAL |
| | sal · *opcional* | — | — | — |

### Cantidades (reglas fijas, sin estimar)

1. Si la fuente da gramos o kilos → `g`. Si da ml o litros → `ml`.
2. Si la fuente cuenta piezas («2 pimientos verdes», «1 pollo», «1 limón», «1 frasco») y Mercadona vende **ese producto por pieza o envase con peso publicado** (`price_instructions.unit_size`), se pasa a gramos: `n × unit_size × 1000`. Ejemplo: Pimiento verde freír «Pieza 90 g aprox» → 2 × 90 = 180 g. La `label` mantiene el texto de la receta. Ese peso es el aproximado que publica Mercadona.
3. Cucharadas **solo para líquidos**: cucharada sopera = 15 ml, cucharadita/cucharada pequeña = 5 ml (de volumen a volumen). Ejemplo: 9 cucharadas soperas de AOVE = 135 ml.
4. Todo lo demás se queda en `ud` tal cual (dientes de ajo, hojas de laurel, «1 cebolla» si se vende en malla, cucharadas de sólidos, huevos). No se inventan pesos por unidad.
5. `optional: true` = agua, sal e ingredientes sin cantidad en la fuente («aceite de oliva», «limón para zumo»). Se muestran, pero **no suman** al precio ni a la nutrición. Cuando la fuente no da cantidad, `quantity` es `0` y la `label` lo dice («cantidad no indicada»). La sal y el agua van sin producto (`product_id: null`).

## Alérgenos: reglas fijas (no IA)

Implementado en `parse_allergens()`; se puede probar con cualquier ficha de `data/raw/mercadona/products/`.

1. **Diccionario fijo** de palabras españolas → 14 códigos (`ALLERGEN_KEYWORDS`). Ejemplos: trigo, cebada, centeno, avena → `gluten`; mejillón, almeja, calamar → `moluscos`; gamba, langostino → `crustaceos`; lactosa, nata, queso → `leche`; almendra, avellana, nuez → `frutos_cascara`; dióxido de azufre, E-220…E-228 → `sulfitos`.
2. Campo `nutrition_information.allergens` dividido en frases:
   - «Contiene …» → `contains`
   - «Puede contener …» / «trazas» → `traces`
   - «Libre de …» / «Sin …» / «No contiene …» → se ignora (no informa de los demás alérgenos)
3. Ingredientes (`nutrition_information.ingredients`): cada `<strong>…</strong>` → `contains`, o `traces` si está en una frase «Puede contener». Las frases «Puede contener …» sin negrita también cuentan como trazas.
4. Si hay al menos una declaración reconocida → `status: "declarado"`.
5. Si el campo es `x99`, está vacío o tiene un código desconocido, y no hay negritas → `status: "desconocido"` (la app muestra «dato no disponible»). **Excepción:** producto de **un solo ingrediente sin ingredientes añadidos** de una categoría de fresco → `status: "producto_fresco"` con sus alérgenos inherentes:
   - Categorías admitidas: Fruta · Verdura · Lechuga y ensalada preparada · Aves y pollo · Cerdo · Vacuno · Conejo y cordero · Pescado fresco (→ `pescado`) · Marisco (→ `moluscos`/`crustaceos` según la especie del nombre) · Huevos (→ `huevos`) · Legumbres secas · Arroz.
   - «Un solo ingrediente»: la lista está vacía (fruta y verdura suelen venir así) o es un único ingrediente («Patata», «100% pollo», «Cebolla (Allium cepa)», «Ajo morado, calibre…»), sin comas, «y», ni aditivos E-xxx. La lenteja cocida («Lenteja, agua, sal y antioxidantes») **no** cumple.
6. Interruptor `TREAT_SINGLE_INGREDIENT_PANTRY_AS_FRESH` (por defecto **False**). Con True, el aceite de oliva 100 % (también la mezcla de aceites de oliva) y la sal marina sin aditivos también pasan a `producto_fresco`. Las especias no entran: se envasan donde puede haber contacto cruzado con mostaza, apio o sésamo. Esto lo decide el equipo.

**Resultado actual:** hay 6 productos «desconocido», todos usados en recetas y todos por ficha `x99` en Mercadona. No se ha forzado ninguno.

| Producto | Por qué es «desconocido» |
|---|---|
| Aceite de oliva 1º Hacendado (4640) | `x99` y no es una categoría de fresco |
| AOVE Hacendado Gran Selección (4706) | `x99` y no es una categoría de fresco |
| Chorizo dulce extra Hacendado (54209) | `x99` y producto elaborado (cerdo, pimentón, ajo, sal) |
| Lenteja cocida Hacendado (26030) | `x99` y lleva agua, sal y antioxidantes |
| Pimentón dulce Hacendado (60573) | `x99`, especia |
| Hoja de laurel Hacendado (47994) | `x99`, especia |

Efecto en la demo: con cualquier alergia en el perfil, la regla «desconocido → ocultar» oculta todas las recetas que usan aceite de oliva. Eso incluye el chilindrón si la app también mira los ingredientes opcionales. Las lentejas se ocultan además por el chorizo, el laurel, el pimentón y la lenteja cocida.

## Nutrición

1. **Open Food Facts** por EAN (`/api/v2/product/<ean>.json?fields=nutriments,product_name`, User-Agent `SiChef-hackathon/0.1 (equipo SíChef)`). Se mapean `energy-kcal_100g`, `fat_100g`, `saturated-fat_100g`, `carbohydrates_100g`, `sugars_100g`, `proteins_100g` y `salt_100g`. Filtro de calidad fijo: hacen falta energía, grasas, hidratos y proteínas. Si falta alguno se descarta: la ficha de las cebollas solo trae «0 kcal».
2. **Respaldo CIQUAL 2020** (interruptor `USE_CIQUAL_FALLBACK`, activado por defecto). Solo se usa para productos frescos de un ingrediente que tienen entrada en la tabla fija `CIQUAL_MAP`, por ejemplo Pimiento rojo → «Poivron rouge, cru [20087]». `nutrition_source` dice el alimento y el código exactos. Los valores «< x» (bajo el límite de cuantificación) y «traces» pasan a 0, como permite declarar la guía UE de tolerancias. «-» pasa a `null`.
   - **Desviación respecto al encargo original**, que pedía solo OFF y `null` en lo demás: sin este respaldo, ninguna verdura, el huevo ni la patata tendrían datos, porque los frescos de Mercadona no están en OFF. Con `USE_CIQUAL_FALLBACK = False` se vuelve a solo OFF.
   - **Pollo entero y mejillón vivo no se mapean a propósito.** CIQUAL da valores por 100 g de parte comestible y Mercadona los vende con hueso o concha. Aplicarlos al peso de compra sobrestimaría (×1,4 el pollo, ×3 el mejillón) y no aplicamos factores de desperdicio → `nutrition_100g: null`.
3. Sin dato en ninguna de las dos → `nutrition_100g: null`, `nutrition_source: null` (laurel, pimentón, pollo entero, mejillón vivo).

## Cálculo de precio y nutrición (para el grupo App)

La regla está en `data/scripts/calc.py`. Siempre «calculado», nunca «estimado».

- **Coste de cada ingrediente** (solo los no opcionales con producto):
  - `g` + producto en `kg` → `(q/1000) / unit_size × unit_price`
  - `ml` + producto en `l` → `(q/1000) / unit_size × unit_price`
  - `ud` + producto en `ud` → `q / unit_size × unit_price` (8 huevos de un paquete de 12 → 8/12)
  - cualquier otro caso → **envase completo** (`unit_price`), porque no sabemos cuánto pesa «1 cebolla» de una malla de 1 kg. La app puede indicarlo («incluye envase completo de: cebolla, ajo»).
- **€/ración** = suma de los costes / `servings`.
- **Cesta**: envases enteros, `ceil(fracción)`, mínimo 1; si las unidades no son compatibles, 1 envase.
- **Nutrición por ración**: Σ `q/100 × nutriente` / `servings`, solo con las líneas en `g` o `ml` que tienen `nutrition_100g` (el contrato dice «por 100 g/ml»). Las líneas en `ud` y las que no tienen dato **no se suman**. Hay que marcar la nutrición como parcial y decir qué falta.
- `reference_format` es el de Mercadona tal cual. Además de `kg`/`L`, puede ser `100 g` (hierbas) o `dc` (docena, en huevos). Para calcular hay que usar `unit_price` y `unit_size`, no `bulk_price`.

Resultado con los datos de hoy (2026-10-05, `vlc1`). La segunda columna es el €/ración sin contar las líneas que no se pueden convertir. Así es como lo calcula ahora `app/src/lib/compute.ts`, que las marca como precio parcial. App y Datos tienen que elegir una de las dos reglas para que la tarjeta y la cesta muestren lo mismo.

| Receta | €/ración calculado | €/ración solo con líneas convertibles (parcial) | Cesta (envases enteros) | Envase completo en | Nutrición/ración |
|---|---|---|---|---|---|
| Pollo con pimientos (2) | **6,16 €** | 4,48 € | 12,31 € | cebolla, ajo | parcial: falta el pollo (34 % del peso con dato) |
| Tortilla de patatas (4) | **1,86 €** | 1,48 € | 12,35 € | cebolla | parcial: faltan huevos y cebolla (`ud`); suma los 500 ml de aceite de freír → 1.229 kcal, sobrestimado |
| Lentejas con chorizo (4) | **2,67 €** | 1,09 € | 16,80 € | ajo, cebolla, laurel, pimentón, zanahoria | 555 kcal · 32 g prot · 26 g hidr · 34 g grasas · 2,1 g azúc · 3,8 g sal (sin ajo, cebolla, laurel, pimentón ni zanahoria) |
| Mejillones al vapor (1) | **3,42 €** | 3,42 € | 3,42 € | — | parcial: falta el mejillón (15 % del peso con dato) |
| Champiñones al ajillo (6) | **1,92 €** | 1,46 € | 15,85 € | ajo, perejil | 255 kcal · 6,6 g prot · 7,9 g hidr · 21,4 g grasas · 6,2 g azúc · 0,2 g sal (sin ajo ni perejil) |

## Tiendas simuladas

- «Mercadona Ruzafa (simulada)» con 10 pasillos y «Mercadona Benimaclet (simulada)» con 11 pasillos, ordenados de otra forma.
- El pasillo sale de la sección del producto: categoría de nivel 0 de Mercadona → «Fruta y verdura», «Carne y aves», «Charcutería y embutidos», etc.
- `side` (`izq`/`der`) y `shelf` (`A`…`D`) salen de un hash MD5 de `tienda:producto`. Son deterministas y distintos en cada tienda.
- Stock `true` para todo, salvo **Champiñones blancos (26951) en Benimaclet**, para la demo de «sin stock».

## Limitaciones conocidas

- La API de Mercadona no es oficial y puede cambiar o cortarse. Los precios son los del 2026-10-05 (`fetched_at`). Ningún producto del template tiene hoy `price_decreased: true`, así que el badge «Ha bajado de precio» no saldrá. Algunos traen `previous_unit_price` con el flag a `false` y se copian tal cual.
- No sabemos qué significa exactamente `x99` en Mercadona. Lo tratamos como «desconocido» por seguridad.
- Pesos por pieza «aprox» (pollo 1,9 kg, pimiento 280 g…): son los que publica Mercadona; la pieza real puede variar.
- Las líneas en `ud` sin peso (cebolla en malla, ajo, laurel, pimentón, perejil, huevos) dejan la nutrición parcial. En la tortilla faltan los huevos, que son lo principal.
- La tortilla suma todo el aceite de freír (1/2 L) aunque la receta retira el sobrante. Con el contrato actual no se puede indicar «cuenta para el precio, no para la nutrición».
- CIQUAL describe alimentos genéricos (Francia), no el producto exacto de Mercadona.

### Propuestas de contrato (para App + Datos, no aplicadas)

- `RecipeIngredient.nutrition_grams?: number | null`: gramos que cuentan para la nutrición, separados de la cantidad que se compra. Permitiría poner `null` en el aceite de freír (absorción desconocida) y un peso documentado en los huevos (p. ej. el mínimo de la talla L de la ficha de Mercadona, «> 63 g»), si el equipo lo acepta.
- `Product.edible_fraction?: number | null`: solo con una fuente abierta de porción comestible. Desbloquearía el pollo entero y el mejillón vivo.
