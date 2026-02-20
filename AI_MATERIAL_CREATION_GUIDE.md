# AI AGENT INSTRUCTIONS: Creating Materials for Genesys Engine

## SYSTEM OVERVIEW
- Engine: Genesys.js (Three.js based)
- Material format: JSON files with `.material.json` extension
- Auto-discovery: Engine scans `assets/materials/` directory
- No code registration needed - files are automatically detected

## FILE STRUCTURE

### Location
```
<project_root>/assets/materials/M_<MaterialName>.material.json
```

### JSON Schema
```json
{
  "$version": 2,
  "$root": {
    "name": "M_MaterialName",
    "userData": {},
    "color": {
      "_": [R, G, B],  // 0.0-1.0 range
      "$bc": "c"
    },
    "roughness": 0.0-1.0,  // 0=smooth, 1=rough
    "metalness": 0.0-1.0,  // 0=non-metal, 1=metal
    "envMapIntensity": 0.0+,  // reflection strength
    "$bc": "THREE.MeshStandardMaterial"
  }
}
```

## PARAMETER REFERENCE

### Required Fields
- `$version`: Always `2`
- `$root.name`: Material identifier
- `$root.$bc`: Always `"THREE.MeshStandardMaterial"`
- `$root.color.$bc`: Always `"c"`

### PBR Parameters
```typescript
// Color (RGB 0-1)
"color": { "_": [R, G, B], "$bc": "c" }

// Surface properties
"roughness": number      // 0=glossy, 1=matte
"metalness": number      // 0=dielectric, 1=conductor
"envMapIntensity": number // reflection multiplier

// Emissive (self-illumination)
"emissive": { "_": [R, G, B], "$bc": "c" }  // glow color
"emissiveIntensity": number  // glow strength (0-10+)

// Transparency (optional)
"transparent": boolean
"opacity": 0.0-1.0       // 0=invisible, 1=opaque
```

### Texture Maps (optional)
```json
"normalMap": {
  "url": "@engine/path/to/texture.png",
  "$bc": "ENGINE.UrlTexture"
},
"normalScale": {
  "_": [x, y],
  "$bc": "v2"
}
```

## ASSET PATH PREFIXES
- `@engine/` - Engine assets: `node_modules/@gnsx/genesys.js/assets/`
- `@project/` - Project assets: `<project_root>/assets/`

## MATERIAL TYPES PATTERNS

### Opaque Metal (Matte)
```json
{
  "$version": 2,
  "$root": {
    "name": "M_Metal_Matte",
    "userData": {},
    "color": { "_": [R, G, B], "$bc": "c" },
    "roughness": 0.8,
    "metalness": 0.9,
    "envMapIntensity": 0.3,
    "$bc": "THREE.MeshStandardMaterial"
  }
}
```

### Opaque Metal (Glossy)
```json
{
  "$version": 2,
  "$root": {
    "name": "M_Metal_Glossy",
    "userData": {},
    "color": { "_": [R, G, B], "$bc": "c" },
    "roughness": 0.3,
    "metalness": 0.95,
    "envMapIntensity": 1.3,
    "$bc": "THREE.MeshStandardMaterial"
  }
}
```

### Transparent Glass-like
```json
{
  "$version": 2,
  "$root": {
    "name": "M_Glass_Color",
    "userData": {},
    "color": { "_": [R, G, B], "$bc": "c" },
    "transparent": true,
    "opacity": 0.4,
    "roughness": 0.1,
    "metalness": 0.2,
    "envMapIntensity": 1.6,
    "$bc": "THREE.MeshStandardMaterial"
  }
}
```

### Emissive (Self-illuminating)
```json
{
  "$version": 2,
  "$root": {
    "name": "M_Emissive_Glow",
    "userData": {},
    "color": { "_": [R, G, B], "$bc": "c" },
    "emissive": { "_": [R, G, B], "$bc": "c" },
    "emissiveIntensity": 2.0,
    "roughness": 0.2,
    "metalness": 0.0,
    "envMapIntensity": 0.3,
    "$bc": "THREE.MeshStandardMaterial"
  }
}
```

### Non-metallic Matte
```json
{
  "$version": 2,
  "$root": {
    "name": "M_Matte_NonMetal",
    "userData": {},
    "color": { "_": [R, G, B], "$bc": "c" },
    "roughness": 0.9,
    "metalness": 0.0,
    "envMapIntensity": 0.2,
    "$bc": "THREE.MeshStandardMaterial"
  }
}
```

## WORKFLOW

### Step 1: Create JSON file
```
Path: <project_root>/assets/materials/M_<Name>.material.json
Content: Valid JSON following schema above
```

### Step 2: Verify file exists
```bash
ls assets/materials/M_<Name>.material.json
```

### Step 3: Material is automatically available
- No code changes needed
- No imports needed
- No registration needed
- Engine auto-discovers on startup

## NAMING CONVENTIONS
- Prefix: `M_` (Material)
- PascalCase: `M_MyMaterialName`
- Examples:
  - `M_Dirty_Gold.material.json`
  - `M_Transparent_Blue.material.json`
  - `M_Weathered_Iron.material.json`

## COLOR PRESETS (RGB 0-1)

### Metals
- Gold: `[1.0, 0.84, 0.0]`
- Silver: `[0.75, 0.75, 0.75]`
- Copper: `[0.72, 0.45, 0.2]`
- Bronze: `[0.8, 0.5, 0.2]`

### Basic Colors
- Red: `[1.0, 0.0, 0.0]`
- Green: `[0.0, 1.0, 0.0]`
- Blue: `[0.0, 0.0, 1.0]`
- Yellow: `[1.0, 1.0, 0.0]`
- Cyan: `[0.0, 1.0, 1.0]`
- Magenta: `[1.0, 0.0, 1.0]`

### Greys
- White: `[1.0, 1.0, 1.0]`
- Light Grey: `[0.7, 0.7, 0.7]`
- Grey: `[0.5, 0.5, 0.5]`
- Dark Grey: `[0.3, 0.3, 0.3]`
- Black: `[0.0, 0.0, 0.0]`

## VALIDATION

### JSON must be valid
- No trailing commas
- All strings double-quoted
- Numbers without quotes

### Test material loads
After creating file, material appears in editor dropdown automatically.

## COMMON PATTERNS

### Create series of materials
For color variations, create multiple files:
```
M_Glass_Red.material.json
M_Glass_Green.material.json  
M_Glass_Blue.material.json
```

### Opacity variations
```json
// 50% transparent
"opacity": 0.5

// 75% transparent
"opacity": 0.25

// 90% transparent
"opacity": 0.1
```

### Roughness variations
```json
// Mirror-like
"roughness": 0.05

// Glossy
"roughness": 0.2

// Semi-matte
"roughness": 0.5

// Matte
"roughness": 0.8

// Very matte
"roughness": 0.95
```

## ADVANCED: TEXTURE MAPS

### With textures
```json
{
  "$version": 2,
  "$root": {
    "name": "M_Textured_Material",
    "userData": {
      "textureTransforms": {
        "normalMap": {
          "wrapS": 1000,
          "wrapT": 1000,
          "repeatX": 1,
          "repeatY": 1,
          "offsetX": 0,
          "offsetY": 0,
          "rotation": 0
        }
      }
    },
    "color": { "_": [1, 1, 1], "$bc": "c" },
    "roughness": 0.5,
    "metalness": 0.9,
    "normalMap": {
      "url": "@engine/assets/textures/T_Normal.png",
      "$bc": "ENGINE.UrlTexture"
    },
    "normalScale": { "_": [1.0, 1.0], "$bc": "v2" },
    "$bc": "THREE.MeshStandardMaterial"
  }
}
```

## TROUBLESHOOTING

### Material not appearing
- Check JSON syntax (use validator)
- Verify file extension is `.material.json`
- Ensure file is in `assets/materials/` directory
- Restart editor if needed

### Material looks wrong
- Check RGB values are 0-1 (not 0-255)
- Verify roughness/metalness in 0-1 range
- For transparent: ensure `"transparent": true` is set

## SUMMARY FOR AI AGENT

1. Create `.material.json` file in `assets/materials/`
2. Use JSON schema with `$version: 2`, `$root`, proper structure
3. Set PBR parameters: color (RGB 0-1), roughness, metalness, envMapIntensity
4. For transparency: add `transparent: true`, `opacity: 0-1`
5. No code changes needed - automatic discovery
6. Material appears in editor Material dropdown

## EXECUTION PROTOCOL

```python
def create_material(name: str, color: tuple, roughness: float, metalness: float, 
                   transparent: bool = False, opacity: float = 1.0):
    material = {
        "$version": 2,
        "$root": {
            "name": name,
            "userData": {},
            "color": {"_": list(color), "$bc": "c"},
            "roughness": roughness,
            "metalness": metalness,
            "envMapIntensity": 1.5 if transparent else (0.3 if roughness > 0.7 else 1.0),
            "$bc": "THREE.MeshStandardMaterial"
        }
    }
    
    if transparent:
        material["$root"]["transparent"] = True
        material["$root"]["opacity"] = opacity
    
    filepath = f"assets/materials/{name}.material.json"
    write_json(filepath, material)
    return filepath
```

END INSTRUCTIONS
