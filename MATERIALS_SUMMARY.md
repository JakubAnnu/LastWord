# ✅ Materiały PBR - Kompletna kolekcja

## 📍 Gdzie znaleźć materiały

```
assets/materials/
├── M_Dirty_Yellow_Metal.material.json   ← Brudno-żółty metal
├── M_Dirty_Gold.material.json           ← Zabrudzone złoto
├── M_Weathered_Brass.material.json      ← Postarzany mosiądz
├── M_Dirty_Grey_Metal.material.json     ← Szary metal ⭐
├── M_Dirty_Steel.material.json          ← Brudna stal
├── M_Weathered_Iron.material.json       ← Postarzane żelazo
├── M_Earthy_Dark_Grey.material.json     ← Ciemna ziemia 🌍
├── M_Earthy_Grey.material.json          ← Ziemia szara
├── M_Earthy_Snow_Grey.material.json     ← Ziemia śnieżna
└── README.md                            ← Pełna dokumentacja
```

## 🎨 Jak użyć w edytorze

1. **Otwórz edytor sceny**
2. **Wybierz obiekt** (który ma MeshComponent)
3. **W inspektorze znajdź dropdown "Material"**
4. **Wybierz jeden z 9 materiałów**

## 🎯 Dostępne materiały

### Żółte/Złote metale (jednolite, bez tekstur):

| Materiał | Kolor | Metalness | Roughness | Opis |
|----------|-------|-----------|-----------|------|
| **M_Dirty_Yellow_Metal** | Jasny żółty (1.0, 0.95, 0.3) | 0.92 | 0.4 | Czysty żółty, gładki, błyszczący |
| **M_Dirty_Gold** | Złoty (1.0, 0.88, 0.1) | 0.95 | 0.35 | Czyste złoto, bardzo błyszczące |
| **M_Weathered_Brass** | Mosiężny (0.85, 0.75, 0.4) | 0.88 | 0.5 | Ciepły mosiądz, średnio błyszczący |

### Szare metale (gładkie, jednolite):

| Materiał | Kolor | Metalness | Roughness | Opis |
|----------|-------|-----------|-----------|------|
| **M_Dirty_Grey_Metal** ⭐ | Szary (0.55, 0.55, 0.55) | 0.92 | 0.4 | Gładki, jednolity, lekko błyszczący |
| **M_Dirty_Steel** | Jaśniejszy (0.65, 0.65, 0.65) | 0.95 | 0.35 | Gładka stal, bardziej błyszcząca |
| **M_Weathered_Iron** | Ciemny (0.45, 0.45, 0.45) | 0.88 | 0.65 | Gładkie żelazo, matowe |

### Ziemiste (czarnawo-szare, bez tekstur):

| Materiał | Kolor | Metalness | Roughness | Opis |
|----------|-------|-----------|-----------|------|
| **M_Earthy_Dark_Grey** 🌍 | Prawie czarny (0.15, 0.15, 0.15) | 0.0 | 0.95 | Bardzo ciemna ziemia, jednolita |
| **M_Earthy_Grey** | Ciemny (0.22, 0.22, 0.22) | 0.0 | 0.92 | Ciemna szara ziemia |
| **M_Earthy_Snow_Grey** | Średnio-ciemny (0.30, 0.30, 0.30) | 0.0 | 0.88 | Szara ziemia |

## 💻 Jak użyć w kodzie

```typescript
// Znajdź obiekt na scenie
const myObject = this.findActorByName('NazwaObiektu');
const meshComponent = myObject?.findComponentByClass(ENGINE.MeshComponent);

// Zastosuj materiał ziemisty:
meshComponent?.setMeshMaterial('@project/assets/materials/M_Earthy_Dark_Grey.material.json');

// Lub inny:
meshComponent?.setMeshMaterial('@project/assets/materials/M_Earthy_Grey.material.json');
meshComponent?.setMeshMaterial('@project/assets/materials/M_Earthy_Snow_Grey.material.json');
```

## ✨ Cechy materiałów

**Żółte/Złote metale:**
- ✅ Pełny PBR workflow (Metallic-Roughness)
- ✅ **Jednolita, gładka powierzchnia** (bez tekstur)
- ✅ **Jasne, czyste kolory żółci/złota**
- ✅ Wysoka wartość metaliczna (0.88-0.95)
- ✅ Błyszczące (roughness 0.35-0.5)

**Szare metale:**
- ✅ Pełny PBR workflow
- ✅ **Gładka, jednolita powierzchnia** (bez tekstur)
- ✅ Idealne dla czystych, minimalistycznych obiektów
- ✅ Lżejsze (brak dodatkowych tekstur)

**Ziemiste materiały:**
- ✅ Pełny PBR workflow
- ✅ **Jednolita, gładka powierzchnia** (bez tekstur)
- ✅ Niemetaliczne (metalness = 0)
- ✅ Bardzo matowe (roughness 0.88-0.95)
- ✅ Ciemne odcienie (0.15-0.30) - efekt ziemisty/czarnawy
- ✅ Minimalne odbicia środowiska (envMapIntensity 0.2-0.3)

## 📚 Więcej informacji

- **Pełna dokumentacja**: `assets/materials/README.md`
- **Kod TypeScript**: `src/dirty-yellow-metal-material.ts`

**9 materiałów gotowych do użycia - wystarczy wybrać z listy w edytorze!** 🎨✨
