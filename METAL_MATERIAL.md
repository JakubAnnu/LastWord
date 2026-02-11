# Dirty Yellow Metal Material - Dokumentacja

## 🎯 SZYBKI START - Użycie w edytorze sceny

### Materiały są już gotowe do użycia!

Materiały PBR znajdują się w: **`assets/materials/`**

#### Dostępne materiały:

**Żółte/Złote:**
1. **M_Dirty_Yellow_Metal** - Brudno-żółty metal (średni połysk)
2. **M_Dirty_Gold** - Zabrudzone złoto (bardziej błyszczące)
3. **M_Weathered_Brass** - Postarzany mosiądz (matowy)

**Szare:**
4. **M_Dirty_Grey_Metal** ⭐ - Szary metal lekko przybrudzony
5. **M_Dirty_Steel** - Stal z brudem (błyszcząca)
6. **M_Weathered_Iron** - Postarzane żelazo (ciemne, matowe)

#### Jak użyć:
1. Otwórz edytor sceny
2. Wybierz obiekt z MeshComponent
3. W właściwości **"Material"** wybierz z dropdownu jeden z materiałów powyżej

**Zobacz pełną dokumentację w:** `assets/materials/README.md`

---

## Opis

Materiał PBR (Physically Based Rendering) dla żółtej, zabrudzonej powierzchni metalowej. Materiał wykorzystuje pełny workflow PBR z następującymi właściwościami:

- **Kolor bazowy**: Brudno-żółty z lekkim brązowym odcieniem (RGB: 0.85, 0.75, 0.25)
- **Metalness**: 0.9 (wysoka wartość dla efektu metalicznego)
- **Roughness**: 0.6 (średnio-wysoka dla efektu brudu i zużycia)
- **Normal Map**: Tekstura szczotkowanego metalu
- **Roughness Map**: Mapa szorstkowości dla efektu zużycia
- **Ambient Occlusion**: Mapa AO dla głębi

## Pliki

- `src/dirty-yellow-metal-material.ts` - Klasa materiału
- `src/dirty-metal-demo-actor.ts` - Przykładowy aktor demonstracyjny

## Użycie podstawowe

### Sposób 1: Użycie demo actora

```typescript
import { DirtyMetalDemoActor } from './dirty-metal-demo-actor.js';

// W metodzie preStart() lub doBeginPlay()
const demoActor = DirtyMetalDemoActor.create({
  position: new THREE.Vector3(0, 2, 0),
  scale: new THREE.Vector3(2, 2, 2),
});

this.world.addActor(demoActor);
```

### Sposób 2: Bezpośrednie użycie materiału

```typescript
import { DirtyYellowMetalMaterial } from './dirty-yellow-metal-material.js';
import * as THREE from 'three';
import * as ENGINE from '@gnsx/genesys.js';

// Stwórz materiał
const metalMaterial = new DirtyYellowMetalMaterial();

// Stwórz mesh component z geometrią
const meshComponent = ENGINE.MeshComponent.create({
  name: 'MyMetalObject',
  geometry: new THREE.BoxGeometry(2, 2, 2),
  material: metalMaterial.getMaterial(),
});

// Dodaj do aktora
this.rootComponent.add(meshComponent);
```

## Dostosowywanie materiału

### Zmiana koloru

```typescript
// Użyj hex color
metalMaterial.setColor(0xFFD700); // złoty

// Lub THREE.Color
metalMaterial.setColor(new THREE.Color(0.9, 0.8, 0.3));
```

### Zmiana metalness (0 = niemetaliczny, 1 = metaliczny)

```typescript
metalMaterial.setMetalness(0.95); // bardziej metaliczny
metalMaterial.setMetalness(0.5);  // pół-metaliczny
```

### Zmiana roughness (0 = gładki/błyszczący, 1 = chropowaty/matowy)

```typescript
metalMaterial.setRoughness(0.3); // bardziej błyszczący
metalMaterial.setRoughness(0.8); // bardziej matowy
```

### Intensywność normal map

```typescript
// Zmiana intensywności (x, y)
metalMaterial.setNormalIntensity(1.0, 1.0); // pełna intensywność
metalMaterial.setNormalIntensity(0.2, 0.2); // subtelny efekt
```

### Intensywność ambient occlusion

```typescript
metalMaterial.setAOIntensity(0.5); // średnia intensywność
metalMaterial.setAOIntensity(0.1); // subtelny efekt
```

### Tiling tekstur

```typescript
// Powtórz tekstury (repeatX, repeatY)
metalMaterial.setTextureRepeat(2, 2); // 2x2 tiling
metalMaterial.setTextureRepeat(4, 4); // 4x4 tiling
```

### Intensywność environment map

```typescript
metalMaterial.setEnvMapIntensity(1.5); // silniejsze odbicia środowiska
metalMaterial.setEnvMapIntensity(0.5); // słabsze odbicia
```

## Przykład kompletny

```typescript
import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';
import { DirtyYellowMetalMaterial } from './dirty-yellow-metal-material.js';

@ENGINE.GameClass()
export class MetalProp extends ENGINE.Actor {
  private metalMaterial: DirtyYellowMetalMaterial | null = null;

  public override doBeginPlay(): void {
    super.doBeginPlay();

    // Stwórz materiał
    this.metalMaterial = new DirtyYellowMetalMaterial();
    
    // Dostosuj parametry
    this.metalMaterial.setColor(0xFFD700);      // złoty kolor
    this.metalMaterial.setMetalness(0.95);      // bardzo metaliczny
    this.metalMaterial.setRoughness(0.5);       // średnio chropowaty
    this.metalMaterial.setTextureRepeat(2, 2);  // 2x2 tiling
    
    // Stwórz mesh
    const meshComponent = ENGINE.MeshComponent.create({
      name: 'MetalProp',
      geometry: new THREE.CylinderGeometry(1, 1, 2, 32),
      material: this.metalMaterial.getMaterial(),
    });
    
    this.rootComponent.add(meshComponent);
  }

  public override destroy(): void {
    if (this.metalMaterial) {
      this.metalMaterial.destroy();
    }
    super.destroy();
  }
}
```

## Zmiana geometrii w runtime

Jeśli używasz `DirtyMetalDemoActor`, możesz zmienić geometrię:

```typescript
// Pobierz referencję do aktora
const demoActor = this.world.getActorByName('DirtyMetalDemoActor') as DirtyMetalDemoActor;

if (demoActor) {
  // Zmień na inną geometrię
  demoActor.setGeometry(new THREE.TorusKnotGeometry(1, 0.3, 100, 16));
}
```

## Używane tekstury silnika

Materiał wykorzystuje następujące tekstury z assetów silnika:

- `@engine/assets/textures/T_Metal_Brushed_Normal.png` - Normal map szczotkowanego metalu
- `@engine/assets/textures/T_Stone_Mossy_Roughness.jpg` - Roughness map (daje efekt brudu)
- `@engine/assets/textures/T_Stone_Mossy_AmbientOcclusion.jpg` - Ambient occlusion map

## Uwagi

1. **Wysokie poly mesh**: Dla najlepszego efektu PBR, używaj mesh'y z wysoką liczbą poligonów (np. 64+ segmentów dla sfer).

2. **UV2 dla AO**: Materiał automatycznie dodaje UV2 dla ambient occlusion, jeśli nie istnieje.

3. **Ładowanie tekstur**: Tekstury ładują się asynchronicznie. Materiał działa od razu, ale tekstury pojawią się po załadowaniu.

4. **Czyszczenie**: Pamiętaj wywołać `destroy()` na materiale, gdy nie jest już potrzebny, aby zwolnić pamięć.

5. **Environment map**: Materiał automatycznie używa environment map ze sceny dla realistycznych odbić.
