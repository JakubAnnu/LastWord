
import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { FreeCameraPlayer } from './player.js';
import { FixedCamera } from './fixed-camera.js';
import { WalkingMannequinActor } from './walking-mannequin-actor.js';
import './auto-imports.js';

class MyGame extends ENGINE.BaseGameLoop {
  private pawn: FreeCameraPlayer | null = null;
  private controller: ENGINE.PlayerController | null = null;
  private camera1: FixedCamera | null = null;
  private camera2: FixedCamera | null = null;
  private camera3: FixedCamera | null = null;
  private camera4: FixedCamera | null = null;
  private camera5: FixedCamera | null = null;
  private activeCamera: 1 | 2 | 3 | 4 | 5 = 1;
  private lastKeyPressTime: { '1': number; '2': number; '3': number; '4': number; '5': number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  private readonly KEY_PRESS_COOLDOWN = 200; // milliseconds

  protected override createLoadingScreen(): ENGINE.ILoadingScreen | null {
    // enable the default loading screen
    return new ENGINE.DefaultLoadingScreen();
  }

  protected override async preStart(): Promise<void> {
    // Create first camera at position (x:-3.45, y:4.75, z:-5.88)
    // pointing at Stan model at (x:1.43, y:2.15, z:-3.97)
    const camera1Position = new THREE.Vector3(-3.45, 4.75, -5.88);
    const stanPosition = new THREE.Vector3(1.43, 2.15, -3.97);
    this.camera1 = FixedCamera.create({ position: camera1Position, startActive: true });
    
    // Create second camera at position (x:0.44, y:13.76, z:-3.62)
    // pointing at position (x:-0.14, y:2.21, z:-3.98)
    // with 20mm focal length (approximately 70° FOV)
    const camera2Position = new THREE.Vector3(0.44, 13.76, -3.62);
    const camera2Target = new THREE.Vector3(-0.14, 2.21, -3.98);
    this.camera2 = FixedCamera.create({ position: camera2Position, startActive: false, fov: 70 });
    this.camera2.setTarget(camera2Target);
    
    // Create third camera at position (x:0.71, y:4.76, z:-8.82)
    // pointing at position (x:0.74, y:3.93, z:-8.82)
    // with 15mm focal length (approximately 94° FOV) and 90° roll rotation
    const camera3Position = new THREE.Vector3(0.71, 4.76, -8.82);
    const camera3Target = new THREE.Vector3(0.74, 3.93, -8.82);
    this.camera3 = FixedCamera.create({ position: camera3Position, startActive: false, fov: 94, rollDegrees: 90 });
    this.camera3.setTarget(camera3Target);
    
    // Create fourth camera at position (x:-45.78, y:5.28, z:-7.77)
    // pointing at position (x:-4.86, y:5.28, z:-7.77)
    // with zoom functionality: 20mm (70° FOV) to 120mm (20° FOV)
    const camera4Position = new THREE.Vector3(-45.78, 5.28, -7.77);
    const camera4Target = new THREE.Vector3(-4.86, 5.28, -7.77);
    this.camera4 = FixedCamera.create({ 
      position: camera4Position, 
      startActive: false,
      enableZoom: true,
      minFOV: 20, // 120mm (zoomed in)
      maxFOV: 70  // 20mm (zoomed out)
    });
    this.camera4.setTarget(camera4Target);
    
    // Create fifth camera at position (x:1.5, y:4.51, z:-9.01)
    // Fixed camera (no rotation control), 20mm focal length (70° FOV)
    // Pointing forward in -Z direction
    const camera5Position = new THREE.Vector3(1.5, 4.51, -9.01);
    const camera5Target = new THREE.Vector3(1.5, 4.51, -10.01); // Looking forward (deeper into -Z)
    this.camera5 = FixedCamera.create({ 
      position: camera5Position, 
      startActive: false,
      fov: 70, // 20mm
      enableRotationControl: false // Immobile camera
    });
    this.camera5.setTarget(camera5Target);
    
    // Add all cameras to the world
    this.world.addActors(this.camera1, this.camera2, this.camera3, this.camera4, this.camera5);
    
    // Create and add walking mannequin
    const mannequin = WalkingMannequinActor.create({
      name: 'WalkingMannequin',
    });
    this.world.addActor(mannequin);
    
    // Wait for the level to load completely
    await this.waitForLevelLoad();
    
    // === PRZYKŁADY JAK DODAĆ MATERIAŁ NA OBIEKT Z LEVELU ===
    
    // PRZYKŁAD 1: Zastosuj materiał na konkretny obiekt po nazwie
    // Odkomentuj i zmień 'NazwaObiektu' na nazwę Twojego obiektu ze sceny
    /*
    const myObject = this.findActorByName('NazwaObiektu');
    if (myObject) {
      const metalMaterial = new DirtyYellowMetalMaterial();
      
      // Znajdź mesh component
      const meshComponent = myObject.findComponentByClass(ENGINE.MeshComponent);
      if (meshComponent) {
        const mesh = meshComponent.getMesh();
        if (mesh) {
          metalMaterial.applyToMesh(mesh);
          console.log('Materiał zastosowany na:', myObject.name);
        }
      }
    }
    */
    
    // PRZYKŁAD 2: Zastosuj na wszystkie meshe w aktorze
    /*
    const myObject = this.findActorByName('NazwaObiektu');
    if (myObject) {
      const metalMaterial = new DirtyYellowMetalMaterial();
      
      // Znajdź wszystkie mesh componenty
      const meshComponents = myObject.findComponentsByClass(ENGINE.MeshComponent);
      for (const meshComponent of meshComponents) {
        const mesh = meshComponent.getMesh();
        if (mesh) {
          metalMaterial.applyToMesh(mesh);
        }
      }
      
      // Opcjonalne dostosowanie
      metalMaterial.setColor(0xFFD700);  // złoty
      metalMaterial.setRoughness(0.5);
      metalMaterial.setTextureRepeat(3, 3);
    }
    */
    
    // PRZYKŁAD 3: Zastosuj na wszystkie obiekty o określonym prefiksie nazwy
    /*
    const allActors = this.world.getActors();
    const metalMaterial = new DirtyYellowMetalMaterial();
    
    for (const actor of allActors) {
      if (actor.name.startsWith('Metal_')) { // Wszystkie aktory zaczynające się od "Metal_"
        const meshComponents = actor.findComponentsByClass(ENGINE.MeshComponent);
        for (const meshComponent of meshComponents) {
          const mesh = meshComponent.getMesh();
          if (mesh) {
            metalMaterial.applyToMesh(mesh);
          }
        }
      }
    }
    */
    
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
   * Handle camera switching based on keyboard input (keys 1, 2, 3, 4, and 5)
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

    // Check for key '3' press
    if (inputManager.isKeyDown('3') && this.activeCamera !== 3) {
      if (currentTime - this.lastKeyPressTime['3'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(3);
        this.lastKeyPressTime['3'] = currentTime;
      }
    }

    // Check for key '4' press
    if (inputManager.isKeyDown('4') && this.activeCamera !== 4) {
      if (currentTime - this.lastKeyPressTime['4'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(4);
        this.lastKeyPressTime['4'] = currentTime;
      }
    }

    // Check for key '5' press
    if (inputManager.isKeyDown('5') && this.activeCamera !== 5) {
      if (currentTime - this.lastKeyPressTime['5'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(5);
        this.lastKeyPressTime['5'] = currentTime;
      }
    }
  }

  /**
   * Switch to the specified camera
   */
  private switchToCamera(cameraNumber: 1 | 2 | 3 | 4 | 5): void {
    // Deactivate all cameras first
    if (this.camera1) this.camera1.setActive(false);
    if (this.camera2) this.camera2.setActive(false);
    if (this.camera3) this.camera3.setActive(false);
    if (this.camera4) this.camera4.setActive(false);
    if (this.camera5) this.camera5.setActive(false);

    // Activate the selected camera
    if (cameraNumber === 1 && this.camera1) {
      this.camera1.setActive(true);
      this.activeCamera = 1;
      console.log('Switched to Camera 1');
    } else if (cameraNumber === 2 && this.camera2) {
      this.camera2.setActive(true);
      this.activeCamera = 2;
      console.log('Switched to Camera 2');
    } else if (cameraNumber === 3 && this.camera3) {
      this.camera3.setActive(true);
      this.activeCamera = 3;
      console.log('Switched to Camera 3');
    } else if (cameraNumber === 4 && this.camera4) {
      this.camera4.setActive(true);
      this.activeCamera = 4;
      console.log('Switched to Camera 4');
    } else if (cameraNumber === 5 && this.camera5) {
      this.camera5.setActive(true);
      this.activeCamera = 5;
      console.log('Switched to Camera 5');
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
