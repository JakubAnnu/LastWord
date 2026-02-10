import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';


/**
 * Options for the FreeCameraPlayer class.
 * Currently empty, can be extended if needed.
 */
export interface FreeCameraPlayerOptions extends ENGINE.PawnOptions {
}

/**
 * A free camera player class.
 *
 * Key points:
 * - No need to provide movementComponent and camera, they are created internally
 * - The pawn is set to be transient so it's never saved in the level
 * - The directional light follows the player for consistent shadows
 *
 */
@ENGINE.GameClass()
export class FreeCameraPlayer extends ENGINE.Pawn {
  constructor() {
    super();
    // simple perspective camera
    const camera = new THREE.PerspectiveCamera(ENGINE.CAMERA_FOV, 1, ENGINE.CAMERA_NEAR, ENGINE.CAMERA_FAR);
    this.rootComponent.add(camera);
    // simple movement component, do not use the character controller
    const movementComponent = ENGINE.CharacterMovementComponent.create({
      // disable the character controller
      characterControllerOptions: null,
    });
    this.movementComponent = movementComponent;

    this.enableDirectionalLightFollowing = true;

    // set the pawn to be transient so it's never saved in the level
    this.setTransient(true);
  }
}
