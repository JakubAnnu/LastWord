import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';
import { DirtyYellowMetalMaterial } from './dirty-yellow-metal-material.js';

/**
 * DirtyMetalDemoActor - Demo actor showing the dirty yellow metal material
 * 
 * Creates a simple geometric object (sphere, box, or custom mesh) with the
 * dirty yellow metal PBR material applied.
 */
@ENGINE.GameClass()
export class DirtyMetalDemoActor extends ENGINE.Actor {
  private metalMaterial: DirtyYellowMetalMaterial | null = null;
  private meshComponent: ENGINE.MeshComponent | null = null;

  public override doBeginPlay(): void {
    super.doBeginPlay();

    // Create the material
    this.metalMaterial = new DirtyYellowMetalMaterial();

    // Create a mesh component
    this.meshComponent = ENGINE.MeshComponent.create({
      name: 'MetalMesh',
      geometry: new THREE.SphereGeometry(1, 64, 64), // High-poly sphere for good PBR
      material: this.metalMaterial.getMaterial(),
    });

    // Attach to root
    this.rootComponent.add(this.meshComponent);

    console.log('DirtyMetalDemoActor: Created with dirty yellow metal material');
  }

  /**
   * Get the material instance for runtime adjustments
   */
  public getMaterial(): DirtyYellowMetalMaterial | null {
    return this.metalMaterial;
  }

  /**
   * Change the mesh geometry
   */
  public setGeometry(geometry: THREE.BufferGeometry): void {
    if (this.meshComponent && this.metalMaterial) {
      const mesh = this.meshComponent.getMesh();
      if (mesh) {
        // Dispose old geometry
        mesh.geometry.dispose();
        
        // Set new geometry
        mesh.geometry = geometry;
        
        // Ensure UV2 for AO
        if (!geometry.attributes.uv2 && geometry.attributes.uv) {
          geometry.setAttribute('uv2', geometry.attributes.uv);
        }
        
        // Re-apply material to ensure textures work correctly
        this.metalMaterial.applyToMesh(mesh);
      }
    }
  }

  public override destroy(): void {
    if (this.metalMaterial) {
      this.metalMaterial.destroy();
      this.metalMaterial = null;
    }
    super.destroy();
  }
}
