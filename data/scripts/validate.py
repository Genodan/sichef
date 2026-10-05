#!/usr/bin/env python3
"""Valida app/public/data/*.json contra el contrato app/src/types.ts.

- Lee types.ts y construye los tipos (interfaces, alias, uniones de literales,
  arrays, objetos anidados, Record<string, T>), así que si el contrato cambia,
  la validación cambia con él.
- Comprueba tipos y campos EXACTOS (ni falta ni sobra ninguno).
- Comprobaciones de integridad: product_id de recetas existen, todos los
  productos tienen ubicación y stock en todas las tiendas, códigos de
  alérgenos válidos, imágenes locales existen, etc.

Uso: python3 data/scripts/validate.py   (código de salida 1 si hay errores)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
import calc  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
TYPES_TS = ROOT / "app" / "src" / "types.ts"
DATA = ROOT / "app" / "public" / "data"
PUBLIC = ROOT / "app" / "public"

# ---------------------------------------------------------------------------
# Mini-parser del subconjunto de TypeScript que usa types.ts
# ---------------------------------------------------------------------------
TOKEN_RE = re.compile(r"\s*(?:(?P<str>'[^']*'|\"[^\"]*\")|(?P<id>[A-Za-z_][A-Za-z0-9_]*)|(?P<num>\d+(?:\.\d+)?)|(?P<p>[{}\[\]()<>|:;,?=]))")

Type = Tuple[Any, ...]  # ('prim', name) | ('lit', value) | ('ref', name) | ('array', T) | ('union', [T]) | ('obj', {k: (T, optional)}) | ('record', K, V)


def tokenize(src: str) -> List[str]:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"//[^\n]*", "", src)
    toks, pos = [], 0
    while pos < len(src):
        m = TOKEN_RE.match(src, pos)
        if not m or m.end() == pos:
            if src[pos:].strip() == "":
                break
            raise SyntaxError(f"types.ts: no entiendo «{src[pos:pos + 30]}»")
        toks.append(m.group(m.lastgroup))
        pos = m.end()
    return toks


class Parser:
    def __init__(self, toks: List[str]):
        self.t, self.i = toks, 0

    def peek(self) -> Optional[str]:
        return self.t[self.i] if self.i < len(self.t) else None

    def eat(self, expected: Optional[str] = None) -> str:
        tok = self.peek()
        if tok is None or (expected is not None and tok != expected):
            raise SyntaxError(f"types.ts: esperaba {expected!r} y encontré {tok!r}")
        self.i += 1
        return tok

    def parse_file(self) -> Dict[str, Type]:
        decls: Dict[str, Type] = {}
        while self.peek() is not None:
            if self.peek() == "export":
                self.eat()
            kw = self.eat()
            name = self.eat()
            if kw == "interface":
                decls[name] = self.parse_object()
            elif kw == "type":
                self.eat("=")
                decls[name] = self.parse_type()
            else:
                raise SyntaxError(f"types.ts: declaración no soportada {kw}")
            if self.peek() == ";":
                self.eat()
        return decls

    def parse_type(self) -> Type:
        if self.peek() == "|":
            self.eat()
        opts = [self.parse_postfix()]
        while self.peek() == "|":
            self.eat()
            opts.append(self.parse_postfix())
        return opts[0] if len(opts) == 1 else ("union", opts)

    def parse_postfix(self) -> Type:
        t = self.parse_primary()
        while self.peek() == "[":
            self.eat("[")
            self.eat("]")
            t = ("array", t)
        return t

    def parse_primary(self) -> Type:
        tok = self.peek()
        if tok == "{":
            return self.parse_object()
        if tok == "(":
            self.eat()
            t = self.parse_type()
            self.eat(")")
            return t
        tok = self.eat()
        if tok[0] in "'\"":
            return ("lit", tok[1:-1])
        if tok in ("string", "number", "boolean"):
            return ("prim", tok)
        if tok == "null":
            return ("lit", None)
        if tok in ("true", "false"):
            return ("lit", tok == "true")
        if tok == "Record":
            self.eat("<")
            k = self.parse_type()
            self.eat(",")
            v = self.parse_type()
            self.eat(">")
            return ("record", k, v)
        return ("ref", tok)

    def parse_object(self) -> Type:
        self.eat("{")
        fields: Dict[str, Tuple[Type, bool]] = {}
        while self.peek() != "}":
            name = self.eat()
            optional = False
            if self.peek() == "?":
                self.eat()
                optional = True
            self.eat(":")
            fields[name] = (self.parse_type(), optional)
            if self.peek() in (";", ","):
                self.eat()
        self.eat("}")
        return ("obj", fields)


def check(value: Any, t: Type, decls: Dict[str, Type], path: str, errors: List[str]) -> bool:
    kind = t[0]
    if kind == "ref":
        return check(value, decls[t[1]], decls, path, errors)
    if kind == "prim":
        ok = {
            "string": isinstance(value, str),
            "number": isinstance(value, (int, float)) and not isinstance(value, bool),
            "boolean": isinstance(value, bool),
        }[t[1]]
        if not ok:
            errors.append(f"{path}: se esperaba {t[1]}, hay {value!r}")
        return ok
    if kind == "lit":
        ok = value is t[1] if t[1] is None or isinstance(t[1], bool) else value == t[1]
        if not ok:
            errors.append(f"{path}: se esperaba {t[1]!r}, hay {value!r}")
        return ok
    if kind == "array":
        if not isinstance(value, list):
            errors.append(f"{path}: se esperaba array")
            return False
        return all([check(v, t[1], decls, f"{path}[{i}]", errors) for i, v in enumerate(value)])
    if kind == "union":
        for opt in t[1]:
            if check(value, opt, decls, path, []):
                return True
        errors.append(f"{path}: {value!r} no encaja en ninguna opción de la unión")
        return False
    if kind == "record":
        if not isinstance(value, dict):
            errors.append(f"{path}: se esperaba objeto (Record)")
            return False
        return all([check(k, t[1], decls, f"{path}.<clave>", errors) and check(v, t[2], decls, f"{path}.{k}", errors)
                    for k, v in value.items()])
    if kind == "obj":
        if not isinstance(value, dict):
            errors.append(f"{path}: se esperaba objeto")
            return False
        ok = True
        for k, (ft, optional) in t[1].items():
            if k not in value:
                if not optional:
                    errors.append(f"{path}: falta el campo «{k}»")
                    ok = False
                continue
            ok = check(value[k], ft, decls, f"{path}.{k}", errors) and ok
        for k in value:
            if k not in t[1]:
                errors.append(f"{path}: campo «{k}» no está en types.ts")
                ok = False
        return ok
    raise ValueError(t)


def literal_values(t: Type) -> List[Any]:
    return [o[1] for o in t[1]] if t[0] == "union" else [t[1]]


# ---------------------------------------------------------------------------
def main() -> int:
    decls = Parser(tokenize(TYPES_TS.read_text(encoding="utf-8"))).parse_file()
    codes = set(literal_values(decls["AllergenCode"]))
    errors: List[str] = []
    warnings: List[str] = []

    def load(name: str) -> Any:
        return json.loads((DATA / name).read_text(encoding="utf-8"))

    allergens = load("allergens.json")
    products_list = load("products.json")
    recipes = load("recipes.json")
    stores = load("stores.json")

    # 1) Tipos exactos
    for name, data, tname in (("allergens.json", allergens, "Allergen"), ("products.json", products_list, "Product"),
                              ("recipes.json", recipes, "Recipe"), ("stores.json", stores, "Store")):
        if not isinstance(data, list):
            errors.append(f"{name}: se esperaba un array")
            continue
        for i, item in enumerate(data):
            check(item, ("ref", tname), decls, f"{name}[{i}]", errors)

    # 2) Alérgenos: los 14, sin repetir
    got = [a.get("code") for a in allergens]
    if sorted(got) != sorted(codes) or len(got) != len(set(got)):
        errors.append(f"allergens.json: deben estar los {len(codes)} códigos una vez cada uno (hay {got})")

    # 3) Productos
    products: Dict[str, Dict[str, Any]] = {}
    for p in products_list:
        pid = p.get("id")
        if pid in products:
            errors.append(f"products.json: id repetido {pid}")
        products[pid] = p
        where = f"producto {pid}"
        if not re.fullmatch(r"https://tienda\.mercadona\.es/product/[^/]+/", p.get("source_url", "")):
            errors.append(f"{where}: source_url con formato inesperado")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", p.get("fetched_at", "")):
            errors.append(f"{where}: fetched_at no es fecha ISO")
        if not (isinstance(p.get("unit_price"), (int, float)) and p["unit_price"] > 0):
            errors.append(f"{where}: unit_price debe ser > 0")
        if p.get("size_format") not in ("kg", "l", "ud", None):
            errors.append(f"{where}: size_format inesperado {p.get('size_format')!r}")
        thumb = p.get("thumbnail", "")
        if thumb.startswith("/") and not (PUBLIC / thumb.lstrip("/")).exists():
            errors.append(f"{where}: no existe la miniatura {thumb}")
        if (p.get("nutrition_100g") is None) != (p.get("nutrition_source") is None):
            errors.append(f"{where}: nutrition_100g y nutrition_source deben ser null a la vez")
        al = p.get("allergens") or {}
        for c in (al.get("contains") or []) + (al.get("traces") or []):
            if c not in codes:
                errors.append(f"{where}: código de alérgeno no válido {c}")
        if al.get("status") == "desconocido" and (al.get("contains") or al.get("traces")):
            errors.append(f"{where}: «desconocido» no puede listar alérgenos")
        if set(al.get("contains") or []) & set(al.get("traces") or []):
            errors.append(f"{where}: un alérgeno no puede estar en contains y traces a la vez")

    # 4) Recetas
    seen = set()
    used_pids = set()
    for r in recipes:
        rid = r.get("id")
        where = f"receta {rid}"
        if rid in seen:
            errors.append(f"recipes.json: id repetido {rid}")
        seen.add(rid)
        img = (r.get("image") or {}).get("url", "")
        if img.startswith("/") and not (PUBLIC / img.lstrip("/")).exists():
            errors.append(f"{where}: no existe la foto {img}")
        if not (r.get("image") or {}).get("author") or not (r.get("image") or {}).get("license"):
            errors.append(f"{where}: la foto necesita autor y licencia")
        if not r.get("steps"):
            errors.append(f"{where}: sin pasos")
        if not (isinstance(r.get("servings"), int) and r["servings"] > 0):
            errors.append(f"{where}: servings debe ser entero > 0")
        for ing in r.get("ingredients", []):
            pid = ing.get("product_id")
            if pid is not None:
                used_pids.add(pid)
                if pid not in products:
                    errors.append(f"{where}: product_id {pid} ({ing.get('name')}) no existe en products.json")
            if not ing.get("optional"):
                if pid is None:
                    warnings.append(f"{where}: «{ing.get('name')}» no es opcional y no tiene producto")
                if not (isinstance(ing.get("quantity"), (int, float)) and ing["quantity"] > 0):
                    errors.append(f"{where}: «{ing.get('name')}» no opcional necesita quantity > 0")
            elif isinstance(ing.get("quantity"), (int, float)) and ing["quantity"] < 0:
                errors.append(f"{where}: quantity negativa")
            if not ing.get("label"):
                errors.append(f"{where}: «{ing.get('name')}» sin label")
    for pid in products:
        if pid not in used_pids:
            warnings.append(f"producto {pid} no se usa en ninguna receta")

    # 5) Tiendas
    if len(stores) < 2:
        errors.append("stores.json: se esperaban al menos 2 tiendas")
    out_of_stock = 0
    loc_signature = []
    for s in stores:
        where = f"tienda {s.get('id')}"
        numbers = [a.get("number") for a in s.get("aisles", [])]
        if len(numbers) != len(set(numbers)):
            errors.append(f"{where}: números de pasillo repetidos")
        if "(simulada)" not in s.get("name", ""):
            errors.append(f"{where}: el nombre debe indicar «(simulada)»")
        for pid in products:
            loc = (s.get("locations") or {}).get(pid)
            if loc is None:
                errors.append(f"{where}: falta ubicación de {pid}")
            elif loc.get("aisle") not in numbers:
                errors.append(f"{where}: {pid} en pasillo {loc.get('aisle')} que no existe")
            if pid not in (s.get("stock") or {}):
                errors.append(f"{where}: falta stock de {pid}")
        for pid in list((s.get("locations") or {})) + list((s.get("stock") or {})):
            if pid not in products:
                errors.append(f"{where}: {pid} no está en products.json")
        out_of_stock += sum(1 for v in (s.get("stock") or {}).values() if v is False)
        loc_signature.append(json.dumps(s.get("locations"), sort_keys=True))
    if len(set(loc_signature)) != len(loc_signature):
        errors.append("stores.json: las ubicaciones deberían ser distintas entre tiendas")
    if out_of_stock == 0:
        warnings.append("stores.json: ningún producto sin stock (la demo lo espera)")

    # 6) Demo «dato no disponible»: al menos un producto desconocido en una receta
    unknown_used = [pid for pid in used_pids if products.get(pid, {}).get("allergens", {}).get("status") == "desconocido"]
    if not unknown_used:
        errors.append("ninguna receta usa un producto con alérgenos «desconocido» (la demo lo necesita)")

    # Informe
    for w in warnings:
        print("AVISO:", w)
    if errors:
        for e in errors:
            print("ERROR:", e)
        print(f"\n✗ {len(errors)} errores")
        return 1
    print(f"✓ Datos válidos contra {TYPES_TS.relative_to(ROOT)}: {len(allergens)} alérgenos, {len(products)} productos, "
          f"{len(recipes)} recetas, {len(stores)} tiendas")
    print("Productos «desconocido» usados en recetas: " + ", ".join(sorted(unknown_used)))
    for r in recipes:
        s = calc.recipe_summary(r, products)
        print(f"  · {r['name']}: {s['cost_per_serving']:.2f} €/ración calculado"
              f" (nutrición {'parcial' if s['nutrition_partial'] else 'completa'}, cobertura por peso {s['nutrition_weight_coverage']} %)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
