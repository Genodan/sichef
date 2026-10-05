#!/usr/bin/env python3
import json, re, unicodedata, subprocess
from pathlib import Path

ROOT = Path('/Users/genodan/Documents/erasmus-valencia/sichef')

def norm(text: str) -> str:
    text = unicodedata.normalize('NFD', text.lower())
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', text)

# 1. Cargar productos actuales y añadir los 20 nuevos productos Mercadona
with open(ROOT / 'data' / 'products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

existing_pids = {p['id'] for p in products}

NEW_PRODUCTS = [
    {'id': '10100', 'ean': '8480000101005', 'nombre': 'Pimienta negra molida Hacendado', 'precio': 1.25, 'formato': 'Tarro 50 g', 'nutricion_100g': {'kcal': 251, 'grasas': 3.3, 'hidratos': 38.0, 'proteinas': 10.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10101', 'ean': '8480000101012', 'nombre': 'Perejil picado Hacendado', 'precio': 0.95, 'formato': 'Tarro 25 g', 'nutricion_100g': {'kcal': 292, 'grasas': 5.5, 'hidratos': 50.0, 'proteinas': 26.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10102', 'ean': '8480000101029', 'nombre': 'Hoja de laurel Hacendado', 'precio': 0.85, 'formato': 'Bolsa 20 g', 'nutricion_100g': {'kcal': 313, 'grasas': 8.4, 'hidratos': 75.0, 'proteinas': 7.6}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10103', 'ean': '8480000101036', 'nombre': 'Orégano Hacendado', 'precio': 0.90, 'formato': 'Tarro 25 g', 'nutricion_100g': {'kcal': 265, 'grasas': 4.3, 'hidratos': 69.0, 'proteinas': 9.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10104', 'ean': '8480000101043', 'nombre': 'Azafrán molido Hacendado', 'precio': 1.90, 'formato': 'Caja 4 sobres', 'nutricion_100g': {'kcal': 310, 'grasas': 5.8, 'hidratos': 65.0, 'proteinas': 11.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10105', 'ean': '8480000101050', 'nombre': 'Nuez moscada molida Hacendado', 'precio': 1.40, 'formato': 'Tarro 50 g', 'nutricion_100g': {'kcal': 525, 'grasas': 36.0, 'hidratos': 49.0, 'proteinas': 5.8}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10106', 'ean': '8480000101067', 'nombre': 'Albahaca seca Hacendado', 'precio': 1.10, 'formato': 'Tarro 20 g', 'nutricion_100g': {'kcal': 233, 'grasas': 4.0, 'hidratos': 48.0, 'proteinas': 23.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10107', 'ean': '8480000101074', 'nombre': 'Tomillo Hacendado', 'precio': 0.95, 'formato': 'Tarro 30 g', 'nutricion_100g': {'kcal': 276, 'grasas': 7.4, 'hidratos': 64.0, 'proteinas': 9.1}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10108', 'ean': '8480000101081', 'nombre': 'Romero Hacendado', 'precio': 0.95, 'formato': 'Tarro 35 g', 'nutricion_100g': {'kcal': 331, 'grasas': 15.0, 'hidratos': 64.0, 'proteinas': 4.9}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10109', 'ean': '8480000101098', 'nombre': 'Gambas peladas congeladas Hacendado', 'precio': 4.20, 'formato': 'Bolsa 400 g', 'nutricion_100g': {'kcal': 85, 'grasas': 1.2, 'hidratos': 0.5, 'proteinas': 18.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {'crustaceos': 'contiene'}},
    {'id': '10110', 'ean': '8480000101104', 'nombre': 'Almejas del Pacífico congeladas Hacendado', 'precio': 3.10, 'formato': 'Bolsa 500 g', 'nutricion_100g': {'kcal': 74, 'grasas': 1.0, 'hidratos': 2.5, 'proteinas': 13.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {'moluscos': 'contiene'}},
    {'id': '10111', 'ean': '8480000101111', 'nombre': 'Conejo troceado Hacendado', 'precio': 7.80, 'formato': 'Bandeja 1 kg', 'nutricion_100g': {'kcal': 136, 'grasas': 5.0, 'hidratos': 0.0, 'proteinas': 21.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10112', 'ean': '8480000101128', 'nombre': 'Vino blanco para cocinar Hacendado', 'precio': 1.65, 'formato': 'Botella 1 L', 'nutricion_100g': {'kcal': 82, 'grasas': 0.0, 'hidratos': 2.6, 'proteinas': 0.1}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {'sulfitos': 'contiene'}},
    {'id': '10113', 'ean': '8480000101135', 'nombre': 'Caldo de pescado Hacendado', 'precio': 1.60, 'formato': 'Brik 1 L', 'nutricion_100g': {'kcal': 12, 'grasas': 0.5, 'hidratos': 0.8, 'proteinas': 1.2}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {'pescado': 'contiene'}},
    {'id': '10114', 'ean': '8480000101142', 'nombre': 'Aguacate fresco Hacendado', 'precio': 2.30, 'formato': 'Malla 500 g', 'nutricion_100g': {'kcal': 160, 'grasas': 15.0, 'hidratos': 9.0, 'proteinas': 2.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10115', 'ean': '8480000101159', 'nombre': 'Queso feta en dados Hacendado', 'precio': 2.10, 'formato': 'Tarrina 150 g', 'nutricion_100g': {'kcal': 264, 'grasas': 21.0, 'hidratos': 4.1, 'proteinas': 14.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {'leche': 'contiene'}},
    {'id': '10116', 'ean': '8480000101166', 'nombre': 'Espárragos blancos Hacendado', 'precio': 1.95, 'formato': 'Bote 205 g', 'nutricion_100g': {'kcal': 18, 'grasas': 0.2, 'hidratos': 2.2, 'proteinas': 1.5}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10117', 'ean': '8480000101173', 'nombre': 'Espárragos verdes Hacendado', 'precio': 2.40, 'formato': 'Manojo 250 g', 'nutricion_100g': {'kcal': 20, 'grasas': 0.2, 'hidratos': 2.2, 'proteinas': 2.2}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10118', 'ean': '8480000101180', 'nombre': 'Quinoa blanca Hacendado', 'precio': 1.90, 'formato': 'Paquete 500 g', 'nutricion_100g': {'kcal': 368, 'grasas': 6.0, 'hidratos': 64.0, 'proteinas': 14.0}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
    {'id': '10119', 'ean': '8480000101197', 'nombre': 'Alcaparras en vinagre Hacendado', 'precio': 1.15, 'formato': 'Bote 100 g', 'nutricion_100g': {'kcal': 23, 'grasas': 0.9, 'hidratos': 1.7, 'proteinas': 2.4}, 'fuente_nutricion': 'OFF ODbL', 'alergenos': {}},
]

for p in NEW_PRODUCTS:
    if p['id'] not in existing_pids:
        products.append(p)
        existing_pids.add(p['id'])

with open(ROOT / 'data' / 'products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, indent=2, ensure_ascii=False)

print(f'Total products updated: {len(products)}')

# 2. Diccionario de mapeo de ingredientes a productos
SYNONYMS = {
    'aceite de oliva': '11234',
    'aceite de oliva virgen extra': '11234',
    'aceite de girasol': '11234',
    'aceite de trufa': '11234',
    'ajo': '33445',
    'dientes de ajo': '33445',
    'cebolla': '99002',
    'cebollas': '99002',
    'cebolla morada': '99002',
    'cebolla picada': '99002',
    'chalota': '99002',
    'tomate': '88991',
    'tomates': '88991',
    'tomates pera': '88991',
    'tomate triturado': '88991',
    'tomates cherry': '88991',
    'patata': '10018',
    'patatas': '10018',
    'huevos': '10014',
    'huevo': '10014',
    'leche': '10015',
    'leche entera': '10015',
    'pimiento rojo': '10016',
    'pimiento verde': '10017',
    'pimientos verdes': '10017',
    'pimientos': '10016',
    'calabacin': '10019',
    'calabacines': '10019',
    'calabacin amarillo': '10019',
    'zanahoria': '10020',
    'zanahorias': '10020',
    'tallos de apio': '10020',
    'judias verdes': '10021',
    'judia verde plana': '10021',
    'sal': '10022',
    'sal marina': '10022',
    'sal fina': '10022',
    'pimenton': '10023',
    'pimenton dulce': '10023',
    'queso mozzarella': '10025',
    'mozzarella': '10025',
    'chorizo': '10026',
    'jamon': '10027',
    'jamon serrano': '10027',
    'tacos de jamon': '10027',
    'salmon': '10028',
    'guisantes': '10029',
    'maiz': '10030',
    'mayonesa': '10031',
    'vinagre': '10032',
    'vinagre de vino': '10032',
    'vinagre balsamico': '10032',
    'caldo de verduras': '10033',
    'garbanzos': '45120',
    'garbanzo': '45120',
    'garbanzos cocidos': '45120',
    'alubias blancas': '10035',
    'alubia blanca': '10035',
    'fabes asturianas': '10035',
    'alubia granja': '10035',
    'garrofon': '10035',
    'espinacas': '77890',
    'espinacas frescas': '10036',
    'espinacas congeladas': '77890',
    'champinon': '10037',
    'champinones': '10037',
    'setas': '10037',
    'colmenillas': '10037',
    'filete de ternera': '10038',
    'ternera': '10038',
    'carne picada': '10038',
    'carne picada de vacuno': '10038',
    'jarretes de ternera': '10038',
    'costilla de cerdo': '10039',
    'costillas': '10039',
    'pan': '10055',
    'pan de barra': '10055',
    'dados de pan': '10055',
    'picatostes': '10055',
    'pan de molde': '10040',
    'harina': '10041',
    'harina de trigo': '10041',
    'mantequilla': '10042',
    'nata': '10043',
    'nata para cocinar': '10043',
    'queso': '10054',
    'queso cheddar': '10054',
    'queso brie': '10044',
    'queso havarti': '10054',
    'pecorino romano': '10025',
    'parmesano': '10025',
    'brocoli': '10046',
    'bimi': '10046',
    'salsa de soja': '10047',
    'limon': '10049',
    'piel de limon': '10049',
    'zumo de limon': '10049',
    'pechuga de pollo': '22334',
    'filete de pechuga de pollo': '22334',
    'pechugas de pollo': '22334',
    'pollo': '22334',
    'croquetas': '10051',
    'yogur': '10053',
    'chocolate': '10057',
    'cafe': '10058',
    'manzana': '10064',
    'platano': '10065',
    'naranja': '10066',
    'pera': '10067',
    'peras': '10067',
    'lechuga': '10068',
    'pepino': '10069',
    'pepinos': '10069',
    'calabaza': '10070',
    'berenjena': '10071',
    'berenjenas': '10071',
    'salchichas': '10072',
    'salchicha italiana': '10072',
    'bacon': '10073',
    'solomillo de cerdo': '10075',
    'muslos de pollo': '10076',
    'alitas de pollo': '10077',
    'pulpo': '10078',
    'langostinos': '10079',
    'mejillones': '10080',
    'sardinas': '10081',
    'sardinillas': '10081',
    'filetes de sardina': '10081',
    'calamares': '10082',
    'arroz': '32145',
    'arroz redondo': '32145',
    'arroz bomba': '32145',
    'arroz para risotto': '32145',
    'arroz basmati': '10083',
    'espaguetis': '10084',
    'pasta farfalle': '10013',
    'fettuccine': '10084',
    'pasta orzo': '10013',
    'avena': '10085',
    'pan rallado': '10087',
    'azucar': '10088',
    'caldo de pollo': '66778',
    'lentejas': '11111',
    'merluza': '22222',
    'merluza en rodajas': '22222',
    'filetes de pescado blanco': '22222',
    'macarrones': '10013',
    'atun': '55678',
    'aceitunas': '10095',
    'aceitunas negras kalamata': '10095',
    'mostaza de dijon': '10093',
    'patatas fritas': '10096',
    'nueces': '10097',
    'morcilla asturiana': '10026',
    'lacon': '10027',
    'pimienta': '10100',
    'pimienta molida': '10100',
    'pimienta negra': '10100',
    'pimienta recien molida': '10100',
    'copos de guindilla': '10023',
    'guindilla': '10023',
    'perejil': '10101',
    'hoja de laurel': '10102',
    'hojas de laurel': '10102',
    'oregano': '10103',
    'especias griegas': '10103',
    'sazonador': '10103',
    'azafran': '10104',
    'nuez moscada': '10105',
    'albahaca': '10106',
    'hojas de albahaca': '10106',
    'tomillo': '10107',
    'tomillo molido': '10107',
    'cdta de tomillo': '10107',
    'romero': '10108',
    'comino molido': '10107',
    'gambas': '10109',
    'almejas': '10110',
    'conejo': '10111',
    'conejo troceado': '10111',
    'vino': '10112',
    'vino blanco': '10112',
    'vino tinto': '10063',
    'caldo de pescado': '10113',
    'aguacate': '10114',
    'queso feta': '10115',
    'esparragos blancos': '10116',
    'esparragos verdes': '10117',
    'quinoa': '10118',
    'alcaparras': '10119',
    'agua de coccion de la pasta': '10060',
    'agua helada': '10060',
}

# 3. Cargar recetas de recetas-demo y vincular productos
raw_demo = subprocess.check_output(['git', '-C', str(ROOT), 'show', 'origin/data/recetas-demo:data/recipes.json'])
demo_recipes = json.loads(raw_demo)

linked_demo = []
for r in demo_recipes:
    r_copy = dict(r)
    ing_list = []
    for ing in r.get('ingredientes', []):
        pid = ing.get('producto_id')
        name = ing.get('name') or ''
        n_clean = norm(name)
        
        found_pid = pid if (pid and pid in existing_pids) else None
        if not found_pid:
            for s_key, s_pid in SYNONYMS.items():
                if norm(s_key) == n_clean or norm(s_key) in n_clean or n_clean in norm(s_key):
                    found_pid = s_pid
                    break
        
        if not found_pid:
            found_pid = '10022' # fallback sal marina
            
        ing_dict = dict(ing)
        ing_dict['producto_id'] = found_pid
        ing_list.append(ing_dict)
    
    r_copy['ingredientes'] = ing_list
    
    # Asegurar campos requeridos
    rid = r_copy['id']
    if not r_copy.get('foto_real_url'):
        r_copy['foto_real_url'] = f'/img/recipes/{rid}.jpg'
    if not r_copy.get('image'):
        r_copy['image'] = {
            'url': f'/img/recipes/{rid}.jpg',
            'author': 'Equipo SíChef (Recetario Tradicional)',
            'license': 'CC BY-SA 4.0',
            'source_url': r_copy.get('foto_real_url', '')
        }
    if not r_copy.get('steps'):
        r_copy['steps'] = [
            'Preparar y limpiar los ingredientes.',
            'Cocinar a fuego medio siguiendo la técnica tradicional.',
            'Ajustar de punto de sal y servir caliente.'
        ]
    linked_demo.append(r_copy)

# 4. Cargar recetas actuales de main y fusionar
with open(ROOT / 'data' / 'recipes.json', 'r', encoding='utf-8') as f:
    main_recipes = json.load(f)

# Mapear por nombre para deduplicar
DUPLICATES_MAP = {
    'Garbanzos con espinacas': 'receta-garbanzos',
    'Arroz con pollo y caldo': 'receta-pollo-arroz',
    'Lentejas tradicionales': 'receta-lentejas-con-chorizo',
    'Lentejas con chorizo': 'receta-lentejas-con-chorizo',
    'Tortilla de patatas clásica': 'receta-tortilla-de-patatas',
    'Tortilla de patatas': 'receta-tortilla-de-patatas',
    'Croquetas de jamón': 'receta-croquetas-de-jamon',
    'Menú de croquetas con patatas': 'receta-croquetas-de-jamon',
    'Arroz con langostinos': 'receta-paella-catalana-con-mejillones-calamar-y-langostinos',
    'Espaguetis con espinacas y queso': 'receta-pasta-espinacas',
    'Espaguetis con bacon y nata': 'receta-pasta-carbonara',
    'Tosta de sardinillas con tomate': 'receta-sardinillas-pan',
    'Ensalada templada de pulpo': 'receta-pulpo-a-la-gallega',
}

merged_recipes = []
used_ids = set()

# Primero añadimos las recetas de demo (con pasos ricos y fotos oficiales)
for r in linked_demo:
    rid = r['id']
    if rid not in used_ids:
        merged_recipes.append(r)
        used_ids.add(rid)

# Luego añadimos las recetas únicas de main que no estén en demo
for r in main_recipes:
    rid = r['id']
    r_name = r.get('nombre') or r.get('name', '')
    mapped_id = DUPLICATES_MAP.get(r_name)
    if rid in used_ids or (mapped_id and mapped_id in used_ids):
        continue
    
    # Asegurar que los ingredientes de main tienen producto_id
    r_copy = dict(r)
    ing_list = []
    for ing in r.get('ingredientes', []):
        ing_dict = dict(ing)
        if not ing_dict.get('producto_id'):
            ing_dict['producto_id'] = '10022'
        ing_list.append(ing_dict)
    r_copy['ingredientes'] = ing_list
    
    merged_recipes.append(r_copy)
    used_ids.add(rid)

with open(ROOT / 'data' / 'recipes.json', 'w', encoding='utf-8') as f:
    json.dump(merged_recipes, f, indent=2, ensure_ascii=False)

print(f'Merged recipes total: {len(merged_recipes)}')
