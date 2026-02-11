# Materiały PBR - Dirty Metal Series

## 📍 Lokalizacja

Materiały znajdują się w: `assets/materials/`

## 🎨 Dostępne materiały

### Żółte/Złote metale:

### 1. **M_Dirty_Yellow_Metal** 
   - Plik: `M_Dirty_Yellow_Metal.material.json`
   - Opis: Jasny żółty metal, jednolity, gładki
   - Kolor: RGB(1.0, 0.95, 0.3) - czysty, jasny żółty
   - Metalness: 0.92
   - Roughness: 0.4
   - **Bez tekstur** - gładka, jednolita powierzchnia

### 2. **M_Dirty_Gold**
   - Plik: `M_Dirty_Gold.material.json`
   - Opis: Złoto, bardzo błyszczące, jednolite
   - Kolor: RGB(1.0, 0.88, 0.1) - jasne złoto
   - Metalness: 0.95
   - Roughness: 0.35
   - **Bez tekstur** - gładka, jednolita powierzchnia

### 3. **M_Weathered_Brass**
   - Plik: `M_Weathered_Brass.material.json`
   - Opis: Mosiądz, ciepły żółtawy, jednolity
   - Kolor: RGB(0.85, 0.75, 0.4) - ciepły mosiężny
   - Metalness: 0.88
   - Roughness: 0.5
   - **Bez tekstur** - gładka, jednolita powierzchnia

### Szare metale:

### 4. **M_Dirty_Grey_Metal** ⭐
   - Plik: `M_Dirty_Grey_Metal.material.json`
   - Opis: Szary metal gładki, jednolity, lekko przybrudzony
   - Kolor: RGB(0.55, 0.55, 0.55)
   - Metalness: 0.92
   - Roughness: 0.4
   - **Bez tekstur** - gładka, jednolita powierzchnia

### 5. **M_Dirty_Steel**
   - Plik: `M_Dirty_Steel.material.json`
   - Opis: Gładka stal, bardziej błyszcząca
   - Kolor: RGB(0.65, 0.65, 0.65) - jaśniejszy
   - Metalness: 0.95
   - Roughness: 0.35
   - **Bez tekstur** - gładka, jednolita powierzchnia

### 6. **M_Weathered_Iron**
   - Plik: `M_Weathered_Iron.material.json`
   - Opis: Postarzane żelazo, ciemniejsze i bardziej matowe
   - Kolor: RGB(0.45, 0.45, 0.45)
   - Metalness: 0.88
   - Roughness: 0.65
   - **Bez tekstur** - gładka, jednolita powierzchnia

### Ziemiste (czarnawo-szare):

### 7. **M_Earthy_Dark_Grey** 🌍
   - Plik: `M_Earthy_Dark_Grey.material.json`
   - Opis: Bardzo ciemna ziemia, prawie czarna z szarym odcieniem
   - Kolor: RGB(0.15, 0.15, 0.15) - bardzo ciemny, prawie czarny
   - Metalness: 0.0 (niemetaliczny)
   - Roughness: 0.95 (maksymalnie matowy)
   - **Bez tekstur** - jednolita powierzchnia

### 8. **M_Earthy_Grey**
   - Plik: `M_Earthy_Grey.material.json`
   - Opis: Ciemna szara ziemia
   - Kolor: RGB(0.22, 0.22, 0.22) - ciemny szary
   - Metalness: 0.0
   - Roughness: 0.92
   - **Bez tekstur** - jednolita powierzchnia

### 9. **M_Earthy_Snow_Grey**
   - Plik: `M_Earthy_Snow_Grey.material.json`
   - Opis: Średnio-ciemna szara ziemia
   - Kolor: RGB(0.30, 0.30, 0.30) - ciemny szary
   - Metalness: 0.0
   - Roughness: 0.88
   - **Bez tekstur** - jednolita powierzchnia

## 🎯 Jak użyć w edytorze sceny

### Sposób 1: Przez edytor (GUI)

1. Otwórz edytor sceny
2. Wybierz obiekt z MeshComponent
3. W inspektorze znajdź właściwość **"Material"** lub **"Mesh Material"**
4. Kliknij dropdown z listą materiałów
5. Znajdź i wybierz jeden z materiałów:
   - `M_Dirty_Yellow_Metal`
   - `M_Dirty_Gold`
   - `M_Weathered_Brass`

### Sposób 2: Przez kod (programowo)

```typescript
// W pliku game.ts, po załadowaniu levelu:

const myObject = this.findActorByName('NazwaObiektu');
if (myObject) {
  const meshComponent = myObject.findComponentByClass(ENGINE.MeshComponent);
  if (meshComponent) {
    // Załaduj materiał z pliku
    meshComponent.setMeshMaterial('@project/assets/materials/M_Dirty_Yellow_Metal.material.json');
  }
}
```

### Sposób 3: W prefabie

W pliku `.prefab.json`, w sekcji MeshComponent:

```json
{
  "meshMaterial": "@project/assets/materials/M_Dirty_Yellow_Metal.material.json"
}
```

## 🎨 Cechy techniczne

### Żółte/Złote materiały:
- **Bez tekstur** - gładka, jednolita powierzchnia
- **Type**: `THREE.MeshStandardMaterial` - pełny PBR workflow
- **Metalness**: 0.88-0.95 (wysoka wartość metaliczna)
- **Kolor**: Jasne, czyste odcienie żółci/złota (1.0, 0.85-0.95, 0.1-0.4)

### Szare metale:
- **Bez tekstur** - gładka, jednolita powierzchnia
- **Type**: `THREE.MeshStandardMaterial` - PBR workflow
- **Metalness**: 0.88-0.95 (wysoka wartość metaliczna)

### Ziemiste materiały:
- **Bez tekstur** - gładka, jednolita powierzchnia
- **Type**: `THREE.MeshStandardMaterial` - pełny PBR workflow
- **Metalness**: 0.0 (niemetaliczny - ziemia/kamień)
- **Roughness**: 0.88-0.95 (bardzo matowy)
- **Kolor**: Ciemne odcienie szarości (0.15-0.30) - efekt ziemisty

## 🔧 Dostosowywanie

Możesz edytować pliki `.material.json` aby zmienić:

- **color**: `[R, G, B]` - kolor bazowy (wartości 0-1)
- **metalness**: 0-1 (0 = niemetaliczny, 1 = metaliczny)
- **roughness**: 0-1 (0 = gładki, 1 = chropowaty)
- **normalScale**: `[x, y]` - intensywność normal map
- **aoMapIntensity**: 0-1 - intensywność ambient occlusion
- **envMapIntensity**: 0+ - siła odbić środowiska

### Przykład - dostosowanie tiling tekstur:

```json
"userData": {
  "textureTransforms": {
    "normalMap": {
      "repeatX": 2,  // ← zmień na 2x tiling
      "repeatY": 2
    }
  }
}
```

## 📝 Uwagi

1. **Restart edytora**: Po dodaniu nowych materiałów lub edycji istniejących, może być konieczny restart edytora sceny
2. **UV Mapping**: Obiekty muszą mieć poprawne UV, aby tekstury wyświetlały się prawidłowo
3. **Oświetlenie**: Materiały PBR wymagają dobrego oświetlenia (directional light + environment map) dla najlepszego efektu
4. **Wydajność**: Materiały używają 3 tekstur, co ma minimalny wpływ na wydajność w nowoczesnych silnikach

## 🆕 Tworzenie własnych wariantów

Skopiuj jeden z plików `.material.json` i dostosuj parametry:

```bash
# W katalogu projektu
cp assets/materials/M_Dirty_Yellow_Metal.material.json assets/materials/M_My_Custom_Metal.material.json
```

Następnie edytuj `M_My_Custom_Metal.material.json` i zmień:
- `name` - nazwa materiału
- `color` - kolor
- inne parametry według potrzeb

Materiał automatycznie pojawi się w edytorze!
