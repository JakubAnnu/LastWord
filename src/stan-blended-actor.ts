import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

const DEFAULT_POSITION = new THREE.Vector3(10.07, 0.6, 10.19);

/**
 * Animated Stan character with "farming" animation. Position from constructor or default (10.07, 0.6, 10.19).
 */
@ENGINE.GameClass()
export class StanBlendedActor extends ENGINE.Actor {
  private gltfComponent!: ENGINE.GLTFMeshComponent;
  private animationComponent!: ENGINE.AnimationComponent;
  private readonly position = new THREE.Vector3().copy(DEFAULT_POSITION);

  private static readonly FARMING_ANIMATION_NAME = 'farming';

  constructor(position?: THREE.Vector3) {
    super();
    if (position) this.position.copy(position);
  }

  public override initialize(): void {
    super.initialize();

    this.setWorldPosition(this.position);
    this.editorData.displayName = 'Stan_Blended';

    // Order as in WalkingMannequinActor: GLTF first, then AnimationComponent (same parent so mixer is shared)
    this.gltfComponent = ENGINE.GLTFMeshComponent.create({
      name: 'StanMesh',
      modelUrl: '@project/assets/generated/mesh/Stan.glb',
    });
    this.rootComponent.add(this.gltfComponent);

    this.animationComponent = ENGINE.AnimationComponent.create({
      name: 'StanAnimation',
      autoPlay: false,
      loopMode: 'LoopRepeat',
    });
    // Attach to GLTF so animation uses the same mixer as the loaded model
    this.gltfComponent.add(this.animationComponent);

    this.gltfComponent.onMeshLoaded.add(() => {
      const animations = this.gltfComponent.getAnimations();
      console.log('Stan_Blended: model loaded, animations count:', animations.length, 'names:', animations.map((a) => a.name));

      if (animations.length === 0) {
        console.warn('Stan_Blended: no animations in Stan.glb. Export "farming" in the same .glb or use external animation .glb + config (Joy-style).');
        return;
      }

      const farmingClip = animations.find(
        (a) => a.name.toLowerCase() === StanBlendedActor.FARMING_ANIMATION_NAME.toLowerCase()
      );
      if (farmingClip) {
        this.animationComponent.playAnimation(farmingClip.name, 0);
        console.log('Stan_Blended: playing animation:', farmingClip.name);
      } else {
        console.warn(
          'Stan_Blended: "farming" not found. Available:',
          animations.map((a) => a.name)
        );
        this.animationComponent.playAnimation(animations[0].name, 0);
        console.log('Stan_Blended: playing first clip:', animations[0].name);
      }
    });
  }
}
