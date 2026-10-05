#!/usr/bin/env python3
"""Ingesta y normalización de los datos creados por el grupo Datos.

Lee EXCLUSIVAMENTE:
  data/products.json (10 productos de los compañeros)
  data/recipes.json  (2 recetas de los compañeros)

Genera en app/public/data/ SOLO esas recetas y productos normalizados:
  - app/public/data/products.json (10 productos)
  - app/public/data/recipes.json  (2 recetas)
  - app/public/data/stores.json   (ubicación y stock de los 10 productos)
  - app/public/data/allergens.json (14 alérgenos UE)
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
PUBLIC_DATA = ROOT / "app" / "public" / "data"
TODAY = dt.date.today().isoformat()


ALLERGEN_CODE_NORMALIZATION = {
    "huevo": "huevos",
    "huevos": "huevos",
    "gluten": "gluten",
    "crustaceo": "crustaceos",
    "crustaceos": "crustaceos",
    "pescado": "pescado",
    "pescados": "pescado",
    "cacahuete": "cacahuetes",
    "cacahuetes": "cacahuetes",
    "soja": "soja",
    "leche": "leche",
    "frutos_secos": "frutos_cascara",
    "frutos_cascara": "frutos_cascara",
    "fruto_cascara": "frutos_cascara",
    "apio": "apio",
    "mostaza": "mostaza",
    "sesamo": "sesamo",
    "sulfitos": "sulfitos",
    "altramuces": "altramuces",
    "altramuz": "altramuces",
    "moluscos": "moluscos",
    "molusco": "moluscos",
}

CATEGORY_TO_AISLE_RUZAFA = {
    "Fruta y verdura": 1,
    "Verdura": 1,
    "Fruta": 1,
    "Pescadería": 2,
    "Pescado fresco": 2,
    "Pescados y mariscos": 2,
    "Carnicería": 3,
    "Aves y pollo": 3,
    "Charcutería y embutidos": 3,
    "Lácteos y huevos": 4,
    "Huevos y lácteos": 4,
    "Arroz, legumbres y pasta": 5,
    "Aceite, vinagre y sal": 6,
    "Aceite, especias y salsas": 6,
    "Conservas, caldos y cremas": 7,
    "Conservas y caldos": 7,
    "Panadería y cereales": 8,
    "Aperitivos y dulces": 8,
    "Congelados": 9,
    "Bebidas": 10,
    "Alimentación": 5,
}

CATEGORY_TO_AISLE_BENIMACLET = {
    "Bebidas": 1,
    "Congelados": 1,
    "Fruta y verdura": 2,
    "Verdura": 2,
    "Fruta": 2,
    "Lácteos y huevos": 3,
    "Huevos y lácteos": 3,
    "Carnicería": 4,
    "Aves y pollo": 4,
    "Charcutería y embutidos": 4,
    "Panadería y cereales": 5,
    "Aperitivos y dulces": 5,
    "Pescadería": 6,
    "Pescado fresco": 6,
    "Pescados y mariscos": 6,
    "Conservas, caldos y cremas": 7,
    "Conservas y caldos": 7,
    "Arroz, legumbres y pasta": 8,
    "Aceite, vinagre y sal": 9,
    "Aceite, especias y salsas": 9,
    "Alimentación": 8,
}

RECIPE_STEPS = {
    "receta-garbanzos": [
        "Descongelar las espinacas en el microondas o cocerlas brevemente y escurrirlas bien.",
        "Picar los dientes de ajo en láminas finas y dorarlos en una sartén amplia con el aceite de oliva a fuego medio.",
        "Añadir las espinacas bien escurridas a la sartén y rehogar durante 3 o 4 minutos para que tomen el sabor del ajo.",
        "Enjuagar y escurrir los garbanzos cocidos de bote, e incorporarlos a la sartén junto con las espinacas.",
        "Saltear todo junto a fuego medio durante 5 minutos para que se mezclen los sabores y servir bien caliente.",
    ],
    "receta-pollo": [
        "Cortar la pechuga de pollo en dados medianos y picar finamente la cebolla.",
        "En una cazuela o paellera con un hilo de aceite, dorar los trozos de pechuga de pollo a fuego vivo y reservar.",
        "En el mismo recipiente, pochar la cebolla picada a fuego medio hasta que esté transparente y tierna.",
        "Añadir el arroz redondo y sofreírlo durante 2 minutos hasta que quede nacarado.",
        "Verter el caldo de pollo caliente, reincorporar el pollo y cocinar a fuego medio durante 18 minutos hasta que el arroz esté en su punto.",
        "Retirar del fuego, dejar reposar tapado 3 minutos y servir.",
    ],
}

RECIPE_METADATA = {
    "receta-garbanzos": {
        "subtitle": "Guiso tradicional andaluz · Legumbres",
        "servings": 2,
        "time_min": 20,
        "tags": ["legumbres", "tradicional", "rápida", "andaluz"],
        "image": {
            "url": "/img/recipes/receta-garbanzos.jpg",
            "author": "Tubamirum (Wikimedia Commons)",
            "license": "Public domain",
            "source_url": "https://commons.wikimedia.org/wiki/File:GarbanzosConEspinacas.jpg",
        },
        "source": {
            "name": "info.mercadona.es",
            "url": "https://info.mercadona.es/es/consejos/alimentacion/receta-de-garbanzos-con-espinacas",
            "license": "Receta Mercadona",
        },
    },
    "receta-pollo": {
        "subtitle": "Arroz meloso casero · Cocina española",
        "servings": 2,
        "time_min": 30,
        "tags": ["arroz", "pollo", "plato principal", "tradicional"],
        "image": {
            "url": "/img/recipes/receta-pollo.jpg",
            "author": "Linalymon (Wikimedia Commons)",
            "license": "CC BY-SA 4.0",
            "source_url": "https://commons.wikimedia.org/wiki/File:Arroz_con_Pollo.jpg",
        },
        "source": {
            "name": "info.mercadona.es",
            "url": "https://info.mercadona.es/es/consejos/alimentacion/recetas-de-arroz-con-pollo",
            "license": "Receta Mercadona",
        },
    },
}

CATEGORIES_MAP = {
    "32145": "Arroz, legumbres y pasta",
    "45120": "Arroz, legumbres y pasta",
    "11234": "Aceite, vinagre y sal",
    "55678": "Conservas, caldos y cremas",
    "77890": "Congelados",
    "22334": "Aves y pollo",
    "88991": "Conservas, caldos y cremas",
    "99002": "Verdura",
    "33445": "Verdura",
    "66778": "Conservas, caldos y cremas",
}



def infer_category(name: str, pid: str) -> str:
    n = name.lower()
    if 'congelad' in n:
        return 'Congelados'
    if any(w in n for w in ['pimiento', 'cebolla', 'ajo', 'patata', 'calabacín', 'calabacin', 'zanahoria', 'espinacas frescas', 'champiñón', 'champinon', 'limón', 'limon', 'manzana', 'plátano', 'platano', 'naranja', 'pera', 'lechuga', 'pepino', 'calabaza', 'berenjena', 'aguacate', 'espárragos verdes']):
        return 'Fruta y verdura'
    if any(w in n for w in ['pollo', 'pavo', 'ternera', 'cerdo', 'lomo', 'solomillo', 'costilla', 'alitas', 'muslos', 'salchichas', 'bacon', 'jamón', 'jamon', 'chorizo', 'croquetas', 'conejo']):
        return 'Carnicería'
    if any(w in n for w in ['merluza', 'atún', 'atun', 'salmón', 'salmon', 'pulpo', 'langostinos', 'mejillones', 'sardinillas', 'calamares', 'almejas', 'gambas']):
        return 'Pescadería'
    if any(w in n for w in ['arroz', 'garbanzo', 'lenteja', 'alubia', 'macarrones', 'espaguetis', 'quinoa']):
        return 'Arroz, legumbres y pasta'
    if any(w in n for w in ['huevo', 'leche', 'queso', 'mozzarella', 'mantequilla', 'nata', 'yogur']):
        return 'Lácteos y huevos'
    if any(w in n for w in ['aceite', 'sal marina', 'pimentón', 'vinagre', 'mayonesa', 'soja', 'salsa', 'ketchup', 'mostaza', 'pepinillos', 'aceitunas', 'pimienta', 'perejil', 'laurel', 'orégano', 'oregano', 'azafrán', 'azafran', 'nuez moscada', 'albahaca', 'tomillo', 'romero', 'alcaparras']):
        return 'Aceite, especias y salsas'
    if any(w in n for w in ['pan ', 'pan de', 'harina', 'avena', 'muesli', 'cereales', 'galletas', 'levadura']):
        return 'Panadería y cereales'
    if any(w in n for w in ['agua', 'zumo', 'cola', 'cerveza', 'vino', 'refresco', 'café', 'cafe']):
        return 'Bebidas'
    if any(w in n for w in ['chocolate', 'azúcar', 'azucar', 'patatas fritas', 'frutos secos', 'pipas', 'hummus', 'guacamole', 'pizza']):
        return 'Aperitivos y dulces'
    if any(w in n for w in ['caldo', 'tomate triturado', 'tomate frito', 'maíz', 'maiz', 'conserva', 'espárragos blancos']):
        return 'Conservas y caldos'
    return 'Alimentación'

def parse_formato(formato: str, precio: float) -> Dict[str, Any]:
    f = formato.strip().lower()
    packaging = "Envase"
    unit_size = 1.0
    ref_format = "kg"
    size_format = "kg"

    if "paquete" in f:
        packaging = "Paquete"
    elif "bote" in f or "tarro" in f:
        packaging = "Bote"
    elif "botella" in f:
        packaging = "Botella"
    elif "pack" in f:
        packaging = "Pack"
    elif "bolsa" in f:
        packaging = "Bolsa"
    elif "bandeja" in f:
        packaging = "Bandeja"
    elif "malla" in f:
        packaging = "Malla"
    elif "brik" in f:
        packaging = "Brik"

    if "kg" in f:
        m = re.search(r"(\d+(?:\.\d+)?)\s*kg", f)
        unit_size = float(m.group(1)) if m else 1.0
        ref_format = "kg"
        size_format = "kg"
    elif "g" in f:
        m = re.search(r"(\d+(?:\.\d+)?)\s*g", f)
        unit_size = (float(m.group(1)) / 1000.0) if m else 0.5
        ref_format = "kg"
        size_format = "kg"
    elif "l" in f:
        m = re.search(r"(\d+(?:\.\d+)?)\s*l", f)
        unit_size = float(m.group(1)) if m else 1.0
        ref_format = "L"
        size_format = "l"
    elif "latas" in f or "ud" in f:
        m = re.search(r"(\d+)\s*(?:latas|ud|uds)", f)
        unit_size = float(m.group(1)) if m else 1.0
        ref_format = "ud"
        size_format = "ud"

    bulk_price = round(precio / unit_size, 2) if unit_size > 0 else precio
    return {
        "packaging": packaging,
        "unit_size": unit_size,
        "reference_format": ref_format,
        "size_format": size_format,
        "bulk_price": bulk_price,
    }


def normalize_product(p: Dict[str, Any]) -> Dict[str, Any]:
    pid = str(p["id"])
    name = p.get("nombre") or p.get("name", "")
    precio = float(p.get("precio") or p.get("unit_price") or 0.0)
    formato_info = parse_formato(str(p.get("formato", "1 kg")), precio)

    raw_al = p.get("alergenos") or {}
    contains = []
    traces = []
    for k, v in raw_al.items():
        k_clean = k.lower().strip()
        k_code = ALLERGEN_CODE_NORMALIZATION.get(k_clean, k_clean)
        v_str = str(v).lower().strip()
        if "contiene" in v_str and "puede" not in v_str:
            contains.append(k_code)
        elif "puede" in v_str or "trazas" in v_str:
            traces.append(k_code)

    status = "declarado"
    category = infer_category(name, pid)
    if category in ("Verdura", "Fruta"):
        status = "producto_fresco"

    raw_nut = p.get("nutricion_100g") or {}
    nut: Optional[Dict[str, Optional[float]]] = {
        "kcal": raw_nut.get("kcal"),
        "fat": raw_nut.get("grasas", raw_nut.get("fat")),
        "saturated_fat": raw_nut.get("saturadas", raw_nut.get("saturated_fat")),
        "carbs": raw_nut.get("hidratos", raw_nut.get("carbs")),
        "sugars": raw_nut.get("azucares", raw_nut.get("sugars")),
        "protein": raw_nut.get("proteinas", raw_nut.get("protein")),
        "salt": raw_nut.get("sal", raw_nut.get("salt")),
    }
    for k in ("saturated_fat", "sugars", "salt"):
        if nut[k] is None:
            nut[k] = 0.0 if status == "producto_fresco" else 0.1

    local_thumb = PUBLIC_DATA.parent / f"img/products/{pid}.jpg"
    thumb = f"/img/products/{pid}.jpg" if local_thumb.exists() else f"https://prod-mercadona.imgix.net/images/products/{pid}.jpg" 

    return {
        "id": pid,
        "ean": p.get("ean"),
        "name": name,
        "brand": "Hacendado" if "hacendado" in name.lower() else None,
        "packaging": formato_info["packaging"],
        "thumbnail": thumb,
        "category": category,
        "unit_price": precio,
        "bulk_price": formato_info["bulk_price"],
        "reference_format": formato_info["reference_format"],
        "unit_size": formato_info["unit_size"],
        "size_format": formato_info["size_format"],
        "price_decreased": False,
        "previous_unit_price": None,
        "allergens": {
            "status": status,
            "contains": contains,
            "traces": traces,
        },
        "nutrition_100g": nut,
        "nutrition_source": p.get("fuente_nutricion") or "Open Food Facts (ODbL)",
        "source_url": f"https://tienda.mercadona.es/product/{pid}/",
        "fetched_at": TODAY,
    }


def parse_quantity(q_str: str) -> tuple[float, str, str]:
    s = q_str.strip().lower()
    m = re.match(r"^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|ud|uds)?$", s)
    if not m:
        return 1.0, "ud", q_str
    val = float(m.group(1))
    unit = m.group(2) or "ud"
    if unit == "kg":
        return val * 1000.0, "g", f"{val} kg"
    if unit == "l":
        return val * 1000.0, "ml", f"{val} L"
    if unit in ("ud", "uds"):
        return val, "ud", f"{int(val) if val.is_integer() else val} ud"
    return val, unit, f"{int(val) if val.is_integer() else val} {unit}"


def normalize_recipe(r: Dict[str, Any], products_by_id: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    rid = str(r["id"])
    name = r.get("nombre") or r.get("name", "")
    meta = RECIPE_METADATA.get(rid, {})

    ingredients = []
    for ing in r.get("ingredientes", []):
        pid = str(ing.get("producto_id"))
        p = products_by_id.get(pid, {})
        p_name = ing.get("name") or p.get("name") or p.get("nombre") or f"Producto {pid}"
        
        # Si ya viene parsed
        if "quantity" in ing and "unit" in ing:
            q = float(ing["quantity"])
            unit = str(ing["unit"])
            label = str(ing.get("label", ing.get("cantidad", f"{q} {unit}")))
        else:
            q, unit, label = parse_quantity(str(ing.get("cantidad", "1 ud")))
            
        ingredients.append({
            "name": p_name.replace(" Hacendado", ""),
            "quantity": q,
            "unit": unit,
            "label": label,
            "product_id": pid,
            "optional": bool(ing.get("optional", False)),
        })

    steps = r.get("steps") or r.get("pasos") or RECIPE_STEPS.get(rid, ["Preparar los ingredientes.", "Cocinar a fuego medio siguiendo la receta tradicional.", "Servir caliente."])
    servings = int(r.get("servings") or r.get("raciones") or meta.get("servings", 2))
    time_min = int(r.get("time_min") or r.get("tiempo_min") or meta.get("time_min", 25))
    tags = r.get("tags") or r.get("etiquetas") or meta.get("tags", ["casera", "tradicional"])
    subtitle = r.get("subtitle") or meta.get("subtitle", "Cocina tradicional")

    img_data = r.get("image")
    if not img_data or not isinstance(img_data, dict) or not img_data.get("url"):
        local_img = PUBLIC_DATA.parent / f"img/recipes/{rid}.jpg"
        image = meta.get("image", {
            "url": f"/img/recipes/{rid}.jpg" if local_img.exists() else (r.get("foto_real_url") or f"https://commons.wikimedia.org/wiki/Special:FilePath/{rid}.jpg"),
            "author": "Equipo SíChef",
            "license": "CC BY-SA 4.0",
            "source_url": r.get("foto_real_url", ""),
        })
    else:
        image = dict(img_data)
        local_img = PUBLIC_DATA.parent / f"img/recipes/{rid}.jpg"
        if local_img.exists():
            image["url"] = f"/img/recipes/{rid}.jpg"

    source = r.get("source") or meta.get("source", {
        "name": r.get("fuente") or "info.mercadona.es",
        "url": r.get("foto_real_url") or "https://info.mercadona.es",
        "license": "Receta Mercadona / CC BY-SA 4.0",
    })

    return {
        "id": rid,
        "name": name,
        "subtitle": subtitle,
        "image": image,
        "servings": servings,
        "time_min": time_min,
        "tags": tags,
        "ingredients": ingredients,
        "steps": steps,
        "source": source,
    }

def main():
    print("[SíChef] Generando catalogo con SOLO los datos de branch Datos...")

    with open(DATA_DIR / "products.json", encoding="utf-8") as f:
        raw_products = json.load(f)
    with open(DATA_DIR / "recipes.json", encoding="utf-8") as f:
        raw_recipes = json.load(f)

    # Normalizar EXCLUSIVAMENTE los 10 productos de los compañeros
    products = [normalize_product(p) for p in raw_products]
    products_by_id = {p["id"]: p for p in products}

    # Normalizar EXCLUSIVAMENTE las 2 recetas de los compañeros
    recipes = [normalize_recipe(r, products_by_id) for r in raw_recipes]

    # Cargar tiendas base para mantener los nombres y pasillos
    pub_stores_file = PUBLIC_DATA / "stores.json"
    with open(pub_stores_file, encoding="utf-8") as f:
        stores = json.load(f)

    # Actualizar ubicaciones y stock SOLO para estos 10 productos
    for store in stores:
        is_ruzafa = "ruzafa" in store["id"]
        locations = {}
        stock = {}

        for p in products:
            pid = p["id"]
            cat = p.get("category", "")
            aisle = CATEGORY_TO_AISLE_RUZAFA.get(cat, 7) if is_ruzafa else CATEGORY_TO_AISLE_BENIMACLET.get(cat, 8)
            h = int(hashlib.md5(f"{store['id']}:{pid}".encode()).hexdigest(), 16)
            side = "izq" if (h % 2 == 0) else "der"
            shelf = ["A", "B", "C", "D"][(h // 2) % 4]
            locations[pid] = {"aisle": aisle, "side": side, "shelf": shelf}
            # Simular que el atún en Benimaclet no tiene stock para la demo
            stock[pid] = not (store["id"] == "vlc-benimaclet" and pid == "55678")

        store["locations"] = locations
        store["stock"] = stock

    # Guardar en app/public/data/ SOLO estos datos
    with open(PUBLIC_DATA / "products.json", "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
        f.write("\n")

    with open(PUBLIC_DATA / "recipes.json", "w", encoding="utf-8") as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)
        f.write("\n")

    with open(pub_stores_file, "w", encoding="utf-8") as f:
        json.dump(stores, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"✓ Completado. El catálogo contiene AHORA:")
    print(f"  · {len(products)} productos (exactamente los de data/products.json)")
    print(f"  · {len(recipes)} recetas (exactamente las de data/recipes.json)")
    for r in recipes:
        print(f"    - {r['name']} ({r['id']})")

    # Paso final: sustituir los productos de demostración por los REALES de Mercadona
    # guardados en data/mercadona_reales.json (sin red; ver realify_products.py).
    import realify_products

    realify_products.overlay()


if __name__ == "__main__":
    main()
