"""Cálculo de referencia de precio y nutrición de una receta (SíChef).

Es la MISMA regla que se documenta en data/README.md para que el grupo App la
porte a TypeScript. No estima nada: solo convierte unidades compatibles.

Coste de una línea (ingrediente no opcional con product_id):
  - unit 'g'  y producto en 'kg' -> (q / 1000) / unit_size * unit_price
  - unit 'ml' y producto en 'l'  -> (q / 1000) / unit_size * unit_price
  - unit 'ud' y producto en 'ud' ->  q / unit_size * unit_price
  - cualquier otro caso (p. ej. «1 cebolla» y malla de 1 kg) -> se cuenta el
    ENVASE COMPLETO (unit_price), porque no sabemos cuánto pesa una unidad.

Envases a comprar (cesta):
  - unidades compatibles -> ceil(fracción de envase), mínimo 1
  - si no -> 1 envase

Nutrición por ración:
  - solo líneas en 'g' o 'ml' (Nutrition100 es «por 100 g/ml»), no opcionales,
    con producto y nutrition_100g. Las líneas en 'ud' no tienen peso -> no se
    suman y la nutrición se marca como parcial (se listan los ingredientes que faltan).
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

NUTRIENTS = ["kcal", "fat", "saturated_fat", "carbs", "sugars", "protein", "salt"]


def _compatible_fraction(ing: Dict[str, Any], prod: Dict[str, Any]) -> Optional[float]:
    """Fracción de envase que usa la receta, o None si las unidades no son compatibles."""
    size = prod.get("unit_size")
    fmt = (prod.get("size_format") or "").lower()
    q = float(ing["quantity"])
    if not size:
        return None
    if ing["unit"] == "g" and fmt == "kg":
        return (q / 1000.0) / size
    if ing["unit"] == "ml" and fmt == "l":
        return (q / 1000.0) / size
    if ing["unit"] == "ud" and fmt == "ud":
        return q / size
    return None


def line_cost(ing: Dict[str, Any], prod: Dict[str, Any]) -> Dict[str, Any]:
    frac = _compatible_fraction(ing, prod)
    if frac is None:
        return {"cost": prod["unit_price"], "packages": 1, "whole_package": True}
    packages = max(1, math.ceil(round(frac, 6)))
    return {"cost": frac * prod["unit_price"], "packages": packages, "whole_package": False}


def recipe_summary(recipe: Dict[str, Any], products: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    total = 0.0
    basket = 0.0
    whole: List[str] = []
    sums = {k: 0.0 for k in NUTRIENTS}
    missing_nutrition: List[str] = []
    for ing in recipe["ingredients"]:
        if ing.get("optional") or ing.get("product_id") is None:
            continue
        prod = products[ing["product_id"]]
        lc = line_cost(ing, prod)
        total += lc["cost"]
        basket += lc["packages"] * prod["unit_price"]
        if lc["whole_package"]:
            whole.append(ing["name"])
        n = prod.get("nutrition_100g")
        if ing["unit"] in ("g", "ml") and n:
            for k in NUTRIENTS:
                if n.get(k) is None:
                    if ing["name"] not in missing_nutrition:
                        missing_nutrition.append(ing["name"])
                else:
                    sums[k] += float(ing["quantity"]) / 100.0 * n[k]
        else:
            missing_nutrition.append(ing["name"])
    servings = recipe["servings"]
    return {
        "cost_total": round(total, 2),
        "cost_per_serving": round(total / servings, 2),
        "basket_total": round(basket, 2),
        "whole_package_lines": whole,
        "nutrition_per_serving": {k: round(v / servings, 1) for k, v in sums.items()},
        "nutrition_partial": bool(missing_nutrition),
        "nutrition_missing": missing_nutrition,
    }
