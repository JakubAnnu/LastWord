import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

/**
 * DirtyYellowMetalMaterial - A PBR material for dirty yellow metallic surfaces
 * 
 * This material creates a realistic physically-based rendering (PBR) appearance
 * of a yellow metal surface with dirt and wear. It includes:
 * - Yellow metallic base color with variation
 * - High metalness with subtle variation for worn areas
 * - Roughness variation to simulate dirt and wear
 * - Normal mapping for surface detail (brushed metal texture)
 * - Ambient occlusion for depth
 */
export class DirtyYellowMetalMaterial {
  private material: THREE.MeshStandardMaterial;

  constructor() {
    
    // Create the PBR material with yellow metallic base
    this.material = new THREE.MeshStandardMaterial({
      name: 'DirtyYellowMetal',
      
      // Base color - dirty yellow with slight brownish tint
      color: new THREE.Color(0.85, 0.75, 0.25), // RGB: dirty yellow-gold
      
      // Metalness - high value for metallic appearance
      metalness: 0.9,
      
      // Roughness - medium-high for dirty/worn surface
      roughness: 0.6,
      
      // Enable environment reflections
      envMapIntensity: 1.0,
    });

    this.loadTextures();
  }

  /**
   * Load and apply PBR textures
   */
  private async loadTextures(): Promise<void> {
    try {
      // Load normal map for surface detail (brushed metal)
      const normalMap = new ENGINE.UrlTexture({
        url: '@engine/assets/textures/T_Metal_Brushed_Normal.png',
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
      });
      
      // Load roughness map for wear variation
      const roughnessMap = new ENGINE.UrlTexture({
        url: '@engine/assets/textures/T_Stone_Mossy_Roughness.jpg',
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
      });
      
      // Load ambient occlusion for depth
      const aoMap = new ENGINE.UrlTexture({
        url: '@engine/assets/textures/T_Stone_Mossy_AmbientOcclusion.jpg',
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
      });

      // Wait for textures to load
      await Promise.all([
        normalMap.loadPromise,
        roughnessMap.loadPromise,
        aoMap.loadPromise,
      ]);

      // Apply textures to material
      this.material.normalMap = normalMap;
      this.material.normalScale = new THREE.Vector2(0.5, 0.5); // Subtle normal effect
      
      this.material.roughnessMap = roughnessMap;
      
      this.material.aoMap = aoMap;
      this.material.aoMapIntensity = 0.3; // Subtle AO effect
      
      // Mark material as needing update
      this.material.needsUpdate = true;
      
      console.log('DirtyYellowMetalMaterial: Textures loaded successfully');
    } catch (error) {
      console.error('DirtyYellowMetalMaterial: Error loading textures:', error);
    }
  }

  /**
   * Get the Three.js material instance
   */
  public getMaterial(): THREE.MeshStandardMaterial {
    return this.material;
  }

  /**
   * Apply this material to a mesh or array of meshes
   */
  public applyToMesh(mesh: THREE.Mesh | THREE.Mesh[]): void {
    const meshes = Array.isArray(mesh) ? mesh : [mesh];
    
    for (const m of meshes) {
      m.material = this.material;
      
      // Ensure the mesh has UV2 for ambient occlusion
      if (this.material.aoMap && !m.geometry.attributes.uv2) {
        m.geometry.setAttribute('uv2', m.geometry.attributes.uv);
      }
    }
  }

  /**
   * Adjust the metalness value (0 = non-metallic, 1 = fully metallic)
   */
  public setMetalness(value: number): void {
    this.material.metalness = THREE.MathUtils.clamp(value, 0, 1);
  }

  /**
   * Adjust the roughness value (0 = smooth/shiny, 1 = rough/matte)
   */
  public setRoughness(value: number): void {
    this.material.roughness = THREE.MathUtils.clamp(value, 0, 1);
  }

  /**
   * Adjust the base color
   */
  public setColor(color: THREE.Color | number): void {
    if (typeof color === 'number') {
      this.material.color.setHex(color);
    } else {
      this.material.color.copy(color);
    }
  }

  /**
   * Adjust the normal map intensity
   */
  public setNormalIntensity(x: number, y: number = x): void {
    if (this.material.normalScale) {
      this.material.normalScale.set(x, y);
    }
  }

  /**
   * Adjust the ambient occlusion intensity
   */
  public setAOIntensity(value: number): void {
    this.material.aoMapIntensity = THREE.MathUtils.clamp(value, 0, 1);
  }

  /**
   * Set texture tiling/repeat
   */
  public setTextureRepeat(repeatX: number, repeatY: number): void {
    if (this.material.normalMap) {
      this.material.normalMap.repeat.set(repeatX, repeatY);
    }
    if (this.material.roughnessMap) {
      this.material.roughnessMap.repeat.set(repeatX, repeatY);
    }
    if (this.material.aoMap) {
      this.material.aoMap.repeat.set(repeatX, repeatY);
    }
  }

  /**
   * Enable/disable environment map reflections
   */
  public setEnvMapIntensity(intensity: number): void {
    this.material.envMapIntensity = Math.max(0, intensity);
  }

  public destroy(): void {
    // Dispose of textures
    if (this.material.normalMap) this.material.normalMap.dispose();
    if (this.material.roughnessMap) this.material.roughnessMap.dispose();
    if (this.material.aoMap) this.material.aoMap.dispose();
    
    // Dispose of material
    this.material.dispose();
  }
}
