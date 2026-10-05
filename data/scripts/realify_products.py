#!/usr/bin/env python3
"""Sustituye los productos de demostración de app/public/data/products.json por
productos REALES del catálogo de tienda.mercadona.es (precio, foto, EAN, alérgenos)
y nutrición de Open Food Facts / CIQUAL cuando existe (si no, null).

Paso 1  python3 data/scripts/realify_products.py match   → data/raw/realify/matches.json (revisar)
Paso 2  python3 data/scripts/realify_products.py apply   → reescribe products/recipes/stores.json

Los ids antiguos se remapean en recipes.json (product_id) y stores.json (locations, stock).
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_template_data as B  # noqa: E402

OUT = B.OUT
WORK = B.RAW / "realify"
# Guardados en el repo: el ingest (predev/prebuild, también en Vercel) los aplica SIN red.
REALES = B.ROOT / "data" / "mercadona_reales.json"
MAPPING = B.ROOT / "data" / "mercadona_mapping.json"
STOP = {"de", "del", "la", "el", "en", "y", "con", "al", "a", "los", "las", "para", "hacendado", "kg", "g", "ml", "l", "ud", "uds", "pack", "bandeja", "bote", "paquete", "botella", "lata", "tarro", "malla"}

# Correcciones manuales tras revisar matches.json (id antiguo -> id real de Mercadona).
OVERRIDES: dict[str, str] = {
    "77890": "61279",  # Espinacas congeladas → Espinaca en porciones Hacendado ultracongelada (no «Sepia»)
    "33445": "69297",  # Ajo → Ajos morados (no «Ajo negro»)
    "22222": "62228",  # Merluza filetes → Filetes de merluza del Cabo sin piel (no rebozados)
    "10013": "6250",   # Macarrones → Macarrón Hacendado (no plato preparado)
    "10026": "59086",  # Chorizo en rodajas → Chorizo extra Hacendado lonchas
    "10029": "61200",  # Guisantes congelados → Guisante muy tierno Hacendado ultracongelado
    "10033": "18480",  # Caldo de verduras → caldo líquido (las recetas lo usan en ml, no en pastillas)
    "10036": "69730",  # Espinacas frescas → Espinacas cortadas y lavadas
    "10038": "8936",   # Filete de ternera → Filetes de vacuno añojo para plancha
    "10051": "63400",  # Croquetas de jamón → Croquetas de jamón Hacendado
    "10055": "83202.1",  # Pan de barra → Barra de pan (no pack de 3)
    "10062": "66463",  # Cerveza rubia → Cerveza Clásica Steinburg (marca propia)
    "10077": "2784",   # Alitas de pollo → Alas de pollo (crudas, no asadas)
    "10084": "6245",   # Espaguetis → Spaghetti Hacendado (no «Arroz»)
    "10090": "80293",  # Levadura química → Impulsor gasificante repostería Hacendado
    "10093": "23410",  # Mostaza fina → Mostaza clásica Hacendado
    "10118": "9430",   # Quinoa → Quinoa Hacendado (seca)
    "99999": "17502",  # «Salsa secreta (test)» → Salsa pimienta verde Hacendado
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", s)


def tokens(s: str) -> list[str]:
    out = []
    for t in norm(s).split():
        if t in STOP or t.isdigit():
            continue
        out.append(t[:-1] if len(t) > 4 and t.endswith("s") else t)  # plural simple
    return out


def catalog() -> list[dict]:
    cats = B.cached_json(B.RAW / "mercadona" / "categories.json", f"{B.MERCADONA}/categories/?lang=es&wh={B.WH}")
    out = []
    for c0 in cats["results"]:
        for c1 in c0["categories"]:
            d = B.cached_json(B.RAW / "mercadona" / f"cat_{c1['id']}.json", f"{B.MERCADONA}/categories/{c1['id']}/?lang=es&wh={B.WH}")
            for sec in d.get("categories", []):
                for p in sec.get("products", []):
                    out.append({"id": str(p["id"]), "name": p["display_name"], "cat0": c0["name"], "cat1": c1["name"], "sec": sec["name"], "packaging": p.get("packaging"), "unit_price": p["price_instructions"].get("unit_price")})
    seen, uniq = set(), []
    for p in out:
        if p["id"] not in seen:
            seen.add(p["id"])
            uniq.append(p)
    return uniq


# Secciones de la app -> categoría de nivel 1 de Mercadona (bonus de coincidencia)
SECTION_CAT0 = {
    "Fruta y verdura": ["Fruta y verdura"],
    "Carnicería": ["Carne"],
    "Carne y aves": ["Carne"],
    "Pescadería": ["Marisco y pescado"],
    "Pescado y marisco": ["Marisco y pescado"],
    "Lácteos y huevos": ["Huevos, leche y mantequilla", "Postres y yogures", "Charcutería y quesos"],
    "Huevos y lácteos": ["Huevos, leche y mantequilla", "Postres y yogures", "Charcutería y quesos"],
    "Charcutería y embutidos": ["Charcutería y quesos"],
    "Aceite, especias y salsas": ["Aceite, especias y salsas"],
    "Arroz, legumbres y pasta": ["Arroz, legumbres y pasta"],
    "Conservas y caldos": ["Conservas, caldos y cremas"],
    "Panadería": ["Panadería y pastelería", "Harina, cereales y legumbres", "Cereales y galletas"],
    "Congelados": ["Congelados"],
    "Bebidas": ["Agua y refrescos", "Bodega", "Zumos", "Café, té e infusiones"],
}


def score(fake: dict, real: dict) -> float:
    ft, rt = set(tokens(fake["name"])), set(tokens(real["name"]))
    if not ft or not rt:
        return 0.0
    inter = len(ft & rt)
    s = inter / len(ft) * 0.7 + inter / len(rt) * 0.3  # que cubra el nombre buscado
    if norm(fake["name"]).split()[:1] == norm(real["name"]).split()[:1]:
        s += 0.15  # misma primera palabra («Cebolla …»)
    if real["cat0"] in SECTION_CAT0.get(fake.get("category", ""), []):
        s += 0.25
    if "hacendado" in norm(fake["name"]) and "hacendado" in norm(real["name"]):
        s += 0.05
    return round(s, 3)


def match() -> None:
    fakes = json.loads((OUT / "products.json").read_text())
    cat = catalog()
    B.log(f"catálogo: {len(cat)} productos")
    rows = []
    for f in fakes:
        ranked = sorted(cat, key=lambda r: score(f, r), reverse=True)[:4]
        rows.append({
            "old_id": f["id"], "old_name": f["name"], "old_category": f.get("category"), "old_price": f.get("unit_price"),
            "candidates": [{"id": r["id"], "name": r["name"], "cat": f"{r['cat0']} / {r['cat1']}", "price": r["unit_price"], "score": score(f, r)} for r in ranked],
        })
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "matches.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    for r in rows:
        c = r["candidates"][0]
        flag = "  " if c["score"] >= 0.9 else "??"
        print(f"{flag} {r['old_id']:>6} {r['old_name'][:38]:38} → {c['id']:>6} {c['name'][:40]:40} {c['score']}")


def apply() -> None:
    rows = json.loads((WORK / "matches.json").read_text())
    fakes = {p["id"]: p for p in json.loads((OUT / "products.json").read_text())}
    mapping = {r["old_id"]: OVERRIDES.get(r["old_id"], r["candidates"][0]["id"]) for r in rows}

    products: dict[str, dict] = {}
    for old, new in mapping.items():
        if new in products:
            continue
        prod, _ = B.build_product(new)
        prod["category"] = fakes[old].get("category") or prod["category"]  # mantener las secciones de la app
        products[new] = prod

    recipes = json.loads((OUT / "recipes.json").read_text())
    for r in recipes:
        for ing in r.get("ingredients", []):
            pid = ing.get("product_id")
            if pid is not None:
                ing["product_id"] = mapping.get(str(pid), pid)

    stores = json.loads((OUT / "stores.json").read_text())
    for s in stores:
        for key in ("locations", "stock"):
            old = s.get(key) or {}
            new: dict = {}
            for pid, val in old.items():
                new.setdefault(mapping.get(pid, pid), val)
            s[key] = new

    B.write_json(OUT / "products.json", list(products.values()))
    B.write_json(OUT / "recipes.json", recipes)
    B.write_json(OUT / "stores.json", stores)
    (WORK / "mapping.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=1))
    B.write_json(REALES, list(products.values()))
    B.write_json(MAPPING, mapping)

    used = {p["thumbnail"].rsplit("/", 1)[-1] for p in products.values()}
    for img in B.IMG_PRODUCTS.glob("*.jpg"):
        if img.name not in used:
            img.unlink()
    nut = sum(1 for p in products.values() if p["nutrition_100g"])
    st = {}
    for p in products.values():
        st[p["allergens"]["status"]] = st.get(p["allergens"]["status"], 0) + 1
    B.log(f"productos reales: {len(products)} · con nutrición: {nut} · alérgenos: {st}")


def remap_outputs(mapping: dict[str, str], real: dict[str, dict]) -> tuple[int, int]:
    """Sustituye en app/public/data los productos de demostración por los reales y remapea los ids."""
    prods = json.loads((OUT / "products.json").read_text())
    out: list[dict] = []
    seen: set[str] = set()
    replaced = 0
    for p in prods:
        nid = mapping.get(p["id"], p["id"])
        if nid in real:
            if nid not in seen:
                q = dict(real[nid])
                q["category"] = p.get("category") or q["category"]
                out.append(q)
                replaced += 1
        elif p["id"] not in seen:
            out.append(p)
        seen.add(nid if nid in real else p["id"])

    recipes = json.loads((OUT / "recipes.json").read_text())
    for r in recipes:
        for ing in r.get("ingredients", []):
            pid = ing.get("product_id")
            if pid is not None and mapping.get(str(pid)) in real:
                ing["product_id"] = mapping[str(pid)]
    stores = json.loads((OUT / "stores.json").read_text())
    for s in stores:
        for key in ("locations", "stock"):
            new: dict = {}
            for pid, val in (s.get(key) or {}).items():
                new.setdefault(mapping.get(pid, pid) if mapping.get(pid) in real else pid, val)
            s[key] = new
    B.write_json(OUT / "products.json", out)
    B.write_json(OUT / "recipes.json", recipes)
    B.write_json(OUT / "stores.json", stores)
    return replaced, len(out)


def overlay() -> None:
    """Paso final de ingest_datos_branch.py: aplica los productos reales guardados en el repo (sin red)."""
    if not (REALES.exists() and MAPPING.exists()):
        return
    real = {p["id"]: p for p in json.loads(REALES.read_text())}
    mapping = json.loads(MAPPING.read_text())
    replaced, total = remap_outputs(mapping, real)
    print(f"✓ Productos reales de Mercadona aplicados: {replaced} de {total} (data/mercadona_reales.json)")


if __name__ == "__main__":
    {"match": match, "apply": apply, "overlay": overlay}[sys.argv[1]]()
