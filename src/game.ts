
import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { FreeCameraPlayer } from './player.js';
import { FixedCamera } from './fixed-camera.js';
import './auto-imports.js';

class MyGame extends ENGINE.BaseGameLoop {
  private pawn: FreeCameraPlayer | null = null;
  private controller: ENGINE.PlayerController | null = null;
  private camera1: FixedCamera | null = null;
  private camera2: FixedCamera | null = null;
  private activeCamera: 1 | 2 = 1;
  private lastKeyPressTime: { '1': number; '2': number } = { '1': 0, '2': 0 };
  private readonly KEY_PRESS_COOLDOWN = 200; // milliseconds

  protected override createLoadingScreen(): ENGINE.ILoadingScreen | null {
    // enable the default loading screen
    return new ENGINE.DefaultLoadingScreen();
  }

  protected override async preStart(): Promise<void> {
    // Create first camera at position (x:4.25, y:2.81, z:-4.21)
    // pointing at Stan model at (x:1.43, y:2.15, z:-3.97)
    const camera1Position = new THREE.Vector3(4.25, 2.81, -4.21);
    const stanPosition = new THREE.Vector3(1.43, 2.15, -3.97);
    this.camera1 = FixedCamera.create({ position: camera1Position, startActive: true });
    
    // Create second camera at position (x:-3.58, y:3.57, z:-5.99)
    // pointing at position (x:-0.14, y:2.21, z:-3.98)
    // with 20mm focal length (approximately 70° FOV)
    const camera2Position = new THREE.Vector3(-3.58, 3.57, -5.99);
    const camera2Target = new THREE.Vector3(-0.14, 2.21, -3.98);
    this.camera2 = FixedCamera.create({ position: camera2Position, startActive: false, fov: 70 });
    this.camera2.setTarget(camera2Target);
    
    // Add both cameras to the world
    this.world.addActors(this.camera1, this.camera2);
    
    // Wait for the level to load completely
    await this.waitForLevelLoad();
    
    // Try to find Stan actor for camera 1
    let stanActor = this.findActorByName('Stan');
    
    // If not found by name, try to find it by proximity to expected position
    if (!stanActor) {
      stanActor = this.findActorNearPosition(stanPosition, 1.0); // within 1 unit
    }
    
    if (stanActor) {
      console.log(`Found Stan actor: ${stanActor.name}`);
      this.camera1.setTarget(stanActor);
    } else {
      console.warn('Stan actor not found, pointing camera 1 at expected position');
      this.camera1.setTarget(stanPosition);
    }
  }

  protected override tick(tickTime: ENGINE.TickTime): void {
    super.tick(tickTime);
    this.handleCameraSwitching();
  }

  /**
   * Handle camera switching based on keyboard input (keys 1 and 2)
   */
  private handleCameraSwitching(): void {
    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    // Check for key '1' press
    if (inputManager.isKeyDown('1') && this.activeCamera !== 1) {
      if (currentTime - this.lastKeyPressTime['1'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(1);
        this.lastKeyPressTime['1'] = currentTime;
      }
    }

    // Check for key '2' press
    if (inputManager.isKeyDown('2') && this.activeCamera !== 2) {
      if (currentTime - this.lastKeyPressTime['2'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(2);
        this.lastKeyPressTime['2'] = currentTime;
      }
    }
  }

  /**
   * Switch to the specified camera
   */
  private switchToCamera(cameraNumber: 1 | 2): void {
    if (cameraNumber === 1 && this.camera1) {
      this.camera1.setActive(true);
      if (this.camera2) {
        this.camera2.setActive(false);
      }
      this.activeCamera = 1;
      console.log('Switched to Camera 1');
    } else if (cameraNumber === 2 && this.camera2) {
      this.camera2.setActive(true);
      if (this.camera1) {
        this.camera1.setActive(false);
      }
      this.activeCamera = 2;
      console.log('Switched to Camera 2');
    }
  }

  /**
   * Wait for the level to finish loading
   */
  private async waitForLevelLoad(): Promise<void> {
    // Give the scene time to load actors
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Find an actor by name (case-insensitive partial match)
   */
  private findActorByName(namePattern: string): ENGINE.Actor | null {
    const actors = this.world.getActors();
    return actors.find(actor => 
      actor.name.toLowerCase().includes(namePattern.toLowerCase())
    ) ?? null;
  }

  /**
   * Find the closest actor to a given position within a threshold
   */
  private findActorNearPosition(position: THREE.Vector3, threshold: number): ENGINE.Actor | null {
    const actors = this.world.getActors();
    let closestActor: ENGINE.Actor | null = null;
    let minDistance = threshold;

    for (const actor of actors) {
      const actorPos = actor.getWorldPosition();
      const distance = actorPos.distanceTo(position);
      if (distance < minDistance) {
        minDistance = distance;
        closestActor = actor;
      }
    }

    return closestActor;
  }
}

export function main(container: HTMLElement, options?: Partial<ENGINE.BaseGameLoopOptions>): ENGINE.IGameLoop {
  const game = new MyGame(container, options);
  return game;
}
