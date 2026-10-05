#!/usr/bin/env python3
"""Genera los JSON del template de SíChef con DATOS REALES.

Salida (cumple app/src/types.ts):
  app/public/data/allergens.json, products.json, recipes.json, stores.json
  app/public/img/recipes/<id>.jpg   (fotos de Wikimedia Commons, sips -Z 1000)
  app/public/img/products/<id>.jpg  (miniaturas de Mercadona, sips -Z 300)

Fuentes (todas cacheadas en data/raw/, ignorado por git):
  - Recetas: es.wikibooks.org (Artes culinarias/Recetas), CC BY-SA 4.0
  - Fotos: Wikimedia Commons (CC BY / CC BY-SA), autor y licencia leídos de la API
  - Productos y precios: API no oficial de tienda.mercadona.es (almacén vlc1)
  - Nutrición: Open Food Facts por EAN (ODbL); si no hay, y SOLO para productos
    frescos de un ingrediente vendidos sin partes no comestibles, CIQUAL 2020
    (ANSES, Licence Ouverte) con una tabla de correspondencias fija.
  - Tiendas: SIMULADAS (deterministas).

Uso:
  python3 data/scripts/build_template_data.py            # usa la caché si existe
  python3 data/scripts/build_template_data.py --refresh  # vuelve a descargar todo

Solo usa la biblioteca estándar de Python (3.9+) y `sips` (macOS) para redimensionar.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
import calc  # noqa: E402

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "app" / "public" / "data"
IMG_RECIPES = ROOT / "app" / "public" / "img" / "recipes"
IMG_PRODUCTS = ROOT / "app" / "public" / "img" / "products"

UA = "SiChef-hackathon/0.1 (equipo SíChef)"
MERCADONA = "https://tienda.mercadona.es/api"
WH = "vlc1"
TODAY = dt.date.today().isoformat()

# Regla de nutrición: CIQUAL como respaldo para frescos de un ingrediente.
# Ponlo a False para usar SOLO Open Food Facts (lo demás queda en null).
USE_CIQUAL_FALLBACK = True

# Regla de alérgenos (ver data/README.md). Por defecto ESTRICTA: solo las
# categorías de producto fresco listadas abajo pueden ser "producto_fresco".
# Si el equipo decide tratar también como "un solo ingrediente" el aceite de
# oliva 100 % y la sal, poner True (el aceite dejaría de ser "desconocido").
TREAT_SINGLE_INGREDIENT_PANTRY_AS_FRESH = False

REFRESH = False

# ---------------------------------------------------------------------------
# Datos fijos y revisables por una persona
# ---------------------------------------------------------------------------
ALLERGENS = [
    ("gluten", "Gluten", "🌾"),
    ("crustaceos", "Crustáceos", "🦐"),
    ("huevos", "Huevos", "🥚"),
    ("pescado", "Pescado", "🐟"),
    ("cacahuetes", "Cacahuetes", "🥜"),
    ("soja", "Soja", "🫘"),
    ("leche", "Leche", "🥛"),
    ("frutos_cascara", "Frutos de cáscara", "🌰"),
    ("apio", "Apio", "🥬"),
    ("mostaza", "Mostaza", "🟡"),
    ("sesamo", "Sésamo", "⚪"),
    ("sulfitos", "Sulfitos", "🍷"),
    ("altramuces", "Altramuces", "🌼"),
    ("moluscos", "Moluscos", "🦪"),
]

# Diccionario fijo palabra española -> código (Reglamento UE 1169/2011, Anexo II).
ALLERGEN_KEYWORDS: List[Tuple[str, str]] = [
    (r"cereales? que contienen? gluten|gluten|trigo|cebada|centeno|avena|espelta|kamut", "gluten"),
    (r"crust[aá]ceos?|gambas?|langostinos?|cangrejos?|cigalas?|bogavantes?|langostas?", "crustaceos"),
    (r"huevos?", "huevos"),
    (r"pescados?|merluza|bacalao|at[uú]n|salm[oó]n|anchoas?|sardinas?|boquer[oó]n(es)?", "pescado"),
    (r"cacahuetes?|man[ií]", "cacahuetes"),
    (r"soja", "soja"),
    (r"leche|lactosa|l[aá]cteos?|nata|mantequilla|quesos?|case[ií]na(to)?|suero l[aá]cteo", "leche"),
    (r"frutos? de c[aá]scara|frutos secos|almendras?|avellanas?|nuez|nueces|anacardos?|pistachos?|pacanas?|macadamias?", "frutos_cascara"),
    (r"apio", "apio"),
    (r"mostaza", "mostaza"),
    (r"s[eé]samo|ajonjol[ií]", "sesamo"),
    (r"sulfitos?|di[oó]xido de azufre|anh[ií]drido sulfuroso|metabisulfito|e-?22[0-8]", "sulfitos"),
    (r"altramu(z|ces)", "altramuces"),
    (r"moluscos?|mejill[oó]n(es)?|almejas?|calamar(es)?|pulpo|sepia|berberechos?|ostras?|vieiras?", "moluscos"),
]

# Categorías (nivel 1 de la API) donde un producto de UN solo ingrediente sin
# ingredientes añadidos se considera "producto_fresco" con sus alérgenos inherentes.
FRESH_CATEGORIES = {
    "Fruta": [],
    "Verdura": [],
    "Lechuga y ensalada preparada": [],
    "Aves y pollo": [],
    "Cerdo": [],
    "Vacuno": [],
    "Conejo y cordero": [],
    "Pescado fresco": ["pescado"],
    "Marisco": None,  # según la especie (mejillón -> moluscos, gamba -> crustáceos)
    "Huevos": ["huevos"],
    "Legumbres": [],  # solo legumbre SECA (la cocida lleva agua y sal -> no es 1 ingrediente)
    "Arroz": [],
}
PANTRY_SINGLE_INGREDIENT = {"Aceite, vinagre y sal": []}

# Correspondencia fija producto -> alimento CIQUAL 2020 (solo frescos de un
# ingrediente cuyo peso de venta es parte comestible). Pollo entero (hueso) y
# mejillón vivo (concha) NO se mapean a propósito: CIQUAL da valores por parte
# comestible y no aplicamos factores de desperdicio.
CIQUAL_MAP = {
    "69089": "20239",  # Cebollas -> Oignon jaune, cru
    "69320": "20085",  # Pimiento verde freír -> Poivron vert, cru
    "69310": "20087",  # Pimiento rojo -> Poivron rouge, cru
    "69912": "20047",  # Tomate pera -> Tomate, crue
    "69297": "11000",  # Ajos morados -> Ail, cru
    "31504": "22000",  # Huevos grandes L -> Oeuf, cru
    "69448": "4008",   # Patatas especial para freír -> Pomme de terre, sans peau, crue
    "69066": "4008",   # Patata -> Pomme de terre, sans peau, crue
    "69669": "20009",  # Zanahorias -> Carotte, crue
    "3210": "13009",   # Limón -> Citron, pulpe, cru
    "26951": "20056",  # Champiñones blancos -> Champignon de Paris, cru
    "69701": "11014",  # Perejil troceado -> Persil, frais
}
CIQUAL_CONST = {"328": "kcal", "40000": "fat", "40302": "saturated_fat", "31000": "carbs",
                "32000": "sugars", "25000": "protein", "10004": "salt"}
CIQUAL_ZIP = "https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip"

# Recetas: página de Wikilibros + foto de Commons + mapeo ingrediente -> producto.
# `src` es un fragmento LITERAL de la línea de ingredientes de la fuente: el script
# comprueba que existe (así no se cuela ningún ingrediente inventado).
# Conversión de cantidades (regla fija, ver README):
#   - g/kg, ml/l: tal cual.
#   - «n» piezas de un producto que Mercadona vende por pieza/bandeja con peso
#     publicado: q = n * unit_size (kg) * 1000 g  -> campo `pieces`.
#   - cucharada sopera = 15 ml, cucharada pequeña/cucharadita = 5 ml, SOLO para
#     líquidos (volumen -> volumen). Sólidos medidos en cucharadas quedan en 'ud'.
#   - el resto queda en 'ud' tal cual lo dice la receta.
RECIPES: List[Dict[str, Any]] = [
    {
        "id": "pollo-con-pimientos",
        "name": "Pollo con pimientos",
        "subtitle": "Al chilindrón · cocina aragonesa",
        "page": "Artes culinarias/Recetas/Pollo al chilindrón",
        "photo": "File:Pollo al chilindrón-01.jpg",
        "tags": ["pollo", "cocina aragonesa", "segundo plato", "gastronomía de España"],
        "stop_steps_at": "'''Variantes",
        "ingredients": [
            {"src": "pollo}} tierno", "name": "Pollo tierno (mejor campero)", "pieces": 1, "label": "1 pollo", "product_id": "2781"},
            {"src": "1 {{ing|cebolla}}", "name": "Cebolla", "quantity": 1, "unit": "ud", "label": "1 cebolla", "product_id": "69089"},
            {"src": "2 {{ing|pimiento}}s verdes", "name": "Pimientos verdes", "pieces": 2, "label": "2 pimientos verdes", "product_id": "69320"},
            {"src": "1 {{ing|pimiento}} rojo", "name": "Pimiento rojo", "pieces": 1, "label": "1 pimiento rojo", "product_id": "69310"},
            {"src": "4 {{ing|tomate}}s maduros", "name": "Tomates maduros", "pieces": 4, "label": "4 tomates maduros", "product_id": "69912"},
            {"src": "3 dientes de {{ing|ajo}}", "name": "Ajo", "quantity": 3, "unit": "ud", "label": "3 dientes", "product_id": "69297"},
            {"src": "{{ing|aceite|aceite de oliva}}", "name": "Aceite de oliva", "quantity": 0, "unit": "ml", "label": "cantidad no indicada", "product_id": "4640", "optional": True},
            {"src": "{{ing|sal}}", "name": "Sal", "quantity": 0, "unit": "g", "label": "cantidad no indicada", "product_id": None, "optional": True},
        ],
    },
    {
        "id": "tortilla-de-patatas",
        "name": "Tortilla de patatas",
        "subtitle": "Gastronomía de España",
        "page": "Artes culinarias/Recetas/Tortilla de patatas",
        "photo": "File:Tortilla de Patatas (Corte transversal).jpg",
        "tags": ["huevo", "patatas", "gastronomía de España"],
        "ingredients": [
            {"src": "8 {{ing|huevo|huevos}} grandes", "name": "Huevos grandes (talla L o XL)", "quantity": 8, "unit": "ud", "label": "8 huevos", "product_id": "31504"},
            {"src": "1 kg de {{ing|patata|patatas}}", "name": "Patatas", "quantity": 1000, "unit": "g", "label": "1 kg", "product_id": "69448"},
            {"src": "1 {{ing|cebolla}} mediana", "name": "Cebolla", "quantity": 1, "unit": "ud", "label": "1 cebolla mediana o grande", "product_id": "69089"},
            {"src": "1/2 litro de {{ing|aceite|aceite de oliva}}", "name": "Aceite de oliva (para freír)", "quantity": 500, "unit": "ml", "label": "1/2 litro (para freír)", "product_id": "4640"},
            {"src": "{{ing|Sal}}", "name": "Sal", "quantity": 0, "unit": "g", "label": "una pizca por yema", "product_id": None, "optional": True},
        ],
    },
    {
        "id": "lentejas-con-chorizo",
        "name": "Lentejas con chorizo",
        "subtitle": "Legumbres · primer plato",
        "page": "Artes culinarias/Recetas/Lentejas con chorizo",
        "photo": "File:Quick Lentils with Chorizo (7017166123).jpg",
        "tags": ["legumbres", "chorizo", "primer plato", "gastronomía de España"],
        "ingredients": [
            {"src": "20 ml de {{ing|aceite}} de oliva", "name": "Aceite de oliva", "quantity": 20, "unit": "ml", "label": "20 ml", "product_id": "4640"},
            {"src": "4 dientes de {{ing|ajo}}", "name": "Ajo", "quantity": 4, "unit": "ud", "label": "4 dientes", "product_id": "69297"},
            {"src": "1 {{ing|patata}}", "name": "Patata", "pieces": 1, "label": "1 patata", "product_id": "69066"},
            {"src": "1/2 {{ing|cebolla}}", "name": "Cebolla", "quantity": 0.5, "unit": "ud", "label": "1/2 cebolla", "product_id": "69089"},
            {"src": "1   {{ing|tomate}}", "name": "Tomate", "pieces": 1, "label": "1 tomate", "product_id": "69912"},
            {"src": "2 hojas  de {{ing|laurel}}", "name": "Laurel", "quantity": 2, "unit": "ud", "label": "2 hojas", "product_id": "47994"},
            {"src": "300 g de {{ing|chorizo}}", "name": "Chorizo", "quantity": 300, "unit": "g", "label": "300 g", "product_id": "54209"},
            {"src": "1 cucharada pequeña de {{ing|pimentón}}", "name": "Pimentón", "quantity": 1, "unit": "ud", "label": "1 cucharada pequeña", "product_id": "60573"},
            {"src": "1 cucharada pequeña de {{ing|sal}}", "name": "Sal", "quantity": 1, "unit": "ud", "label": "1 cucharada pequeña", "product_id": None, "optional": True},
            {"src": "{{ing|agua}}", "name": "Agua", "quantity": 1000, "unit": "ml", "label": "1 litro", "product_id": None, "optional": True},
            {"src": "1 {{ing|zanahoria}}", "name": "Zanahoria", "quantity": 1, "unit": "ud", "label": "1 zanahoria", "product_id": "69669"},
            {"src": "1 frasco de {{ing|lentejas}} en conserva", "name": "Lentejas en conserva", "pieces": 1, "label": "1 frasco", "product_id": "26030"},
        ],
    },
    {
        "id": "mejillones-al-vapor",
        "name": "Mejillones al vapor",
        "subtitle": "Cocina gallega",
        "page": "Artes culinarias/Recetas/Mejillones al vapor",
        "photo": "File:Mejillones cocidos al vapor.jpg",
        "tags": ["marisco", "cocina gallega", "gastronomía de España"],
        "ingredients": [
            {"src": "1 k de {{ing|Mejillón|mejillones}}", "name": "Mejillones", "quantity": 1000, "unit": "g", "label": "1 kg", "product_id": "85144"},
            {"src": "10 gramos de {{ing|sal}}", "name": "Sal", "quantity": 10, "unit": "g", "label": "10 g", "product_id": None, "optional": True},
            {"src": "Un {{ing|limón}}", "name": "Limón", "pieces": 1, "label": "1 limón", "product_id": "3210"},
        ],
    },
    {
        "id": "champinones-al-ajillo",
        "name": "Champiñones al ajillo",
        "subtitle": "Aperitivo · vegana",
        "page": "Artes culinarias/Recetas/Champiñones al ajillo",
        "photo": "File:Champiñones al ajillo (Madrid).jpg",
        "tags": ["setas", "ajillo", "aperitivo", "primer plato", "vegetariana", "vegana", "gastronomía de España"],
        "ingredients": [
            {"src": "1,5 kg {{ing|champiñones}} pequeños", "name": "Champiñones pequeños", "quantity": 1500, "unit": "g", "label": "1,5 kg", "product_id": "26951"},
            {"src": "9 cucharadas soperas de {{ing|aceite|aceite de oliva virgen extra}}", "name": "Aceite de oliva virgen extra", "quantity": 135, "unit": "ml", "label": "9 cucharadas soperas", "product_id": "4706"},
            {"src": "3 dientes de {{ing|ajo|ajos}} picados", "name": "Ajo", "quantity": 3, "unit": "ud", "label": "3 dientes picados", "product_id": "69297"},
            {"src": "2 cucharadas soperas de {{ing|perejil}} picado", "name": "Perejil picado", "quantity": 2, "unit": "ud", "label": "2 cucharadas soperas", "product_id": "69701"},
            {"src": "{{ing|Limón}} para zumo", "name": "Limón", "quantity": 0, "unit": "ud", "label": "para zumo (cantidad no indicada)", "product_id": "3210", "optional": True},
            {"src": "{{ing|Sal}}", "name": "Sal", "quantity": 0, "unit": "g", "label": "cantidad no indicada", "product_id": None, "optional": True},
        ],
    },
]

# Pasillos de las tiendas simuladas (secciones con nombre).
STORES = [
    {
        "id": "ruzafa",
        "name": "Mercadona Ruzafa (simulada)",
        "aisles": ["Fruta y verdura", "Carne y aves", "Pescado y marisco", "Charcutería y embutidos",
                   "Huevos y lácteos", "Aceite, especias y salsas", "Arroz, legumbres y pasta",
                   "Conservas y caldos", "Panadería", "Congelados"],
    },
    {
        "id": "benimaclet",
        "name": "Mercadona Benimaclet (simulada)",
        "aisles": ["Panadería", "Fruta y verdura", "Huevos y lácteos", "Carne y aves",
                   "Charcutería y embutidos", "Pescado y marisco", "Conservas y caldos",
                   "Arroz, legumbres y pasta", "Aceite, especias y salsas", "Congelados", "Bebidas"],
    },
]
# Producto sin stock (simulado) para la demo: (tienda, product_id)
OUT_OF_STOCK = [("benimaclet", "26951")]


def section_for(cat0: str, cat1: str) -> str:
    if cat1 == "Embutido" or cat0 == "Charcutería y quesos":
        return "Charcutería y embutidos"
    return {
        "Fruta y verdura": "Fruta y verdura",
        "Carne": "Carne y aves",
        "Marisco y pescado": "Pescado y marisco",
        "Huevos, leche y mantequilla": "Huevos y lácteos",
        "Aceite, especias y salsas": "Aceite, especias y salsas",
        "Arroz, legumbres y pasta": "Arroz, legumbres y pasta",
        "Conservas, caldos y cremas": "Conservas y caldos",
        "Panadería y pastelería": "Panadería",
        "Congelados": "Congelados",
        "Agua y refrescos": "Bebidas",
    }[cat0]


# ---------------------------------------------------------------------------
# Utilidades HTTP con caché
# ---------------------------------------------------------------------------
def log(*a: Any) -> None:
    print(*a, file=sys.stderr)


def http_get(url: str, *, pause: float = 0.3, retries: int = 5, accept_404: bool = False) -> bytes:
    last: Optional[Exception] = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            time.sleep(pause)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404 and accept_404:
                time.sleep(pause)
                return e.read() or b'{"status": 0}'
            last = e
            wait = 10 * (i + 1) if e.code == 429 else 2 * (i + 1)
            log(f"  HTTP {e.code} en {url[:90]} -> reintento en {wait}s")
            time.sleep(wait)
        except Exception as e:  # red, timeout...
            last = e
            log(f"  error {e} en {url[:90]} -> reintento")
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"No se pudo descargar {url}: {last}")


def cached_json(path: Path, url: str, **kw: Any) -> Any:
    if path.exists() and not REFRESH:
        return json.loads(path.read_text(encoding="utf-8"))
    path.parent.mkdir(parents=True, exist_ok=True)
    data = http_get(url, **kw)
    path.write_bytes(data)
    return json.loads(data.decode("utf-8"))


def sips_resize(src: Path, dst: Path, max_px: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if shutil.which("sips"):
        subprocess.run(["sips", "-s", "format", "jpeg", "-Z", str(max_px), str(src), "--out", str(dst)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:  # fuera de macOS: copia sin redimensionar
        shutil.copyfile(src, dst)


def strip_html(s: Optional[str]) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


# ---------------------------------------------------------------------------
# Recetas (Wikilibros)
# ---------------------------------------------------------------------------
def wikibooks_page(title: str) -> Dict[str, Any]:
    q = urllib.parse.urlencode({"action": "parse", "page": title, "prop": "wikitext|revid",
                                "format": "json", "formatversion": "2", "redirects": "1"})
    safe = re.sub(r"[^A-Za-z0-9]+", "_", title)
    d = cached_json(RAW / "recipes" / f"wikibooks_{safe}.json",
                    "https://es.wikibooks.org/w/api.php?" + q, pause=1.0)
    return d["parse"]


def clean_wiki(s: str) -> str:
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", " ", s)
    # {{ing|a|b}}, {{coc|A|b}}, {{ute|x}}, {{rec|x}} -> último argumento
    s = re.sub(r"\{\{(?:ing|coc|ute|rec)\|([^{}]*?)\}\}", lambda m: m.group(1).split("|")[-1], s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = s.replace("'''", "").replace("''", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_steps(wikitext: str, stop_at: Optional[str]) -> List[str]:
    m = re.search(r"\|\s*procedimiento\s*=(.*)", wikitext, re.S)
    if not m:
        raise ValueError("receta sin procedimiento")
    body = m.group(1)
    if stop_at and stop_at in body:
        body = body.split(stop_at)[0]
    steps = []
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("#"):
            txt = clean_wiki(line.lstrip("#").strip())
            txt = txt.rstrip("}").strip()
            if txt:
                steps.append(txt)
    return steps


def parse_servings(wikitext: str) -> int:
    m = re.search(r"\|\s*comensales\s*=\s*(\d+)", wikitext)
    return int(m.group(1))


def parse_time(wikitext: str) -> Optional[int]:
    m = re.search(r"\|\s*tiempo\s*=\s*([^\n|]+)", wikitext)
    if not m:
        return None
    t = m.group(1).lower()
    n = re.search(r"\d+", t)
    if not n:
        return None
    v = int(n.group(0))
    return v * 60 if "hora" in t else v


def ingredients_block(wikitext: str) -> str:
    m = re.search(r"\|\s*ingredientes\s*=(.*?)\|\s*procedimiento", wikitext, re.S)
    return m.group(1) if m else ""


# ---------------------------------------------------------------------------
# Fotos (Wikimedia Commons)
# ---------------------------------------------------------------------------
def commons_photo(file_title: str, recipe_id: str) -> Dict[str, str]:
    q = urllib.parse.urlencode({"action": "query", "titles": file_title, "prop": "imageinfo",
                                "iiprop": "url|extmetadata|timestamp|metadata", "iiurlwidth": "1200",
                                "format": "json", "formatversion": "2"})
    safe = re.sub(r"[^A-Za-z0-9]+", "_", file_title)
    d = cached_json(RAW / "commons" / f"{safe}.json", "https://commons.wikimedia.org/w/api.php?" + q, pause=1.0)
    ii = d["query"]["pages"][0]["imageinfo"][0]
    em = ii.get("extmetadata", {})
    author = strip_html(em.get("Artist", {}).get("value"))
    lic = strip_html(em.get("LicenseShortName", {}).get("value"))
    if not author or not lic:
        raise ValueError(f"{file_title}: falta autor o licencia")
    if not re.match(r"^(CC BY(-SA)? [0-9.]+|CC0|Public domain)", lic):
        raise ValueError(f"{file_title}: licencia no admitida: {lic}")
    raw_img = RAW / "commons" / f"{recipe_id}_src.jpg"
    if not raw_img.exists() or REFRESH:
        raw_img.write_bytes(http_get(ii["thumburl"], pause=3.0))
    sips_resize(raw_img, IMG_RECIPES / f"{recipe_id}.jpg", 1000)
    return {
        "url": f"/img/recipes/{recipe_id}.jpg",
        "author": author,
        "license": lic,
        "source_url": ii["descriptionurl"],
    }


# ---------------------------------------------------------------------------
# Alérgenos con reglas fijas
# ---------------------------------------------------------------------------
def find_codes(text: str) -> List[str]:
    t = text.lower()
    found = []
    for pat, code in ALLERGEN_KEYWORDS:
        if re.search(r"(?<![a-záéíóúñ])(" + pat + r")(?![a-záéíóúñ])", t) and code not in found:
            found.append(code)
    return found


def classify_statement(sentence: str) -> Optional[str]:
    """'contains' | 'traces' | 'free' | None según el verbo de la frase."""
    s = sentence.lower()
    if re.search(r"puede contener|trazas", s):
        return "traces"
    if re.search(r"\blibre de\b|\bsin\b|\bno contiene\b", s):
        return "free"
    if re.search(r"\bcontiene\b", s):
        return "contains"
    return None


def parse_allergens(prod: Dict[str, Any]) -> Dict[str, Any]:
    ni = prod.get("nutrition_information") or {}
    a_html = ni.get("allergens") or ""
    i_html = ni.get("ingredients") or ""
    contains: List[str] = []
    traces: List[str] = []
    informative = False

    def add(lst: List[str], codes: List[str]) -> None:
        for c in codes:
            if c not in lst:
                lst.append(c)

    # 1) Campo de alérgenos: frases «Contiene …» / «Puede contener …»
    a_txt = strip_html(a_html)
    for sent in re.split(r"[.;]", a_txt):
        sent = sent.strip()
        if not sent or re.fullmatch(r"x\d+", sent.lower()):
            continue
        kind = classify_statement(sent)
        codes = find_codes(sent)
        if kind == "contains" and codes:
            add(contains, codes)
            informative = True
        elif kind == "traces" and codes:
            add(traces, codes)
            informative = True
    # 2) Ingredientes: negritas <strong> -> contiene (o trazas si la frase es «Puede contener»)
    i_plain = strip_html(i_html)
    for sent in re.split(r"(?<=[.])\s+", i_plain):
        if classify_statement(sent) == "traces":
            codes = find_codes(sent)
            if codes:
                add(traces, codes)
                informative = True
    for m in re.finditer(r"<strong>(.*?)</strong>", i_html, re.S):
        frag = strip_html(m.group(1))
        start = max(0, m.start() - 40)
        context = strip_html(i_html[start:m.start()]).lower()
        kind = classify_statement(frag) or classify_statement(context[-25:]) or "contains"
        codes = find_codes(frag)
        if not codes:
            continue
        if kind == "traces":
            add(traces, codes)
        elif kind == "contains":
            add(contains, codes)
        informative = True
    traces = [c for c in traces if c not in contains]
    if informative:
        return {"status": "declarado", "contains": contains, "traces": traces}

    # 3) x99 / vacío / código desconocido -> desconocido, SALVO producto fresco de 1 ingrediente
    cats = prod.get("categories") or [{}]
    cat1 = (cats[0].get("categories") or [{}])[0].get("name", "")
    allowed = dict(FRESH_CATEGORIES)
    if TREAT_SINGLE_INGREDIENT_PANTRY_AS_FRESH:
        allowed.update(PANTRY_SINGLE_INGREDIENT)
    pantry = cat1 in PANTRY_SINGLE_INGREDIENT and TREAT_SINGLE_INGREDIENT_PANTRY_AS_FRESH
    if cat1 in allowed and (is_pantry_single(i_plain) if pantry else is_single_ingredient(i_plain)):
        inherent = allowed[cat1]
        if inherent is None:  # marisco: según especie
            inherent = [c for c in find_codes(prod["display_name"]) if c in ("moluscos", "crustaceos")]
            if not inherent:
                return {"status": "desconocido", "contains": [], "traces": []}
        return {"status": "producto_fresco", "contains": list(inherent), "traces": []}
    return {"status": "desconocido", "contains": [], "traces": []}


def is_pantry_single(ingredients_plain: str) -> bool:
    """Solo con el interruptor activado: aceite de oliva (aunque sea mezcla de
    aceites de oliva) o sal marina, sin ningún otro ingrediente."""
    t = re.sub(r"^ingredientes:\s*", "", ingredients_plain.lower()).strip(" .")
    t = re.sub(r"\b100\s*%", "", t)
    parts = [x.strip(" .") for x in re.split(r",|\by\b", t) if x.strip(" .")]
    return bool(parts) and all(re.fullmatch(r"aceite de oliva( virgen( extra)?| refinado)?|sal( marina)?", x) for x in parts)


def is_single_ingredient(ingredients_plain: str) -> bool:
    t = ingredients_plain.lower()
    t = re.sub(r"^ingredientes:\s*", "", t)
    t = re.sub(r",?\s*calibre.*$", "", t)        # «Ajo morado, calibre: 45/55 mm.»
    t = re.sub(r"\([^)]*\)", "", t)              # «Cebolla (Allium cepa)»
    t = re.sub(r"\b100\s*%", "", t).strip(" .")
    if not t:
        return True  # fresco sin lista de ingredientes (fruta, verdura...)
    if re.search(r"[,;:]|\be-?\d{3}\b|\by\b|\be\b", t):
        return False
    return len(t.split()) <= 5


# ---------------------------------------------------------------------------
# Nutrición
# ---------------------------------------------------------------------------
def off_nutrition(ean: Optional[str]) -> Optional[Dict[str, Optional[float]]]:
    if not ean:
        return None
    url = f"https://world.openfoodfacts.org/api/v2/product/{ean}.json?fields=nutriments,product_name"
    d = cached_json(RAW / "off" / f"{ean}.json", url, pause=1.0, accept_404=True)
    n = (d.get("product") or {}).get("nutriments") or {}
    keys = {"kcal": "energy-kcal_100g", "fat": "fat_100g", "saturated_fat": "saturated-fat_100g",
            "carbs": "carbohydrates_100g", "sugars": "sugars_100g", "protein": "proteins_100g", "salt": "salt_100g"}
    out: Dict[str, Optional[float]] = {}
    for k, src in keys.items():
        v = n.get(src)
        try:
            out[k] = None if v in (None, "") else round(float(v), 2)
        except (TypeError, ValueError):
            out[k] = None
    # Filtro de calidad fijo: hacen falta energía + grasas + hidratos + proteínas.
    if any(out[k] is None for k in ("kcal", "fat", "carbs", "protein")):
        return None
    return out


_CIQUAL: Optional[Dict[str, Dict[str, Any]]] = None


def ciqual_table() -> Dict[str, Dict[str, Any]]:
    global _CIQUAL
    if _CIQUAL is not None:
        return _CIQUAL
    zpath = RAW / "ciqual" / "ciqual_xml.zip"
    if not zpath.exists():
        zpath.parent.mkdir(parents=True, exist_ok=True)
        zpath.write_bytes(http_get(CIQUAL_ZIP, pause=1.0))
    xdir = RAW / "ciqual" / "xml"
    if not (xdir / "compo_2020_07_07.xml").exists():
        with zipfile.ZipFile(zpath) as z:
            z.extractall(xdir)
    names = dict(re.findall(r"<alim_code>\s*(\d+)\s*</alim_code>\s*<alim_nom_fr>\s*(.*?)\s*</alim_nom_fr>",
                            (xdir / "alim_2020_07_07.xml").read_text(encoding="windows-1252")))
    wanted = set(CIQUAL_MAP.values())
    table: Dict[str, Dict[str, Any]] = {c: {"name": names.get(c, c), "values": {}} for c in wanted}
    blk: List[str] = []
    with open(xdir / "compo_2020_07_07.xml", encoding="windows-1252") as f:
        for line in f:
            if "<COMPO>" in line:
                blk = []
            blk.append(line)
            if "</COMPO>" in line:
                b = "".join(blk)
                a = re.search(r"<alim_code>\s*(\d+)", b).group(1)
                if a not in wanted:
                    continue
                c = re.search(r"<const_code>\s*(\d+)", b).group(1)
                if c in CIQUAL_CONST:
                    t = re.search(r"<teneur>(.*?)</teneur>", b)
                    table[a]["values"][CIQUAL_CONST[c]] = ciqual_value(t.group(1) if t else None)
    _CIQUAL = table
    return table


def ciqual_value(raw: Optional[str]) -> Optional[float]:
    """«< x» y «traces» -> 0 (guía UE de tolerancias permite declarar 0); «-» -> null."""
    if raw is None:
        return None
    s = raw.strip().lower()
    if s in ("", "-"):
        return None
    if s.startswith("<") or s == "traces":
        return 0.0
    try:
        return round(float(s.replace(",", ".")), 2)
    except ValueError:
        return None


def nutrition_for(pid: str, ean: Optional[str], allergen_status: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    off = off_nutrition(ean)
    if off:
        return off, "Open Food Facts (ODbL)"
    if USE_CIQUAL_FALLBACK and pid in CIQUAL_MAP and allergen_status in ("producto_fresco", "declarado"):
        code = CIQUAL_MAP[pid]
        row = ciqual_table()[code]
        vals = {k: row["values"].get(k) for k in calc.NUTRIENTS}
        if vals["kcal"] is not None:
            return vals, f"CIQUAL 2020 (ANSES, Licence Ouverte) · {row['name']} [{code}]"
    return None, None


# ---------------------------------------------------------------------------
# Productos (Mercadona)
# ---------------------------------------------------------------------------
def num(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
    return round(float(v), 4)


def mercadona_product(pid: str) -> Dict[str, Any]:
    return cached_json(RAW / "mercadona" / "products" / f"{pid}.json",
                       f"{MERCADONA}/products/{pid}/?lang=es&wh={WH}", pause=0.3)


def build_product(pid: str) -> Tuple[Dict[str, Any], Dict[str, str]]:
    p = mercadona_product(pid)
    pi = p["price_instructions"]
    cats = p.get("categories") or [{}]
    cat0 = cats[0].get("name", "")
    cat1 = (cats[0].get("categories") or [{}])[0].get("name", "")
    allergens = parse_allergens(p)
    nut, nut_src = nutrition_for(pid, p.get("ean") or None, allergens["status"])
    # miniatura
    thumb_raw = RAW / "mercadona" / "thumbs" / f"{pid}.img"
    if not thumb_raw.exists() or REFRESH:
        thumb_raw.parent.mkdir(parents=True, exist_ok=True)
        thumb_raw.write_bytes(http_get(p["thumbnail"], pause=0.3))
    sips_resize(thumb_raw, IMG_PRODUCTS / f"{pid}.jpg", 300)
    size_format = (pi.get("size_format") or None)
    prod = {
        "id": str(p["id"]),
        "ean": p.get("ean") or None,
        "name": p["display_name"],
        "brand": (p.get("brand") or None),
        "packaging": p.get("packaging") or None,
        "thumbnail": f"/img/products/{pid}.jpg",
        "category": cat1,
        "unit_price": num(pi["unit_price"]),
        "bulk_price": num(pi["bulk_price"]),
        "reference_format": pi.get("reference_format"),
        "unit_size": num(pi.get("unit_size")),
        "size_format": size_format.lower() if size_format else None,
        "price_decreased": bool(pi.get("price_decreased")),
        "previous_unit_price": num(pi.get("previous_unit_price")),
        "allergens": allergens,
        "nutrition_100g": nut,
        "nutrition_source": nut_src,
        "source_url": f"https://tienda.mercadona.es/product/{pid}/",
        "fetched_at": TODAY,
    }
    return prod, {"cat0": cat0, "cat1": cat1}


# ---------------------------------------------------------------------------
# Tiendas simuladas
# ---------------------------------------------------------------------------
def build_stores(products: List[Dict[str, Any]], cats: Dict[str, Dict[str, str]]) -> List[Dict[str, Any]]:
    stores = []
    for s in STORES:
        aisles = [{"number": i + 1, "name": n} for i, n in enumerate(s["aisles"])]
        by_name = {a["name"]: a["number"] for a in aisles}
        locations: Dict[str, Any] = {}
        stock: Dict[str, bool] = {}
        for p in products:
            sec = section_for(cats[p["id"]]["cat0"], cats[p["id"]]["cat1"])
            h = hashlib.md5(f"{s['id']}:{p['id']}".encode()).digest()
            locations[p["id"]] = {
                "aisle": by_name[sec],
                "side": "izq" if h[0] % 2 == 0 else "der",
                "shelf": "ABCD"[h[1] % 4],
            }
            stock[p["id"]] = (s["id"], p["id"]) not in OUT_OF_STOCK
        stores.append({"id": s["id"], "name": s["name"], "simulated": True,
                       "aisles": aisles, "locations": locations, "stock": stock})
    return stores


# ---------------------------------------------------------------------------
# Principal
# ---------------------------------------------------------------------------
def build_recipe(r: Dict[str, Any], products: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    page = wikibooks_page(r["page"])
    wt = page["wikitext"]
    ing_src = ingredients_block(wt)
    ingredients = []
    for ing in r["ingredients"]:
        if ing["src"] not in ing_src:
            raise ValueError(f"{r['id']}: «{ing['src']}» no aparece en los ingredientes de la fuente")
        out: Dict[str, Any] = {"name": ing["name"]}
        if "pieces" in ing:
            prod = products[ing["product_id"]]
            if prod["size_format"] != "kg" or not prod["unit_size"]:
                raise ValueError(f"{r['id']}: {ing['name']} no tiene peso por pieza")
            out["quantity"] = round(ing["pieces"] * prod["unit_size"] * 1000)
            out["unit"] = "g"
        else:
            out["quantity"] = ing["quantity"]
            out["unit"] = ing["unit"]
        out["label"] = ing["label"]
        out["product_id"] = ing["product_id"]
        if ing.get("optional"):
            out["optional"] = True
        ingredients.append(out)
    title = page["title"]
    return {
        "id": r["id"],
        "name": r["name"],
        "subtitle": r["subtitle"],
        "image": commons_photo(r["photo"], r["id"]),
        "servings": parse_servings(wt),
        "time_min": parse_time(wt),
        "tags": r["tags"],
        "ingredients": ingredients,
        "steps": parse_steps(wt, r.get("stop_steps_at")),
        "source": {
            "name": f"Wikilibros · {title.split('/')[-1]}",
            "url": "https://es.wikibooks.org/w/index.php?" + urllib.parse.urlencode({"title": title, "oldid": page["revid"]}),
            "license": "CC BY-SA 4.0",
        },
    }


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    global REFRESH
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="ignora la caché de data/raw y vuelve a descargar")
    REFRESH = ap.parse_args().refresh

    # Productos en el orden en que aparecen en las recetas
    pids: List[str] = []
    for r in RECIPES:
        for ing in r["ingredients"]:
            if ing["product_id"] and ing["product_id"] not in pids:
                pids.append(ing["product_id"])
    products: Dict[str, Dict[str, Any]] = {}
    cats: Dict[str, Dict[str, str]] = {}
    for pid in pids:
        log(f"producto {pid}")
        products[pid], cats[pid] = build_product(pid)

    recipes = []
    for r in RECIPES:
        log(f"receta {r['id']}")
        recipes.append(build_recipe(r, products))

    # Limpia imágenes generadas por ejecuciones anteriores que ya no se usan
    for folder, keep in ((IMG_PRODUCTS, set(products)), (IMG_RECIPES, {r["id"] for r in RECIPES})):
        for f in folder.glob("*.jpg"):
            if f.stem not in keep:
                log(f"  elimino imagen sin uso {f.name}")
                f.unlink()

    stores = build_stores(list(products.values()), cats)
    allergens = [{"code": c, "name": n, "emoji": e} for c, n, e in ALLERGENS]

    write_json(OUT / "allergens.json", allergens)
    write_json(OUT / "products.json", list(products.values()))
    write_json(OUT / "recipes.json", recipes)
    write_json(OUT / "stores.json", stores)

    # Resumen
    print(f"OK: {len(recipes)} recetas, {len(products)} productos, {len(stores)} tiendas -> {OUT}")
    for r in recipes:
        s = calc.recipe_summary(r, products)
        n = s["nutrition_per_serving"]
        print(f"- {r['name']}: {s['cost_per_serving']:.2f} €/ración (total {s['cost_total']:.2f} €, cesta {s['basket_total']:.2f} €)"
              f" | envase completo: {', '.join(s['whole_package_lines']) or '—'}")
        print(f"    nutrición/ración{' PARCIAL' if s['nutrition_partial'] else ''}: {n['kcal']} kcal, prot {n['protein']} g,"
              f" hidr {n['carbs']} g, grasas {n['fat']} g, azúc {n['sugars']} g, sal {n['salt']} g"
              f" | cobertura por peso {s['nutrition_weight_coverage']} %"
              f"{' | sin dato: ' + ', '.join(s['nutrition_missing']) if s['nutrition_missing'] else ''}")
    unk = [p for p in products.values() if p["allergens"]["status"] == "desconocido"]
    print("Alérgenos «desconocido»: " + ", ".join(f"{p['name']} ({p['id']})" for p in unk))


if __name__ == "__main__":
    main()
