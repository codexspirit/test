#!/usr/bin/env python3
import json, re, urllib.request
from html import unescape
from pathlib import Path

BASE = "https://wutheringwaves.fandom.com"
PAGES = {
    "characters": f"{BASE}/wiki/Resonator/List",
    "weapons": f"{BASE}/wiki/Weapons/List",
}

def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")

def clean(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    return unescape(re.sub(r"\s+", " ", s)).strip()

def parse_table_rows(html: str):
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, flags=re.S | re.I):
        cols = re.findall(r"<(?:td|th)[^>]*>(.*?)</(?:td|th)>", row, flags=re.S | re.I)
        if cols:
            yield [clean(c) for c in cols]

def extract_characters(html: str):
    chars = []
    for cols in parse_table_rows(html):
        if len(cols) < 4 or cols[0].lower() in {"icon", "name"}:
            continue
        name = cols[1] if len(cols) > 1 else ""
        rarity = cols[2] if len(cols) > 2 else ""
        weapon = cols[4] if len(cols) > 4 else ""
        source = " ".join(cols)
        standard = "standard" in source.lower()
        chars.append({"name": name, "rarity": rarity, "weapon_type": weapon, "standard": standard, "signature_weapon": None})
    dedup = {}
    for c in chars:
        if c["name"]:
            dedup[c["name"]] = c
    return sorted(dedup.values(), key=lambda x: x["name"])

def extract_weapons(html: str):
    weps = []
    for cols in parse_table_rows(html):
        if len(cols) < 4 or cols[0].lower() in {"icon", "name"}:
            continue
        name = cols[1] if len(cols) > 1 else ""
        wtype = cols[3] if len(cols) > 3 else ""
        source = " ".join(cols)
        standard = "standard weapon convene" in source.lower() or "standard" in source.lower()
        weps.append({"name": name, "weapon_type": wtype, "standard": standard})
    dedup = {}
    for w in weps:
        if w["name"]:
            dedup[w["name"]] = w
    return sorted(dedup.values(), key=lambda x: x["name"])

def build_html(payload):
    json_blob = json.dumps(payload)
    return """<!doctype html><html><head><meta charset='utf-8'><title>WuWa Artifact</title>
<style>body{font-family:Arial;margin:20px} textarea{width:100%;height:260px} .row{display:flex;gap:12px;flex-wrap:wrap} button{padding:8px 10px}</style></head>
<body><h1>WuWa Characters & Weapons Artifact</h1>
<p>Generated from latest source fetch at build time.</p>
<div class='row'>
<button onclick=\"show('all_chars')\">All Characters</button>
<button onclick=\"show('std_chars')\">Standard Characters</button>
<button onclick=\"show('all_weps')\">All Weapons</button>
<button onclick=\"show('std_weps')\">Standard Weapons</button>
<button onclick=\"copyText()\">Copy Text</button>
</div>
<textarea id='out'></textarea>
<script>
const data = __DATA__;
function lines(arr, fn){ return arr.map(fn).join('\\n'); }
function show(mode){
 let txt='';
 if(mode==='all_chars') txt=lines(data.characters,c=>`${c.name} | ${c.rarity} | ${c.weapon_type} | signature: ${c.signature_weapon||'N/A'} | standard: ${c.standard}`);
 if(mode==='std_chars') txt=lines(data.characters.filter(c=>c.standard),c=>`${c.name} | ${c.rarity} | ${c.weapon_type} | signature: ${c.signature_weapon||'N/A'}`);
 if(mode==='all_weps') txt=lines(data.weapons,w=>`${w.name} | ${w.weapon_type} | standard: ${w.standard}`);
 if(mode==='std_weps') txt=lines(data.weapons.filter(w=>w.standard),w=>`${w.name} | ${w.weapon_type}`);
 document.getElementById('out').value = txt;
}
function copyText(){ const t=document.getElementById('out'); t.select(); document.execCommand('copy'); }
show('all_chars');
</script></body></html>""".replace("__DATA__", json_blob)

def main():
    c_html = fetch(PAGES["characters"])
    w_html = fetch(PAGES["weapons"])
    data = {"characters": extract_characters(c_html), "weapons": extract_weapons(w_html)}
    Path("dist").mkdir(exist_ok=True)
    Path("dist/data.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
    Path("dist/index.html").write_text(build_html(data), encoding="utf-8")
    print(f"Built dist/index.html with {len(data['characters'])} characters and {len(data['weapons'])} weapons")

if __name__ == "__main__":
    main()
