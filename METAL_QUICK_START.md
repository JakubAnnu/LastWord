## Quick Start - Dirty Yellow Metal Material

### Najszybszy sposób:

```typescript
import { DirtyMetalDemoActor } from './dirty-metal-demo-actor.js';

// W game.ts w metodzie preStart():
const metalSphere = DirtyMetalDemoActor.create({
  position: new THREE.Vector3(0, 2, 0),
});

this.world.addActor(metalSphere);
```

### Dostosowanie:

```typescript
// Pobierz materiał z aktora
const material = metalSphere.getMaterial();

if (material) {
  material.setColor(0xFFD700);       // zmień kolor na złoty
  material.setRoughness(0.4);        // bardziej błyszczący
  material.setMetalness(0.95);       // bardziej metaliczny
  material.setTextureRepeat(3, 3);   // więcej tiling
}
```

### Zobacz pełną dokumentację w `METAL_MATERIAL.md`
