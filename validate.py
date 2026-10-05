import json
import os

def validate_data():
    base_path = "data"
    products_path = os.path.join(base_path, "products.json")
    recipes_path = os.path.join(base_path, "recipes.json")

    print("Inicio de la validación de datos para SíChef...")

    # 1. Comprobar productos
    if not os.path.exists(products_path):
        print(f"❌ Error: El archivo {products_path} no se encuentra.")
        return False
    
    with open(products_path, 'r', encoding='utf-8') as f:
        try:
            products = json.load(f)
        except json.JSONDecodeError as e:
            print(f"❌ Error de JSON en products.json: {e}")
            return False

    product_ids = {p["id"] for p in products}
    print(f"Se han encontrado {len(products)} productos.")

    # 2. Comprobar recetas
    if not os.path.exists(recipes_path):
        print(f"❌ Error: El archivo {recipes_path} no se encuentra.")
        return False

    with open(recipes_path, 'r', encoding='utf-8') as f:
        try:
            recipes = json.load(f)
        except json.JSONDecodeError as e:
            print(f"❌ Error de JSON en recipes.json: {e}")
            return False

    print(f"Se han encontrado {len(recipes)} recetas.")

    # 3. Verificar integridad de las referencias (ningún ID inventado)
    errors = 0
    for r in recipes:
        for ing in r.get("ingredientes", []):
            pid = ing.get("producto_id")
            if pid not in product_ids:
                print(f"❌ Error en la receta '{r.get('nombre')}': el product_id '{pid}' no existe en products.json")
                errors += 1

    if errors == 0:
        print("✅ Validación completada con éxito. Todos los ingredientes apuntan a productos reales.")
        return True
    else:
        print(f"❌ Se han encontrado {errors} errores de mapeo.")
        return False

if __name__ == "__main__":
    validate_data()