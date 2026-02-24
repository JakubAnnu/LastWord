
import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { FreeCameraPlayer } from './player.js';
import { FixedCamera } from './fixed-camera.js';
import './auto-imports.js';
import './stan-blended-actor.js';

class MyGame extends ENGINE.BaseGameLoop {
  private pawn: FreeCameraPlayer | null = null;
  private controller: ENGINE.PlayerController | null = null;
  private camera1: FixedCamera | null = null;
  private camera2: FixedCamera | null = null;
  private camera3: FixedCamera | null = null;
  private camera4: FixedCamera | null = null;
  private camera5: FixedCamera | null = null;
  private camera6: FixedCamera | null = null;
  private camera7: FixedCamera | null = null;
  private camera8: FixedCamera | null = null;
  private camera9: FixedCamera | null = null;
  private camera10: FixedCamera | null = null;
  private activeCamera: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 = 1;

  // Camera 1 - 3 positions; position 1.1 tracks Stan actor
  private readonly CAMERA1_POSITIONS = [
    new THREE.Vector3(8.37, 2.73, 11.28),
    new THREE.Vector3(-9.8, 2.3, -18.9),
    new THREE.Vector3(-4.4, 2.7, -29.5),
  ];
  private readonly CAMERA1_TARGETS_FIXED = [
    new THREE.Vector3(1.43, 2.15, -3.97),
    new THREE.Vector3(-7.3, 1.48, 1.48),
    new THREE.Vector3(2.9, 1.6, -29.6),
  ];
  private camera1StanTarget: THREE.Vector3 | ENGINE.Actor = new THREE.Vector3(1.43, 2.15, -3.97);
  private activeCamera1Position: number = 0;

  // Camera 6 - single camera cycling through 4 positions with arrow keys
  private readonly CAMERA6_POSITIONS = [
    new THREE.Vector3(2.3, 10.39, -4.1),
    new THREE.Vector3(9.05, 3.04, -14.35),
    new THREE.Vector3(9.07, 3.14, -8.48),
    new THREE.Vector3(9.12, 3.13, -20.79),
  ];
  private readonly CAMERA6_TARGETS = [
    new THREE.Vector3(9.5, 3.57, -11.46),
    new THREE.Vector3(11.08, 2.29, -14.91),
    new THREE.Vector3(10.85, 2.3, -8.48),
    new THREE.Vector3(11.14, 1.98, -20.79),
  ];
  // FOV per position: 40mm≈39° for pos 6.1, 20mm=70° for the rest
  private readonly CAMERA6_FOVS = [39, 70, 70, 70];
  private activeCamera6Position: number = 0;

  // Camera 8 (external) - 4 fixed positions, all pointing at the same target
  private readonly CAMERA8_TARGET = new THREE.Vector3(-0.28, 7.49, -3.57);
  private readonly CAMERA8_POSITIONS = [
    new THREE.Vector3(-45.33, 5.25, -8),
    new THREE.Vector3(-15.92, 1.05, 15.96),
    new THREE.Vector3(21.74, 0.8, 29.1),
    new THREE.Vector3(1.37, 13.38, -3.49),
  ];
  private activeCamera8Position: number = 0;
  // Focal length steps for camera 8: 20mm=70°, 50mm=31°, 80mm=20°
  private readonly CAMERA8_FOCAL_STEPS: Array<{ label: string; fov: number }> = [
    { label: '20mm', fov: 70 },
    { label: '50mm', fov: 31 },
    { label: '80mm', fov: 20 },
  ];
  private camera8FocalIndex: number = 0;

  // Camera 9 (internal) - 4 fixed positions, each with its own target; W/S rotate yaw
  private readonly CAMERA9_POSITIONS = [
    new THREE.Vector3(-1.65, 5.41, 2.22),
    new THREE.Vector3(-1.16, 4.75, -6.51),
    new THREE.Vector3(0.04, 4.77, -5.98),
    new THREE.Vector3(3.53, 5.79, -5.16),
  ];
  private readonly CAMERA9_TARGETS = [
    new THREE.Vector3(0.03, 4.81, 1.35),
    new THREE.Vector3(0.85, 4.35, -8.07),
    new THREE.Vector3(0.04, 3.2, -3.58),
    new THREE.Vector3(3.53, 5.79, -2.14),
  ];
  private activeCamera9Position: number = 0;
  private cameraPositionLabel: HTMLElement | null = null;

  private lastKeyPressTime: { '1': number; '2': number; '3': number; '4': number; '5': number; '6': number; '7': number; '8': number; '9': number; '0': number; 'w': number; 's': number; 'a': number; 'd': number; 'h': number; 'b': number; 'p': number; 'k': number; 'y': number; 'ArrowLeft': number; 'ArrowRight': number; 'ArrowUp': number; 'ArrowDown': number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '0': 0, 'w': 0, 's': 0, 'a': 0, 'd': 0, 'h': 0, 'b': 0, 'p': 0, 'k': 0, 'y': 0, 'ArrowLeft': 0, 'ArrowRight': 0, 'ArrowUp': 0, 'ArrowDown': 0 };
  private readonly KEY_PRESS_COOLDOWN = 200; // milliseconds
  // H key: move all hills to their target X over 30 seconds
  private readonly HILLS_MOVE_DURATION = 240;

  private hill1Actor: ENGINE.Actor | null = null;
  private readonly HILL1_START_X = 700;
  private readonly HILL1_TARGET_X = -560;
  private hill1MoveStartPos = new THREE.Vector3();
  private hill1MoveTargetPos = new THREE.Vector3();
  private hill1MoveProgress = 0;
  private hill1IsMoving = false;

  private hill2Actor: ENGINE.Actor | null = null;
  private readonly HILL2_START_X = 630;
  private readonly HILL2_TARGET_X = -590;
  private hill2MoveStartPos = new THREE.Vector3();
  private hill2MoveTargetPos = new THREE.Vector3();
  private hill2MoveProgress = 0;
  private hill2IsMoving = false;

  // hill2 Y: starts at y=-61.98, reaches y=-98.16 exactly when x=113.48, stays there after
  private readonly HILL2_START_Y = -61.98;
  private readonly HILL2_DESCENT_TARGET_Y = -98.16;
  private readonly HILL2_DESCENT_TRIGGER_X = 113.48;

  private hill3Actor: ENGINE.Actor | null = null;
  private readonly HILL3_START_X = 530;
  private readonly HILL3_TARGET_X = -590;
  private hill3MoveStartPos = new THREE.Vector3();
  private hill3MoveTargetPos = new THREE.Vector3();
  private hill3MoveProgress = 0;
  private hill3IsMoving = false;

  private hill4Actor: ENGINE.Actor | null = null;
  private readonly HILL4_START_X = 1043.47;
  private readonly HILL4_TARGET_X = -799.72;
  private hill4MoveStartPos = new THREE.Vector3();
  private hill4MoveTargetPos = new THREE.Vector3();
  private hill4MoveProgress = 0;
  private hill4IsMoving = false;

  // B key: raise all barriers (any actor with displayName starting with "barrier") from y=-2.16 to y=3.59 over 12 seconds
  private readonly BARRIER_START_Y = -2.16;
  private readonly BARRIER_TARGET_Y = 3.59;
  private readonly BARRIER_RISE_DURATION = 12;
  private barrierActors: ENGINE.Actor[] = [];
  private barrierRiseStartY: number[] = [];
  private barrierRiseProgress = 0;
  private barrierIsRising = false;

  // P key: toggle smooth random scale animation on "print" model (scale 0.1–0.5 per axis)
  private printActor: ENGINE.Actor | null = null;
  private printScaleActive = false;
  private printCurrentScale = new THREE.Vector3(0.41, 0.18, 0.3);
  private printScaleTarget = new THREE.Vector3(0.41, 0.18, 0.3);
  private readonly PRINT_SCALE_MIN = 0.1;
  private readonly PRINT_SCALE_MAX = 0.5;
  private readonly PRINT_SCALE_SPEED = 0.25; // units per second — controls smoothness

  // Y key: raise all "bubble"/"bubbel" models by 0.60, each with independent random delay
  private readonly BUBBLE_RISE_OFFSET = 0.60;
  private readonly BUBBLE_RISE_DURATION = 4; // seconds per actor (50% slower than before)
  private readonly BUBBLE_MAX_DELAY = 2.5; // max random start delay in seconds
  private bubbleStates: Array<{
    actor: ENGINE.Actor;
    originY: number; // oryginalna pozycja Y — stała przez cały czas
    startY: number;
    delay: number;   // seconds to wait before starting
    elapsed: number; // total elapsed since Y pressed
    done: boolean;
  }> = [];
  private bubbleActive = false;

  // print_02: same P-key animation with independent random state
  private print2Actor: ENGINE.Actor | null = null;
  private print2CurrentScale = new THREE.Vector3(0.41, 0.18, 0.3);
  private print2ScaleTarget = new THREE.Vector3(0.41, 0.18, 0.3);

  // K key: "generator" sequence — slider → coal → (coal + door + slider simultaneously)
  private genSliderActor: ENGINE.Actor | null = null;
  private genCoalActor: ENGINE.Actor | null = null;
  private genDoorActor: ENGINE.Actor | null = null;

  // Step durations (seconds)
  private readonly GEN_STEP1_DURATION = 2.4;  // slider slides in
  private readonly GEN_STEP2_DURATION = 1.8;  // coal moves in
  private readonly GEN_STEP3_DURATION = 1.0;  // coal holds position (pause)
  private readonly GEN_STEP4_DURATION = 4.8;  // all three move simultaneously

  // Step 1: slider (3.3,2.8,-29.58) → (0.3,1.84,-29.58)
  private readonly GEN_SLIDER_STEP1_START = new THREE.Vector3(0.3, 2.8, -29.58);
  private readonly GEN_SLIDER_STEP1_END   = new THREE.Vector3(0.3, 1.79, -29.58);
  // Step 2: coal (0.6,1.52,-31.8) → (0.6,1.52,-29.55)
  private readonly GEN_COAL_STEP2_START   = new THREE.Vector3(0.6, 1.52, -31.8);
  private readonly GEN_COAL_STEP2_END     = new THREE.Vector3(0.6, 1.52, -29.55);
  // Step 3: coal → (4.92,1.52,-29.55)
  private readonly GEN_COAL_STEP3_END     = new THREE.Vector3(4.92, 1.52, -29.55);
  // Step 3: door (3.3,2.19,-29.58) → (3.3,2.98,-29.58)
  private readonly GEN_DOOR_STEP3_START   = new THREE.Vector3(3.3, 2.21, -29.58);
  private readonly GEN_DOOR_STEP3_END     = new THREE.Vector3(3.3, 2.98, -29.58);
  // Step 3: slider (0.3,1.84,-29.58) → (3.3,2.8,-29.58)
  // Slider returns to its original start position (no pause — starts during step 3)
  private readonly GEN_SLIDER_RETURN_DURATION = 3.0;

  // State machine: 0=idle, 1=step1, 2=step2, 3=step3
  private readonly GEN_DOOR_SPEED_MULT = 1.4;          // door 40% faster
  private readonly GEN_COAL_DOOR_TRIGGER_X = 3.25;     // coal X that triggers door close
  private readonly GEN_DOOR_CLOSE_DURATION = 4 / 1.4;  // same speed as opening

  private genStep = 0;
  private genProgress = 0;
  private genStep3SliderStart = new THREE.Vector3();
  private genActive = false;
  private genSliderReturnActive = false;
  private genSliderReturnProgress = 0;
  private genSliderReturnStartPos = new THREE.Vector3();
  private genStep3CoalStart = new THREE.Vector3();
  private genDoorClosing = false;
  private genDoorCloseProgress = 0;
  private genDoorCloseStartPos = new THREE.Vector3();

  // Camera 10 focal length toggle
  private camera10FocalLength: '20mm' | '120mm' = '20mm'; // Start at 20mm (FOV 70°)
  
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
    // Create first camera at position (x:8.37, y:2.73, z:11.28)
    // pointing at Stan model at (x:1.43, y:2.15, z:-3.97)
    const camera1Position = new THREE.Vector3(8.37, 2.73, 11.28);
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
    
    // Camera 6 - single camera cycling through 4 positions with arrow keys
    this.camera6 = FixedCamera.create({
      position: this.CAMERA6_POSITIONS[0].clone(),
      startActive: false,
      fov: this.CAMERA6_FOVS[0],
      enableRotationControl: false,
    });
    this.camera6.setTarget(this.CAMERA6_TARGETS[0]);
    
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
    
    // Camera 8 (zewnętrzna) - cycles through 4 fixed positions with arrow keys
    // All positions point at the same fixed target
    this.camera8 = FixedCamera.create({ 
      position: this.CAMERA8_POSITIONS[0].clone(), 
      startActive: false,
      fov: 70,
      enableRotationControl: false
    });
    this.camera8.setTarget(this.CAMERA8_TARGET);
    
    // Camera 9 (wewnętrzna) - cycles through 4 positions with arrow keys; W/S rotate yaw
    this.camera9 = FixedCamera.create({
      position: this.CAMERA9_POSITIONS[0].clone(),
      startActive: false,
      fov: 70,
      enableRotationControl: false,
      enableWSYawControl: true,
    });
    this.camera9.setTarget(this.CAMERA9_TARGETS[0]);
    
    // Camera 10 - focal length toggle camera with W/S keys
    // Position: (x:0.11, y:5.16, z:0.86)
    // Points at: (x:0.11, y:4.34, z:2.46)
    // W/S keys toggle between 20mm (FOV 70°) and 120mm (FOV 11.5°)
    const camera10Position = new THREE.Vector3(0.11, 5.16, 0.86);
    const camera10Target = new THREE.Vector3(0.11, 4.34, 2.46);
    this.camera10 = FixedCamera.create({ 
      position: camera10Position, 
      startActive: false,
      fov: 70, // Start at 20mm (70° FOV)
      enableRotationControl: false,
      enableZoom: false // Will handle focal length toggle manually
    });
    this.camera10.setTarget(camera10Target);
    
    // Add all cameras to the world
    this.world.addActors(this.camera1, this.camera2, this.camera3, this.camera4, this.camera5, this.camera6, this.camera7, this.camera8, this.camera9, this.camera10);
    
    // Wait for the level to load completely
    this.createCameraPositionLabel();
    await this.waitForLevelLoad();
    
    // Try to find Stan actor for camera 1
    let stanActor = this.findActorByName('Stan');
    
    // If not found by name, try to find it by proximity to expected position
    if (!stanActor) {
      stanActor = this.findActorNearPosition(stanPosition, 1.0); // within 1 unit
    }
    
    if (stanActor) {
      console.log(`Found Stan actor: ${stanActor.name}`);
      this.camera1StanTarget = stanActor;
    } else {
      console.warn('Stan actor not found, pointing camera 1 at expected position');
    }
    this.camera1.setTarget(this.camera1StanTarget);

    // Stan_Blended at (10.07, 0.6, 10.19) with farming animation
    const stanBlended = ENGINE.ClassRegistry.constructObject('GAME.StanBlendedActor', false) as ENGINE.Actor;
    this.world.addActors(stanBlended);

    // Second animated Stan at (0.94, 4.91, 2.29)
    const stanBlended2 = ENGINE.ClassRegistry.constructObject(
      'GAME.StanBlendedActor',
      false,
      new THREE.Vector3(0.94, 4.91, 2.29)
    ) as ENGINE.Actor;
    this.world.addActors(stanBlended2);

    this.hill1Actor = this.findActorByDisplayName('hill1') ?? this.findActorByName('hill1');
    if (this.hill1Actor) {
      const pos = this.hill1Actor.getWorldPosition();
      pos.x = this.HILL1_START_X;
      this.hill1Actor.setWorldPosition(pos);
    }

    this.hill2Actor = this.findActorByDisplayName('hill2') ?? this.findActorByName('hill2');
    if (this.hill2Actor) {
      const pos = this.hill2Actor.getWorldPosition();
      pos.x = this.HILL2_START_X;
      pos.y = this.HILL2_START_Y;
      this.hill2Actor.setWorldPosition(pos);
    }

    this.hill3Actor = this.findActorByDisplayName('hill3') ?? this.findActorByName('hill3');
    if (this.hill3Actor) {
      const pos = this.hill3Actor.getWorldPosition();
      pos.x = this.HILL3_START_X;
      this.hill3Actor.setWorldPosition(pos);
    }

    this.hill4Actor = this.findActorByDisplayName('hill4') ?? this.findActorByName('hill4');
    if (this.hill4Actor) {
      const pos = this.hill4Actor.getWorldPosition();
      pos.x = this.HILL4_START_X;
      this.hill4Actor.setWorldPosition(pos);
    }

    this.barrierActors = this.findActorsByDisplayNamePrefix('barrier');
    for (const actor of this.barrierActors) {
      const pos = actor.getWorldPosition();
      pos.y = this.BARRIER_START_Y;
      actor.setWorldPosition(pos);
    }

    this.printActor = this.findActorByDisplayName('print') ?? this.findActorByName('print');
    if (this.printActor) {
      this.printActor.setWorldScale(this.printCurrentScale.clone());
    }

    this.print2Actor = this.findActorByDisplayName('print_02') ?? this.findActorByName('print_02');
    if (this.print2Actor) {
      this.print2Actor.setWorldScale(this.print2CurrentScale.clone());
    }

    this.genSliderActor = this.findActorByDisplayName('slider') ?? this.findActorByDisplayName('slider_02');
    this.genCoalActor   = this.findActorByDisplayName('coal')   ?? this.findActorByName('coal');
    this.genDoorActor   = this.findActorByDisplayName('door')   ?? this.findActorByName('door');

    if (this.genSliderActor) this.genSliderActor.setWorldPosition(this.GEN_SLIDER_STEP1_START.clone());
    if (this.genCoalActor)   this.genCoalActor.setWorldPosition(this.GEN_COAL_STEP2_START.clone());
    if (this.genDoorActor)   this.genDoorActor.setWorldPosition(this.GEN_DOOR_STEP3_START.clone());
  }

  protected override tick(tickTime: ENGINE.TickTime): void {
    super.tick(tickTime);
    this.handleCameraSwitching();
    this.handleCamera7Animation(tickTime.deltaTimeMS / 1000);
    this.handleCamera3Dolly(tickTime.deltaTimeMS / 1000);
    this.handleCamera8FocalSwitch();
    this.handleCamera10FocalToggle();
    this.handleHillsMove(tickTime.deltaTimeMS / 1000);
    this.handleBarrierRise(tickTime.deltaTimeMS / 1000);
    this.handlePrintScale(tickTime.deltaTimeMS / 1000);
    this.handleGeneratorSequence(tickTime.deltaTimeMS / 1000);
    this.handleBubbleRise(tickTime.deltaTimeMS / 1000);
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

    // Check for key '0' press
    if (inputManager.isKeyDown('0') && this.activeCamera !== 10) {
      if (currentTime - this.lastKeyPressTime['0'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(10);
        this.lastKeyPressTime['0'] = currentTime;
      }
    }

    // Handle A/D keys for position cycling across cameras 1, 6, 8, 9
    const switchLeft =
      (inputManager.isKeyDown('a') || inputManager.isKeyDown('A')) &&
      currentTime - this.lastKeyPressTime['a'] > this.KEY_PRESS_COOLDOWN;
    const switchRight =
      (inputManager.isKeyDown('d') || inputManager.isKeyDown('D')) &&
      currentTime - this.lastKeyPressTime['d'] > this.KEY_PRESS_COOLDOWN;

    if (switchLeft || switchRight) {
      const dir = switchLeft ? 'left' : 'right';
      if (switchLeft) this.lastKeyPressTime['a'] = currentTime;
      if (switchRight) this.lastKeyPressTime['d'] = currentTime;

      if (this.activeCamera === 1) this.switchCamera1Position(dir);
      else if (this.activeCamera === 6) this.switchCamera6Position(dir);
      else if (this.activeCamera === 8) this.switchCamera8Position(dir);
      else if (this.activeCamera === 9) this.switchCamera9Position(dir);
    }
  }

  /**
   * Switch to the specified camera
   */
  private switchToCamera(cameraNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10): void {
    // Deactivate all cameras first
    if (this.camera1) this.camera1.setActive(false);
    if (this.camera2) this.camera2.setActive(false);
    if (this.camera3) this.camera3.setActive(false);
    if (this.camera4) this.camera4.setActive(false);
    if (this.camera5) this.camera5.setActive(false);
    if (this.camera6) this.camera6.setActive(false);
    if (this.camera7) this.camera7.setActive(false);
    if (this.camera8) this.camera8.setActive(false);
    if (this.camera9) this.camera9.setActive(false);
    if (this.camera10) this.camera10.setActive(false);

    // Activate the selected camera
    if (cameraNumber === 1 && this.camera1) {
      this.camera1.setActive(true);
      this.activeCamera = 1;
      this.activeCamera1Position = 0;
      this.camera1.setWorldPosition(this.CAMERA1_POSITIONS[0].clone());
      this.camera1.setTarget(this.camera1StanTarget);
      console.log('Switched to Camera 1 - position 1.1 - Use arrows to cycle positions');
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
    } else if (cameraNumber === 6 && this.camera6) {
      this.camera6.setActive(true);
      this.activeCamera = 6;
      this.activeCamera6Position = 0;
      this.camera6.setWorldPosition(this.CAMERA6_POSITIONS[0].clone());
      this.camera6.setTarget(this.CAMERA6_TARGETS[0]);
      this.camera6.setFOV(this.CAMERA6_FOVS[0]);
      console.log('Switched to Camera 6 - position 6.1 - Use arrows to cycle positions');
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
      this.camera8.setActive(true);
      this.activeCamera = 8;
      this.activeCamera8Position = 0;
      this.camera8FocalIndex = 0;
      this.camera8.setWorldPosition(this.CAMERA8_POSITIONS[0].clone());
      this.camera8.setTarget(this.CAMERA8_TARGET);
      this.camera8.setFOV(this.CAMERA8_FOCAL_STEPS[0].fov);
      console.log('Switched to Camera 8 (zewnętrzna) - position 8.1 - arrows: cycle positions, W/S: focal length');
    } else if (cameraNumber === 9 && this.camera9) {
      this.camera9.setActive(true);
      this.activeCamera = 9;
      this.activeCamera9Position = 0;
      this.camera9.setWorldPosition(this.CAMERA9_POSITIONS[0].clone());
      this.camera9.setTarget(this.CAMERA9_TARGETS[0]);
      this.camera9.resetRotationOffsets();
      console.log('Switched to Camera 9 (wewnętrzna) - position 9.1 - Use arrows to cycle, A/D to rotate');
    } else if (cameraNumber === 10 && this.camera10) {
      this.camera10.setActive(true);
      this.activeCamera = 10;
      console.log('Switched to Camera 10 - Use W/S to toggle focal length (20mm/120mm)');
    }

    this.updateCameraPositionLabel();
  }

  /**
   * Cycle camera 1 through its 3 fixed positions using arrow keys.
   * Position 1.1 uses the Stan actor as target (or fallback Vector3).
   */
  private switchCamera1Position(direction: 'left' | 'right'): void {
    if (!this.camera1) return;

    const count = this.CAMERA1_POSITIONS.length;
    if (direction === 'left') {
      this.activeCamera1Position = (this.activeCamera1Position - 1 + count) % count;
    } else {
      this.activeCamera1Position = (this.activeCamera1Position + 1) % count;
    }

    const pos = this.CAMERA1_POSITIONS[this.activeCamera1Position];
    const target = this.activeCamera1Position === 0
      ? this.camera1StanTarget
      : this.CAMERA1_TARGETS_FIXED[this.activeCamera1Position];

    this.camera1.setWorldPosition(pos.clone());
    this.camera1.setTarget(target);
    this.updateCameraPositionLabel();
    console.log(`Camera 1 - position 1.${this.activeCamera1Position + 1}`);
  }

  /**
   * Cycle camera 6 through its 4 fixed positions using arrow keys
   */
  private switchCamera6Position(direction: 'left' | 'right'): void {
    if (!this.camera6) return;

    const count = this.CAMERA6_POSITIONS.length;
    if (direction === 'left') {
      this.activeCamera6Position = (this.activeCamera6Position - 1 + count) % count;
    } else {
      this.activeCamera6Position = (this.activeCamera6Position + 1) % count;
    }

    const pos = this.CAMERA6_POSITIONS[this.activeCamera6Position];
    const target = this.CAMERA6_TARGETS[this.activeCamera6Position];
    const fov = this.CAMERA6_FOVS[this.activeCamera6Position];
    this.camera6.setWorldPosition(pos.clone());
    this.camera6.setTarget(target);
    this.camera6.setFOV(fov);
    this.updateCameraPositionLabel();
    console.log(`Camera 6 - position 6.${this.activeCamera6Position + 1}`);
  }

  /**
   * Cycle camera 8 (external) through its 4 fixed positions using arrow keys
   */
  private switchCamera8Position(direction: 'left' | 'right'): void {
    if (!this.camera8) return;

    const count = this.CAMERA8_POSITIONS.length;
    if (direction === 'left') {
      this.activeCamera8Position = (this.activeCamera8Position - 1 + count) % count;
    } else {
      this.activeCamera8Position = (this.activeCamera8Position + 1) % count;
    }

    const pos = this.CAMERA8_POSITIONS[this.activeCamera8Position];
    this.camera8.setWorldPosition(pos.clone());
    this.camera8.setTarget(this.CAMERA8_TARGET);
    this.updateCameraPositionLabel();
    console.log(`Camera 8 (zewnętrzna) - position 8.${this.activeCamera8Position + 1}`);
  }

  /**
   * Cycle camera 9 (internal) through its 4 fixed positions using arrow keys.
   * Resets yaw rotation on each position change.
   */
  private switchCamera9Position(direction: 'left' | 'right'): void {
    if (!this.camera9) return;

    const count = this.CAMERA9_POSITIONS.length;
    if (direction === 'left') {
      this.activeCamera9Position = (this.activeCamera9Position - 1 + count) % count;
    } else {
      this.activeCamera9Position = (this.activeCamera9Position + 1) % count;
    }

    const pos = this.CAMERA9_POSITIONS[this.activeCamera9Position];
    const target = this.CAMERA9_TARGETS[this.activeCamera9Position];
    this.camera9.setWorldPosition(pos.clone());
    this.camera9.setTarget(target);
    this.camera9.resetRotationOffsets();
    this.updateCameraPositionLabel();
    console.log(`Camera 9 (wewnętrzna) - position 9.${this.activeCamera9Position + 1}`);
  }

  /**
   * Create the bottom-left camera position label UI element
   */
  private createCameraPositionLabel(): void {
    const label = document.createElement('div');
    label.style.cssText = [
      'position: absolute',
      'bottom: 24px',
      'left: 24px',
      'color: white',
      'font-family: monospace',
      'font-size: 32px',
      'font-weight: bold',
      'letter-spacing: 3px',
      'text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
      'display: none',
      'pointer-events: none',
      'user-select: none',
    ].join(';');
    this.world.gameContainer?.appendChild(label);
    this.cameraPositionLabel = label;
  }

  /**
   * Update the camera position label text and visibility
   */
  private updateCameraPositionLabel(): void {
    if (!this.cameraPositionLabel) return;

    let text = '';
    switch (this.activeCamera) {
      case 1:  text = `1.${this.activeCamera1Position + 1}`;  break;
      case 2:  text = '2';  break;
      case 3:  text = '3';  break;
      case 4:  text = '4';  break;
      case 5:  text = '5';  break;
      case 6:  text = `6.${this.activeCamera6Position + 1}`;  break;
      case 7:  text = '7';  break;
      case 8:  text = `8.${this.activeCamera8Position + 1}`;  break;
      case 9:  text = `9.${this.activeCamera9Position + 1}`;  break;
      case 10: text = '10'; break;
    }

    this.cameraPositionLabel.textContent = text;
    this.cameraPositionLabel.style.display = text ? 'block' : 'none';
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
   * Find all actors whose editor displayName starts with the given prefix (case-insensitive).
   */
  private findActorsByDisplayNamePrefix(prefix: string): ENGINE.Actor[] {
    const key = prefix.toLowerCase();
    return this.world.getActors().filter(actor => {
      const ed = (actor as unknown as { editorData?: { displayName?: string } }).editorData;
      return ed?.displayName?.toLowerCase().startsWith(key);
    });
  }

  /**
   * Find an actor by editor display name (exact match, case-insensitive).
   * Use for actors placed in the scene editor (displayName in .genesys-scene).
   */
  private findActorByDisplayName(displayName: string): ENGINE.Actor | null {
    const key = displayName.toLowerCase();
    const actors = this.world.getActors();
    return actors.find(actor => {
      const ed = (actor as unknown as { editorData?: { displayName?: string } }).editorData;
      return ed?.displayName?.toLowerCase() === key;
    }) ?? null;
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

  /**
   * Handle camera 8 focal length stepping: W = longer focal (narrower), S = shorter focal (wider)
   * Steps: 20mm (70°) → 50mm (31°) → 80mm (20°)
   */
  private handleCamera8FocalSwitch(): void {
    if (!this.camera8 || this.activeCamera !== 8) return;

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    // W key - step to longer focal length (narrower FOV)
    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      if (currentTime - this.lastKeyPressTime['w'] > this.KEY_PRESS_COOLDOWN) {
        this.lastKeyPressTime['w'] = currentTime;
        const next = Math.min(this.camera8FocalIndex + 1, this.CAMERA8_FOCAL_STEPS.length - 1);
        if (next !== this.camera8FocalIndex) {
          this.camera8FocalIndex = next;
          const step = this.CAMERA8_FOCAL_STEPS[this.camera8FocalIndex];
          this.camera8.setFOV(step.fov);
          console.log(`Camera 8: ${step.label} (FOV ${step.fov}°)`);
        }
      }
    }

    // S key - step to shorter focal length (wider FOV)
    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      if (currentTime - this.lastKeyPressTime['s'] > this.KEY_PRESS_COOLDOWN) {
        this.lastKeyPressTime['s'] = currentTime;
        const prev = Math.max(this.camera8FocalIndex - 1, 0);
        if (prev !== this.camera8FocalIndex) {
          this.camera8FocalIndex = prev;
          const step = this.CAMERA8_FOCAL_STEPS[this.camera8FocalIndex];
          this.camera8.setFOV(step.fov);
          console.log(`Camera 8: ${step.label} (FOV ${step.fov}°)`);
        }
      }
    }
  }

  /**
   * Handle camera 10 focal length toggle (W/S keys for instant switch between 20mm and 70mm)
   */
  private handleCamera10FocalToggle(): void {
    if (!this.camera10 || this.activeCamera !== 10) return;

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    // W key - switch to 120mm (FOV 11.5°)
    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      if (currentTime - this.lastKeyPressTime['w'] > this.KEY_PRESS_COOLDOWN) {
        if (this.camera10FocalLength !== '120mm') {
          this.camera10FocalLength = '120mm';
          this.camera10.setFOV(11.5); // 120mm focal length ≈ 11.5° FOV
          console.log('Camera 10: Switched to 120mm (FOV 11.5°)');
        }
        this.lastKeyPressTime['w'] = currentTime;
      }
    }

    // S key - switch to 20mm (FOV 70°)
    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      if (currentTime - this.lastKeyPressTime['s'] > this.KEY_PRESS_COOLDOWN) {
        if (this.camera10FocalLength !== '20mm') {
          this.camera10FocalLength = '20mm';
          this.camera10.setFOV(70); // 20mm focal length = 70° FOV
          console.log('Camera 10: Switched to 20mm (FOV 70°)');
        }
        this.lastKeyPressTime['s'] = currentTime;
      }
    }
  }

  /**
   * H key: start moving all hills to their target X positions over 30 seconds.
   */
  private handleHillsMove(deltaTime: number): void {
    const inputManager = this.world.inputManager;
    const currentTime = performance.now();
    const hPressed = (inputManager.isKeyDown('h') || inputManager.isKeyDown('H'))
      && currentTime - this.lastKeyPressTime['h'] > this.KEY_PRESS_COOLDOWN;

    if (hPressed) this.lastKeyPressTime['h'] = currentTime;

    this.tickHill(
      'hill1', this.hill1Actor, this.HILL1_TARGET_X, deltaTime, hPressed,
      this.hill1MoveStartPos, this.hill1MoveTargetPos,
      () => this.hill1MoveProgress, (v) => { this.hill1MoveProgress = v; },
      () => this.hill1IsMoving, (v) => { this.hill1IsMoving = v; }
    );
    this.tickHill(
      'hill2', this.hill2Actor, this.HILL2_TARGET_X, deltaTime, hPressed,
      this.hill2MoveStartPos, this.hill2MoveTargetPos,
      () => this.hill2MoveProgress, (v) => { this.hill2MoveProgress = v; },
      () => this.hill2IsMoving, (v) => { this.hill2IsMoving = v; }
    );
    this.handleHill2YDescent(deltaTime);
    this.tickHill(
      'hill3', this.hill3Actor, this.HILL3_TARGET_X, deltaTime, hPressed,
      this.hill3MoveStartPos, this.hill3MoveTargetPos,
      () => this.hill3MoveProgress, (v) => { this.hill3MoveProgress = v; },
      () => this.hill3IsMoving, (v) => { this.hill3IsMoving = v; }
    );
    this.tickHill(
      'hill4', this.hill4Actor, this.HILL4_TARGET_X, deltaTime, hPressed,
      this.hill4MoveStartPos, this.hill4MoveTargetPos,
      () => this.hill4MoveProgress, (v) => { this.hill4MoveProgress = v; },
      () => this.hill4IsMoving, (v) => { this.hill4IsMoving = v; }
    );
  }

  /**
   * hill2 Y: lerps from y=-61.98 to y=-98.16 proportionally to X progress,
   * reaching -98.16 exactly at x=113.48, then stays there.
   */
  private handleHill2YDescent(_deltaTime: number): void {
    if (!this.hill2Actor) return;
    if (!this.hill2IsMoving && this.hill2MoveProgress <= 0) return;

    const triggerProgress = (this.HILL2_START_X - this.HILL2_DESCENT_TRIGGER_X)
      / (this.HILL2_START_X - this.HILL2_TARGET_X);
    const yProgress = Math.min(this.hill2MoveProgress / triggerProgress, 1);
    const newY = this.HILL2_START_Y + (this.HILL2_DESCENT_TARGET_Y - this.HILL2_START_Y) * yProgress;

    const pos = this.hill2Actor.getWorldPosition();
    pos.y = newY;
    this.hill2Actor.setWorldPosition(pos);
  }

  /**
   * B key: raise all barriers from y=-2.16 to y=3.59 over 7 seconds.
   */
  private handleBarrierRise(deltaTime: number): void {
    if (this.barrierActors.length === 0) {
      this.barrierActors = this.findActorsByDisplayNamePrefix('barrier');
    }
    if (this.barrierActors.length === 0) return;

    if (this.barrierIsRising) {
      this.barrierRiseProgress = Math.min(this.barrierRiseProgress + deltaTime / this.BARRIER_RISE_DURATION, 1);
      const t = this.barrierRiseProgress;
      for (let i = 0; i < this.barrierActors.length; i++) {
        const actor = this.barrierActors[i];
        const startY = this.barrierRiseStartY[i];
        const currentY = startY + (this.BARRIER_TARGET_Y - startY) * t;
        const pos = actor.getWorldPosition();
        pos.y = currentY;
        actor.setWorldPosition(pos);
      }
      if (this.barrierRiseProgress >= 1) {
        this.barrierIsRising = false;
      }
      return;
    }

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();
    if ((inputManager.isKeyDown('b') || inputManager.isKeyDown('B'))
      && currentTime - this.lastKeyPressTime['b'] > this.KEY_PRESS_COOLDOWN) {
      this.lastKeyPressTime['b'] = currentTime;
      this.barrierRiseStartY = this.barrierActors.map(a => a.getWorldPosition().y);
      this.barrierRiseProgress = 0;
      this.barrierIsRising = true;
    }
  }

  /**
   * P key: toggle smooth random scale animation on "print" model.
   * Each axis moves continuously toward a random target in range [0.1, 0.5].
   * When target is reached, a new random target is chosen (at least one axis up, one down).
   */
  private handlePrintScale(deltaTime: number): void {
    if (!this.printActor) {
      this.printActor = this.findActorByDisplayName('print') ?? this.findActorByName('print');
    }
    if (!this.print2Actor) {
      this.print2Actor = this.findActorByDisplayName('print_02') ?? this.findActorByName('print_02');
    }

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();
    if ((inputManager.isKeyDown('p') || inputManager.isKeyDown('P'))
      && currentTime - this.lastKeyPressTime['p'] > this.KEY_PRESS_COOLDOWN) {
      this.lastKeyPressTime['p'] = currentTime;
      this.printScaleActive = !this.printScaleActive;
      if (this.printScaleActive) {
        this.pickNewPrintScaleTarget(this.printCurrentScale, this.printScaleTarget);
        this.pickNewPrintScaleTarget(this.print2CurrentScale, this.print2ScaleTarget);
      }
    }

    if (!this.printScaleActive) return;

    const move = this.PRINT_SCALE_SPEED * deltaTime;

    if (this.printActor) {
      const allReached = this.tickPrintScale(this.printCurrentScale, this.printScaleTarget, move);
      if (allReached) this.pickNewPrintScaleTarget(this.printCurrentScale, this.printScaleTarget);
      this.printActor.setWorldScale(this.printCurrentScale.clone());
    }

    if (this.print2Actor) {
      const allReached = this.tickPrintScale(this.print2CurrentScale, this.print2ScaleTarget, move);
      if (allReached) this.pickNewPrintScaleTarget(this.print2CurrentScale, this.print2ScaleTarget);
      this.print2Actor.setWorldScale(this.print2CurrentScale.clone());
    }
  }

  private tickPrintScale(current: THREE.Vector3, target: THREE.Vector3, move: number): boolean {
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    let allReached = true;
    for (const axis of axes) {
      const diff = target[axis] - current[axis];
      if (Math.abs(diff) > 0.005) {
        allReached = false;
        current[axis] += Math.sign(diff) * Math.min(Math.abs(diff), move);
      } else {
        current[axis] = target[axis];
      }
    }
    return allReached;
  }

  private pickNewPrintScaleTarget(cur: THREE.Vector3, target: THREE.Vector3): void {
    const min = this.PRINT_SCALE_MIN;
    const max = this.PRINT_SCALE_MAX;
    const rand = () => min + Math.random() * (max - min);

    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    for (let i = axes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [axes[i], axes[j]] = [axes[j], axes[i]];
    }

    target[axes[0]] = cur[axes[0]] < max ? cur[axes[0]] + Math.random() * (max - cur[axes[0]]) : rand();
    target[axes[1]] = cur[axes[1]] > min ? min + Math.random() * (cur[axes[1]] - min) : rand();
    target[axes[2]] = rand();

    for (const axis of axes) {
      target[axis] = Math.max(min, Math.min(max, target[axis]));
    }
  }

  /**
   * K key: "generator" sequence.
   * Step 1: slider slides to loading position.
   * Step 2: coal moves in.
   * Step 3: coal holds position (1 s pause).
   * Step 4: coal moves out, door opens, slider returns — simultaneously.
   */
  private handleGeneratorSequence(deltaTime: number): void {
    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    if ((inputManager.isKeyDown('k') || inputManager.isKeyDown('K'))
      && currentTime - this.lastKeyPressTime['k'] > this.KEY_PRESS_COOLDOWN) {
      this.lastKeyPressTime['k'] = currentTime;

      if (!this.genActive) {
        // Start looping sequence
        this.genActive = true;
        this.genStartLoop();
      } else {
        // Stop sequence and reset
        this.genActive = false;
        this.genStep = 0;
        this.genProgress = 0;
        this.genSliderReturnActive = false;
        this.genSliderReturnProgress = 0;
        this.genDoorClosing = false;
        this.genDoorCloseProgress = 0;
        if (this.genSliderActor) this.genSliderActor.setWorldPosition(this.GEN_SLIDER_STEP1_START.clone());
        if (this.genCoalActor)   this.genCoalActor.setWorldPosition(this.GEN_COAL_STEP2_START.clone());
        if (this.genDoorActor)   this.genDoorActor.setWorldPosition(this.GEN_DOOR_STEP3_START.clone());
      }
    }

    if (!this.genActive || this.genStep === 0) return;

    this.genProgress += deltaTime / this.genCurrentDuration();
    const t = Math.min(this.genProgress, 1);
    this.applyGenStep(t);

    // Slider return: starts at step 3, runs independently through step 3+4
    if (this.genSliderReturnActive && this.genSliderActor) {
      this.genSliderReturnProgress = Math.min(
        this.genSliderReturnProgress + deltaTime / this.GEN_SLIDER_RETURN_DURATION, 1
      );
      this.genSliderActor.setWorldPosition(
        new THREE.Vector3().lerpVectors(
          this.genSliderReturnStartPos, this.GEN_SLIDER_STEP1_START, this.genSliderReturnProgress
        )
      );
      if (this.genSliderReturnProgress >= 1) this.genSliderReturnActive = false;
    }

    // Step 4: door 40% faster + close when coal passes x=3.25
    if (this.genStep === 4) {
      if (!this.genDoorClosing && this.genCoalActor) {
        const coalX = this.genCoalActor.getWorldPosition().x;
        if (coalX >= this.GEN_COAL_DOOR_TRIGGER_X) {
          this.genDoorClosing = true;
          this.genDoorCloseProgress = 0;
          if (this.genDoorActor) this.genDoorCloseStartPos.copy(this.genDoorActor.getWorldPosition());
        }
      }

      if (this.genDoorClosing && this.genDoorActor) {
        this.genDoorCloseProgress = Math.min(
          this.genDoorCloseProgress + deltaTime / this.GEN_DOOR_CLOSE_DURATION, 1
        );
        this.genDoorActor.setWorldPosition(
          new THREE.Vector3().lerpVectors(
            this.genDoorCloseStartPos, this.GEN_DOOR_STEP3_START, this.genDoorCloseProgress
          )
        );
      }
    }

    if (this.genProgress >= 1) {
      if (this.genStep < 4) {
        this.genStep++;
        this.genProgress = 0;
        if (this.genStep === 3) {
          this.genSliderReturnActive = true;
          this.genSliderReturnProgress = 0;
          if (this.genSliderActor) this.genSliderReturnStartPos.copy(this.genSliderActor.getWorldPosition());
        }
        if (this.genStep === 4) {
          this.genDoorClosing = false;
          this.genDoorCloseProgress = 0;
          if (this.genCoalActor) this.genStep3CoalStart.copy(this.genCoalActor.getWorldPosition());
        }
      } else {
        // Step 4 finished — loop back to step 1
        if (this.genCoalActor) this.genCoalActor.setWorldPosition(this.GEN_COAL_STEP2_START.clone());
        this.genStartLoop();
      }
    }
  }

  private genStartLoop(): void {
    this.genStep = 1;
    this.genProgress = 0;
    this.genSliderReturnActive = false;
    this.genSliderReturnProgress = 0;
    this.genDoorClosing = false;
    this.genDoorCloseProgress = 0;
  }

  private genCurrentDuration(): number {
    if (this.genStep === 1) return this.GEN_STEP1_DURATION;
    if (this.genStep === 2) return this.GEN_STEP2_DURATION;
    if (this.genStep === 3) return this.GEN_STEP3_DURATION;
    return this.GEN_STEP4_DURATION;
  }

  private applyGenStep(t: number): void {
    const lerp = (a: THREE.Vector3, b: THREE.Vector3, f: number) =>
      new THREE.Vector3().lerpVectors(a, b, Math.min(f, 1));

    if (this.genStep === 1 && this.genSliderActor) {
      this.genSliderActor.setWorldPosition(lerp(this.GEN_SLIDER_STEP1_START, this.GEN_SLIDER_STEP1_END, t));
    }

    if (this.genStep === 2 && this.genCoalActor) {
      this.genCoalActor.setWorldPosition(lerp(this.GEN_COAL_STEP2_START, this.GEN_COAL_STEP2_END, t));
    }

    // Step 3: pause — coal holds its position, nothing moves

    if (this.genStep === 4) {
      if (this.genCoalActor)
        this.genCoalActor.setWorldPosition(lerp(this.genStep3CoalStart, this.GEN_COAL_STEP3_END, t));
      if (!this.genDoorClosing && this.genDoorActor)
        this.genDoorActor.setWorldPosition(
          lerp(this.GEN_DOOR_STEP3_START, this.GEN_DOOR_STEP3_END, t * this.GEN_DOOR_SPEED_MULT)
        );
      // Slider is handled by independent return animation (genSliderReturnActive)
    }
  }

  /**
   * Y key: raise all "bubble" models by 0.60 on Y axis over 2 seconds.
   * Automatically finds all actors whose displayName starts with "bubble".
   */
  private handleBubbleRise(deltaTime: number): void {
    if (this.bubbleActive) {
      let allDone = true;

      for (const state of this.bubbleStates) {
        if (state.done) continue;

        state.elapsed += deltaTime;
        const timeAfterDelay = state.elapsed - state.delay;

        if (timeAfterDelay <= 0) {
          allDone = false;
          continue;
        }

        const progress = Math.min(timeAfterDelay / this.BUBBLE_RISE_DURATION, 1);
        const pos = state.actor.getWorldPosition();
        pos.y = state.startY + this.BUBBLE_RISE_OFFSET * progress;
        state.actor.setWorldPosition(pos);

        if (progress >= 1) {
          state.done = true;
          state.actor.setHidden(true);
        } else {
          allDone = false;
        }
      }

      if (allDone) {
        for (const state of this.bubbleStates) {
          const pos = state.actor.getWorldPosition();
          pos.y = state.originY;
          state.actor.setWorldPosition(pos);
          state.actor.setHidden(false);
          state.startY = state.originY;
          state.delay = Math.random() * this.BUBBLE_MAX_DELAY;
          state.elapsed = 0;
          state.done = false;
        }
      }
      return;
    }

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    if ((inputManager.isKeyDown('y') || inputManager.isKeyDown('Y'))
      && currentTime - this.lastKeyPressTime['y'] > this.KEY_PRESS_COOLDOWN) {
      this.lastKeyPressTime['y'] = currentTime;

      // Prefiks "bubb" — łapie zarówno "bubble" jak i "bubbel"
      const actors = this.findActorsByDisplayNamePrefix('bubb');
      if (actors.length === 0) return;

      this.bubbleStates = actors.map(actor => {
        actor.setHidden(false);
        const originY = actor.getWorldPosition().y;
        return {
          actor,
          originY,
          startY: originY,
          delay: Math.random() * this.BUBBLE_MAX_DELAY,
          elapsed: 0,
          done: false,
        };
      });

      this.bubbleActive = true;
    }
  }

  private tickHill(
    displayName: string,
    actor: ENGINE.Actor | null,
    targetX: number,
    deltaTime: number,
    hPressed: boolean,
    startPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    getProgress: () => number,
    setProgress: (v: number) => void,
    getIsMoving: () => boolean,
    setIsMoving: (v: boolean) => void
  ): void {
    if (!actor) return;

    if (getIsMoving()) {
      const progress = Math.min(getProgress() + deltaTime / this.HILLS_MOVE_DURATION, 1);
      setProgress(progress);
      if (progress >= 1) {
        setIsMoving(false);
        actor.setWorldPosition(targetPos.clone());
        return;
      }
      actor.setWorldPosition(new THREE.Vector3().lerpVectors(startPos, targetPos, progress));
      return;
    }

    if (hPressed) {
      startPos.copy(actor.getWorldPosition());
      targetPos.set(targetX, startPos.y, startPos.z);
      setProgress(0);
      setIsMoving(true);
    }
  }
}

export function main(container: HTMLElement, options?: Partial<ENGINE.BaseGameLoopOptions>): ENGINE.IGameLoop {
  const game = new MyGame(container, options);
  return game;
}
