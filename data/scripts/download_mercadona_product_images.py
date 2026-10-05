#!/usr/bin/env python3
import urllib.request, json, re, unicodedata, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path('/Users/genodan/Documents/erasmus-valencia/sichef')
IMG_DIR = ROOT / 'app' / 'public' / 'img' / 'products'
IMG_DIR.mkdir(parents=True, exist_ok=True)

def norm(text: str) -> str:
    text = unicodedata.normalize('NFD', text.lower())
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9\s]', '', text).strip()

print("[SíChef] Descargando catálogo oficial de Mercadona API...")
req = urllib.request.Request('https://tienda.mercadona.es/api/categories/', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as r:
    data = json.load(r)

subcat_ids = [sub['id'] for top in data['results'] for sub in top.get('categories', [])]

def fetch_subcat(cid):
    try:
        req = urllib.request.Request(f'https://tienda.mercadona.es/api/categories/{cid}/', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as r:
            cdata = json.load(r)
            return [{'name': p.get('display_name', ''), 'thumbnail': p.get('thumbnail', ''), 'id': p.get('id', '')}
                    for sub in cdata.get('categories', []) for p in sub.get('products', []) if p.get('thumbnail')]
    except Exception:
        return []

all_mp = []
with ThreadPoolExecutor(max_workers=8) as pool:
    for res in pool.map(fetch_subcat, subcat_ids):
        all_mp.extend(res)

print(f"[SíChef] {len(all_mp)} productos escaneados desde Mercadona API.")

with open(ROOT / 'data' / 'products.json', encoding='utf-8') as f:
    our_products = json.load(f)

# Alias específicos para los que usan otra denominación en Mercadona
MANUAL_ALIAS = {
    '77890': 'espinaca troceada congelada',
    '22222': 'merluza del cabo',
    '10036': 'espinaca baby',
    '10079': 'langostino cocido',
    '10084': 'spaghetti',
    '10098': 'hummus de garbanzos',
    '10109': 'gamba pelada',
    '99999': 'salsa brava', # test salsa
    '11234': 'aceite de oliva virgen extra',
    '22334': 'pechuga entera de pollo',
}

download_tasks = []

for p in our_products:
    pid = p['id']
    target_img = IMG_DIR / f'{pid}.jpg'
    
    # Target search string
    search_str = MANUAL_ALIAS.get(pid, p['nombre'].replace(' Hacendado', ''))
    p_clean = norm(search_str)
    p_words = set(p_clean.split())
    
    best = None
    best_score = 0
    for mp in all_mp:
        m_clean = norm(mp['name'].replace(' Hacendado', ''))
        m_words = set(m_clean.split())
        common = p_words & m_words
        if not common:
            continue
        score = len(common) / max(len(p_words), len(m_words))
        if p_clean in m_clean or m_clean in p_clean:
            score += 1.5
        if score > best_score:
            best_score = score
            best = mp
            
    if best and best['thumbnail']:
        thumb_url = best['thumbnail']
        # Usar tamaño óptimo
        if '?' in thumb_url:
            base_url = thumb_url.split('?')[0]
            thumb_url = f"{base_url}?fit=crop&h=300&w=300"
        download_tasks.append((pid, p['nombre'], best['name'], thumb_url, target_img))
    else:
        print(f"⚠️ No se encontró match para: {p['nombre']}")

print(f"[SíChef] Descargando {len(download_tasks)} fotos de productos Mercadona...")

def download_one(task):
    pid, p_name, m_name, url, target_path = task
    if target_path.exists() and target_path.stat().st_size > 1500:
        return pid, True, "cached"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            content = resp.read()
            with open(target_path, 'wb') as out_f:
                out_f.write(content)
            return pid, True, len(content)
    except Exception as e:
        return pid, False, str(e)

success = 0
with ThreadPoolExecutor(max_workers=6) as pool:
    for pid, ok, res in pool.map(download_one, download_tasks):
        if ok:
            success += 1

print(f"✓ {success} / {len(download_tasks)} fotos reales de Mercadona descargadas en {IMG_DIR}")
