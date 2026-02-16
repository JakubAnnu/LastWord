
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
  private camera3: FixedCamera | null = null;
  private camera4: FixedCamera | null = null;
  private camera5: FixedCamera | null = null;
  private camera6a: FixedCamera | null = null;
  private camera6b: FixedCamera | null = null;
  private camera6c: FixedCamera | null = null;
  private camera7: FixedCamera | null = null;
  private camera8: FixedCamera | null = null;
  private camera9: FixedCamera | null = null;
  private activeCamera: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 1;
  private activeCamera6Sub: 'a' | 'b' | 'c' = 'a'; // Track which sub-camera of 6 is active
  private lastKeyPressTime: { '1': number; '2': number; '3': number; '4': number; '5': number; '6': number; '7': number; '8': number; '9': number; 'ArrowLeft': number; 'ArrowRight': number; 'ArrowUp': number; 'ArrowDown': number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, 'ArrowLeft': 0, 'ArrowRight': 0, 'ArrowUp': 0, 'ArrowDown': 0 };
  private readonly KEY_PRESS_COOLDOWN = 200; // milliseconds
  
  // Camera 3 dolly (forward/backward movement)
  private camera3BasePosition = new THREE.Vector3(0.71, 4.71, -8.82);
  private camera3Target = new THREE.Vector3(0.74, 3.93, -8.82);
  private camera3DollyOffset = 0; // Forward/backward offset
  private readonly CAMERA3_DOLLY_SPEED = 2; // Units per second
  private readonly CAMERA3_MAX_DOLLY = 2; // Maximum dolly distance (reduced for closer range)
  
  // Camera 7 animation
  private camera7StartPos = new THREE.Vector3(-2.46, 6.38, -1.73);
  private camera7EndPos = new THREE.Vector3(-2.46, 25.83, 7.05); // Raised by 5 units from 20.83
  private camera7Target = new THREE.Vector3(-2.46, 6.22, -1.71);
  private camera7IsAnimating = false;
  private camera7AnimationProgress = 0; // 0 = start, 1 = end
  private readonly CAMERA7_ANIMATION_SPEED = 0.5; // Speed of movement (0.5 = 2 seconds)
  private camera7SideOffset = 0; // Left/right offset in units
  private readonly CAMERA7_SIDE_SPEED = 2; // Units per second for side movement
  private readonly CAMERA7_MAX_SIDE_OFFSET = 3; // Maximum offset in units
  // Drone-like hovering oscillation
  private camera7HoverTime = 0; // Time counter for hover oscillation
  private readonly CAMERA7_HOVER_AMPLITUDE = 0.3; // How much to move up/down
  private readonly CAMERA7_HOVER_SPEED = 1.5; // Speed of oscillation

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
    
    // Create third camera at position (x:0.71, y:4.71, z:-8.82) - raised back by 0.05 from previous
    // pointing at position (x:0.74, y:3.93, z:-8.82)
    // with 15mm focal length (approximately 94° FOV) and 90° roll rotation
    // Arrow keys: rotate camera, W/S keys: dolly in/out (limited range)
    const camera3Position = new THREE.Vector3(0.71, 4.71, -8.82);
    const camera3Target = new THREE.Vector3(0.74, 3.93, -8.82);
    this.camera3 = FixedCamera.create({ 
      position: camera3Position, 
      startActive: false, 
      fov: 94, 
      rollDegrees: 90,
      enableRotationControl: true // Enable arrow key rotation
    });
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
    
    // Create sixth camera set (6a, 6b, 6c) - all immobile cameras
    // Camera 6a at position (x:9.05, y:3.04, z:-14.35)
    // pointing at (x:11.08, y:2.29, z:-14.91)
    const camera6aPosition = new THREE.Vector3(9.05, 3.04, -14.35);
    const camera6aTarget = new THREE.Vector3(11.08, 2.29, -14.91);
    this.camera6a = FixedCamera.create({ 
      position: camera6aPosition, 
      startActive: false,
      fov: 70, // 20mm
      enableRotationControl: false // Immobile camera
    });
    this.camera6a.setTarget(camera6aTarget);
    
    // Camera 6b at position (x:9.07, y:3.14, z:-8.48)
    // pointing at (x:10.85, y:2.3, z:-8.48)
    const camera6bPosition = new THREE.Vector3(9.07, 3.14, -8.48);
    const camera6bTarget = new THREE.Vector3(10.85, 2.3, -8.48);
    this.camera6b = FixedCamera.create({ 
      position: camera6bPosition, 
      startActive: false,
      fov: 70, // 20mm
      enableRotationControl: false // Immobile camera
    });
    this.camera6b.setTarget(camera6bTarget);
    
    // Camera 6c at position (x:9.12, y:3.13, z:-20.79)
    // pointing at (x:11.14, y:1.98, z:-20.79)
    const camera6cPosition = new THREE.Vector3(9.12, 3.13, -20.79);
    const camera6cTarget = new THREE.Vector3(11.14, 1.98, -20.79);
    this.camera6c = FixedCamera.create({ 
      position: camera6cPosition, 
      startActive: false,
      fov: 70, // 20mm
      enableRotationControl: false // Immobile camera
    });
    this.camera6c.setTarget(camera6cTarget);
    
    // Camera 7 - animated camera that moves from start to end position with drone-like hover
    // Starts at (x:-2.46, y:6.38, z:-1.73)
    // Ends at (x:-2.46, y:20.83, z:7.05) - lowered by 2 units
    // Always points at (x:-2.46, y:6.22, z:-1.71)
    // Has hovering oscillation when at end position to simulate drone movement
    this.camera7 = FixedCamera.create({ 
      position: this.camera7StartPos.clone(), 
      startActive: false,
      fov: 70, // 20mm
      enableRotationControl: false // Will handle movement manually
    });
    this.camera7.setTarget(this.camera7Target);
    
    // Camera 8 - rotatable camera with arrow keys
    // Position: (x:-1.95, y:4.82, z:2.1)
    // Initially points at: (x:-0.39, y:4.78, z:1.27)
    const camera8Position = new THREE.Vector3(-1.95, 4.82, 2.1);
    const camera8Target = new THREE.Vector3(-0.39, 4.78, 1.27);
    this.camera8 = FixedCamera.create({ 
      position: camera8Position, 
      startActive: false,
      fov: 70, // 20mm
      enableRotationControl: true // Enable arrow key rotation
    });
    this.camera8.setTarget(camera8Target);
    
    // Camera 9 - fixed camera
    // Position: (x:-1.08, y:4.68, z:-6.58)
    // Points at: (x:0.59, y:4.21, z:-8.82)
    const camera9Position = new THREE.Vector3(-1.08, 4.68, -6.58);
    const camera9Target = new THREE.Vector3(0.59, 4.21, -8.82);
    this.camera9 = FixedCamera.create({ 
      position: camera9Position, 
      startActive: false,
      fov: 70, // 20mm
      enableRotationControl: true // Enable arrow key rotation
    });
    this.camera9.setTarget(camera9Target);
    
    // Add all cameras to the world
    this.world.addActors(this.camera1, this.camera2, this.camera3, this.camera4, this.camera5, this.camera6a, this.camera6b, this.camera6c, this.camera7, this.camera8, this.camera9);
    
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
    this.handleCamera7Animation(tickTime.deltaTimeMS / 1000);
    this.handleCamera3Dolly(tickTime.deltaTimeMS / 1000);
  }

  /**
   * Handle camera switching based on keyboard input (keys 1, 2, 3, 4, 5, 6, and 7)
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

    // Check for key '6' press
    if (inputManager.isKeyDown('6') && this.activeCamera !== 6) {
      if (currentTime - this.lastKeyPressTime['6'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(6);
        this.lastKeyPressTime['6'] = currentTime;
      }
    }

    // Check for key '7' press
    if (inputManager.isKeyDown('7') && this.activeCamera !== 7) {
      if (currentTime - this.lastKeyPressTime['7'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(7);
        this.lastKeyPressTime['7'] = currentTime;
      }
    }

    // Check for key '8' press
    if (inputManager.isKeyDown('8') && this.activeCamera !== 8) {
      if (currentTime - this.lastKeyPressTime['8'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(8);
        this.lastKeyPressTime['8'] = currentTime;
      }
    }

    // Check for key '9' press
    if (inputManager.isKeyDown('9') && this.activeCamera !== 9) {
      if (currentTime - this.lastKeyPressTime['9'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(9);
        this.lastKeyPressTime['9'] = currentTime;
      }
    }

    // Handle arrow left/right for camera 6 sub-camera switching
    if (this.activeCamera === 6) {
      // Arrow Left - switch to previous camera (c -> b -> a)
      if (inputManager.isKeyDown('ArrowLeft')) {
        if (currentTime - this.lastKeyPressTime['ArrowLeft'] > this.KEY_PRESS_COOLDOWN) {
          this.switchCamera6Sub('left');
          this.lastKeyPressTime['ArrowLeft'] = currentTime;
        }
      }

      // Arrow Right - switch to next camera (a -> b -> c)
      if (inputManager.isKeyDown('ArrowRight')) {
        if (currentTime - this.lastKeyPressTime['ArrowRight'] > this.KEY_PRESS_COOLDOWN) {
          this.switchCamera6Sub('right');
          this.lastKeyPressTime['ArrowRight'] = currentTime;
        }
      }
    }
  }

  /**
   * Switch to the specified camera
   */
  private switchToCamera(cameraNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): void {
    // Deactivate all cameras first
    if (this.camera1) this.camera1.setActive(false);
    if (this.camera2) this.camera2.setActive(false);
    if (this.camera3) this.camera3.setActive(false);
    if (this.camera4) this.camera4.setActive(false);
    if (this.camera5) this.camera5.setActive(false);
    if (this.camera6a) this.camera6a.setActive(false);
    if (this.camera6b) this.camera6b.setActive(false);
    if (this.camera6c) this.camera6c.setActive(false);
    if (this.camera7) this.camera7.setActive(false);
    if (this.camera8) this.camera8.setActive(false);
    if (this.camera9) this.camera9.setActive(false);

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
      this.camera3DollyOffset = 0; // Reset dolly position
      this.camera3.setWorldPosition(this.camera3BasePosition.clone());
      this.camera3.setTarget(this.camera3Target);
      console.log('Switched to Camera 3 - Use W/S to dolly in/out');
    } else if (cameraNumber === 4 && this.camera4) {
      this.camera4.setActive(true);
      this.activeCamera = 4;
      console.log('Switched to Camera 4');
    } else if (cameraNumber === 5 && this.camera5) {
      this.camera5.setActive(true);
      this.activeCamera = 5;
      console.log('Switched to Camera 5');
    } else if (cameraNumber === 6) {
      // Activate camera 6 - which sub-camera depends on activeCamera6Sub
      this.activeCamera = 6;
      this.activateCamera6Sub(this.activeCamera6Sub);
    } else if (cameraNumber === 7 && this.camera7) {
      // Activate camera 7 and start animation
      this.camera7.setActive(true);
      this.activeCamera = 7;
      this.camera7IsAnimating = true;
      this.camera7AnimationProgress = 0;
      this.camera7SideOffset = 0;
      this.camera7HoverTime = 0; // Reset hover time
      // Reset to start position
      this.camera7.setWorldPosition(this.camera7StartPos.clone());
      this.camera7.setTarget(this.camera7Target);
      console.log('Switched to Camera 7 - Animation started');
    } else if (cameraNumber === 8 && this.camera8) {
      // Activate camera 8 - rotatable camera
      this.camera8.setActive(true);
      this.activeCamera = 8;
      console.log('Switched to Camera 8 - Use arrows to rotate');
    } else if (cameraNumber === 9 && this.camera9) {
      // Activate camera 9 - rotatable camera
      this.camera9.setActive(true);
      this.activeCamera = 9;
      console.log('Switched to Camera 9 - Use arrows to rotate');
    }
  }

  /**
   * Switch between camera 6 sub-cameras (a, b, c) using arrow keys
   */
  private switchCamera6Sub(direction: 'left' | 'right'): void {
    const subCameras: Array<'a' | 'b' | 'c'> = ['a', 'b', 'c'];
    const currentIndex = subCameras.indexOf(this.activeCamera6Sub);

    let newIndex: number;
    if (direction === 'left') {
      // Go to previous camera (wrap around: a -> c)
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = subCameras.length - 1;
    } else {
      // Go to next camera (wrap around: c -> a)
      newIndex = currentIndex + 1;
      if (newIndex >= subCameras.length) newIndex = 0;
    }

    const newSubCamera = subCameras[newIndex];
    this.activeCamera6Sub = newSubCamera;
    this.activateCamera6Sub(newSubCamera);
  }

  /**
   * Activate the specified camera 6 sub-camera
   */
  private activateCamera6Sub(subCamera: 'a' | 'b' | 'c'): void {
    // Deactivate all camera 6 sub-cameras
    if (this.camera6a) this.camera6a.setActive(false);
    if (this.camera6b) this.camera6b.setActive(false);
    if (this.camera6c) this.camera6c.setActive(false);

    // Activate the selected sub-camera
    if (subCamera === 'a' && this.camera6a) {
      this.camera6a.setActive(true);
      console.log('Switched to Camera 6a');
    } else if (subCamera === 'b' && this.camera6b) {
      this.camera6b.setActive(true);
      console.log('Switched to Camera 6b');
    } else if (subCamera === 'c' && this.camera6c) {
      this.camera6c.setActive(true);
      console.log('Switched to Camera 6c');
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

  /**
   * Handle camera 7 animation and side movement with drone-like hovering
   */
  private handleCamera7Animation(deltaTime: number): void {
    if (this.activeCamera !== 7 || !this.camera7) return;

    const inputManager = this.world.inputManager;

    // Handle initial animation from start to end position
    if (this.camera7IsAnimating) {
      this.camera7AnimationProgress += this.CAMERA7_ANIMATION_SPEED * deltaTime;
      
      if (this.camera7AnimationProgress >= 1.0) {
        this.camera7AnimationProgress = 1.0;
        this.camera7IsAnimating = false;
        console.log('Camera 7 reached end position - hovering mode activated');
      }

      // Interpolate between start and end positions
      const basePosition = new THREE.Vector3().lerpVectors(
        this.camera7StartPos,
        this.camera7EndPos,
        this.camera7AnimationProgress
      );

      // Apply side offset
      basePosition.x += this.camera7SideOffset;

      this.camera7.setWorldPosition(basePosition);
      this.camera7.setTarget(this.camera7Target);
    } else {
      // After animation is complete, handle side movement and hovering
      
      // Update hover time
      this.camera7HoverTime += deltaTime;
      
      // Calculate hover offset (sine wave for smooth up/down motion)
      const hoverOffset = Math.sin(this.camera7HoverTime * this.CAMERA7_HOVER_SPEED) * this.CAMERA7_HOVER_AMPLITUDE;
      
      // Handle side movement with arrow keys
      let sideMovement = 0;

      if (inputManager.isKeyDown('ArrowLeft')) {
        sideMovement = -this.CAMERA7_SIDE_SPEED * deltaTime;
      }
      if (inputManager.isKeyDown('ArrowRight')) {
        sideMovement = this.CAMERA7_SIDE_SPEED * deltaTime;
      }

      // Update side offset with clamping
      this.camera7SideOffset = THREE.MathUtils.clamp(
        this.camera7SideOffset + sideMovement,
        -this.CAMERA7_MAX_SIDE_OFFSET,
        this.CAMERA7_MAX_SIDE_OFFSET
      );

      // Apply side offset and hover offset to current position
      const currentPos = this.camera7EndPos.clone();
      currentPos.x += this.camera7SideOffset;
      currentPos.y += hoverOffset; // Add hovering motion
      
      this.camera7.setWorldPosition(currentPos);
      this.camera7.setTarget(this.camera7Target);
    }
  }

  /**
   * Handle camera 3 dolly movement (forward/backward with W/S keys)
   */
  private handleCamera3Dolly(deltaTime: number): void {
    if (this.activeCamera !== 3 || !this.camera3) return;

    const inputManager = this.world.inputManager;
    let dollyMovement = 0;

    // W key - move forward (toward target)
    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      dollyMovement = this.CAMERA3_DOLLY_SPEED * deltaTime;
    }

    // S key - move backward (away from target)
    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      dollyMovement = -this.CAMERA3_DOLLY_SPEED * deltaTime;
    }

    if (dollyMovement !== 0) {
      // Update dolly offset with clamping
      this.camera3DollyOffset = THREE.MathUtils.clamp(
        this.camera3DollyOffset + dollyMovement,
        -this.CAMERA3_MAX_DOLLY,
        this.CAMERA3_MAX_DOLLY
      );

      // Calculate direction from camera to target
      const direction = new THREE.Vector3()
        .subVectors(this.camera3Target, this.camera3BasePosition)
        .normalize();

      // Apply dolly offset along the direction
      const newPosition = this.camera3BasePosition.clone();
      newPosition.addScaledVector(direction, this.camera3DollyOffset);

      this.camera3.setWorldPosition(newPosition);
      this.camera3.setTarget(this.camera3Target);
    }
  }
}

export function main(container: HTMLElement, options?: Partial<ENGINE.BaseGameLoopOptions>): ENGINE.IGameLoop {
  const game = new MyGame(container, options);
  return game;
}
