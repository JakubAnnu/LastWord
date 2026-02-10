import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

/**
 * Options for the FixedCamera actor.
 */
export interface FixedCameraOptions extends ENGINE.ActorOptions {
  /** Target position or actor to look at */
  target?: THREE.Vector3 | ENGINE.Actor;
  /** Field of view for the camera */
  fov?: number;
  /** Whether this camera should start as active */
  startActive?: boolean;
}

/**
 * A fixed camera actor that can be positioned at a specific location
 * and look at a target position or actor.
 */
@ENGINE.GameClass()
export class FixedCamera extends ENGINE.Actor {
  private cameraComponent: ENGINE.CameraComponent;
  private target: THREE.Vector3 | ENGINE.Actor | null = null;
  private shouldStartActive: boolean = false;

  constructor() {
    super();
    
    // Create camera component (don't set startActive yet, we'll do it in initialize)
    this.cameraComponent = ENGINE.CameraComponent.create({
      fov: ENGINE.CAMERA_FOV,
      near: ENGINE.CAMERA_NEAR,
      far: ENGINE.CAMERA_FAR,
      startActive: false,
    });
    
    this.rootComponent.add(this.cameraComponent);
  }

  public override initialize(options?: FixedCameraOptions): void {
    super.initialize(options);
    
    if (options?.fov !== undefined) {
      this.cameraComponent.setFOV(options.fov);
    }
    
    if (options?.target) {
      this.target = options.target;
    }

    // Store startActive flag for use in beginPlay
    this.shouldStartActive = options?.startActive ?? false;
  }

  /**
   * Sets the target for the camera to look at
   * @param target Target position or actor
   */
  public setTarget(target: THREE.Vector3 | ENGINE.Actor): void {
    this.target = target;
    this.updateCameraDirection();
  }

  /**
   * Sets whether this camera is active for rendering
   * @param active Whether to activate or deactivate this camera
   */
  public setActive(active: boolean): void {
    this.cameraComponent.setActive(active);
  }

  /**
   * Checks if this camera is currently active
   * @returns Whether this camera is active
   */
  public isActive(): boolean {
    return this.cameraComponent.isActive();
  }

  /**
   * Updates the camera direction to look at the target
   */
  private updateCameraDirection(): void {
    if (!this.target) return;

    const targetPosition = this.target instanceof ENGINE.Actor 
      ? this.target.getWorldPosition() 
      : this.target;

    // Get camera's world position
    const cameraWorldPos = new THREE.Vector3();
    this.cameraComponent.getWorldPosition(cameraWorldPos);

    // Calculate direction from camera to target
    const direction = new THREE.Vector3().subVectors(targetPosition, cameraWorldPos);
    
    // Create a quaternion that rotates to look at the target
    const matrix = new THREE.Matrix4();
    matrix.lookAt(cameraWorldPos, targetPosition, new THREE.Vector3(0, 1, 0));
    const quaternion = new THREE.Quaternion();
    quaternion.setFromRotationMatrix(matrix);
    
    // Apply rotation to the camera component
    this.cameraComponent.setWorldRotation(new THREE.Euler().setFromQuaternion(quaternion));
  }

  public override beginPlay(): void {
    super.beginPlay();
    // Activate camera if shouldStartActive is true
    if (this.shouldStartActive) {
      this.setActive(true);
    }
    // Update camera direction when the actor begins play
    this.updateCameraDirection();
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    // Continuously update if target is an actor (in case it moves)
    if (this.target instanceof ENGINE.Actor) {
      this.updateCameraDirection();
    }
  }
}
