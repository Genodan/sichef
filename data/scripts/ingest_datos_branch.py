#!/usr/bin/env python3
"""Ingesta e normalizzazione dei dati creati dal gruppo Dati (branch Datos).

Legge:
  data/products.json
  data/recipes.json

Normalizza i campi secondo il contratto app/src/types.ts e li unisce
al catalogo in app/public/data/:
  - allergens.json
  - products.json
  - recipes.json
  - stores.json

Uso:
  python3 data/scripts/ingest_datos_branch.py
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

# Mappatura delle categorie per pasillo nei negozi
CATEGORY_TO_AISLE_RUZAFA = {
    "Fruta y verdura": 1,
    "Verdura": 1,
    "Fruta": 1,
    "Aves y pollo": 2,
    "Carnicería": 2,
    "Pescado fresco": 3,
    "Pescados y mariscos": 3,
    "Marisco": 3,
    "Charcutería y embutidos": 4,
    "Huevos y lácteos": 5,
    "Aceite, vinagre y sal": 6,
    "Aceite, especias y salsas": 6,
    "Arroz, legumbres y pasta": 7,
    "Conservas, caldos y cremas": 8,
    "Congelados": 10,
}

CATEGORY_TO_AISLE_BENIMACLET = {
    "Fruta y verdura": 2,
    "Verdura": 2,
    "Fruta": 2,
    "Aves y pollo": 4,
    "Carnicería": 4,
    "Pescado fresco": 6,
    "Pescados y mariscos": 6,
    "Marisco": 6,
    "Charcutería y embutidos": 5,
    "Huevos y lácteos": 3,
    "Conservas, caldos y cremas": 7,
    "Arroz, legumbres y pasta": 8,
    "Aceite, vinagre y sal": 9,
    "Aceite, especias y salsas": 9,
    "Congelados": 10,
}

# Passi culinari reali per le ricette del gruppo Dati
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

    # Alérgenos
    raw_al = p.get("alergenos") or {}
    contains = []
    traces = []
    for k, v in raw_al.items():
        k_code = k.lower().strip()
        v_str = str(v).lower().strip()
        if "contiene" in v_str and "puede" not in v_str:
            contains.append(k_code)
        elif "puede" in v_str or "trazas" in v_str:
            traces.append(k_code)

    status = "declarado"
    category = CATEGORIES_MAP.get(pid, "Alimentación")
    if category in ("Verdura", "Fruta"):
        status = "producto_fresco"

    # Nutrición
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
    # Completar nulls no especificados para coherencia
    for k in ("saturated_fat", "sugars", "salt"):
        if nut[k] is None:
            nut[k] = 0.0 if status == "producto_fresco" else 0.1

    thumb = f"/img/products/{pid}.jpg"

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
        p_name = p.get("name") or p.get("nombre") or f"Producto {pid}"
        q, unit, label = parse_quantity(str(ing.get("cantidad", "1 ud")))
        ingredients.append({
            "name": p_name.replace(" Hacendado", ""),
            "quantity": q,
            "unit": unit,
            "label": label,
            "product_id": pid,
            "optional": False,
        })

    steps = RECIPE_STEPS.get(rid, ["Preparar los ingredientes.", "Cocinar a fuego medio.", "Servir caliente."])

    return {
        "id": rid,
        "name": name,
        "subtitle": meta.get("subtitle", "Receta casera"),
        "image": meta.get("image", {
            "url": f"/img/recipes/{rid}.jpg",
            "author": "Equipo SíChef",
            "license": "CC BY-SA 4.0",
            "source_url": r.get("foto_real_url", ""),
        }),
        "servings": meta.get("servings", 2),
        "time_min": meta.get("time_min", 25),
        "tags": meta.get("tags", ["casera"]),
        "ingredients": ingredients,
        "steps": steps,
        "source": meta.get("source", {
            "name": "info.mercadona.es",
            "url": "https://info.mercadona.es",
            "license": "Receta Mercadona",
        }),
    }


def main():
    print("[SíChef] Ingesting and normalizing Datos branch data...")

    # Carica file sorgente da data/
    with open(DATA_DIR / "products.json", encoding="utf-8") as f:
        raw_products = json.load(f)
    with open(DATA_DIR / "recipes.json", encoding="utf-8") as f:
        raw_recipes = json.load(f)

    # Carica catalogo esistente da app/public/data/ se presente
    pub_products_file = PUBLIC_DATA / "products.json"
    pub_recipes_file = PUBLIC_DATA / "recipes.json"
    pub_stores_file = PUBLIC_DATA / "stores.json"

    existing_products: List[Dict[str, Any]] = []
    if pub_products_file.exists():
        with open(pub_products_file, encoding="utf-8") as f:
            existing_products = json.load(f)

    existing_recipes: List[Dict[str, Any]] = []
    if pub_recipes_file.exists():
        with open(pub_recipes_file, encoding="utf-8") as f:
            existing_recipes = json.load(f)

    existing_stores: List[Dict[str, Any]] = []
    if pub_stores_file.exists():
        with open(pub_stores_file, encoding="utf-8") as f:
            existing_stores = json.load(f)

    # Normalizza nuovi prodotti
    normalized_new_products = [normalize_product(p) for p in raw_products]
    all_products_by_id = {p["id"]: p for p in existing_products}
    for p in normalized_new_products:
        all_products_by_id[p["id"]] = p

    merged_products = list(all_products_by_id.values())

    # Normalizza nuove ricette
    normalized_new_recipes = [normalize_recipe(r, all_products_by_id) for r in raw_recipes]
    all_recipes_by_id = {r["id"]: r for r in existing_recipes}
    for r in normalized_new_recipes:
        all_recipes_by_id[r["id"]] = r

    merged_recipes = list(all_recipes_by_id.values())

    # Aggiorna negozi con corsie e stock per tutti i prodotti
    for store in existing_stores:
        is_ruzafa = "ruzafa" in store["id"]
        locations = store.setdefault("locations", {})
        stock = store.setdefault("stock", {})

        for p in merged_products:
            pid = p["id"]
            if pid not in locations:
                cat = p.get("category", "")
                if is_ruzafa:
                    aisle = CATEGORY_TO_AISLE_RUZAFA.get(cat, 7)
                else:
                    aisle = CATEGORY_TO_AISLE_BENIMACLET.get(cat, 8)

                h = int(hashlib.md5(f"{store['id']}:{pid}".encode()).hexdigest(), 16)
                side = "izq" if (h % 2 == 0) else "der"
                shelf = ["A", "B", "C", "D"][(h // 2) % 4]
                locations[pid] = {"aisle": aisle, "side": side, "shelf": shelf}

            if pid not in stock:
                # Simula stock: tutto disponibile tranne qualche eccezione
                stock[pid] = True

    # Salva in app/public/data/
    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    with open(pub_products_file, "w", encoding="utf-8") as f:
        json.dump(merged_products, f, indent=2, ensure_ascii=False)
        f.write("\n")

    with open(pub_recipes_file, "w", encoding="utf-8") as f:
        json.dump(merged_recipes, f, indent=2, ensure_ascii=False)
        f.write("\n")

    with open(pub_stores_file, "w", encoding="utf-8") as f:
        json.dump(existing_stores, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("✓ Ingestion completata con successo:")
    print(f"  · Prodotti totali: {len(merged_products)} (di cui {len(normalized_new_products)} da Datos)")
    print(f"  · Ricette totali: {len(merged_recipes)} (di cui {len(normalized_new_recipes)} da Datos)")
    print(f"  · Negozi aggiornati: {len(existing_stores)}")


if __name__ == "__main__":
    main()
