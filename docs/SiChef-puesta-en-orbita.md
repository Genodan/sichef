# SíChef — «Desliza a la derecha y dile sí a tu cena.»

Hackathon Mercadona · *Construye el supermercado del futuro* · Puesta en Órbita (deadline 10:30h)

## 🇮🇹 Note per te

Integrazione: l'Idea 2 (swipe tipo Tinder + profilo allergie) è la porta d'ingresso; l'Idea 1 (app collegata all'API Mercadona) è il motore che trasforma la ricetta in spesa reale, con tutti gli ingredienti, i prezzi, i valori nutrizionali e la posizione in ogni supermercato. Tutti i punti di entrambe le idee restano espliciti (slide 4 e lista features). Su indicazione della giuria ho dato più peso all'Idea 1 con una seconda porta, «¿Qué cocino con esto?», e con 2 negozi simulati, così «in ogni supermercato» è rispettato alla lettera.

Aggiunte: tutto ciò che non viene dalle idee originali è marcato [AÑADIDO] ed è opzionale. Le 3 da mettere in evidenza: lista per corsia; profilo famiglia multi-allergia + tracce + «dato no disponible»; costo per porzione + modalità budget.

Rischi da risolvere subito:
1) Foto dei piatti: nessun dataset aperto le ha. Il León deve chiedere ORA all'organizzazione il ricettario di info.mercadona.es con le foto; piano B: foto CC con attribuzione.
2) Allergeni: il 42% del campione è «x99» o vuoto. In demo usate ricette con dati completi e mostrate apposta un caso «dato no disponible».
3) L'API non ha valori nutrizionali: usate Open Food Facts per EAN, citando ODbL.
4) L'API non è ufficiale: copia JSON, niente chiamate live.
5) ESL/server interno non confermati: mock con un contratto definito.

Consigli della giuria:
- Mai «stimato», dite «calcolato».
- Mai «offerta»: Mercadona fa Siempre Precios Bajos, dite «ha bajado de precio».
- Sostituzioni solo dentro lo stesso ingrediente.
- Chiamate il cliente «el Jefe» e puntate sul negozio fisico (l'online è il 2,5%).
- Portate 2-3 KPI.

Ho tolto le cifre non verificate (EAACI, FACE, INE, MAPA). Il Loro deve parlare spagnolo; il León carica il QR alle 10:25. Slide e testi sono pronti per Canva: mancano solo i [Nombre].

## 📋 Respuestas para el formulario del QR (copiar y pegar)

### 1. ¿Qué solución vamos a aportar para el supermercado del futuro?

Problema: cada día el Jefe decide qué comer sin saber si es seguro para sus alergias, cuánto le cuesta el plato ni dónde está cada producto en su tienda.
Solución: SíChef, una app que une un swipe de recetas tipo Tinder con el catálogo real de Mercadona.
Haces swipe, las recetas con tus alérgenos no aparecen y, al decir «sí», ves todos los ingredientes como productos reales de Mercadona, con precio, valores nutricionales y pasillo/lineal en tu tienda.
La IA no inventa nada: solo reelabora datos que ya existen.

### 2. ¿Cómo nos puede ayudar la IA con esos PAINS?

La IA no crea: filtra, combina, recomienda y explica datos que ya existen.
1. «¿Qué como hoy?» → recomienda recetas reales según tus «sí» anteriores.
2. «¿Es seguro para mis alergias?» → filtro duro con reglas fijas (no IA) sobre los alérgenos oficiales de cada producto; si falta el dato: «dato no disponible».
3. «¿Cuánto cuesta y dónde está?» → la IA empareja cada ingrediente con un producto real del catálogo; el código suma precio y nutrición y lee pasillo y lineal del servidor de tienda (ESL).
Cadena: datos reales → reglas fijas → IA (emparejar, ordenar, explicar) → app.
Control: la IA solo puede citar IDs que existen; si no, su salida se descarta.

### 3. ¿Qué solución escogemos?

SíChef: integramos las dos ideas en una sola app, sin quitar nada.
• Idea 2 (swipe tipo Tinder + perfil de alergias) = la puerta de entrada: decides qué cocinar.
• Idea 1 (app conectada a la API de Mercadona) = el motor: la receta se convierte en compra real con todos sus ingredientes, precios, valores nutricionales y posición en cada supermercado.
Dos entradas: «Descubrir» (swipe) y «¿Qué cocino con esto?» (de un producto a recetas existentes).
Flujo: perfil con alergias → swipe → «sí» → receta con productos reales, precio y nutrición → pasillo y lineal en tu tienda.
Supuesto del reto: etiquetas digitales (ESL) + servidor interno de cada tienda.

### 4. ¿Qué funcionalidades tiene nuestra solución?

Leyenda: [I1] Idea 1 · [I2] Idea 2 · [AÑADIDO] añadido propuesto, opcional.
1. Perfil: alergias que ocultan las recetas con esos alérgenos [I2]; trazas y perfil hogar [AÑADIDO].
2. Descubrir: swipe con nombre, imagen real, valores nutricionales y alergias del plato [I2].
3. Receta: crear recetas combinando recetas reales con productos reales del catálogo; ver todos los ingredientes [I1].
4. Precio y nutrición: precio por producto y total, valores nutricionales calculados [I1]; coste por ración [AÑADIDO].
5. Tienda: posición de cada producto en cada supermercado vía servidor interno/ESL [I1]; lista ordenada por pasillo [AÑADIDO].
6. Recomendación: según tus «sí» anteriores, con el filtro de alergias aplicado antes [I2]; «¿por qué esta receta?» [AÑADIDO].

### 5. ¿Qué funcionalidades priorizamos desarrollar para nuestro MVP?

MUST 1: perfil con alergias + filtro duro + swipe (nombre, imagen, nutrición, alérgenos) + recomendación por likes [I2]; trazas y «dato no disponible» [AÑADIDO].
MUST 2: receta con todos los ingredientes mapeados a productos reales de Mercadona, precio total y nutrición calculada [I1]; fuente de cada dato [AÑADIDO].
MUST 3: posición (pasillo y lineal) de cada producto en 2 tiendas simuladas con selector [I1].
SHOULD: «¿Qué cocino con esto?» [I1] · lista por pasillo con mapa + coste por ración [AÑADIDO].
WON'T: integración real con ESL/servidor interno (mock con el mismo contrato) · generar recetas, imágenes o datos con IA (nunca: es un principio).
Datos de la demo: catálogo y precios reales (copia JSON de la API), nutrición de Open Food Facts, 20 recetas con foto real.

### 6. Identidad -> Nombre y Eslogan

Nombre: SíChef
Eslogan: «Desliza a la derecha y dile sí a tu cena.»
Frase secundaria: «Recetas, precios y pasillos reales. La IA no inventa.»
Por qué: se dice igual en español y en italiano («Sì, chef»), el «sí» es el like del swipe, no suena a «otro Tinder», el nombre no limita la app a las cenas y guiña al Jefe.

### 7. ¿Quién hace qué?

León – [Nombre]: Product Owner. Prioriza el MVP, controla el tiempo, pide a la organización el recetario con fotos y sube la entrega por QR.
Cocodrilo – [Nombre]: Backend y datos. Copia del catálogo (API), nutrición de Open Food Facts, alérgenos normalizados y mock de tienda/ESL.
Perro – [Nombre]: IA. Mapeo ingrediente→producto, filtro de alérgenos, recomendador por likes y cálculo de precio y nutrición.
Zorro – [Nombre]: Frontend. Swipe, ficha de receta, perfil, selector de tienda y lista por pasillo.
Pollito – [Nombre]: Diseño. Logo, paleta, mockups, Canva y vídeo de respaldo de la demo.
Loro – [Nombre] (hispanohablante): Pitch y negocio. Guion, cifras con fuente, KPI y ensayos.

### 8. Entrega PUESTA EN ÓRBITA usando el QR

SíChef – «Desliza a la derecha y dile sí a tu cena.»
App para el supermercado del futuro que integra dos ideas: un swipe de recetas con perfil de alergias (Idea 2) y el catálogo de Mercadona con productos, precios, valores nutricionales y posición en cada tienda (Idea 1).
La IA no inventa: empareja, filtra, recomienda y explica datos existentes; precio y nutrición los calcula el código.
MVP: alergias → swipe → «sí» → receta con productos reales, precio y nutrición → pasillo en 2 tiendas simuladas.
Equipo: [nombres] · Presentación: [enlace Canva]

## 🧩 Funcionalidades (origen y prioridad MVP)

| Módulo | Funcionalidad | Origen | MVP |
|---|---|---|---|
| 1. Perfil | Alergias en el perfil (14 alérgenos del Reglamento UE 1169/2011) | IDEA 2 | MUST |
| 1. Perfil | Las recetas con tus alérgenos no aparecen (filtro duro con reglas fijas, aplicado antes de recomendar) | IDEA 2 | MUST |
| 1. Perfil | Excluir también trazas («Puede contener»), activado por defecto | AÑADIDO PROPUESTO | MUST |
| 1. Perfil | Aviso «dato no disponible»: si un producto tiene x99, campo vacío o código desconocido, la receta se oculta a quien tiene alergias y se le explica por qué | AÑADIDO PROPUESTO | MUST |
| 1. Perfil | Perfil Hogar multi-alergia (varios miembros en una cuenta) | AÑADIDO PROPUESTO | COULD |
| 1. Perfil | Dieta, comensales y presupuesto en el perfil | AÑADIDO PROPUESTO | COULD |
| 2. Descubrir (swipe) | Swipe tipo Tinder: derecha = sí, izquierda = no | IDEA 2 | MUST |
| 2. Descubrir (swipe) | Tarjeta con nombre del plato | IDEA 2 | MUST |
| 2. Descubrir (swipe) | Tarjeta con imagen del plato (foto real de la fuente o CC con atribución, nunca generada) | IDEA 2 | MUST |
| 2. Descubrir (swipe) | Tarjeta con valores nutricionales por ración (mínimos del art. 30) | IDEA 2 | MUST |
| 2. Descubrir (swipe) | Tarjeta con alergias (alérgenos de la receta) | IDEA 2 | MUST |
| 2. Descubrir (swipe) | Coste por ración en la tarjeta (precio calculado, no estimado) | AÑADIDO PROPUESTO | SHOULD |
| 2. Descubrir (swipe) | Distintivo «ha bajado de precio» (endpoint real price-drops) | AÑADIDO PROPUESTO | COULD |
| 2. Descubrir (swipe) | Modo accesible: botones Sí/No además del swipe, letra grande | AÑADIDO PROPUESTO | COULD |
| 2. Descubrir (swipe) | Onboarding con 5 swipes de calentamiento variados | AÑADIDO PROPUESTO | COULD |
| 3. Receta | Crear recetas: receta real existente + productos reales del catálogo (la IA empareja, no inventa platos) | IDEA 1 | MUST |
| 3. Receta | Ver todos los ingredientes de la receta | IDEA 1 | MUST |
| 3. Receta | Cada ingrediente mapeado a un producto real de Mercadona (foto, formato, precio); mapeo precalculado por IA y validado por una persona | IDEA 1 | MUST |
| 3. Receta | Fuente y fecha de cada dato + pantalla de trazabilidad del mapeo (incluye atribución ODbL) | AÑADIDO PROPUESTO | MUST |
| 3. Receta | «¿Qué cocino con esto?»: de un producto a recetas existentes que lo usan (consulta a BD, sin IA) | IDEA 1 | SHOULD |
| 3. Receta | Cambiar el producto dentro del mismo ingrediente (otra marca o formato del catálogo) | AÑADIDO PROPUESTO | COULD |
| 3. Receta | Raciones reales: escalar comensales y calcular envases completos a comprar | AÑADIDO PROPUESTO | COULD |
| 3. Receta | Pasos de la receta tomados de la fuente original (no generados) | AÑADIDO PROPUESTO | COULD |
| 4. Precio y nutrición | Ver el precio de cada producto (API de Mercadona) | IDEA 1 | MUST |
| 4. Precio y nutrición | Precio total de la receta (suma calculada) | IDEA 1 | MUST |
| 4. Precio y nutrición | Valores nutricionales por producto (demo: Open Food Facts por EAN; producción: dato interno; «sin dato» si falta) | IDEA 1 | MUST |
| 4. Precio y nutrición | Valores nutricionales de la receta = suma calculada de los productos («nutrición parcial» si falta alguno) | IDEA 1+2 | MUST |
| 4. Precio y nutrición | Alérgenos de la receta = unión de los alérgenos de los productos (campo allergens + <strong> de ingredientes) y de la receta original | IDEA 1+2 | MUST |
| 4. Precio y nutrición | Modo presupuesto (p. ej., cena para 4 por menos de 15 €) | AÑADIDO PROPUESTO | COULD |
| 4. Precio y nutrición | Semáforo nutricional (grasas, saturadas, azúcares, sal); Nutri-Score solo si Open Food Facts lo trae por producto | AÑADIDO PROPUESTO | COULD |
| 4. Precio y nutrición | Transcripción OCR de la etiqueta trasera (solo nutrición, validada, marcada «transcrito») | AÑADIDO PROPUESTO | WONT |
| 5. Tienda y ubicación | Posición de cada producto en cada supermercado (pasillo, lineal, balda) | IDEA 1 | MUST |
| 5. Tienda y ubicación | Interfaz con servidor interno de tienda + ESL (mock con contrato definido: posición, stock, precio) | IDEA 1 | MUST |
| 5. Tienda y ubicación | Selector de tienda: 2 tiendas simuladas, mismo producto en distinto pasillo | IDEA 1 | MUST |
| 5. Tienda y ubicación | Del match al carro: lista unificada ordenada por pasillo con mapa en rejilla | AÑADIDO PROPUESTO | SHOULD |
| 5. Tienda y ubicación | Integración real con el servidor interno y las etiquetas digitales (requiere acceso oficial) | IDEA 1 | WONT |
| 5. Tienda y ubicación | Sustitución por stock solo dentro del mismo ingrediente (otra marca/formato) | AÑADIDO PROPUESTO | WONT |
| 5. Tienda y ubicación | Pick-to-light: la etiqueta digital se ilumina al acercarte | AÑADIDO PROPUESTO | WONT |
| 5. Tienda y ubicación | Escanear la etiqueta (NFC/QR) y ver recetas con ese producto | AÑADIDO PROPUESTO | WONT |
| 5. Tienda y ubicación | Enviar la lista al carrito de la compra online | AÑADIDO PROPUESTO | WONT |
| 6. Recomendación IA | Recomendar recetas según los likes anteriores (similitud de ingredientes y etiquetas, Jaccard) | IDEA 2 | MUST |
| 6. Recomendación IA | La IA reelabora (empareja, filtra, ordena, explica) y nunca genera; salida validada contra IDs existentes | IDEA 1+2 | MUST |
| 6. Recomendación IA | «¿Por qué esta receta?» con plantilla y umbrales fijos, sin texto libre | AÑADIDO PROPUESTO | COULD |
| 6. Recomendación IA | Modo despensa: priorizar recetas con lo que ya tengo en casa | AÑADIDO PROPUESTO | COULD |
| 6. Recomendación IA | Match en grupo (pareja o familia hacen swipe juntos) | AÑADIDO PROPUESTO | WONT |
| 6. Recomendación IA | Planificador semanal con lista única | AÑADIDO PROPUESTO | WONT |
| 6. Recomendación IA | Panel de demanda B2B para Mercadona (agregado, anónimo, opt-in) | AÑADIDO PROPUESTO | WONT |
| 6. Recomendación IA | Generar recetas, imágenes o datos con IA (nunca: es un principio, no una limitación de tiempo) | IDEA 1+2 | WONT |

## ➕ Añadidos propuestos (opcionales, no sustituyen nada)

- **Del match al carro (lista por pasillo)**: Junta los ingredientes de las recetas con «sí» en una sola lista, suma los repetidos y la ordena por pasillo de la tienda elegida, con un mapa sencillo en rejilla. — *Es el pegamento entre la Idea 2 (swipe) y la Idea 1 (posición en tienda). Poco esfuerzo y mucho efecto en la demo. MVP: SHOULD.*
- **Excluir trazas («Puede contener»)**: Opción del perfil, activada por defecto, que trata las trazas como alérgeno. — *Seguridad alimentaria con un dato que ya existe en la ficha (62 menciones de «Puede contener» en la muestra). MVP: MUST.*
- **Aviso «dato no disponible»**: Si un producto trae «x99», campo vacío o un código desconocido, se marca como no disponible. A quien tiene alergias se le oculta la receta y se le dice por qué («1 receta oculta por falta de datos»). — *Aplica el principio «la IA no inventa» y es el momento de confianza del pitch. MVP: MUST.*
- **Fuente y fecha de cada dato (trazabilidad)**: Cada precio, valor nutricional y alérgeno indica de dónde viene (API Mercadona, Open Food Facts ODbL, tienda) y cuándo se tomó. Incluye la pantalla del mapeo ingrediente→producto. — *Responde antes de tiempo a «¿y si la IA se inventa algo?» y cumple la atribución obligatoria de ODbL. MVP: MUST.*
- **Perfil Hogar multi-alergia**: Varios miembros en una cuenta; el filtro excluye la suma de los alérgenos de todos. — *Amplía la parte más humana de la Idea 2: una sola comida segura para toda la familia. Fideliza a quien hace la compra. COULD.*
- **Coste por ración y raciones reales**: Dos precios honestos: por ración (proporcional a lo usado) y «lo que pagas en caja» (envases completos). Al cambiar comensales se recalculan cantidades, precio y nutrición. — *Usa el dato más fuerte de la Idea 1 y encaja con Siempre Precios Bajos: el valor está en el coste por plato, no en el precio en tiempo real. Coste por ración: SHOULD; escalar raciones: COULD.*
- **Modo presupuesto**: El swipe solo muestra recetas cuyo precio calculado entra en un límite (p. ej., cena para 4 por menos de 15 €). — *El jurado lo entiende al instante y refuerza Siempre Precios Bajos. COULD.*
- **¿Por qué esta receta?**: Explicación con plantilla y umbrales fijos: «comparte garbanzos con Hummus, que te gustó · sin frutos de cáscara · [precio calculado]/ración». Sin texto libre de un modelo. — *Hace visible que la recomendación usa solo datos existentes. COULD.*
- **«Ha bajado de precio»**: Distintivo en la tarjeta cuando algún producto de la receta aparece en el endpoint real de bajadas de precio. — *Dato real que ya existe; no es una oferta, así que no choca con Siempre Precios Bajos. COULD.*
- **Semáforo nutricional**: Semáforo por ración con grasas, saturadas, azúcares y sal (datos obligatorios del art. 30). Nutri-Score solo cuando Open Food Facts lo trae por producto, nunca para una receta. — *Salud de un vistazo sin estimar datos que no tenemos (fibra, % de fruta y verdura). COULD.*
- **Sustitución por stock (mismo ingrediente)**: Si un producto está agotado en tu tienda, propone otra marca o formato del MISMO ingrediente. Un ingrediente distinto solo si la receta original lo da o hay una tabla de equivalencias validada por una persona. — *No se pierde la venta y no se crean recetas nuevas. Roadmap (WON'T en el hackathon).*
- **Match en grupo**: La pareja o la familia hacen swipe en la misma sesión; una receta es «sí» solo cuando todos la aceptan. — *Resuelve el eterno «¿qué cenamos?» y sirve de cierre «wow» como visión de futuro. Roadmap.*
- **Pick-to-light con etiquetas digitales**: La etiqueta digital del producto parpadea cuando el cliente se acerca con la lista activa. — *Solo es posible con ESL: es la imagen del supermercado del futuro. Diapositiva, no demo.*
- **Panel de demanda B2B**: Panel para Mercadona con los «sí» agregados y anónimos por zona y tienda (opt-in, mínimo de usuarios por grupo). — *Previsión de stock y menos merma. Maqueta en el pitch; nunca datos individuales (RGPD art. 9).*
- **Modo accesible**: Botones Sí/No además del swipe, letra grande y alto contraste; en el futuro, lectura en voz alta. — *Llega a personas mayores o con discapacidad, es decir, a todos los clientes de Mercadona. COULD.*

## 🏷️ Alternativas de nombre

- **CenaMatch** — «¿Qué ceno? Desliza y haz match.». «Cena» se dice igual en español y en italiano y el nombre recoge el problema diario. Pega: «match» alimenta el ataque de «otro Tinder» y limita la app a las cenas.
- **Receta Real** — «La IA no inventa: combina lo que hay en tu Mercadona.». Lleva el principio del equipo en el nombre y transmite confianza. Funciona mejor como frase secundaria que como marca.
- **CarroMatch** — «Del swipe al carro, y del carro al pasillo.». Une las dos ideas de forma explícita y pone delante el valor de negocio para Mercadona (del «sí» a la compra en tienda).
- **Gusto** — «A tu gusto, con lo que hay en tu súper.». Misma palabra en español e italiano, corta y cercana; «me gusta» es el like. Riesgo: demasiado genérica para registrarla o buscarla.
- **Swipe&Cook** — «Desliza. Compra. Cocina.». Tres verbos que son los tres pasos del producto (Idea 2 → Idea 1). En inglés queda menos cercana al cliente de Mercadona.

## 🐾 ¿Quién hace qué?

- 🦁 **León – Product Owner y coordinación**: [Nombre]. Prioriza el MVP, controla el tiempo, decide en caso de empate y hace check-ins de 5 min cada 90 min. AHORA: pide a la organización el recetario de info.mercadona.es con fotos y acceso a datos oficiales. Sube la entrega por QR a las 10:25. Prepara con el Loro las preguntas del jurado.
- 🐊 **Cocodrilo – Backend y datos de Mercadona**: [Nombre]. Copia JSON de 100–150 productos de las recetas (API no oficial, sin llamadas en directo). Cruce con Open Food Facts por EAN. Normalizador de alérgenos a 14 códigos (contiene/trazas/libre/desconocido; x99 y vacío = desconocido; segunda fuente: <strong> de ingredientes). Mock del servidor de tienda/ESL con 2 tiendas.
- 🐶 **Perro – IA, recomendación y cálculos**: [Nombre]. Mapeo ingrediente→producto precalculado (la IA propone entre candidatos reales, una persona valida). Filtro duro de alérgenos. Recomendador por likes (Jaccard sobre ingredientes y etiquetas). Precio total, coste por ración y nutrición calculados por código. Validación: solo IDs existentes.
- 🦊 **Zorro – Frontend y UX**: [Nombre]. Pantalla de swipe, ficha de receta (ingredientes, productos, precio, nutrición, fuente), perfil con alergias, selector de tienda, lista por pasillo con mapa en rejilla y flujo completo de la demo.
- 🐥 **Pollito – Diseño, identidad y Canva**: [Nombre]. Logo SíChef, paleta, mockups, presentación en Canva y capturas. Revisa licencias y atribución de las fotos de los platos. Graba el vídeo de respaldo de la demo a las 15:30.
- 🦜 **Loro – Pitch y negocio (hispanohablante)**: [Nombre]. Relato centrado en la tienda física y en el Jefe, cifras siempre con fuente, 2–3 KPI, guion cronometrado y 2 ensayos. Respuestas preparadas: «¿de dónde salen los datos?», «¿la IA inventa?», «¿cómo protegéis los datos de alergias?», «¿quién mapea miles de recetas?».

## 🎤 Guion del pitch (~3 min)

[Diapo 1 · Portada · 8 s] (Loro) Hola, somos [equipo], un equipo de Italia y España. Esto es SíChef.

[Diapo 2 · Problema · 18 s] Son las nueve de la noche. El Jefe abre la nevera y piensa: ¿qué ceno hoy? Y detrás llegan tres preguntas más: ¿es seguro para la alergia de mi hija?, ¿cuánto me cuesta el plato? y ¿dónde está cada producto en mi Mercadona? Las respuestas ya existen, pero están repartidas en cientos de etiquetas.

[Diapo 3 · IA · 20 s] Nuestra regla es sencilla: la IA no inventa, reelabora. Partimos de datos reales: catálogo, precios, alérgenos, nutrición y posición en el lineal. Lo crítico, como el filtro de alérgenos o la suma de precios, lo hacen reglas fijas. La IA solo empareja ingredientes con productos reales, ordena recetas según tus gustos y explica por qué. Si falta un dato, lo decimos: «dato no disponible». Y tus alergias se quedan en tu móvil.

[Diapo 4 · Dos ideas · 12 s] Llegamos con dos ideas y no hemos tirado ninguna. El Tinder de recetas con perfil de alergias es la puerta de entrada. La app conectada al catálogo de Mercadona, con precios, nutrición y posición en cada tienda, es el motor.

[Diapo 5 · Flujo · 18 s] Marcas tus alergias. Haces swipe y solo ves recetas seguras para ti. Dices «sí» y la receta se convierte en productos reales de tu Mercadona, con precio total, nutrición y el pasillo de cada uno. Y funciona al revés: tienes un producto en la mano y preguntas «¿qué cocino con esto?».

[Diapo 6 · Funcionalidades · 7 s] Seis módulos: perfil, descubrir, receta, precio y nutrición, tienda y recomendación. Lo que hemos añadido nosotros va marcado como añadido.

[Diapo 7 · MVP · 15 s] Hoy demostramos el recorrido completo: alergias, swipe y recomendación; receta con productos reales, precio y nutrición; y posición en dos tiendas. Las etiquetas electrónicas las simulamos con el mismo contrato que tendría la integración real. Y no generamos nada con IA. Nunca.

[Diapo 8 · Demo · 25 s] Soy alérgico a los frutos de cáscara: ninguna tarjeta los lleva. Doy dos «sí» a platos de legumbres y el mazo cambia. Elijo garbanzos con espinacas: cada ingrediente es un producto real, con su precio por ración calculado y su fuente. Cambio de tienda: mismo producto, otro pasillo. Y aquí, una receta oculta porque un producto no declara sus alérgenos. Preferimos no enseñar una receta antes que inventar un dato.

[Diapo 9 · Valor para Mercadona · 25 s] ¿Por qué en la tienda? Porque la venta online es el 2,5 % de Mercadona: el resto pasa por la tienda física. Con el nuevo modelo de tienda T9 en 59 tiendas en 2026 y el piloto de etiquetas electrónicas en Valencia, el dato de tienda ya está llegando. El swipe es la puerta; el dato de tienda es lo que nadie puede copiar. Lo mediremos con tres KPI: porcentaje de «sí» que acaban en compra completa, recetas sin rotura de stock y minutos en tienda.

[Diapo 10 · Identidad · 10 s] Por eso SíChef: «Sì, chef» en italiano, «¡Sí, chef!» en español. Desliza a la derecha y dile sí a tu cena.

[Diapo 11 · Equipo · 12 s] Somos seis: el León marca el rumbo, el Cocodrilo sostiene los datos, el Perro olfatea tus gustos y tus alergias, el Zorro hace el swipe, el Pollito le da color y yo, el Loro, os lo cuento.

[Diapo 12 · Cierre · 10 s] Recetas, precios y pasillos reales. La IA no inventa: reelabora lo que ya existe en vuestras tiendas. Gracias.

(Duración total aproximada: 3 minutos. Si hay que recortar, se acortan las diapositivas 6 y 11.)

## 🔧 Datos técnicos verificados y fuentes

CONFIRMADO (llamadas reales a la API el 05/10/2026 y búsqueda web):

1) API no oficial de tienda.mercadona.es, sin login
- GET /api/categories/?lang=es&wh=vlc1 → 26 categorías y 152 subcategorías.
- GET /api/categories/{id}/ → secciones y productos; recorriendo las 152 subcategorías de vlc1 salen 4.318 productos únicos (incluye no alimentación).
- GET /api/products/{id}/ → ficha completa: id, ean, display_name, brand, packaging, categories (3 niveles), thumbnail y photos[] (perspective 9 = etiqueta trasera con la tabla nutricional, solo como imagen), price_instructions (unit_price, bulk_price, reference_price, reference_format, size_format, unit_size, previous_unit_price como texto con espacios, price_decreased, tax_percentage, is_pack, pack_size, approx_size, selling_method…), nutrition_information (solo ingredients y allergens, en HTML; el alérgeno va en <strong>), details (origin, suppliers, usage_instructions, storage_instructions, is_prepared_by_mercadona…).
- Otros endpoints: /api/products/{id}/similars/ (5), /api/products/{id}/xselling/ (10), /api/home/, /api/home/price-drops/ (166 productos), /api/home/new-arrivals/ (51). lang=en traduce nombres.
- NO existe: /api/products/ (listado) ni /api/recipes/ (404); valores nutricionales estructurados (kcal, grasas…); pasillo, posición o stock de tienda física.
- Alérgenos (muestra de 107 productos de alimentación): texto literal del Anexo II del Reglamento 1169/2011 con «Contiene» (108 menciones), «Puede contener» (62) y «Libre de» (14). Calidad: 38 con «x99», 7 vacíos (42 % sin dato) y códigos sueltos (gb, gs, go, sh, sw, ml, ca, fa). Regla: x99, vacío o código desconocido = «dato no disponible», nunca «sin alérgenos». Segunda fuente fija sin IA: el <strong> de la lista de ingredientes.
- Documentación de terceros: https://github.com/datania/mercadona-catalog/blob/main/api.md · https://github.com/m0wer/mercaapi

2) Nutrición sin inventar
- Open Food Facts por EAN (ej.: arroz redondo Hacendado, 344 kcal/100 g, Nutri-Score b). La API devuelve 429 enseguida: usar el volcado CSV/JSONL. Licencia ODbL con atribución obligatoria. https://world.openfoodfacts.org/data
- Si no hay dato: «sin dato». No usar estimaciones (mercaapi estima cuando falta, y eso sería inventar).

3) Recetas e imágenes
- Mercadona publica recetas en info.mercadona.es (Consejos > Alimentación), p. ej. https://info.mercadona.es/es/consejos/alimentacion/receta-de-gazpacho-andaluz/tip, pero el sitio bloquea las peticiones automáticas (403): hay que pedirlas a la organización.
- Zenodo Community Recipe Dataset: 12.641 recetas en español, CC BY 4.0, sin imágenes. https://zenodo.org/records/4681803
- somosnlp/recetas-cocina: 28.238 recetas, MIT, sin imágenes, derechos de origen dudosos. https://huggingface.co/datasets/somosnlp/recetas-cocina
- TheMealDB: con imágenes, en inglés; uso comercial de pago. https://www.themealdb.com/terms_of_use.php
- Imagen del plato: solo fotos reales (fuente con permiso, CC con atribución o fotos del equipo). Una foto de producto no vale como imagen del plato.

4) Normativa
- 14 alérgenos: Reglamento (UE) 1169/2011, Anexo II; art. 21.1.b (alérgeno destacado tipográficamente); art. 30 (energía, grasas, saturadas, hidratos, azúcares, proteínas, sal). https://www.boe.es/buscar/doc.php?id=DOUE-L-2011-82311

5) ESL y cifras de Mercadona
- Piloto de etiquetas electrónicas en varias tiendas de Valencia desde finales de 2024; precios dinámicos descartados; extensión a toda la red no decidida. https://distribucionactualidad.com/mercadona-se-suma-a-la-tendencia-de-las-etiquetas-electronicas/ · https://www.foodretail.es/retailers/mercadona-prueba-en-sus-tiendas-las-ventajas-de-la-etiqueta-electronica.html
- La mayoría de tiendas siguen con etiquetas de papel (El Debate, 03/10/2026).
- 2025: 1.672 supermercados y 115.000 personas (https://info.mercadona.es/document/es/memoria-anual-2025.pdf); ventas 41.858 M€ (+8 %) y beneficio 1.729 M€ (https://info.mercadona.es/en/current-affairs/mercadona-achieves-turnover-of-e41858-million-up-8-and-net-profit-of-e1729-million/news); online 1.061 M€ = 2,5 % del total (https://marketing4ecommerce.net/mercadona-online-2025/); Plan de Excelencia Digital 250 M€ 2025-2028 y 1.200 profesionales IT (Alicante Plaza); modelo T9: 59 tiendas en 2026, toda la red en 2033 (https://www.directoalpaladar.com/consumidores/asi-t9-nuevo-modelo-tienda-mercadona-uniremos-todas-zonas-preparacion-obrador-central).

NO CONFIRMADO
- Parámetro wh: mismo precio de la leche en vlc1, mad1, bcn1 y alc1; no se ha comprobado si cambia el surtido.
- Significado de «x99» y de los códigos de dos letras (preguntar a Mercadona).
- Buscador Algolia y política de caché.
- Términos de uso de la API no oficial: en la demo, copia JSON y cero llamadas en directo.

SUPUESTO DEL EQUIPO (reto)
- Etiquetas digitales (ESL) + servidor interno de cada tienda con pasillo, lineal, balda, stock y precio actual. No está confirmado que el servidor ESL de Mercadona guarde la balda: se presenta como «planograma + ESL detrás de una interfaz definida».

DEMO SIMULADA
- Mock del servidor de tienda en 2 tiendas ficticias: GET /store/{store_id}/product/{product_id} → { product_id, pasillo, lineal, balda, stock, precio_esl, actualizado }.
- Contrato de datos corregido: producto { id, ean, nombre, precio, formato, nutricion_100g (puede ser null), fuente_nutricion ("OFF ODbL" | "interno" | null), alergenos {14 códigos: contiene | trazas | libre | desconocido}, fuente_alergenos }; receta { id, nombre, foto_real_url, fuente, ingredientes[{producto_id, cantidad}], alergenos DERIVADOS, nutricion CALCULADA, precio CALCULADO }.

RETIRADO DEL PITCH POR NO ESTAR VERIFICADO: EAACI (17 millones de alérgicos), FACE (1 % celiaquía), INE (inflación de dos dígitos), MAPA (>1.000 M kg de desperdicio).

## ⚖️ Crítica del jurado (simulada)

# Veredicto del jurado

Las dos ideas están completas y bien trazadas, y el principio "la IA no crea" está mejor pensado que en la mayoría de equipos. Aun así, el borrador se contradice entre bloques y tiene fugas de generación. El MVP intenta abarcar demasiado y el valor para la tienda física está mal argumentado. Todo tiene arreglo antes de las 10:30.

---

## 1. Integración de la Idea 1 y la Idea 2: qué falta o queda desdibujado

- **"Crear recetas" (Idea 1) queda como una subpantalla.** Solo aparece como el mapeo dentro del detalle de una receta. La entrada desde el catálogo ("¿Qué cocino con esto?") está en COULD, así que la Idea 1 parece un accesorio de la Idea 2.
  - **Arreglo:** dar a la app dos puertas de entrada: "Descubrir" (swipe) y "Tengo o quiero este producto" (del catálogo a las recetas). Basta una consulta a la base de datos, sin IA. Pasadla a SHOULD o MUST.
- **"Posición en CADA supermercado" (Idea 1).** El MVP simula una sola tienda.
  - **Arreglo:** dos tiendas simuladas con un selector. El mismo producto aparece en un pasillo distinto en cada una. Cuesta 10 minutos y cumple la idea al pie de la letra.
- **Los valores nutricionales se contradicen.** El bloque API confirma que la API no trae nutrición estructurada. Sin embargo, la tabla de datos de la Tarjeta 5 dice "real cuando la API los trae" y el contrato de datos usa `nutricion_100g`. Hoy la tarjeta de la Idea 2 no tiene de dónde sacar ese dato.
- **"Imagen del plato" (Idea 2) no tiene fuente confirmada.** Zenodo y Hugging Face no traen imágenes, e info.mercadona.es devuelve 403. El plan B de usar "fotos de los productos del catálogo" no cumple: una foto de un producto no es una imagen del plato.
- **El etiquetado no es coherente entre bloques.** La ruta por pasillos aparece como [I1] en el bloque de pains y como AÑADIDO en las tarjetas 4 y 5. La idea original dice "ver posiciones", así que la ruta es un AÑADIDO. Unificadlo.

## 2. Dónde se cuela la generación

- **"Adaptar receta" sustituyendo un ingrediente por otro** (bloque API) y **"Sustitución por stock" con el "producto más parecido de la misma categoría".** Cambiar almendra por otro fruto seco, o nata por leche, da una receta nueva que nadie ha probado. Eso es crear.
  - **Regla:** solo se cambia el producto dentro del mismo ingrediente (otra marca o formato). Un ingrediente distinto solo vale si la receta original da la alternativa o si hay una tabla de equivalencias validada por una persona.
- **Nutri-Score "con la fórmula oficial" (añadido 10).** La fórmula necesita la fibra y el % de fruta, verdura y legumbres, que no están en vuestros datos. Habría que estimarlos.
  - **Arreglo:** usar solo un semáforo con grasas, saturadas, azúcares y sal (los datos obligatorios del art. 30). El Nutri-Score, solo cuando Open Food Facts lo traiga por producto, y nunca para una receta.
- **"Precio estimado por ración" (Tarjeta 3, paso 1).** Cambiadlo por "precio calculado". La palabra "estimado" contradice vuestro principio delante del jurado.
- **Explicación "en lenguaje natural"** (bloque pains: "alta en proteína y baja en sal según tus gustos").
  - **Arreglo:** una plantilla con umbrales definidos, sin texto libre de un modelo.
- **OCR de la etiqueta trasera.** Un número mal leído es un dato inventado.
  - **Regla:** solo para nutrición y nunca para alérgenos. Hay que validarlo (kcal ≈ 4·P + 4·H + 9·G) y marcarlo como "transcrito". Fuera del MVP.
- **Cifras sin fuente en las diapositivas.**
  - "Más de 1.000 M kg (verificad)": verificadla o quitadla.
  - EAACI, FACE e INE: citad la fuente en la diapositiva.
  - "Encaja con el AI Act": no lo exageréis.
- **"Recetas de oferta" (añadido del bloque API)** choca con "Siempre Precios Bajos" (SPB). Renombradlo a "ha bajado de precio", que es el dato real del endpoint price-drops.

## 3. Lo que atacaría un jurado de Mercadona

- **"Esto es otro Tinder de recetas."** Ya existen apps de recetas con swipe y apps que pasan la receta a la lista de la compra.
  - **Respuesta:** el swipe es la puerta; lo que nadie puede copiar es el dato de tienda (lineal, stock, coste del plato en tu Mercadona) y los alérgenos sacados de la ficha oficial.
- **Valor para Mercadona sin ningún KPI.**
  - **Proponed dos o tres:** % de likes que terminan en compra completa, recetas sin rotura de stock y minutos en tienda.
- **"¿Por qué en tienda física?"** Tenéis los datos confirmados y no los usáis:
  - El online es 1.061 M€ de 41.858 M€, el 2,5 %, así que más del 97 % de las ventas se hacen en tienda.
  - Con el modelo T9, 59 tiendas cambian de distribución en 2026, y el Jefe se va a perder.
  - Ya están probando las etiquetas digitales (ESL) en Valencia.
- **El "precio en tiempo real" vale poco en Mercadona.** Con SPB los precios son estables, y vosotros mismos visteis el mismo precio en vlc1, mad1, bcn1 y alc1. Además, Mercadona ha descartado los precios dinámicos. El valor está en el coste por plato y por ración, no en el tiempo real.
- **El filtro de alergias puede vaciar el mazo.** En la muestra, 38 de 107 productos tienen "x99" y 7 tienen el campo vacío: un 42 % sin dato. Si "sin dato" significa "no mostrar", una receta de 5 productos solo tendría todos los datos en torno al 7 % de los casos (cálculo aproximado, suponiendo independencia). Un usuario alérgico se quedaría sin tarjetas.
  - **Arreglo:** extraer los alérgenos del `<strong>` de los ingredientes como segunda fuente fija, sin IA. Pedir a Mercadona qué significa "x99". En la demo, usar recetas con todos los datos completos.
- **Las etiquetas digitales y el servidor interno.** No está confirmado que el servidor de las ESL guarde la balda de cada producto.
  - **Cómo presentarlo:** "planograma + ESL, detrás de una interfaz que ya está definida". Y para la API no oficial: copia guardada del catálogo y petición de acceso oficial.
- **RGPD, art. 9.** Las alergias son datos de salud.
  - **En la diapositiva, una línea:** "El perfil de alergias se queda en tu móvil; Mercadona solo ve datos agregados".
- **"¿Quién mapea miles de recetas?"**
  - **Respuesta:** la IA propone y una persona valida una vez por receta. Después ese mapeo sirve en todas las tiendas.

## 4. ¿Se puede demostrar el MVP?

Sí, pero solo recortando. Hoy son 7 MUST más embeddings, pgvector, Rocchio, un grafo de tienda y un LLM en directo.

**Recortar:**
- **Sin llamadas en directo:** una copia en JSON de unos 100–150 productos de las recetas.
- **Mapeo ingrediente → producto calculado antes de la demo** (LLM + revisión humana) y guardado. En la demo se enseña como pantalla de trazabilidad.
- **Recomendador:** puntuar por etiquetas e ingredientes compartidos (Jaccard). Se ve el mismo efecto sin embeddings, pgvector ni Rocchio.
- **Ruta:** ordenar por número de pasillo, con un mapa SVG en rejilla. Sin grafo.
- **Recetas:** 20 con foto real, no 30–50.
- **Fuera de la demo:** OCR, Algolia, login, Match en grupo, voz y pick-to-light. Pick-to-light y el panel B2B se quedan como diapositiva o maqueta.

**Añadir, porque cuesta poco:** la segunda tienda simulada y la entrada "¿Qué cocino con esto?".

**Además:** vídeo de respaldo grabado a las 15:30.

## 5. Nombre, eslogan y los 3 mejores añadidos

**Nombre ganador: SíChef**
- **Eslogan:** "Desliza a la derecha y dile sí a tu cena."
- **Frase secundaria:** "Recetas, precios y pasillos reales. La IA no inventa."
- **Por qué:**
  - Se dice igual en español y en italiano ("Sì, chef").
  - El "sí" es el like, así que integra la Idea 2 sin decir "match" ni "Tinder".
  - El nombre no limita la app a las cenas.
  - Permite un guiño a "el Jefe" de la cultura Mercadona.
- **Frente a CenaMatch:** se entiende enseguida, pero "match" alimenta justo el ataque de "otro Tinder", y el nombre se queda en la cena.
- **Receta Real** funciona mejor como frase secundaria que como nombre.

**Los 3 mejores añadidos:**
1. **Del match al carro (lista por pasillo).** Es el pegamento entre la Idea 2 y la Idea 1. Esfuerzo bajo y efecto visual alto.
2. **Perfil Hogar multi-alergia + excluir trazas + aviso "dato no disponible".** Seguridad y emoción, y además demuestra el principio en directo.
3. **Raciones reales + Modo Presupuesto.** Dos precios, "por ración" y "lo que pagas en caja". Encaja con SPB.

La sustitución por stock va al roadmap, y solo con el mismo ingrediente.

## 6. Las 5 mejoras para ganar

1. **Cerrad la fuente de nutrición.** Usad el volcado de Open Food Facts por EAN para los productos de la demo, con una marca de fuente ("OFF, ODbL") y "sin dato" cuando falte. Corregid la tabla de la Tarjeta 5 y el contrato de datos.
2. **Conseguid ya recetas y fotos reales.** Pedid a la organización el recetario de info.mercadona.es con sus fotos: el hackathon es suyo. Plan B: 20 recetas cocinadas y fotografiadas por el equipo, o fotos CC con atribución. Sin esto no hay tarjeta de la Idea 2.
3. **Resolved el problema de "x99" antes de prometer el filtro duro.** Extraed los alérgenos del `<strong>`, usad en la demo recetas con datos completos y enseñad a propósito un caso de "dato no disponible". Será el momento de confianza del pitch.
4. **Pasad el pitch de "app" a "tienda":**
   - Tres cifras confirmadas: más del 97 % de las ventas en tienda física, el T9 en 59 tiendas en 2026 y el piloto de ESL en Valencia.
   - Dos KPI.
   - La frase "el swipe es la puerta; el dato de tienda es lo que no se puede copiar".
   - Hablad del cliente como "el Jefe".
5. **Comprimid las tarjetas para las 10:30:**
   - T1: un problema y una solución.
   - T2: solo 3 pains (qué como, alergias, cuánto cuesta y dónde está) y la cadena datos → reglas → IA.
   - T4: los 6 módulos, una línea por módulo.
   - T5: 3 MUST, 2 SHOULD y 2 WON'T.
   - Unificad las etiquetas [I1], [I2] y [AÑADIDO], y quitad "estimado" y "oferta".
   - T7 está bien: solo falta poner los nombres, y el Loro debe ser hispanohablante.
   - El León sube el QR a las 10:25.
