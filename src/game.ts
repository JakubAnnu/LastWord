
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
  private camera1b: FixedCamera | null = null; // sub-camera of 1.1, W/S to enter/exit
  private camera1c: FixedCamera | null = null; // sub-camera of 1.3, W/S to enter/exit
  private camera1d: FixedCamera | null = null; // sub-camera of 1.2 (1.2b), W/S to enter/exit
  private camera2: FixedCamera | null = null; // dolly (was cam3)
  private camera3: FixedCamera | null = null; // 4-position cycling (was cam6)
  private camera4: FixedCamera | null = null; // animated drone (was cam7)
  private camera5: FixedCamera | null = null; // external (was cam8)
  private camera6: FixedCamera | null = null; // internal/yaw (was cam9)
  private camera7: FixedCamera | null = null; // focal toggle (was cam10)
  private activeCamera: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1;

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
  private isCamera1b: boolean = false; // true when sub-camera 1.1b is active
  private isCamera1c: boolean = false; // true when sub-camera 1.3b is active
  private isCamera1d: boolean = false; // true when sub-camera 1.2b is active

  // Camera 3 - single camera cycling through 4 positions (was cam6)
  private readonly CAMERA3_POSITIONS = [
    new THREE.Vector3(2.3, 10.39, -4.1),
    new THREE.Vector3(9.05, 3.04, -14.35),
    new THREE.Vector3(9.07, 3.14, -8.48),
    new THREE.Vector3(9.12, 3.13, -20.79),
  ];
  private readonly CAMERA3_TARGETS = [
    new THREE.Vector3(9.5, 3.57, -11.46),
    new THREE.Vector3(11.08, 2.29, -14.91),
    new THREE.Vector3(10.85, 2.3, -8.48),
    new THREE.Vector3(11.14, 1.98, -20.79),
  ];
  // FOV per position: 40mm≈39° for pos 3.1, 20mm=70° for the rest
  private readonly CAMERA3_FOVS = [39, 70, 70, 70];
  private activeCamera3Position: number = 0;

  // Camera 5 (external) - 4 fixed positions, all pointing at the same target (was cam8)
  private readonly CAMERA5_TARGET = new THREE.Vector3(-0.28, 7.49, -3.57);
  private readonly CAMERA5_POSITIONS = [
    new THREE.Vector3(-45.33, 5.25, -8),
    new THREE.Vector3(-15.92, 1.05, 15.96),
    new THREE.Vector3(21.74, 0.8, 29.1),
    new THREE.Vector3(1.37, 13.38, -3.49),
  ];
  private activeCamera5Position: number = 0;
  // Focal length steps for camera 5: 20mm=70°, 50mm=31°, 80mm=20°
  private readonly CAMERA5_FOCAL_STEPS: Array<{ label: string; fov: number }> = [
    { label: '20mm', fov: 70 },
    { label: '50mm', fov: 31 },
    { label: '80mm', fov: 20 },
  ];
  private camera5FocalIndex: number = 0;

  // Camera 6 (internal) - 4 fixed positions, each with its own target; arrow keys rotate yaw (was cam9)
  private readonly CAMERA6_POSITIONS = [
    new THREE.Vector3(-1.65, 5.41, 2.22),
    new THREE.Vector3(-1.16, 4.75, -6.51),
    new THREE.Vector3(0.04, 4.77, -5.98),
    new THREE.Vector3(3.53, 5.79, -5.16),
  ];
  private readonly CAMERA6_TARGETS = [
    new THREE.Vector3(0.03, 4.81, 1.35),
    new THREE.Vector3(0.85, 4.35, -8.07),
    new THREE.Vector3(0.04, 3.2, -3.58),
    new THREE.Vector3(3.53, 5.79, -2.14),
  ];
  private activeCamera6Position: number = 0;
  private cameraPositionLabel: HTMLElement | null = null;

  private lastKeyPressTime: { '1': number; '2': number; '3': number; '4': number; '5': number; '6': number; '7': number; 'w': number; 's': number; 'a': number; 'd': number; 'e': number; 'h': number; 'b': number; 'p': number; 'k': number; 'y': number; 'ArrowLeft': number; 'ArrowRight': number; 'ArrowUp': number; 'ArrowDown': number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, 'w': 0, 's': 0, 'a': 0, 'd': 0, 'e': 0, 'h': 0, 'b': 0, 'p': 0, 'k': 0, 'y': 0, 'ArrowLeft': 0, 'ArrowRight': 0, 'ArrowUp': 0, 'ArrowDown': 0 };
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
  private hillsActivated = false; // toggle: false=at start, true=animating or at end

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
  private barrierActivated = false;

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

  // E key: elevator sequence — both models move simultaneously
  private elevatorActor: ENGINE.Actor | null = null;
  private stanElevatorActor: ENGINE.Actor | null = null;
  private readonly ELEVATOR_START     = new THREE.Vector3(0.11, 1.88, -4.07);
  private readonly ELEVATOR_END       = new THREE.Vector3(0.11, 3.29, -4.07);
  private readonly STAN_ELEVATOR_START = new THREE.Vector3(0.08, 1.95, -4.04);
  private readonly STAN_ELEVATOR_END   = new THREE.Vector3(0.08, 3.35, -4.04);
  private readonly ELEVATOR_DURATION  = 15; // seconds
  private elevatorProgress = 0;
  private elevatorIsMoving = false;
  private elevatorActivated = false;

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

  // Camera 7 focal length toggle (was cam10)
  private camera7FocalLength: '20mm' | '120mm' = '20mm'; // Start at 20mm (FOV 70°)
  
  // Camera 2 dolly (forward/backward movement) (was cam3)
  private camera2BasePosition = new THREE.Vector3(0.71, 4.71, -8.82);
  private camera2Target = new THREE.Vector3(0.74, 3.93, -8.82);
  private camera2DollyOffset = 0; // Forward/backward offset
  private readonly CAMERA2_DOLLY_SPEED = 2; // Units per second
  private readonly CAMERA2_MAX_DOLLY = 2; // Maximum dolly distance
  
  // Camera 4 animation (was cam7)
  private camera4StartPos = new THREE.Vector3(-2.46, 6.38, -1.73);
  private camera4EndPos = new THREE.Vector3(-2.46, 25.83, 7.05);
  private camera4Target = new THREE.Vector3(-2.46, 6.22, -1.71);
  private camera4IsAnimating = false;
  private camera4AnimationProgress = 0; // 0 = start, 1 = end
  private readonly CAMERA4_ANIMATION_SPEED = 0.5; // Speed of movement (0.5 = 2 seconds)
  private camera4SideOffset = 0; // Left/right offset in units
  private readonly CAMERA4_SIDE_SPEED = 2; // Units per second for side movement
  private readonly CAMERA4_MAX_SIDE_OFFSET = 3; // Maximum offset in units
  // Drone-like hovering oscillation
  private camera4HoverTime = 0; // Time counter for hover oscillation
  private readonly CAMERA4_HOVER_AMPLITUDE = 0.3; // How much to move up/down
  private readonly CAMERA4_HOVER_SPEED = 1.5; // Speed of oscillation

  protected override createLoadingScreen(): ENGINE.ILoadingScreen | null {
    // enable the default loading screen
    return new ENGINE.DefaultLoadingScreen();
  }

  protected override async preStart(): Promise<void> {
    // Camera 1 - position 1.1: (x:8.37, y:2.73, z:11.28) pointing at Stan
    const camera1Position = new THREE.Vector3(8.37, 2.73, 11.28);
    const stanPosition = new THREE.Vector3(1.43, 2.15, -3.97);
    this.camera1 = FixedCamera.create({ position: camera1Position, startActive: true });

    // Camera 1.1b - sub-camera of 1.1, enter with W, exit with S
    // Position: (10.27, 2.44, 2.44), target: (10.27, 1.78, 9.31), 22mm ≈ 65° FOV
    this.camera1b = FixedCamera.create({
      position: new THREE.Vector3(10.22, 2.3, 9.35),
      startActive: false,
      fov: 65,
      enableRotationControl: false,
      enableWSYawControl: true,
    });
    this.camera1b.setTarget(new THREE.Vector3(10.22, 1.82, 9.33));

    // Camera 1.3b - sub-camera of 1.3, enter with W, exit with S
    // Position: (-13.54, 0.7, -36.93), target: (-6.22, 2.3, -29.61), 22mm ≈ 65° FOV
    this.camera1c = FixedCamera.create({
      position: new THREE.Vector3(-13.54, 0.7, -36.93),
      startActive: false,
      fov: 65,
      enableRotationControl: false,
      enableWSYawControl: true,
    });
    this.camera1c.setTarget(new THREE.Vector3(-6.22, 2.3, -29.61));

    // Camera 1.2b - sub-camera of 1.2, enter with W, exit with S
    // Position: (1.11, 8.42, -7.97), target: (-5.54, 4.01, -16.04), 20mm = 70° FOV, yaw rotation
    this.camera1d = FixedCamera.create({
      position: new THREE.Vector3(1.11, 8.42, -7.97),
      startActive: false,
      fov: 70,
      enableRotationControl: false,
      enableWSYawControl: true,
    });
    this.camera1d.setTarget(new THREE.Vector3(-5.54, 4.01, -16.04));
    
    // Camera 2 (was 3) - dolly camera at (x:0.71, y:4.71, z:-8.82)
    // pointing at (x:0.74, y:3.93, z:-8.82), 15mm (94° FOV), 90° roll
    const camera2Position = new THREE.Vector3(0.71, 4.71, -8.82);
    const camera2TargetVec = new THREE.Vector3(0.74, 3.93, -8.82);
    this.camera2 = FixedCamera.create({ 
      position: camera2Position, 
      startActive: false, 
      fov: 94, 
      rollDegrees: 90,
      enableRotationControl: true
    });
    this.camera2.setTarget(camera2TargetVec);
    
    // Camera 3 (was 6) - single camera cycling through 4 positions
    this.camera3 = FixedCamera.create({
      position: this.CAMERA3_POSITIONS[0].clone(),
      startActive: false,
      fov: this.CAMERA3_FOVS[0],
      enableRotationControl: false,
    });
    this.camera3.setTarget(this.CAMERA3_TARGETS[0]);
    
    // Camera 4 (was 7) - animated drone camera
    this.camera4 = FixedCamera.create({ 
      position: this.camera4StartPos.clone(), 
      startActive: false,
      fov: 70,
      enableRotationControl: false
    });
    this.camera4.setTarget(this.camera4Target);
    
    // Camera 5 (was 8, zewnętrzna) - cycles through 4 fixed positions
    this.camera5 = FixedCamera.create({ 
      position: this.CAMERA5_POSITIONS[0].clone(), 
      startActive: false,
      fov: 70,
      enableRotationControl: false
    });
    this.camera5.setTarget(this.CAMERA5_TARGET);
    
    // Camera 6 (was 9, wewnętrzna) - cycles through 4 positions; arrow keys rotate yaw
    this.camera6 = FixedCamera.create({
      position: this.CAMERA6_POSITIONS[0].clone(),
      startActive: false,
      fov: 70,
      enableRotationControl: false,
      enableWSYawControl: true,
    });
    this.camera6.setTarget(this.CAMERA6_TARGETS[0]);
    
    // Camera 7 (was 10) - focal length toggle camera
    // Position: (x:0.11, y:5.16, z:0.86), Points at: (x:0.11, y:4.34, z:2.46)
    const camera7Position = new THREE.Vector3(0.11, 5.16, 0.86);
    const camera7TargetVec = new THREE.Vector3(0.11, 4.34, 2.46);
    this.camera7 = FixedCamera.create({ 
      position: camera7Position, 
      startActive: false,
      fov: 70,
      enableRotationControl: false,
      enableZoom: false
    });
    this.camera7.setTarget(camera7TargetVec);
    
    // Add all cameras to the world
    this.world.addActors(this.camera1, this.camera1b, this.camera1c, this.camera1d, this.camera2, this.camera3, this.camera4, this.camera5, this.camera6, this.camera7);
    
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
      console.log(`Found Stan actor: ${stanActor.name} - storing position and removing from world`);
      this.camera1StanTarget = stanActor.getWorldPosition().clone();
      this.world.removeActor(stanActor);
    } else {
      console.warn('Stan actor not found, using fallback position');
    }
    this.camera1.setTarget(this.camera1StanTarget);

    // Animated Stan at (0.94, 4.91, 2.29)
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

    this.elevatorActor     = this.findActorByDisplayName('elevator')      ?? this.findActorByName('elevator');
    this.stanElevatorActor = this.findActorByDisplayName('stan_elevator_2') ?? this.findActorByName('stan_elevator_2');
    if (this.elevatorActor)     this.elevatorActor.setWorldPosition(this.ELEVATOR_START.clone());
    if (this.stanElevatorActor) this.stanElevatorActor.setWorldPosition(this.STAN_ELEVATOR_START.clone());
  }

  protected override tick(tickTime: ENGINE.TickTime): void {
    super.tick(tickTime);
    this.handleCameraSwitching();
    this.handleCamera1bSwitch();
    this.handleCamera4Animation(tickTime.deltaTimeMS / 1000);
    this.handleCamera2Dolly(tickTime.deltaTimeMS / 1000);
    this.handleCamera5FocalSwitch();
    this.handleCamera7FocalToggle();
    this.handleHillsMove(tickTime.deltaTimeMS / 1000);
    this.handleBarrierRise(tickTime.deltaTimeMS / 1000);
    this.handlePrintScale(tickTime.deltaTimeMS / 1000);
    this.handleGeneratorSequence(tickTime.deltaTimeMS / 1000);
    this.handleBubbleRise(tickTime.deltaTimeMS / 1000);
    this.handleElevator(tickTime.deltaTimeMS / 1000);
  }

  /**
   * Handle camera switching based on keyboard input (keys 1–7)
   */
  private handleCameraSwitching(): void {
    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    if (inputManager.isKeyDown('1') && this.activeCamera !== 1) {
      if (currentTime - this.lastKeyPressTime['1'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(1);
        this.lastKeyPressTime['1'] = currentTime;
      }
    }

    if (inputManager.isKeyDown('2') && this.activeCamera !== 2) {
      if (currentTime - this.lastKeyPressTime['2'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(2);
        this.lastKeyPressTime['2'] = currentTime;
      }
    }

    if (inputManager.isKeyDown('3') && this.activeCamera !== 3) {
      if (currentTime - this.lastKeyPressTime['3'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(3);
        this.lastKeyPressTime['3'] = currentTime;
      }
    }

    if (inputManager.isKeyDown('4') && this.activeCamera !== 4) {
      if (currentTime - this.lastKeyPressTime['4'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(4);
        this.lastKeyPressTime['4'] = currentTime;
      }
    }

    if (inputManager.isKeyDown('5') && this.activeCamera !== 5) {
      if (currentTime - this.lastKeyPressTime['5'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(5);
        this.lastKeyPressTime['5'] = currentTime;
      }
    }

    if (inputManager.isKeyDown('6') && this.activeCamera !== 6) {
      if (currentTime - this.lastKeyPressTime['6'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(6);
        this.lastKeyPressTime['6'] = currentTime;
      }
    }

    if (inputManager.isKeyDown('7') && this.activeCamera !== 7) {
      if (currentTime - this.lastKeyPressTime['7'] > this.KEY_PRESS_COOLDOWN) {
        this.switchToCamera(7);
        this.lastKeyPressTime['7'] = currentTime;
      }
    }

    // Handle A/D keys for position cycling across cameras 1, 3, 5, 6
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

      if (this.activeCamera === 1 && !this.isCamera1b && !this.isCamera1c && !this.isCamera1d) this.switchCamera1Position(dir);
      else if (this.activeCamera === 3) this.switchCamera3Position(dir);
      else if (this.activeCamera === 5) this.switchCamera5Position(dir);
      else if (this.activeCamera === 6) this.switchCamera6Position(dir);
    }
  }

  /**
   * Switch to the specified camera
   */
  private switchToCamera(cameraNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7): void {
    // Deactivate all cameras first
    if (this.camera1) this.camera1.setActive(false);
    if (this.camera1b) this.camera1b.setActive(false);
    this.isCamera1b = false;
    if (this.camera1c) this.camera1c.setActive(false);
    this.isCamera1c = false;
    if (this.camera1d) this.camera1d.setActive(false);
    this.isCamera1d = false;
    if (this.camera2) this.camera2.setActive(false);
    if (this.camera3) this.camera3.setActive(false);
    if (this.camera4) this.camera4.setActive(false);
    if (this.camera5) this.camera5.setActive(false);
    if (this.camera6) this.camera6.setActive(false);
    if (this.camera7) this.camera7.setActive(false);

    if (cameraNumber === 1 && this.camera1) {
      this.camera1.setActive(true);
      this.activeCamera = 1;
      this.activeCamera1Position = 0;
      this.camera1.setWorldPosition(this.CAMERA1_POSITIONS[0].clone());
      this.camera1.setTarget(this.camera1StanTarget);
      console.log('Switched to CAM 1 - position 1.1 - Use A/D to cycle positions');
    } else if (cameraNumber === 2 && this.camera2) {
      this.camera2.setActive(true);
      this.activeCamera = 2;
      this.camera2DollyOffset = 0;
      this.camera2.setWorldPosition(this.camera2BasePosition.clone());
      this.camera2.setTarget(this.camera2Target);
      console.log('Switched to CAM 2 - Use W/S to dolly in/out');
    } else if (cameraNumber === 3 && this.camera3) {
      this.camera3.setActive(true);
      this.activeCamera = 3;
      this.activeCamera3Position = 0;
      this.camera3.setWorldPosition(this.CAMERA3_POSITIONS[0].clone());
      this.camera3.setTarget(this.CAMERA3_TARGETS[0]);
      this.camera3.setFOV(this.CAMERA3_FOVS[0]);
      console.log('Switched to CAM 3 - position 3.1 - Use A/D to cycle positions');
    } else if (cameraNumber === 4 && this.camera4) {
      this.camera4.setActive(true);
      this.activeCamera = 4;
      this.camera4IsAnimating = true;
      this.camera4AnimationProgress = 0;
      this.camera4SideOffset = 0;
      this.camera4HoverTime = 0;
      this.camera4.setWorldPosition(this.camera4StartPos.clone());
      this.camera4.setTarget(this.camera4Target);
      console.log('Switched to CAM 4 - Animation started');
    } else if (cameraNumber === 5 && this.camera5) {
      this.camera5.setActive(true);
      this.activeCamera = 5;
      this.activeCamera5Position = 0;
      this.camera5FocalIndex = 0;
      this.camera5.setWorldPosition(this.CAMERA5_POSITIONS[0].clone());
      this.camera5.setTarget(this.CAMERA5_TARGET);
      this.camera5.setFOV(this.CAMERA5_FOCAL_STEPS[0].fov);
      console.log('Switched to CAM 5 (zewnętrzna) - position 5.1 - A/D: cycle positions, W/S: focal length');
    } else if (cameraNumber === 6 && this.camera6) {
      this.camera6.setActive(true);
      this.activeCamera = 6;
      this.activeCamera6Position = 0;
      this.camera6.setWorldPosition(this.CAMERA6_POSITIONS[0].clone());
      this.camera6.setTarget(this.CAMERA6_TARGETS[0]);
      this.camera6.resetRotationOffsets();
      console.log('Switched to CAM 6 (wewnętrzna) - position 6.1 - A/D: cycle, arrows: rotate');
    } else if (cameraNumber === 7 && this.camera7) {
      this.camera7.setActive(true);
      this.activeCamera = 7;
      console.log('Switched to CAM 7 - Use W/S to toggle focal length (20mm/120mm)');
    }

    this.updateCameraPositionLabel();
  }

  /**
   * W key: enter sub-camera (1.1b from 1.1, 1.3b from 1.3). S key: return to parent position.
   * Only active while activeCamera === 1.
   */
  private handleCamera1bSwitch(): void {
    if (this.activeCamera !== 1 || !this.camera1) return;

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    const wDown = (inputManager.isKeyDown('w') || inputManager.isKeyDown('W'))
      && currentTime - this.lastKeyPressTime['w'] > this.KEY_PRESS_COOLDOWN;
    const sDown = (inputManager.isKeyDown('s') || inputManager.isKeyDown('S'))
      && currentTime - this.lastKeyPressTime['s'] > this.KEY_PRESS_COOLDOWN;
    const aDown = (inputManager.isKeyDown('a') || inputManager.isKeyDown('A'))
      && currentTime - this.lastKeyPressTime['a'] > this.KEY_PRESS_COOLDOWN;
    const dDown = (inputManager.isKeyDown('d') || inputManager.isKeyDown('D'))
      && currentTime - this.lastKeyPressTime['d'] > this.KEY_PRESS_COOLDOWN;

    // A/D while in any sub-camera: cycle directly to adjacent sub-camera
    // Sub-camera order mirrors main positions: index 0=1.1b, 1=1.2b, 2=1.3b
    const subCameras = [this.camera1b, this.camera1d, this.camera1c]; // order: 1.1b, 1.2b, 1.3b
    const subLabels = ['CAM 1.1b', 'CAM 1.2b', 'CAM 1.3b'];
    const inSub = this.isCamera1b || this.isCamera1c || this.isCamera1d;

    if (inSub && (aDown || dDown)) {
      if (aDown) this.lastKeyPressTime['a'] = currentTime;
      if (dDown) this.lastKeyPressTime['d'] = currentTime;

      // Determine current sub-camera index
      const currentSubIdx = this.isCamera1b ? 0 : this.isCamera1d ? 1 : 2;
      const count = subCameras.length;
      const nextSubIdx = aDown
        ? (currentSubIdx - 1 + count) % count
        : (currentSubIdx + 1) % count;

      // Deactivate current sub-camera
      subCameras[currentSubIdx]?.setActive(false);
      this.isCamera1b = false;
      this.isCamera1c = false;
      this.isCamera1d = false;

      // Update main position index to match the new sub-camera
      // subIdx 0→pos 0, subIdx 1→pos 1, subIdx 2→pos 2
      this.activeCamera1Position = nextSubIdx;

      // Activate next sub-camera
      const nextCam = subCameras[nextSubIdx];
      if (nextCam) {
        nextCam.resetRotationOffsets();
        nextCam.setActive(true);
      }
      if (nextSubIdx === 0) this.isCamera1b = true;
      else if (nextSubIdx === 1) this.isCamera1d = true;
      else this.isCamera1c = true;

      this.updateCameraPositionLabel();
      console.log(`${subLabels[nextSubIdx]} - Switched via A/D`);
      return;
    }

    // W — enter sub-camera from a supported main position
    if (!this.isCamera1b && !this.isCamera1c && !this.isCamera1d && wDown) {
      // Position 1.1 → 1.1b
      if (this.activeCamera1Position === 0 && this.camera1b) {
        this.lastKeyPressTime['w'] = currentTime;
        this.camera1.setActive(false);
        this.camera1b.resetRotationOffsets();
        this.camera1b.setActive(true);
        this.isCamera1b = true;
        this.updateCameraPositionLabel();
        console.log('CAM 1.1b - Enter sub-camera (S to return)');
      }
      // Position 1.2 → 1.2b
      else if (this.activeCamera1Position === 1 && this.camera1d) {
        this.lastKeyPressTime['w'] = currentTime;
        this.camera1.setActive(false);
        this.camera1d.resetRotationOffsets();
        this.camera1d.setActive(true);
        this.isCamera1d = true;
        this.updateCameraPositionLabel();
        console.log('CAM 1.2b - Enter sub-camera (S to return)');
      }
      // Position 1.3 → 1.3b
      else if (this.activeCamera1Position === 2 && this.camera1c) {
        this.lastKeyPressTime['w'] = currentTime;
        this.camera1.setActive(false);
        this.camera1c.resetRotationOffsets();
        this.camera1c.setActive(true);
        this.isCamera1c = true;
        this.updateCameraPositionLabel();
        console.log('CAM 1.3b - Enter sub-camera (S to return)');
      }
    }

    // S — return to parent position from 1.1b
    if (this.isCamera1b && this.camera1b && sDown) {
      this.lastKeyPressTime['s'] = currentTime;
      this.camera1b.setActive(false);
      this.camera1.setActive(true);
      this.isCamera1b = false;
      this.updateCameraPositionLabel();
      console.log('CAM 1.1 - Returned from sub-camera');
    }

    // S — return to parent position from 1.2b
    if (this.isCamera1d && this.camera1d && sDown) {
      this.lastKeyPressTime['s'] = currentTime;
      this.camera1d.setActive(false);
      this.camera1.setActive(true);
      this.isCamera1d = false;
      this.updateCameraPositionLabel();
      console.log('CAM 1.2 - Returned from sub-camera');
    }

    // S — return to parent position from 1.3b
    if (this.isCamera1c && this.camera1c && sDown) {
      this.lastKeyPressTime['s'] = currentTime;
      this.camera1c.setActive(false);
      this.camera1.setActive(true);
      this.isCamera1c = false;
      this.updateCameraPositionLabel();
      console.log('CAM 1.3 - Returned from sub-camera');
    }
  }

  /**
   * Cycle camera 1 through its 3 fixed positions using A/D keys.
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
    console.log(`CAM 1 - position 1.${this.activeCamera1Position + 1}`);
  }

  /**
   * Cycle camera 3 through its 4 fixed positions using A/D keys (was cam6)
   */
  private switchCamera3Position(direction: 'left' | 'right'): void {
    if (!this.camera3) return;

    const count = this.CAMERA3_POSITIONS.length;
    if (direction === 'left') {
      this.activeCamera3Position = (this.activeCamera3Position - 1 + count) % count;
    } else {
      this.activeCamera3Position = (this.activeCamera3Position + 1) % count;
    }

    const pos = this.CAMERA3_POSITIONS[this.activeCamera3Position];
    const target = this.CAMERA3_TARGETS[this.activeCamera3Position];
    const fov = this.CAMERA3_FOVS[this.activeCamera3Position];
    this.camera3.setWorldPosition(pos.clone());
    this.camera3.setTarget(target);
    this.camera3.setFOV(fov);
    this.updateCameraPositionLabel();
    console.log(`CAM 3 - position 3.${this.activeCamera3Position + 1}`);
  }

  /**
   * Cycle camera 5 (external) through its 4 fixed positions using A/D keys (was cam8)
   */
  private switchCamera5Position(direction: 'left' | 'right'): void {
    if (!this.camera5) return;

    const count = this.CAMERA5_POSITIONS.length;
    if (direction === 'left') {
      this.activeCamera5Position = (this.activeCamera5Position - 1 + count) % count;
    } else {
      this.activeCamera5Position = (this.activeCamera5Position + 1) % count;
    }

    const pos = this.CAMERA5_POSITIONS[this.activeCamera5Position];
    this.camera5.setWorldPosition(pos.clone());
    this.camera5.setTarget(this.CAMERA5_TARGET);
    this.updateCameraPositionLabel();
    console.log(`CAM 5 (zewnętrzna) - position 5.${this.activeCamera5Position + 1}`);
  }

  /**
   * Cycle camera 6 (internal) through its 4 fixed positions using A/D keys.
   * Resets yaw rotation on each position change. (was cam9)
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
    this.camera6.setWorldPosition(pos.clone());
    this.camera6.setTarget(target);
    this.camera6.resetRotationOffsets();
    this.updateCameraPositionLabel();
    console.log(`CAM 6 (wewnętrzna) - position 6.${this.activeCamera6Position + 1}`);
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
      case 1:
        if (this.isCamera1b) text = 'CAM 1.1b';
        else if (this.isCamera1d) text = 'CAM 1.2b';
        else if (this.isCamera1c) text = 'CAM 1.3b';
        else text = `CAM 1.${this.activeCamera1Position + 1}`;
        break;
      case 2:  text = 'CAM 2';  break;
      case 3:  text = `CAM 3.${this.activeCamera3Position + 1}`;  break;
      case 4:  text = 'CAM 4';  break;
      case 5:  text = `CAM 5.${this.activeCamera5Position + 1}`;  break;
      case 6:  text = `CAM 6.${this.activeCamera6Position + 1}`;  break;
      case 7:  text = 'CAM 7';  break;
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
   * Handle camera 4 animation and side movement with drone-like hovering (was cam7)
   */
  private handleCamera4Animation(deltaTime: number): void {
    if (this.activeCamera !== 4 || !this.camera4) return;

    const inputManager = this.world.inputManager;

    if (this.camera4IsAnimating) {
      this.camera4AnimationProgress += this.CAMERA4_ANIMATION_SPEED * deltaTime;
      
      if (this.camera4AnimationProgress >= 1.0) {
        this.camera4AnimationProgress = 1.0;
        this.camera4IsAnimating = false;
        console.log('CAM 4 reached end position - hovering mode activated');
      }

      const basePosition = new THREE.Vector3().lerpVectors(
        this.camera4StartPos,
        this.camera4EndPos,
        this.camera4AnimationProgress
      );

      basePosition.x += this.camera4SideOffset;

      this.camera4.setWorldPosition(basePosition);
      this.camera4.setTarget(this.camera4Target);
    } else {
      this.camera4HoverTime += deltaTime;
      
      const hoverOffset = Math.sin(this.camera4HoverTime * this.CAMERA4_HOVER_SPEED) * this.CAMERA4_HOVER_AMPLITUDE;
      
      let sideMovement = 0;

      if (inputManager.isKeyDown('ArrowLeft')) {
        sideMovement = -this.CAMERA4_SIDE_SPEED * deltaTime;
      }
      if (inputManager.isKeyDown('ArrowRight')) {
        sideMovement = this.CAMERA4_SIDE_SPEED * deltaTime;
      }

      this.camera4SideOffset = THREE.MathUtils.clamp(
        this.camera4SideOffset + sideMovement,
        -this.CAMERA4_MAX_SIDE_OFFSET,
        this.CAMERA4_MAX_SIDE_OFFSET
      );

      const currentPos = this.camera4EndPos.clone();
      currentPos.x += this.camera4SideOffset;
      currentPos.y += hoverOffset;
      
      this.camera4.setWorldPosition(currentPos);
      this.camera4.setTarget(this.camera4Target);
    }
  }

  /**
   * Handle camera 2 dolly movement (forward/backward with W/S keys) (was cam3)
   */
  private handleCamera2Dolly(deltaTime: number): void {
    if (this.activeCamera !== 2 || !this.camera2) return;

    const inputManager = this.world.inputManager;
    let dollyMovement = 0;

    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      dollyMovement = this.CAMERA2_DOLLY_SPEED * deltaTime;
    }

    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      dollyMovement = -this.CAMERA2_DOLLY_SPEED * deltaTime;
    }

    if (dollyMovement !== 0) {
      this.camera2DollyOffset = THREE.MathUtils.clamp(
        this.camera2DollyOffset + dollyMovement,
        -this.CAMERA2_MAX_DOLLY,
        this.CAMERA2_MAX_DOLLY
      );

      const direction = new THREE.Vector3()
        .subVectors(this.camera2Target, this.camera2BasePosition)
        .normalize();

      const newPosition = this.camera2BasePosition.clone();
      newPosition.addScaledVector(direction, this.camera2DollyOffset);

      this.camera2.setWorldPosition(newPosition);
      this.camera2.setTarget(this.camera2Target);
    }
  }

  /**
   * Handle camera 5 focal length stepping: W = longer focal (narrower), S = shorter focal (wider)
   * Steps: 20mm (70°) → 50mm (31°) → 80mm (20°) (was cam8)
   */
  private handleCamera5FocalSwitch(): void {
    if (!this.camera5 || this.activeCamera !== 5) return;

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      if (currentTime - this.lastKeyPressTime['w'] > this.KEY_PRESS_COOLDOWN) {
        this.lastKeyPressTime['w'] = currentTime;
        const next = Math.min(this.camera5FocalIndex + 1, this.CAMERA5_FOCAL_STEPS.length - 1);
        if (next !== this.camera5FocalIndex) {
          this.camera5FocalIndex = next;
          const step = this.CAMERA5_FOCAL_STEPS[this.camera5FocalIndex];
          this.camera5.setFOV(step.fov);
          console.log(`CAM 5: ${step.label} (FOV ${step.fov}°)`);
        }
      }
    }

    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      if (currentTime - this.lastKeyPressTime['s'] > this.KEY_PRESS_COOLDOWN) {
        this.lastKeyPressTime['s'] = currentTime;
        const prev = Math.max(this.camera5FocalIndex - 1, 0);
        if (prev !== this.camera5FocalIndex) {
          this.camera5FocalIndex = prev;
          const step = this.CAMERA5_FOCAL_STEPS[this.camera5FocalIndex];
          this.camera5.setFOV(step.fov);
          console.log(`CAM 5: ${step.label} (FOV ${step.fov}°)`);
        }
      }
    }
  }

  /**
   * Handle camera 7 focal length toggle (W/S keys for instant switch between 20mm and 120mm) (was cam10)
   */
  private handleCamera7FocalToggle(): void {
    if (!this.camera7 || this.activeCamera !== 7) return;

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();

    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      if (currentTime - this.lastKeyPressTime['w'] > this.KEY_PRESS_COOLDOWN) {
        if (this.camera7FocalLength !== '120mm') {
          this.camera7FocalLength = '120mm';
          this.camera7.setFOV(11.5);
          console.log('CAM 7: Switched to 120mm (FOV 11.5°)');
        }
        this.lastKeyPressTime['w'] = currentTime;
      }
    }

    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      if (currentTime - this.lastKeyPressTime['s'] > this.KEY_PRESS_COOLDOWN) {
        if (this.camera7FocalLength !== '20mm') {
          this.camera7FocalLength = '20mm';
          this.camera7.setFOV(70);
          console.log('CAM 7: Switched to 20mm (FOV 70°)');
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

    if (hPressed) {
      this.lastKeyPressTime['h'] = currentTime;

      if (!this.hillsActivated) {
        this.hillsActivated = true;
      } else {
        // Reset wszystkich hill do pozycji startowych
        this.hillsActivated = false;
        this.hill1IsMoving = false; this.hill1MoveProgress = 0;
        this.hill2IsMoving = false; this.hill2MoveProgress = 0;
        this.hill3IsMoving = false; this.hill3MoveProgress = 0;
        this.hill4IsMoving = false; this.hill4MoveProgress = 0;
        if (this.hill1Actor) { const p = this.hill1Actor.getWorldPosition(); p.x = this.HILL1_START_X; this.hill1Actor.setWorldPosition(p); }
        if (this.hill2Actor) { const p = this.hill2Actor.getWorldPosition(); p.x = this.HILL2_START_X; p.y = this.HILL2_START_Y; this.hill2Actor.setWorldPosition(p); }
        if (this.hill3Actor) { const p = this.hill3Actor.getWorldPosition(); p.x = this.HILL3_START_X; this.hill3Actor.setWorldPosition(p); }
        if (this.hill4Actor) { const p = this.hill4Actor.getWorldPosition(); p.x = this.HILL4_START_X; this.hill4Actor.setWorldPosition(p); }
        return;
      }
    }

    if (!this.hillsActivated) return;

    this.tickHill(
      'hill1', this.hill1Actor, this.HILL1_TARGET_X, deltaTime, hPressed && this.hillsActivated,
      this.hill1MoveStartPos, this.hill1MoveTargetPos,
      () => this.hill1MoveProgress, (v) => { this.hill1MoveProgress = v; },
      () => this.hill1IsMoving, (v) => { this.hill1IsMoving = v; }
    );
    this.tickHill(
      'hill2', this.hill2Actor, this.HILL2_TARGET_X, deltaTime, hPressed && this.hillsActivated,
      this.hill2MoveStartPos, this.hill2MoveTargetPos,
      () => this.hill2MoveProgress, (v) => { this.hill2MoveProgress = v; },
      () => this.hill2IsMoving, (v) => { this.hill2IsMoving = v; }
    );
    this.handleHill2YDescent(deltaTime);
    this.tickHill(
      'hill3', this.hill3Actor, this.HILL3_TARGET_X, deltaTime, hPressed && this.hillsActivated,
      this.hill3MoveStartPos, this.hill3MoveTargetPos,
      () => this.hill3MoveProgress, (v) => { this.hill3MoveProgress = v; },
      () => this.hill3IsMoving, (v) => { this.hill3IsMoving = v; }
    );
    this.tickHill(
      'hill4', this.hill4Actor, this.HILL4_TARGET_X, deltaTime, hPressed && this.hillsActivated,
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

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();
    const bPressed = (inputManager.isKeyDown('b') || inputManager.isKeyDown('B'))
      && currentTime - this.lastKeyPressTime['b'] > this.KEY_PRESS_COOLDOWN;

    if (bPressed) {
      this.lastKeyPressTime['b'] = currentTime;

      if (!this.barrierActivated) {
        this.barrierActivated = true;
        this.barrierRiseStartY = this.barrierActors.map(a => a.getWorldPosition().y);
        this.barrierRiseProgress = 0;
        this.barrierIsRising = true;
      } else {
        // Reset do pozycji startowej
        this.barrierActivated = false;
        this.barrierIsRising = false;
        this.barrierRiseProgress = 0;
        for (const actor of this.barrierActors) {
          const pos = actor.getWorldPosition();
          pos.y = this.BARRIER_START_Y;
          actor.setWorldPosition(pos);
        }
      }
    }

    if (!this.barrierIsRising) return;

    this.barrierRiseProgress = Math.min(this.barrierRiseProgress + deltaTime / this.BARRIER_RISE_DURATION, 1);
    const t = this.barrierRiseProgress;
    for (let i = 0; i < this.barrierActors.length; i++) {
      const actor = this.barrierActors[i];
      const startY = this.barrierRiseStartY[i];
      const pos = actor.getWorldPosition();
      pos.y = startY + (this.BARRIER_TARGET_Y - startY) * t;
      actor.setWorldPosition(pos);
    }
    if (this.barrierRiseProgress >= 1) {
      this.barrierIsRising = false;
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
        this.genActive = true;
        this.genStartLoop();
      } else {
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

      if (this.bubbleActive) {
        // Stop loop — reset do pozycji startowych
        this.bubbleActive = false;
        for (const state of this.bubbleStates) {
          const pos = state.actor.getWorldPosition();
          pos.y = state.originY;
          state.actor.setWorldPosition(pos);
          state.actor.setHidden(false);
        }
        return;
      }

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

  private handleElevator(deltaTime: number): void {
    if (!this.elevatorActor) {
      this.elevatorActor = this.findActorByDisplayName('elevator') ?? this.findActorByName('elevator');
    }
    if (!this.stanElevatorActor) {
      this.stanElevatorActor = this.findActorByDisplayName('stan_elevator_2') ?? this.findActorByName('stan_elevator_2');
    }

    const inputManager = this.world.inputManager;
    const currentTime = performance.now();
    const ePressed = (inputManager.isKeyDown('e') || inputManager.isKeyDown('E'))
      && currentTime - this.lastKeyPressTime['e'] > this.KEY_PRESS_COOLDOWN;

    if (ePressed) {
      this.lastKeyPressTime['e'] = currentTime;

      if (!this.elevatorActivated) {
        this.elevatorActivated = true;
        this.elevatorProgress = 0;
        this.elevatorIsMoving = true;
      } else {
        // Reset do pozycji startowej
        this.elevatorActivated = false;
        this.elevatorIsMoving = false;
        this.elevatorProgress = 0;
        if (this.elevatorActor)     this.elevatorActor.setWorldPosition(this.ELEVATOR_START.clone());
        if (this.stanElevatorActor) this.stanElevatorActor.setWorldPosition(this.STAN_ELEVATOR_START.clone());
      }
    }

    if (!this.elevatorIsMoving) return;

    this.elevatorProgress = Math.min(this.elevatorProgress + deltaTime / this.ELEVATOR_DURATION, 1);
    const t = this.elevatorProgress;

    if (this.elevatorActor) {
      this.elevatorActor.setWorldPosition(new THREE.Vector3().lerpVectors(this.ELEVATOR_START, this.ELEVATOR_END, t));
    }
    if (this.stanElevatorActor) {
      this.stanElevatorActor.setWorldPosition(new THREE.Vector3().lerpVectors(this.STAN_ELEVATOR_START, this.STAN_ELEVATOR_END, t));
    }

    if (this.elevatorProgress >= 1) {
      this.elevatorIsMoving = false;
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
