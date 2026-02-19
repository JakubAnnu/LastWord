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
  /** Roll rotation in degrees (rotation around the camera's forward axis) */
  rollDegrees?: number;
  /** Enable zoom functionality (W/S keys) */
  enableZoom?: boolean;
  /** Enable A/D keys for yaw rotation (left/right pan) */
  enableWSYawControl?: boolean;
  /** Minimum FOV for zoom (maximum zoom in) */
  minFOV?: number;
  /** Maximum FOV for zoom (maximum zoom out) */
  maxFOV?: number;
  /** Enable camera rotation control (arrow keys) - default true */
  enableRotationControl?: boolean;
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
  private rollDegrees: number = 0;
  
  // Camera rotation control
  private baseRotation: THREE.Quaternion = new THREE.Quaternion();
  private currentYaw: number = 0; // Current yaw offset in degrees
  private currentPitch: number = 0; // Current pitch offset in degrees
  private readonly MAX_YAW = 120; // Maximum yaw rotation in degrees (significantly increased for wider range)
  private readonly MAX_PITCH = 91; // Maximum pitch rotation in degrees (increased by 30%)
  private readonly ROTATION_SPEED = 60; // Degrees per second

  // W/S yaw rotation control
  private enableWSYawControl: boolean = false;

  // Zoom control
  private enableZoom: boolean = false;
  private minFOV: number = 40; // 60mm equivalent (zoomed in)
  private maxFOV: number = 70; // 20mm equivalent (zoomed out)
  private currentFOV: number = 70;
  private readonly ZOOM_SPEED = 30; // FOV change per second

  // Rotation control
  private enableRotationControl: boolean = true;

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
      this.currentFOV = options.fov;
      this.cameraComponent.setFOV(options.fov);
    }
    
    if (options?.target) {
      this.target = options.target;
    }

    // Store startActive flag for use in beginPlay
    this.shouldStartActive = options?.startActive ?? false;
    
    // Store roll rotation
    this.rollDegrees = options?.rollDegrees ?? 0;

    // Store zoom settings
    this.enableZoom = options?.enableZoom ?? false;
    if (options?.minFOV !== undefined) {
      this.minFOV = options.minFOV;
    }
    if (options?.maxFOV !== undefined) {
      this.maxFOV = options.maxFOV;
      this.currentFOV = options.maxFOV; // Start with max FOV (zoomed out)
      this.cameraComponent.setFOV(this.maxFOV);
    }

    // Store rotation control setting
    this.enableRotationControl = options?.enableRotationControl ?? true;

    // Store W/S yaw control setting
    this.enableWSYawControl = options?.enableWSYawControl ?? false;
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
   * Resets yaw and pitch rotation offsets back to zero (base look-at direction)
   */
  public resetRotationOffsets(): void {
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.applyCameraRotation();
  }

  /**
   * Sets the field of view for the camera
   * @param fov Field of view in degrees
   */
  public setFOV(fov: number): void {
    this.currentFOV = fov;
    this.cameraComponent.setFOV(fov);
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
    
    // Apply roll rotation if specified
    if (this.rollDegrees !== 0) {
      const rollRadians = THREE.MathUtils.degToRad(this.rollDegrees);
      const rollQuaternion = new THREE.Quaternion();
      rollQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollRadians);
      quaternion.multiply(rollQuaternion);
    }
    
    // Store this as the base rotation (convert to Euler for easier manipulation)
    this.baseRotation.copy(quaternion);
    
    // Apply current yaw and pitch offsets
    this.applyCameraRotation();
  }

  /**
   * Applies the current yaw and pitch offsets to the camera rotation
   */
  private applyCameraRotation(): void {
    // Convert base rotation to Euler angles
    const baseEuler = new THREE.Euler().setFromQuaternion(this.baseRotation, 'YXZ');
    
    // Add yaw and pitch offsets
    const finalEuler = new THREE.Euler(
      baseEuler.x + THREE.MathUtils.degToRad(this.currentPitch),
      baseEuler.y + THREE.MathUtils.degToRad(this.currentYaw),
      baseEuler.z,
      'YXZ'
    );
    
    // Apply rotation to the camera component
    this.cameraComponent.setWorldRotation(finalEuler);
  }

  /**
   * Handles keyboard input for camera rotation
   */
  private handleCameraRotation(deltaTime: number): void {
    if (!this.enableRotationControl || !this.isActive()) return;

    const world = this.getWorld();
    if (!world) return;

    const inputManager = world.inputManager;
    const rotationAmount = this.ROTATION_SPEED * deltaTime;
    
    let rotationChanged = false;

    // Arrow Left - rotate left (negative yaw)
    if (inputManager.isKeyDown('ArrowLeft')) {
      this.currentYaw = Math.max(this.currentYaw - rotationAmount, -this.MAX_YAW);
      rotationChanged = true;
    }

    // Arrow Right - rotate right (positive yaw)
    if (inputManager.isKeyDown('ArrowRight')) {
      this.currentYaw = Math.min(this.currentYaw + rotationAmount, this.MAX_YAW);
      rotationChanged = true;
    }

    // Arrow Up - rotate up (negative pitch)
    if (inputManager.isKeyDown('ArrowUp')) {
      this.currentPitch = Math.max(this.currentPitch - rotationAmount, -this.MAX_PITCH);
      rotationChanged = true;
    }

    // Arrow Down - rotate down (positive pitch)
    if (inputManager.isKeyDown('ArrowDown')) {
      this.currentPitch = Math.min(this.currentPitch + rotationAmount, this.MAX_PITCH);
      rotationChanged = true;
    }

    // Apply rotation if changed
    if (rotationChanged) {
      this.applyCameraRotation();
    }
  }

  /**
   * Handles W/S keys for yaw-only rotation (left/right pan)
   */
  private handleWSYawControl(deltaTime: number): void {
    if (!this.enableWSYawControl || !this.isActive()) return;

    const world = this.getWorld();
    if (!world) return;

    const inputManager = world.inputManager;
    const rotationAmount = this.ROTATION_SPEED * deltaTime;
    let rotationChanged = false;

    // A key - rotate left (negative yaw)
    if (inputManager.isKeyDown('a') || inputManager.isKeyDown('A')) {
      this.currentYaw = Math.max(this.currentYaw - rotationAmount, -this.MAX_YAW);
      rotationChanged = true;
    }

    // D key - rotate right (positive yaw)
    if (inputManager.isKeyDown('d') || inputManager.isKeyDown('D')) {
      this.currentYaw = Math.min(this.currentYaw + rotationAmount, this.MAX_YAW);
      rotationChanged = true;
    }

    if (rotationChanged) {
      this.applyCameraRotation();
    }
  }

  /**
   * Handles keyboard input for camera zoom (W/S keys)
   */
  private handleCameraZoom(deltaTime: number): void {
    if (!this.enableZoom || !this.isActive()) return;

    const world = this.getWorld();
    if (!world) return;

    const inputManager = world.inputManager;
    const zoomAmount = this.ZOOM_SPEED * deltaTime;
    
    let zoomChanged = false;

    // W key - zoom in (decrease FOV)
    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      this.currentFOV = Math.max(this.currentFOV - zoomAmount, this.minFOV);
      zoomChanged = true;
    }

    // S key - zoom out (increase FOV)
    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      this.currentFOV = Math.min(this.currentFOV + zoomAmount, this.maxFOV);
      zoomChanged = true;
    }

    // Apply zoom if changed
    if (zoomChanged) {
      this.cameraComponent.setFOV(this.currentFOV);
    }
  }

  public override doBeginPlay(): void {
    super.doBeginPlay();
    // Activate camera if shouldStartActive is true
    if (this.shouldStartActive) {
      this.setActive(true);
    }
    // Update camera direction when the actor begins play
    this.updateCameraDirection();
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    
    // Handle camera rotation input
    this.handleCameraRotation(deltaTime);

    // Handle W/S yaw rotation input
    this.handleWSYawControl(deltaTime);
    
    // Handle camera zoom input
    this.handleCameraZoom(deltaTime);
    
    // Continuously update if target is an actor (in case it moves)
    if (this.target instanceof ENGINE.Actor) {
      this.updateCameraDirection();
    }
  }
}
