import json
import requests

# Archivo del pack a procesar
pack_file = "pack_00001.json"  # <-- cámbialo al pack que quieras procesar

# Pesos por categoría
pesos = {
    "normal": 40,
    "effect": 5,
    "fusion": 1,
    "synchro": 1,
    "xyz": 1,
    "link": 1,
    "ritual": 1,
    "pendulum": 1,
    "spell": 1,
    "trap": 1,
    "otro": 1
}


# Contadores con listas de códigos
conteo = {cat: [] for cat in pesos.keys()}

# Cargar el pack existente
with open(pack_file, "r", encoding="utf-8") as f:
    pack = json.load(f)

card_list = []
total = len(pack["card_list"])  # total de cartas a procesar

for idx, item in enumerate(pack["card_list"], start=1):
    codigo = item["card_id"]

    try:
        # Consultar API oficial
        url = f"https://db.ygoprodeck.com/api/v7/cardinfo.php?id={codigo}"
        response = requests.get(url)
        data = response.json()

        if "data" not in data:
            categoria = "otro"
        else:
            card = data["data"][0]
            tipo = card.get("type", "")

            # Clasificación detallada usando inglés
            if "Spell" in tipo:
                categoria = "spell"
            elif "Trap" in tipo:
                categoria = "trap"
            elif "Fusion" in tipo:
                categoria = "fusion"
            elif "Synchro" in tipo:
                categoria = "synchro"
            elif "Xyz" in tipo:
                categoria = "xyz"
            elif "Link" in tipo:
                categoria = "link"
            elif "Ritual" in tipo:
                categoria = "ritual"
            elif "Pendulum" in tipo:
                categoria = "pendulum"
            elif "Normal" in tipo:
                categoria = "normal"
            elif "Effect" in tipo:
                categoria = "effect"
            else:
                categoria = "otro"

        conteo[categoria].append(codigo)
        peso = pesos.get(categoria, 1)

        card_list.append({
            "card_id": codigo,
            "peso": peso
        })

    except Exception as e:
        print(f"❌ Error con {codigo}: {e}")
        continue

    # Mostrar progreso
    progreso = (idx / total) * 100
    print(f"[{idx}/{total}] ({progreso:.2f}%) Procesando carta {codigo} -> {categoria}")

# Normalizar probabilidades
total_peso = sum(c["peso"] for c in card_list)
for c in card_list:
    c["probability"] = round(c["peso"] / total_peso, 6)
    del c["peso"]

# Reemplazar la lista en el pack original
pack["card_list"] = card_list

# Sobrescribir el pack
with open(pack_file, "w", encoding="utf-8") as f:
    json.dump(pack, f, indent=4, ensure_ascii=False)

# Guardar reporte
with open("reporte.txt", "w", encoding="utf-8") as f:
    f.write("📊 Resumen de cartas detectadas:\n\n")
    for cat, lista in conteo.items():
        f.write(f"{cat.capitalize()} → {len(lista)} cartas\n")
        if lista:
            f.write(f"IDs: {', '.join(lista)}\n")
        f.write("\n")

print(f"\n✅ Pack '{pack_file}' actualizado con probabilidades normalizadas.")
print("✅ Reporte generado en 'reporte.txt'")
