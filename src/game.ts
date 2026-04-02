
import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { FreeCameraPlayer } from './player.js';
import { FixedCamera } from './fixed-camera.js';
import { playIntroVideo } from './intro-video.js';
import { IntroSequence, SequenceCancelledError as IntroSequenceCancelledError } from './intro-sequence.js';
import { FunctionalCam1Sequence, SequenceCancelledError as FuncCam1CancelledError } from './functional-cam1-sequence.js';
import { createTaskPanel } from './task-ui.js';
import './auto-imports.js';
import './stan-blended-actor.js';

class MyGame extends ENGINE.BaseGameLoop {
  private pawn: FreeCameraPlayer | null = null;
  private controller: ENGINE.PlayerController | null = null;

  // Single camera instance that changes position/settings on every switch
  private mainCamera: FixedCamera | null = null;

  private activeCamera: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1;

  // ─── Camera 1 ────────────────────────────────────────────────────────────────
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

  // Sub-cameras of camera 1 (1.1b, 1.2b, 1.3b)
  private isCamera1b: boolean = false;
  private isCamera1c: boolean = false;
  private isCamera1d: boolean = false;
  private readonly CAM1B_POSITION = new THREE.Vector3(10.22, 2.3, 9.35);
  private readonly CAM1B_TARGET   = new THREE.Vector3(10.22, 1.82, 9.33);
  private readonly CAM1C_POSITION = new THREE.Vector3(-6.17, 4.18, -31.58);
  private readonly CAM1C_TARGET   = new THREE.Vector3(2.79, 4.18, -19.52);
  private readonly CAM1D_POSITION = new THREE.Vector3(-4.21, 2.88, -2.71);
  private readonly CAM1D_TARGET   = new THREE.Vector3(-7.223333, 1.44, -13.417);

  // ─── Camera 3 (4-position cycling) ──────────────────────────────────────────
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
  private readonly CAMERA3_FOVS = [39, 70, 70, 70];
  private activeCamera3Position: number = 0;

  // ─── Camera 5 (external, 4 positions + focal) ────────────────────────────────
  private readonly CAMERA5_TARGET = new THREE.Vector3(-0.28, 7.49, -3.57);
  private readonly CAMERA5_POSITIONS = [
    new THREE.Vector3(-45.33, 5.25, -8),
    new THREE.Vector3(-15.92, 1.05, 15.96),
    new THREE.Vector3(21.74, 0.8, 29.1),
    new THREE.Vector3(1.37, 13.38, -3.49),
  ];
  private activeCamera5Position: number = 0;
  private readonly CAMERA5_FOCAL_STEPS: Array<{ label: string; fov: number }> = [
    { label: '20mm', fov: 70 },
    { label: '50mm', fov: 31 },
    { label: '80mm', fov: 20 },
  ];
  private camera5FocalIndex: number = 0;

  // ─── Camera 6 (internal, 4 positions + yaw) ──────────────────────────────────
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

  // ─── Camera 7 (focal toggle) ─────────────────────────────────────────────────
  private readonly CAM7_POSITION = new THREE.Vector3(0.11, 5.16, 0.86);
  private readonly CAM7_TARGET   = new THREE.Vector3(0.11, 4.34, 2.46);
  private camera7FocalLength: '20mm' | '120mm' = '20mm';

  // ─── Audio ───────────────────────────────────────────────────────────────────
  private soundtrackHandle: ENGINE.SoundHandle | null = null;
  private ambientSoundHandle: ENGINE.SoundHandle | null = null;
  private audioInitialized = false;
  private readonly DESERT_STATES  = new Set(['1.2b', '1.3b', '3.1', '4', '5.1', '5.2', '5.3', '5.4', '6.4']);
  private readonly HOWLING_STATES = new Set(['1.1', '1.1b', '1.2', '1.3', '2', '3.2', '3.3', '3.4', '6.1', '6.2', '6.3', '7']);

  // Enemy-sequence audio handles & one-shot flags
  private enemyLoopHandle:      ENGINE.SoundHandle | null = null;
  private scanningThemeHandle:  ENGINE.SoundHandle | null = null;
  private scanSound1Handle:     ENGINE.SoundHandle | null = null;
  private alarmHandle:          ENGINE.SoundHandle | null = null;
  private approachAudioPlayed   = false;
  private approachVO11Played    = false;
  private approachBridgeSoundPlayed = false;
  private bridgeScanSoundPlayed = false;
  private scanningAudioPlayed   = false;


  // ─── Camera 2 (dolly) ────────────────────────────────────────────────────────
  private camera2BasePosition = new THREE.Vector3(0.71, 4.71, -8.82);
  private camera2Target       = new THREE.Vector3(0.74, 3.93, -8.82);
  private camera2DollyOffset  = 0;
  private readonly CAMERA2_DOLLY_SPEED = 2;
  private readonly CAMERA2_MAX_DOLLY   = 2;

  // ─── Camera 4 (animated drone) ───────────────────────────────────────────────
  private camera4StartPos = new THREE.Vector3(-2.46, 6.38, -1.73);
  private camera4EndPos   = new THREE.Vector3(-2.46, 45.83, 20.67);
  private camera4Target   = new THREE.Vector3(1.667, 10.34, -3.459);
  private camera4IsAnimating       = false;
  private camera4AnimationProgress = 0;
  private readonly CAMERA4_ANIMATION_SPEED    = 0.5;
  private camera4SideOffset                   = 0;
  private readonly CAMERA4_SIDE_SPEED         = 3.6;
  private readonly CAMERA4_MAX_SIDE_OFFSET    = 5.4;
  private camera4HoverTime                    = 0;
  private readonly CAMERA4_HOVER_AMPLITUDE    = 0.3;
  private readonly CAMERA4_HOVER_SPEED        = 1.5;

  // ─── UI ──────────────────────────────────────────────────────────────────────
  private cameraPositionLabel: HTMLElement | null = null;
  private cameraHintLabel: HTMLElement | null = null;
  private cameraColumnEl: HTMLElement | null = null;
  private skipTutorialBtn: HTMLElement | null = null;
  private currentCameraState: string = '';

  // ─── Camera groups ───────────────────────────────────────────────────────────
  private readonly CAMERA_GROUPS: Array<{ label: string; states: string[] }> = [
    { label: 'OUTDOOR CAM', states: ['5.1', '5.2', '5.3', '1.2b', '1.3b', '4'] },
    { label: 'BASE CAM',    states: ['6.1', '6.2', '6.3', '6.4'] },
    { label: 'RECOURCES',   states: ['1.1', '1.1b', '1.2', '1.3', '3.1', '3.2', '3.3', '3.4'] },
    { label: 'FUNCTIONAL',  states: ['2', '7'] },
  ];
  private groupButtonElements: HTMLElement[]        = [];
  private activeGroupIndex: number | null           = null;
  private cameraNumbersContainer: HTMLElement | null = null;
  private cameraNumberElements: HTMLElement[]        = [];
  private cameraStatusLabel: HTMLElement | null      = null;

  // ─── Functional group lock ────────────────────────────────────────────────────
  private readonly FUNCTIONAL_GROUP_INDEX        = 3;
  private readonly FUNCTIONAL_GROUP_LOCK_S       = 50;
  private functionalGroupLocked                  = true;
  private functionalGroupLockElapsed             = 0;

  private lastKeyPressTime: { '1': number; '2': number; '3': number; '4': number; '5': number; '6': number; '7': number; '8': number; 'w': number; 's': number; 'a': number; 'd': number; 'e': number; 'h': number; 'b': number; 'p': number; 'k': number; 'y': number; 'o': number; 'l': number; 'ArrowLeft': number; 'ArrowRight': number; 'ArrowUp': number; 'ArrowDown': number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, 'w': 0, 's': 0, 'a': 0, 'd': 0, 'e': 0, 'h': 0, 'b': 0, 'p': 0, 'k': 0, 'y': 0, 'o': 0, 'l': 0, 'ArrowLeft': 0, 'ArrowRight': 0, 'ArrowUp': 0, 'ArrowDown': 0 };
  private readonly KEY_PRESS_COOLDOWN = 200;

  // ─── Hills ───────────────────────────────────────────────────────────────────
  private readonly HILLS_MOVE_DURATION = 240;
  private hill1Actor: ENGINE.Actor | null = null;
  private readonly HILL1_START_X = 700;
  private readonly HILL1_TARGET_X = -560;
  private hill1MoveStartPos  = new THREE.Vector3();
  private hill1MoveTargetPos = new THREE.Vector3();
  private hill1MoveProgress  = 0;
  private hill1IsMoving      = false;
  private hillsActivated     = false;

  private hill2Actor: ENGINE.Actor | null = null;
  private readonly HILL2_START_X  = 630;
  private readonly HILL2_TARGET_X = -590;
  private hill2MoveStartPos  = new THREE.Vector3();
  private hill2MoveTargetPos = new THREE.Vector3();
  private hill2MoveProgress  = 0;
  private hill2IsMoving      = false;
  private readonly HILL2_START_Y            = -61.98;
  private readonly HILL2_DESCENT_TARGET_Y   = -98.16;
  private readonly HILL2_DESCENT_TRIGGER_X  = 113.48;

  private hill3Actor: ENGINE.Actor | null = null;
  private readonly HILL3_START_X  = 530;
  private readonly HILL3_TARGET_X = -590;
  private hill3MoveStartPos  = new THREE.Vector3();
  private hill3MoveTargetPos = new THREE.Vector3();
  private hill3MoveProgress  = 0;
  private hill3IsMoving      = false;

  private hill4Actor: ENGINE.Actor | null = null;
  private readonly HILL4_START_X  = 1043.47;
  private readonly HILL4_TARGET_X = -799.72;
  private hill4MoveStartPos  = new THREE.Vector3();
  private hill4MoveTargetPos = new THREE.Vector3();
  private hill4MoveProgress  = 0;
  private hill4IsMoving      = false;

  // ─── Barriers ────────────────────────────────────────────────────────────────
  private readonly BARRIER_START_Y        = -2.16;
  private readonly BARRIER_TARGET_Y       = 3;
  private readonly BARRIER_RISE_DURATION  = 18;
  private readonly BARRIER_AUTO_RESET_S   = 30; // seconds until auto-return to start
  private barrierActors: ENGINE.Actor[]   = [];
  private barrierRiseStartY: number[]     = [];
  private barrierRiseProgress             = 0;
  private barrierIsRising                 = false;
  private barrierActivated                = false;
  private barrierKeyPressTime             = 0;
  private barrierResetTimerId: ReturnType<typeof setTimeout> | null = null;

  private fuelActor: ENGINE.Actor | null       = null;
  private readonly FUEL_START_POS              = new THREE.Vector3(10.97, 1.65, -8.67);
  private readonly FUEL_END_Y                  = 10.97;
  private readonly FUEL_RISE_DURATION          = 12;  // seconds, matches barrier rise
  private fuelRiseActive                       = false;
  private fuelRiseProgress                     = 0;

  // ─── Fuel cam 3.3 descent ─────────────────────────────────────────────────
  private readonly FUEL_CAM33_START_Y  = 1.12;
  private readonly FUEL_CAM33_END_Y    = 0.55;
  private readonly FUEL_CAM33_DURATION = 25;
  private fuelCam33Progress            = 0;
  private fuelCam33IsMoving            = false;

  // ─── Figure movement (triggered after VO_10_base ends) ──────────────────
  private figureActor: ENGINE.Actor | null         = null;
  private readonly FIGURE_START_POS                = new THREE.Vector3(0.55, 3.97, -8.92);
  private readonly FIGURE_END_POS                  = new THREE.Vector3(0.55, 3.97, -9.21);
  private readonly FIGURE_MOVE_DURATION            = 240; // seconds
  private figureMoveProgress                       = 0;
  private figureMoveActive                         = false;

  // ─── Enemy / Scan sequence (triggered 20 s after VO_10_base ends) ───────
  private enemyActor: ENGINE.Actor | null = null;
  private scanActor:  ENGINE.Actor | null = null;

  private readonly ENEMY_START_DELAY = 20; // seconds after VO_10_base ends

  // Phase: approach  (enemy moves to bridge position)
  private readonly ENEMY_APPROACH_FROM   = new THREE.Vector3(3016.14, 56.81, -32.09);
  private readonly ENEMY_APPROACH_TO     = new THREE.Vector3(58.06,   56.81, -32.09);
  private readonly ENEMY_APPROACH_DUR    = 120; // seconds

  // Phase: bridge  (enemy holds position; scan rises at t=8 s)
  private readonly BRIDGE_DURATION       = 10;  // seconds
  private readonly BRIDGE_SCAN_TRIGGER   = 8;   // second within bridge when scan starts
  private readonly SCAN_RISE_FROM        = new THREE.Vector3(58.06, -36.21, -32.09);
  private readonly SCAN_RISE_TO          = new THREE.Vector3(58.06,  28.59, -32.09);
  private readonly SCAN_RISE_DUR         = 0.5; // seconds

  // Phase: scanning  (both actors move together; scan also gets random XZ scale)
  private readonly SCAN_PHASE_DUR        = 180; // seconds (3 minutes)
  private readonly ENEMY_SCAN_FROM       = new THREE.Vector3(58.06,  56.81, -32.09);
  private readonly ENEMY_SCAN_TO         = new THREE.Vector3(-0.41,  38.76, -24.68);
  private readonly SCAN_SCAN_FROM        = new THREE.Vector3(58.06,  28.59, -32.09);
  private readonly SCAN_SCAN_TO          = new THREE.Vector3(-8.55,  8.34,  -20.48);

  // Camera blackout sequence during scanning phase
  private readonly BLACKOUT_START_DELAY  = 60;  // seconds into scanning before blackouts begin
  private readonly BLACKOUT_INTERVAL     = 4;   // seconds between each camera going dark
  private readonly CAMERA_BLACKOUT_ORDER = [
    '6.3',  // base cam 3
    '1.1b', // resources 2
    '1.3',  // resources 4
    '3.4',  // resources 8
    '3.3',  // resources 7
    '3.2',  // resources 6
    '1.2',  // resources 3
    '7',    // functional 2
    '1.2b', // outdoor 4
    '5.1',  // outdoor 1
    '3.1',  // resources 5
    '1.1',  // resources 1
    '6.4',  // base cam 4
    '6.2',  // base cam 2
    '6.1',  // base cam 1
    '4',    // outdoor 6
    '5.3',  // outdoor 3
    '5.2',  // outdoor 2
    '1.3b', // outdoor 5
  ] as const;
  private blackedOutStates         = new Set<string>();
  private scanningBlackoutStarted  = false;

  // Scan random-scale during scanning phase
  private readonly SCAN_SCALE_MAX_DELTA  = 10;  // max change per axis per transition
  private readonly SCAN_SCALE_MAX_DUR    = 20;  // max seconds per scale transition
  private readonly SCAN_SCALE_LATE_TRIGGER = 5; // seconds into scanning before scale cap kicks in
  private readonly SCAN_SCALE_LATE_MAX   = 5;   // max scale value after trigger
  private scanScaleFromX  = 1;
  private scanScaleFromZ  = 1;
  private scanScaleToX    = 1;
  private scanScaleToZ    = 1;
  private scanScaleProg   = 0;
  private scanScaleDur    = 1;

  // Runtime state
  private enemyPhase:        'idle' | 'approach' | 'bridge' | 'scanning' = 'idle';
  private enemyPhaseTimer    = 0; // elapsed seconds in current phase
  private enemyApproachProg  = 0;
  private scanRiseProg       = 0;
  private scanRiseActive     = false;
  private scanPhaseProg      = 0;

  // ─── Ending system ───────────────────────────────────────────────────────────
  private readonly TRUEEND_START_S    = 140; // 2 min 20 s into scanning
  private readonly TRUEEND_END_S      = 150; // 2 min 30 s into scanning
  private endingTriggered             = false;
  private endingOverlayEl: HTMLElement | null = null;

  // Scanning task panel
  private scanningTaskHideCallback: (() => void) | null = null;

  // Camera shake (TrueEnd)
  private cameraShakeActive   = false;
  private cameraShakeElapsed  = 0;
  private readonly CAMERA_SHAKE_DURATION  = 5;    // seconds
  private readonly CAMERA_SHAKE_INTENSITY = 0.06; // max offset in world units

  // Camera redirect (TrueEnd — after VO_13_end 30 s)
  private readonly TRUEEND_CAMERA_TARGET_A    = new THREE.Vector3(13.53, -25.93, 0.28);  // resources 1 & 5
  private readonly TRUEEND_CAMERA_TARGET_B    = new THREE.Vector3(3.02, -22.58, -39.15); // base cam 1 & functional 2
  private readonly TRUEEND_REDIRECTED_STATES  = new Set(['6.1', '1.1', '3.1', '7']);
  private trueEndCameraTargetA: THREE.Vector3 | null = null;
  private trueEndCameraTargetB: THREE.Vector3 | null = null;
  private trueEndExtrasActive  = false; // FOV boost + typing sound gate
  private typingSoundHandle: ENGINE.SoundHandle | null = null;

  // ─── Mobile (OUTDOOR 1 / state '4') ──────────────────────────────────────
  private mobileActor: ENGINE.Actor | null       = null;
  private readonly MOBILE_START_POS              = new THREE.Vector3(-13.33, 0.43, 28.75);
  private readonly MOBILE_END_POS                = new THREE.Vector3(-13.33, 0.43, -81.96);
  private readonly MOBILE_MOVE_DURATION          = 10;
  private readonly MOBILE_SOUND                  = '@project/assets/sounds/mobile.mp3';
  private mobileMoveProgress                     = 0;
  private mobileIsMoving                         = false;

  // ─── Print scale ─────────────────────────────────────────────────────────────
  private printActor: ENGINE.Actor | null  = null;
  private printScaleActive                 = false;
  private printCurrentScale                = new THREE.Vector3(0.41, 0.18, 0.3);
  private printScaleTarget                 = new THREE.Vector3(0.41, 0.18, 0.3);
  private readonly PRINT_SCALE_MIN         = 0.1;
  private readonly PRINT_SCALE_MAX         = 0.5;
  private readonly PRINT_SCALE_SPEED       = 0.25;
  private print2Actor: ENGINE.Actor | null = null;
  private print2CurrentScale               = new THREE.Vector3(0.41, 0.18, 0.3);
  private print2ScaleTarget                = new THREE.Vector3(0.41, 0.18, 0.3);

  // ─── Bubbles ─────────────────────────────────────────────────────────────────
  private readonly BUBBLE_RISE_OFFSET  = 0.60;
  private readonly BUBBLE_RISE_DURATION = 4;
  private readonly BUBBLE_MAX_DELAY    = 2.5;
  private bubbleStates: Array<{
    actor: ENGINE.Actor; originY: number; startY: number;
    delay: number; elapsed: number; done: boolean;
  }> = [];
  private bubbleActive = false;

  // ─── Elevator ────────────────────────────────────────────────────────────────
  private elevatorActor: ENGINE.Actor | null     = null;
  private stanElevatorActor: ENGINE.Actor | null = null;
  private readonly ELEVATOR_START      = new THREE.Vector3(0.11, 1.88, -4.07);
  private readonly ELEVATOR_END        = new THREE.Vector3(0.11, 3.29, -4.07);
  private readonly STAN_ELEVATOR_START = new THREE.Vector3(0.08, 1.95, -4.04);
  private readonly STAN_ELEVATOR_END   = new THREE.Vector3(0.08, 3.35, -4.04);
  private readonly ELEVATOR_DURATION   = 15;
  private elevatorProgress             = 0;
  private elevatorIsMoving             = false;
  private elevatorActivated            = false;

  // ─── Intro sequence ──────────────────────────────────────────────────────────
  private introSequence: IntroSequence | null = null;

  // ─── Functional Camera 1 sequence ────────────────────────────────────────────
  private functionalCam1Sequence: FunctionalCam1Sequence | null = null;
  private functionalCam1SequencePlayed: boolean = false;
  /** Blocks A/D group switching and 1–8 camera-number keys during sequences */
  private cameraInputBlocked: boolean = false;
  /** When true the L-key PointLight_16 handler is suppressed (Z already fired) */
  private pointLight16Locked: boolean = false;
  /** Hides the persistent map-hint TASK panel; set by IntroSequence, called on entering state '2' */
  private hideMapHintCallback: (() => void) | null = null;

  // ─── Point Light 16 ──────────────────────────────────────────────────────────
  private pointLight16Actor: ENGINE.Actor | null = null;

  // ─── Directional Light 02 ────────────────────────────────────────────────────
  private dirLight02Actor: ENGINE.Actor | null = null;
  private readonly DIR_LIGHT02_START   = new THREE.Vector3(2.34, 20.99, -99.96);
  private readonly DIR_LIGHT02_END     = new THREE.Vector3(2.34, 20.99, 80.09);
  private readonly DIR_LIGHT02_DURATION = 3;
  private dirLight02Progress           = 0;
  private dirLight02IsMoving           = false;
  private dirLight02Activated          = false;

  // ─── Generator ───────────────────────────────────────────────────────────────
  private genSliderActor: ENGINE.Actor | null = null;
  private genCoalActor: ENGINE.Actor | null   = null;
  private genDoorActor: ENGINE.Actor | null   = null;
  private readonly GEN_STEP1_DURATION         = 2.4;
  private readonly GEN_STEP2_DURATION         = 1.8;
  private readonly GEN_STEP3_DURATION         = 1.0;
  private readonly GEN_STEP4_DURATION         = 4.8;
  private readonly GEN_SLIDER_STEP1_START     = new THREE.Vector3(0.3, 2.8, -29.58);
  private readonly GEN_SLIDER_STEP1_END       = new THREE.Vector3(0.3, 1.79, -29.58);
  private readonly GEN_COAL_STEP2_START       = new THREE.Vector3(0.6, 1.52, -31.8);
  private readonly GEN_COAL_STEP2_END         = new THREE.Vector3(0.6, 1.52, -29.55);
  private readonly GEN_COAL_STEP3_END         = new THREE.Vector3(4.92, 1.52, -29.55);
  private readonly GEN_DOOR_STEP3_START       = new THREE.Vector3(3.3, 2.21, -29.58);
  private readonly GEN_DOOR_STEP3_END         = new THREE.Vector3(3.3, 2.98, -29.58);
  private readonly GEN_SLIDER_RETURN_DURATION = 3.0;
  private readonly GEN_DOOR_SPEED_MULT        = 1.4;
  private readonly GEN_COAL_DOOR_TRIGGER_X    = 3.25;
  private readonly GEN_DOOR_CLOSE_DURATION    = 4 / 1.4;
  private genStep                             = 0;
  private genProgress                         = 0;
  private genStep3SliderStart                 = new THREE.Vector3();
  private genActive                           = false;
  private genSliderReturnActive               = false;
  private genSliderReturnProgress             = 0;
  private genSliderReturnStartPos             = new THREE.Vector3();
  private genStep3CoalStart                   = new THREE.Vector3();
  private genDoorClosing                      = false;
  private genDoorCloseProgress                = 0;
  private genDoorCloseStartPos                = new THREE.Vector3();

  protected override createLoadingScreen(): ENGINE.ILoadingScreen | null {
    return new ENGINE.DefaultLoadingScreen();
  }

  protected override async preStart(): Promise<void> {
    // Create the single camera – starts at Camera 1 position 1.1
    this.mainCamera = FixedCamera.create({
      position: this.CAMERA1_POSITIONS[0].clone(),
      startActive: true,
      fov: 70,
      enableRotationControl: true,
    });
    this.mainCamera.setTarget(this.CAMERA1_TARGETS_FIXED[0]);

    this.world.addActors(this.mainCamera);

    this.createCameraPositionLabel();
    this.updateCameraPositionLabel();
    await this.waitForLevelLoad();

    // Find and remove Stan actor; store its position as camera 1.1 target
    const stanPosition = new THREE.Vector3(1.43, 2.15, -3.97);
    let stanActor = this.findActorByName('Stan');
    if (!stanActor) stanActor = this.findActorNearPosition(stanPosition, 1.0);
    if (stanActor) {
      console.log(`Found Stan actor: ${stanActor.name} - storing position and removing`);
      this.camera1StanTarget = stanActor.getWorldPosition().clone();
      this.world.removeActor(stanActor);
    } else {
      console.warn('Stan actor not found, using fallback position');
    }
    this.mainCamera.setTarget(this.camera1StanTarget);

    // Animated Stan
    const stanBlended2 = ENGINE.ClassRegistry.constructObject(
      'GAME.StanBlendedActor', false, new THREE.Vector3(0.94, 4.91, 2.29)
    ) as ENGINE.Actor;
    this.world.addActors(stanBlended2);

    this.hill1Actor = this.findActorByDisplayName('hill1') ?? this.findActorByName('hill1');
    if (this.hill1Actor) { const p = this.hill1Actor.getWorldPosition(); p.x = this.HILL1_START_X; this.hill1Actor.setWorldPosition(p); }

    this.hill2Actor = this.findActorByDisplayName('hill2') ?? this.findActorByName('hill2');
    if (this.hill2Actor) { const p = this.hill2Actor.getWorldPosition(); p.x = this.HILL2_START_X; p.y = this.HILL2_START_Y; this.hill2Actor.setWorldPosition(p); }

    this.hill3Actor = this.findActorByDisplayName('hill3') ?? this.findActorByName('hill3');
    if (this.hill3Actor) { const p = this.hill3Actor.getWorldPosition(); p.x = this.HILL3_START_X; this.hill3Actor.setWorldPosition(p); }

    this.hill4Actor = this.findActorByDisplayName('hill4') ?? this.findActorByName('hill4');
    if (this.hill4Actor) { const p = this.hill4Actor.getWorldPosition(); p.x = this.HILL4_START_X; this.hill4Actor.setWorldPosition(p); }

    this.barrierActors = this.findActorsByDisplayNamePrefix('barrier');
    for (const actor of this.barrierActors) {
      const pos = actor.getWorldPosition(); pos.y = this.BARRIER_START_Y; actor.setWorldPosition(pos);
    }

    this.printActor  = this.findActorByDisplayName('print')    ?? this.findActorByName('print');
    this.print2Actor = this.findActorByDisplayName('print_02') ?? this.findActorByName('print_02');
    if (this.printActor)  this.printActor.setWorldScale(this.printCurrentScale.clone());
    if (this.print2Actor) this.print2Actor.setWorldScale(this.print2CurrentScale.clone());

    this.genSliderActor = this.findActorByDisplayName('slider') ?? this.findActorByDisplayName('slider_02');
    this.genCoalActor   = this.findActorByDisplayName('coal')   ?? this.findActorByName('coal');
    this.genDoorActor   = this.findActorByDisplayName('door')   ?? this.findActorByName('door');
    if (this.genSliderActor) this.genSliderActor.setWorldPosition(this.GEN_SLIDER_STEP1_START.clone());
    if (this.genCoalActor)   this.genCoalActor.setWorldPosition(this.GEN_COAL_STEP2_START.clone());
    if (this.genDoorActor)   this.genDoorActor.setWorldPosition(this.GEN_DOOR_STEP3_START.clone());

    this.elevatorActor     = this.findActorByDisplayName('elevator')      ?? this.findActorByName('elevator');
    this.stanElevatorActor = this.findActorByDisplayName('stan_elevator') ?? this.findActorByName('stan_elevator');
    if (this.elevatorActor)     this.elevatorActor.setWorldPosition(this.ELEVATOR_START.clone());
    if (this.stanElevatorActor) this.stanElevatorActor.setWorldPosition(this.STAN_ELEVATOR_START.clone());

    this.dirLight02Actor = this.findActorByDisplayName('Directional Light_02') ?? this.findActorByDisplayName('directional light_02') ?? this.findActorByName('Directional Light_02');
    if (this.dirLight02Actor) this.dirLight02Actor.setWorldPosition(this.DIR_LIGHT02_START.clone());

    this.pointLight16Actor = this.findActorByDisplayName('PointLight_16') ?? this.findActorByName('PointLight_16');

    this.registerBarrierKeyListener();
    this.registerEndingKeyListener();

    // Trigger camera-based animations now that all scene actors are loaded
    this.currentCameraState = '';
    this.onCameraStateChanged(this.computeCameraState());

    // Audio starts on first user interaction (browser autoplay policy)
    this.registerAudioOnInteraction();
  }

  protected override postStart(): void {
    const container = this.world.gameContainer;
    if (!container) return;
    this.setInputEnabled(false);
    playIntroVideo(container).then(() => {
      this.setInputEnabled(true);
      this.startIntroSequence();
    });
  }

  private startIntroSequence(): void {
    this.introSequence = new IntroSequence({
      playGlobalSound: (url) =>
        this.world.globalAudioManager.playGlobalSound(url, {
          volume: 1.0,
          loop: false,
          bus: 'Voice',
        }),
      isSoundPlaying: (handle) =>
        this.world.globalAudioManager.isSoundPlaying(handle),
      resumeAudioContext: async () => {
        const ctx = (this.world.audioListener as THREE.AudioListener | null)?.context;
        if (ctx && ctx.state === 'suspended') {
          await ctx.resume();
        }
      },
      switchToState: (state) => this.switchToState(state),
      setInputEnabled: (enabled) => {
        this.setInputEnabled(enabled);
        this.updateCameraStatusLabel(enabled ? 'free' : 'controlled');
      },
      gameContainer: this.world.gameContainer ?? null,
      onMapHintShown: (hide) => { this.hideMapHintCallback = hide; },
      startFuelAnimation: () => this.startFuelRiseAnimation(),
      stopFuelAnimation: () => this.stopFuelRiseAnimation(),
    });
    this.introSequence.run().catch(err => {
      if (!(err instanceof IntroSequenceCancelledError)) console.error('[IntroSequence] Sequence error:', err);
    });
  }

  protected override tick(tickTime: ENGINE.TickTime): void {
    super.tick(tickTime);
    this.tickFunctionalGroupLock(tickTime.deltaTimeMS / 1000);
    this.handleCameraSwitching();
    this.handleCamera4Hover(tickTime.deltaTimeMS / 1000);
    this.handleCamera2Dolly(tickTime.deltaTimeMS / 1000);
    this.handleCamera5FocalSwitch();
    this.handleCamera7FocalToggle();
    this.handleHillsMove(tickTime.deltaTimeMS / 1000);
    this.handleBarrierRise(tickTime.deltaTimeMS / 1000);
    this.handleFuelRise(tickTime.deltaTimeMS / 1000);
    this.handlePrintScale(tickTime.deltaTimeMS / 1000);
    this.handleGeneratorSequence(tickTime.deltaTimeMS / 1000);
    this.handleBubbleRise(tickTime.deltaTimeMS / 1000);
    this.handleElevator(tickTime.deltaTimeMS / 1000);
    this.handleDirLight02(tickTime.deltaTimeMS / 1000);
    this.handleFuelCam33(tickTime.deltaTimeMS / 1000);
    this.handleMobileMove(tickTime.deltaTimeMS / 1000);
    this.handleFigureMove(tickTime.deltaTimeMS / 1000);
    this.handleEnemySequence(tickTime.deltaTimeMS / 1000);
    this.handleCameraShake(tickTime.deltaTimeMS / 1000);
    this.handlePointLight16Color();
  }

  // ─── Camera configuration helper ─────────────────────────────────────────────

  /**
   * Apply position, target, FOV, roll and rotation settings to the single camera.
   */
  private configureCam(
    position: THREE.Vector3,
    target: THREE.Vector3 | ENGINE.Actor,
    fov: number,
    rollDegrees: number,
    rotationControl: boolean,
    yawControl: boolean,
    resetRotation: boolean = true,
  ): void {
    if (!this.mainCamera) return;
    this.mainCamera.setRotationControl(rotationControl);
    this.mainCamera.setWSYawControl(yawControl);
    this.mainCamera.setRoll(rollDegrees);      // sets roll + recomputes direction
    this.mainCamera.setWorldPosition(position.clone());
    this.mainCamera.setFOV(fov);
    this.mainCamera.setTarget(target);        // recomputes direction with new target
    if (resetRotation) this.mainCamera.resetRotationOffsets();
  }

  // ─── Functional group lock ────────────────────────────────────────────────────

  private tickFunctionalGroupLock(deltaTime: number): void {
    if (!this.functionalGroupLocked) return;
    this.functionalGroupLockElapsed += deltaTime;
    if (this.functionalGroupLockElapsed >= this.FUNCTIONAL_GROUP_LOCK_S) {
      this.functionalGroupLocked = false;
      this.updateGroupButtonHighlights();
    }
  }

  private isFunctionalGroupLocked(): boolean {
    return this.functionalGroupLocked;
  }

  // ─── Camera switching ────────────────────────────────────────────────────────

  private handleCameraSwitching(): void {
    if (this.cameraInputBlocked) return;

    const inputManager = this.world.inputManager;
    const currentTime  = performance.now();

    if (this.activeGroupIndex !== null) {
      // ── Group mode: keys 1–8 jump to the Nth camera in the active group ──────
      const group = this.CAMERA_GROUPS[this.activeGroupIndex];
      for (let i = 0; i < group.states.length && i < 8; i++) {
        const k = String(i + 1) as keyof typeof this.lastKeyPressTime;
        if (inputManager.isKeyDown(k) && currentTime - this.lastKeyPressTime[k] > this.KEY_PRESS_COOLDOWN) {
          this.lastKeyPressTime[k] = currentTime;
          if (!this.blackedOutStates.has(group.states[i])) {
            this.switchToState(group.states[i]);
          }
          return;
        }
      }
    }

    // ── A/D: cycle camera groups ──────────────────────────────────────────────
    const switchLeft =
      (inputManager.isKeyDown('a') || inputManager.isKeyDown('A')) &&
      currentTime - this.lastKeyPressTime['a'] > this.KEY_PRESS_COOLDOWN;
    const switchRight =
      (inputManager.isKeyDown('d') || inputManager.isKeyDown('D')) &&
      currentTime - this.lastKeyPressTime['d'] > this.KEY_PRESS_COOLDOWN;

    if (switchLeft || switchRight) {
      if (switchLeft)  this.lastKeyPressTime['a'] = currentTime;
      if (switchRight) this.lastKeyPressTime['d'] = currentTime;

      const current = this.activeGroupIndex ?? 0;
      let next = switchLeft
        ? (current - 1 + this.CAMERA_GROUPS.length) % this.CAMERA_GROUPS.length
        : (current + 1) % this.CAMERA_GROUPS.length;
      if (next === this.FUNCTIONAL_GROUP_INDEX && this.isFunctionalGroupLocked()) {
        next = switchLeft
          ? (next - 1 + this.CAMERA_GROUPS.length) % this.CAMERA_GROUPS.length
          : (next + 1) % this.CAMERA_GROUPS.length;
      }
      const firstActive = this.firstActiveStateInGroup(next);
      if (!firstActive) return; // whole group deactivated — skip
      this.activeGroupIndex = next;
      this.switchToState(firstActive);
      this.updateGroupButtonHighlights();
    }
  }

  private switchToCamera(cameraNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7): void {
    // Reset sub-camera state
    this.isCamera1b = false;
    this.isCamera1c = false;
    this.isCamera1d = false;

    if (cameraNumber === 1) {
      this.activeCamera = 1;
      this.activeCamera1Position = 0;
      this.configureCam(
        this.CAMERA1_POSITIONS[0], this.camera1StanTarget,
        70, 0, true, false,
      );
      console.log('Switched to CAM 1 - position 1.1');
    } else if (cameraNumber === 2) {
      this.activeCamera = 2;
      this.camera2DollyOffset = 0;
      this.configureCam(this.camera2BasePosition, this.camera2Target, 94, 90, true, false);
      console.log('Switched to CAM 2');
    } else if (cameraNumber === 3) {
      this.activeCamera = 3;
      this.activeCamera3Position = 0;
      this.configureCam(
        this.CAMERA3_POSITIONS[0], this.CAMERA3_TARGETS[0],
        this.CAMERA3_FOVS[0], 0, false, false,
      );
      console.log('Switched to CAM 3 - position 3.1');
    } else if (cameraNumber === 4) {
      this.activeCamera = 4;
      this.camera4SideOffset = 0;
      this.camera4HoverTime  = 0;
      this.configureCam(this.camera4EndPos, this.camera4Target, 70, 0, false, false);
      console.log('Switched to CAM 4');
    } else if (cameraNumber === 5) {
      this.activeCamera = 5;
      this.activeCamera5Position = 0;
      this.camera5FocalIndex     = 0;
      this.configureCam(
        this.CAMERA5_POSITIONS[0], this.CAMERA5_TARGET,
        this.CAMERA5_FOCAL_STEPS[0].fov, 0, false, false,
      );
      console.log('Switched to CAM 5 (zewnętrzna) - position 5.1');
    } else if (cameraNumber === 6) {
      this.activeCamera = 6;
      this.activeCamera6Position = 0;
      this.configureCam(
        this.CAMERA6_POSITIONS[0], this.CAMERA6_TARGETS[0],
        70, 0, false, true,
      );
      console.log('Switched to CAM 6 (wewnętrzna) - position 6.1');
    } else if (cameraNumber === 7) {
      this.activeCamera = 7;
      this.camera7FocalLength = '20mm';
      this.configureCam(this.CAM7_POSITION, this.CAM7_TARGET, 70, 0, false, false);
      console.log('Switched to CAM 7');
    }

    this.updateCameraPositionLabel();
  }

  // ─── Position cycling ────────────────────────────────────────────────────────

  private switchCamera1Position(direction: 'left' | 'right'): void {
    if (!this.mainCamera) return;
    const count = this.CAMERA1_POSITIONS.length;
    this.activeCamera1Position = direction === 'left'
      ? (this.activeCamera1Position - 1 + count) % count
      : (this.activeCamera1Position + 1) % count;
    const pos    = this.CAMERA1_POSITIONS[this.activeCamera1Position];
    const target = this.activeCamera1Position === 0
      ? this.camera1StanTarget
      : this.CAMERA1_TARGETS_FIXED[this.activeCamera1Position];
    this.configureCam(pos, target, 70, 0, true, false);
    this.updateCameraPositionLabel();
    console.log(`CAM 1.${this.activeCamera1Position + 1}`);
  }

  private switchCamera3Position(direction: 'left' | 'right'): void {
    if (!this.mainCamera) return;
    const count = this.CAMERA3_POSITIONS.length;
    this.activeCamera3Position = direction === 'left'
      ? (this.activeCamera3Position - 1 + count) % count
      : (this.activeCamera3Position + 1) % count;
    this.configureCam(
      this.CAMERA3_POSITIONS[this.activeCamera3Position],
      this.CAMERA3_TARGETS[this.activeCamera3Position],
      this.CAMERA3_FOVS[this.activeCamera3Position],
      0, false, false,
    );
    this.updateCameraPositionLabel();
    console.log(`CAM 3.${this.activeCamera3Position + 1}`);
  }

  private switchCamera5Position(direction: 'left' | 'right'): void {
    if (!this.mainCamera) return;
    const count = this.CAMERA5_POSITIONS.length;
    this.activeCamera5Position = direction === 'left'
      ? (this.activeCamera5Position - 1 + count) % count
      : (this.activeCamera5Position + 1) % count;
    this.configureCam(
      this.CAMERA5_POSITIONS[this.activeCamera5Position],
      this.CAMERA5_TARGET,
      this.CAMERA5_FOCAL_STEPS[this.camera5FocalIndex].fov,
      0, false, false,
    );
    this.updateCameraPositionLabel();
    console.log(`CAM 5.${this.activeCamera5Position + 1}`);
  }

  private switchCamera6Position(direction: 'left' | 'right'): void {
    if (!this.mainCamera) return;
    const count = this.CAMERA6_POSITIONS.length;
    this.activeCamera6Position = direction === 'left'
      ? (this.activeCamera6Position - 1 + count) % count
      : (this.activeCamera6Position + 1) % count;
    this.configureCam(
      this.CAMERA6_POSITIONS[this.activeCamera6Position],
      this.CAMERA6_TARGETS[this.activeCamera6Position],
      70, 0, false, true,
    );
    this.updateCameraPositionLabel();
    console.log(`CAM 6.${this.activeCamera6Position + 1}`);
  }

  // ─── Per-frame camera handlers ───────────────────────────────────────────────

  private handleCamera4Hover(deltaTime: number): void {
    if (this.activeCamera !== 4 || !this.mainCamera) return;
    const inputManager = this.world.inputManager;

    this.camera4HoverTime += deltaTime;
    const hoverOffset = Math.sin(this.camera4HoverTime * this.CAMERA4_HOVER_SPEED) * this.CAMERA4_HOVER_AMPLITUDE;

    let sideMovement = 0;
    if (inputManager.isKeyDown('ArrowLeft'))  sideMovement = -this.CAMERA4_SIDE_SPEED * deltaTime;
    if (inputManager.isKeyDown('ArrowRight')) sideMovement =  this.CAMERA4_SIDE_SPEED * deltaTime;
    this.camera4SideOffset = THREE.MathUtils.clamp(
      this.camera4SideOffset + sideMovement,
      -this.CAMERA4_MAX_SIDE_OFFSET, this.CAMERA4_MAX_SIDE_OFFSET,
    );

    const pos = this.camera4EndPos.clone();
    pos.x += this.camera4SideOffset;
    pos.y += hoverOffset;
    this.mainCamera.setWorldPosition(pos);
    this.mainCamera.setTarget(this.camera4Target);
  }

  private handleCamera2Dolly(deltaTime: number): void {
    if (this.activeCamera !== 2 || !this.mainCamera) return;
    const inputManager = this.world.inputManager;
    let dollyMovement = 0;
    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) dollyMovement =  this.CAMERA2_DOLLY_SPEED * deltaTime;
    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) dollyMovement = -this.CAMERA2_DOLLY_SPEED * deltaTime;
    if (dollyMovement !== 0) {
      this.camera2DollyOffset = THREE.MathUtils.clamp(
        this.camera2DollyOffset + dollyMovement, -this.CAMERA2_MAX_DOLLY, this.CAMERA2_MAX_DOLLY,
      );
      const dir = new THREE.Vector3().subVectors(this.camera2Target, this.camera2BasePosition).normalize();
      const newPos = this.camera2BasePosition.clone().addScaledVector(dir, this.camera2DollyOffset);
      this.mainCamera.setWorldPosition(newPos);
      this.mainCamera.setTarget(this.camera2Target);
    }
  }

  private handleCamera5FocalSwitch(): void {
    if (!this.mainCamera || this.activeCamera !== 5) return;
    const inputManager = this.world.inputManager;
    const currentTime  = performance.now();

    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      if (currentTime - this.lastKeyPressTime['w'] > this.KEY_PRESS_COOLDOWN) {
        this.lastKeyPressTime['w'] = currentTime;
        const next = Math.min(this.camera5FocalIndex + 1, this.CAMERA5_FOCAL_STEPS.length - 1);
        if (next !== this.camera5FocalIndex) {
          this.camera5FocalIndex = next;
          this.mainCamera.setFOV(this.CAMERA5_FOCAL_STEPS[this.camera5FocalIndex].fov);
        }
      }
    }
    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      if (currentTime - this.lastKeyPressTime['s'] > this.KEY_PRESS_COOLDOWN) {
        this.lastKeyPressTime['s'] = currentTime;
        const prev = Math.max(this.camera5FocalIndex - 1, 0);
        if (prev !== this.camera5FocalIndex) {
          this.camera5FocalIndex = prev;
          this.mainCamera.setFOV(this.CAMERA5_FOCAL_STEPS[this.camera5FocalIndex].fov);
        }
      }
    }
  }

  private handleCamera7FocalToggle(): void {
    if (!this.mainCamera || this.activeCamera !== 7) return;
    const inputManager = this.world.inputManager;
    const currentTime  = performance.now();

    if (inputManager.isKeyDown('w') || inputManager.isKeyDown('W')) {
      if (currentTime - this.lastKeyPressTime['w'] > this.KEY_PRESS_COOLDOWN) {
        if (this.camera7FocalLength !== '120mm') { this.camera7FocalLength = '120mm'; this.mainCamera.setFOV(11.5); }
        this.lastKeyPressTime['w'] = currentTime;
      }
    }
    if (inputManager.isKeyDown('s') || inputManager.isKeyDown('S')) {
      if (currentTime - this.lastKeyPressTime['s'] > this.KEY_PRESS_COOLDOWN) {
        if (this.camera7FocalLength !== '20mm') { this.camera7FocalLength = '20mm'; this.mainCamera.setFOV(70); }
        this.lastKeyPressTime['s'] = currentTime;
      }
    }
  }

  // ─── Point Light 16 color ────────────────────────────────────────────────────

  private handlePointLight16Color(): void {
    if (!this.pointLight16Actor || this.pointLight16Locked) return;
    const inputManager = this.world.inputManager;
    const currentTime  = performance.now();

    if ((inputManager.isKeyDown('l') || inputManager.isKeyDown('L')) &&
        currentTime - this.lastKeyPressTime['l'] > this.KEY_PRESS_COOLDOWN) {
      this.lastKeyPressTime['l'] = currentTime;
      const lightComponents = this.pointLight16Actor.getComponents(ENGINE.PointLightComponent);
      for (const light of lightComponents) {
        light.setColor(0xff0000);
      }
    }
  }

  private applyPointLight16Color(hexColor: number): void {
    if (!this.pointLight16Actor) return;
    const lightComponents = this.pointLight16Actor.getComponents(ENGINE.PointLightComponent);
    for (const light of lightComponents) {
      light.setColor(hexColor);
    }
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  private createCameraPositionLabel(): void {
    const hint = document.createElement('div');
    hint.style.cssText = [
      'position: absolute', 'bottom: 24px', 'right: 24px',
      'color: rgba(255,255,255,0.85)', "font-family: 'Space Mono', sans-serif", 'font-size: 16px',
      'font-weight: normal', 'letter-spacing: 1px', 'line-height: 1.8',
      'text-align: right', 'text-shadow: 0 1px 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
      'display: none', 'pointer-events: none', 'user-select: none',
    ].join(';');
    this.world.gameContainer?.appendChild(hint);
    this.cameraHintLabel = hint;

    this.createCameraNumbersDisplay();

    // Camera name label lives in the top-right column, below the status label.
    const label = document.createElement('div');
    label.style.cssText = [
      'color: white', "font-family: 'Space Mono', sans-serif", 'font-size: 32px', 'font-weight: bold',
      'letter-spacing: 3px', 'text-align: right',
      'text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
      'display: none', 'pointer-events: none', 'user-select: none',
    ].join(';');
    this.cameraColumnEl?.appendChild(label);
    this.cameraPositionLabel = label;

    this.createCameraGroupButtons();
    this.createSkipTutorialButton();
  }

  private createCameraNumbersDisplay(): void {
    // Outer column: always visible, aligns numbers row + status label to the right.
    const column = document.createElement('div');
    column.style.cssText = [
      'position: absolute', 'top: 24px', 'right: 24px',
      'display: flex', 'flex-direction: column', 'align-items: flex-end', 'gap: 8px',
      'pointer-events: none', 'user-select: none',
    ].join(';');
    this.world.gameContainer?.appendChild(column);
    this.cameraColumnEl = column;

    // Numbers row — starts hidden; shown when a camera group is active.
    const numbersRow = document.createElement('div');
    numbersRow.style.cssText = [
      'display: none', 'flex-direction: row', 'gap: 10px',
    ].join(';');
    column.appendChild(numbersRow);
    this.cameraNumbersContainer = numbersRow;

    // Status label — directly below the numbers row.
    const statusLabel = document.createElement('div');
    statusLabel.textContent = 'FREE CAMERA';
    statusLabel.style.cssText = [
      'color: rgba(255,255,255,0.5)',
      "font-family: 'Space Mono', sans-serif", 'font-size: 13px', 'font-weight: bold',
      'letter-spacing: 2px', 'text-align: right',
      'text-shadow: 0 1px 6px rgba(0,0,0,0.9)',
    ].join(';');
    column.appendChild(statusLabel);
    this.cameraStatusLabel = statusLabel;
  }

  private updateCameraStatusLabel(mode: 'controlled' | 'free'): void {
    if (!this.cameraStatusLabel) return;
    if (mode === 'controlled') {
      this.cameraStatusLabel.textContent = 'CAMERA CONTROLLED';
      this.cameraStatusLabel.style.color = 'rgba(255,200,80,0.9)';
    } else {
      this.cameraStatusLabel.textContent = 'FREE CAMERA';
      this.cameraStatusLabel.style.color = 'rgba(255,255,255,0.5)';
    }
  }

  private updateCameraNumbers(): void {
    if (!this.cameraNumbersContainer) return;
    const currentState = this.computeCameraState();
    let groupIndex = this.activeGroupIndex ?? this.CAMERA_GROUPS.findIndex(g => g.states.includes(currentState));
    if (groupIndex < 0) {
      this.cameraNumbersContainer.style.display = 'none';
      return;
    }

    const group     = this.CAMERA_GROUPS[groupIndex];
    const activeIdx = group.states.indexOf(currentState);
    const count     = group.states.length;

    if (this.cameraNumberElements.length !== count) {
      this.cameraNumbersContainer.innerHTML = '';
      this.cameraNumberElements = [];
      for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.textContent = String(i + 1);
        el.style.cssText = [
          "font-family: 'Space Mono', sans-serif", 'font-weight: bold', 'letter-spacing: 1px',
          'text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
          'transition: color 0.15s, font-size 0.15s',
        ].join(';');
        this.cameraNumbersContainer.appendChild(el);
        this.cameraNumberElements.push(el);
      }
    }

    this.cameraNumbersContainer.style.display = 'flex';
    this.cameraNumberElements.forEach((el, i) => {
      const deactivated = this.blackedOutStates.has(group.states[i]);
      el.style.color    = deactivated ? 'rgba(220,30,30,0.8)'
                        : i === activeIdx ? '#ffffff' : 'rgba(255,255,255,0.3)';
      el.style.fontSize = i === activeIdx ? '34px' : '28px';
    });
  }

  private createCameraGroupButtons(): void {
    // Outer column – centres the heading + buttons row together.
    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'position: absolute', 'bottom: 24px', 'left: 50%',
      'transform: translateX(-50%)',
      'display: flex', 'flex-direction: column', 'align-items: center', 'gap: 6px',
      'pointer-events: none', 'user-select: none',
    ].join(';');

    // "Camera Groups" heading above the buttons.
    const heading = document.createElement('div');
    heading.textContent = 'CAMERA GROUPS';
    heading.style.cssText = [
      'color: rgba(255,255,255,0.4)',
      "font-family: 'Space Mono', sans-serif", 'font-size: 11px', 'font-weight: bold',
      'letter-spacing: 4px',
      'text-shadow: 0 1px 4px rgba(0,0,0,0.8)',
      'pointer-events: none',
    ].join(';');
    wrapper.appendChild(heading);

    // Buttons row.
    const container = document.createElement('div');
    container.style.cssText = [
      'display: flex', 'gap: 6px',
      'pointer-events: auto',
    ].join(';');

    this.CAMERA_GROUPS.forEach((group, index) => {
      const btn = document.createElement('button');
      btn.textContent = group.label;
      btn.style.cssText = [
        'background: rgba(0,0,0,0.6)',
        'color: rgba(255,255,255,0.7)',
        'border: 1px solid rgba(255,255,255,0.25)',
        "font-family: 'Space Mono', sans-serif", 'font-size: 12px', 'font-weight: bold',
        'letter-spacing: 1.5px', 'padding: 7px 14px',
        'cursor: pointer', 'outline: none',
        'text-shadow: 0 1px 4px rgba(0,0,0,0.9)',
      ].join(';');

      btn.addEventListener('mouseenter', () => {
        if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.12)';
      });
      btn.addEventListener('mouseleave', () => {
        if (!btn.dataset.active) btn.style.background = 'rgba(0,0,0,0.6)';
      });
      btn.addEventListener('click', () => this.onGroupButtonClick(index));

      container.appendChild(btn);
      this.groupButtonElements.push(btn);
    });

    wrapper.appendChild(container);
    this.world.gameContainer?.appendChild(wrapper);
  }

  private createSkipTutorialButton(): void {
    const btn = document.createElement('div');
    btn.textContent = 'SKIP TUTORIAL';
    btn.style.cssText = [
      'position: absolute', 'bottom: 24px', 'left: 24px',
      'color: rgba(255,255,255,0.6)',
      "font-family: 'Space Mono', sans-serif",
      'font-size: 13px', 'font-weight: bold', 'letter-spacing: 3px',
      'text-shadow: 0 1px 6px rgba(0,0,0,0.9)',
      'padding: 6px 12px',
      'border: 1px solid rgba(255,255,255,0.25)',
      'cursor: pointer', 'user-select: none',
      'transition: color 0.15s, border-color 0.15s',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      btn.style.color = 'rgba(255,255,255,1)';
      btn.style.borderColor = 'rgba(255,255,255,0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.color = 'rgba(255,255,255,0.6)';
      btn.style.borderColor = 'rgba(255,255,255,0.25)';
    });
    btn.addEventListener('click', () => this.skipToVO10Base());
    this.world.gameContainer?.appendChild(btn);
    this.skipTutorialBtn = btn;
  }

  private dismissSkipTutorialButton(): void {
    if (this.skipTutorialBtn) {
      this.skipTutorialBtn.remove();
      this.skipTutorialBtn = null;
    }
  }

  private skipToVO10Base(): void {
    this.dismissSkipTutorialButton();

    // Cancel every running tutorial sequence — releases all key listeners and UI panels
    if (this.introSequence) {
      this.introSequence.destroy();
      this.introSequence = null;
    }
    if (this.functionalCam1Sequence) {
      this.functionalCam1Sequence.destroy();
      this.functionalCam1Sequence = null;
    }
    this.functionalCam1SequencePlayed = true;

    // Stop all audio (VO lines, ambience, soundtrack) and clear handles
    this.world.globalAudioManager.stopAllSounds();
    this.soundtrackHandle   = null;
    this.ambientSoundHandle = null;

    // Stop any in-progress tutorial animations
    this.stopFuelRiseAnimation();

    // Restore player input and camera control
    this.setInputEnabled(true);
    this.cameraInputBlocked = false;
    this.updateCameraStatusLabel('free');

    // Dismiss persistent map-hint panel if present
    if (this.hideMapHintCallback) {
      this.hideMapHintCallback();
      this.hideMapHintCallback = null;
    }

    // Jump to the post-tutorial world state
    this.switchToState('5.1');
    this.pointLight16Locked = true;
    this.applyPointLight16Color(0xff0000);
    this.startMobileMove();

    const ctx = (this.world.audioListener as THREE.AudioListener | null)?.context;
    const resume = ctx && ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    void resume.then(async () => {
      // Restart background audio that was cleared above
      this.soundtrackHandle = await this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/soundtrack.mp3',
        { volume: 1.0, loop: true },
      );
      await this.startAmbientForState(this.currentCameraState);

      // Play VO_10_base — this is the first thing the player hears post-skip
      const handle = await this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/VO_10_base.mp3',
        { volume: 1.0, loop: false, bus: 'Voice' },
      );
      if (!handle) {
        this.startFigureMove();
        this.startEnemyMoveAfterDelay();
        return;
      }
      const poll = () => {
        if (!this.world.globalAudioManager.isSoundPlaying(handle)) {
          this.startFigureMove();
          this.startEnemyMoveAfterDelay();
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  private onGroupButtonClick(groupIndex: number): void {
    if (groupIndex === this.FUNCTIONAL_GROUP_INDEX && this.isFunctionalGroupLocked()) return;
    const group   = this.CAMERA_GROUPS[groupIndex];
    const current = this.computeCameraState();
    const idxInGroup = group.states.indexOf(current);
    // Cycle through active (non-deactivated) states only
    const activeStates = group.states.filter(s => !this.blackedOutStates.has(s));
    if (activeStates.length === 0) return;
    const activeIdx = activeStates.indexOf(current);
    const nextState = activeIdx >= 0
      ? activeStates[(activeIdx + 1) % activeStates.length]
      : activeStates[0];
    this.activeGroupIndex = groupIndex;
    this.switchToState(nextState);
  }

  /** Returns the first non-deactivated state in a camera group, or null if all are deactivated. */
  private firstActiveStateInGroup(groupIndex: number): string | null {
    return this.CAMERA_GROUPS[groupIndex].states.find(s => !this.blackedOutStates.has(s)) ?? null;
  }

  private updateGroupButtonHighlights(): void {
    const current = this.computeCameraState();
    this.CAMERA_GROUPS.forEach((group, i) => {
      const btn = this.groupButtonElements[i];
      if (!btn) return;
      const locked = i === this.FUNCTIONAL_GROUP_INDEX && this.isFunctionalGroupLocked();
      if (locked) {
        btn.style.background  = 'rgba(0,0,0,0.3)';
        btn.style.borderColor = 'rgba(255,255,255,0.08)';
        btn.style.color       = 'rgba(255,255,255,0.2)';
        btn.style.cursor      = 'not-allowed';
        delete btn.dataset.active;
        return;
      }
      btn.style.cursor = 'pointer';
      const active = i === this.activeGroupIndex || group.states.includes(current);
      btn.style.background    = active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.6)';
      btn.style.borderColor   = active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)';
      btn.style.color         = active ? 'white' : 'rgba(255,255,255,0.7)';
      if (active) btn.dataset.active = '1'; else delete btn.dataset.active;
    });
  }

  private switchToState(state: string): void {
    this.isCamera1b = false; this.isCamera1c = false; this.isCamera1d = false;
    switch (state) {
      case '1.1':
        this.activeCamera = 1; this.activeCamera1Position = 0;
        this.configureCam(this.CAMERA1_POSITIONS[0], this.trueEndCameraTargetA ?? this.camera1StanTarget, 70, 0, true, false); break;
      case '1.2':
        this.activeCamera = 1; this.activeCamera1Position = 1;
        this.configureCam(this.CAMERA1_POSITIONS[1], this.CAMERA1_TARGETS_FIXED[1], 70, 0, true, false); break;
      case '1.3':
        this.activeCamera = 1; this.activeCamera1Position = 2;
        this.configureCam(this.CAMERA1_POSITIONS[2], this.CAMERA1_TARGETS_FIXED[2], 70, 0, true, false); break;
      case '1.1b':
        this.activeCamera = 1; this.activeCamera1Position = 0; this.isCamera1b = true;
        this.configureCam(this.CAM1B_POSITION, this.CAM1B_TARGET, 65, 0, false, true); break;
      case '1.2b':
        this.activeCamera = 1; this.activeCamera1Position = 1; this.isCamera1d = true;
        this.configureCam(this.CAM1D_POSITION, this.CAM1D_TARGET, 70, 0, false, true); break;
      case '1.3b':
        this.activeCamera = 1; this.activeCamera1Position = 2; this.isCamera1c = true;
        this.configureCam(this.CAM1C_POSITION, this.CAM1C_TARGET, 65, 0, false, true); break;
      case '2':
        this.activeCamera = 2; this.camera2DollyOffset = 0;
        this.configureCam(this.camera2BasePosition, this.camera2Target, 94, 90, true, false); break;
      case '3.1':
        this.activeCamera = 3; this.activeCamera3Position = 0;
        this.configureCam(this.CAMERA3_POSITIONS[0], this.trueEndCameraTargetA ?? this.CAMERA3_TARGETS[0], this.CAMERA3_FOVS[0], 0, false, false); break;
      case '3.2':
        this.activeCamera = 3; this.activeCamera3Position = 1;
        this.configureCam(this.CAMERA3_POSITIONS[1], this.CAMERA3_TARGETS[1], this.CAMERA3_FOVS[1], 0, false, false); break;
      case '3.3':
        this.activeCamera = 3; this.activeCamera3Position = 2;
        this.configureCam(this.CAMERA3_POSITIONS[2], this.CAMERA3_TARGETS[2], this.CAMERA3_FOVS[2], 0, false, false); break;
      case '3.4':
        this.activeCamera = 3; this.activeCamera3Position = 3;
        this.configureCam(this.CAMERA3_POSITIONS[3], this.CAMERA3_TARGETS[3], this.CAMERA3_FOVS[3], 0, false, false); break;
      case '4':
        this.activeCamera = 4;
        this.camera4SideOffset = 0;
        this.camera4HoverTime  = 0;
        this.configureCam(this.camera4EndPos, this.camera4Target, 70, 0, false, false); break;
      case '5.1':
        this.activeCamera = 5; this.activeCamera5Position = 0; this.camera5FocalIndex = 0;
        this.configureCam(this.CAMERA5_POSITIONS[0], this.CAMERA5_TARGET, this.CAMERA5_FOCAL_STEPS[0].fov, 0, false, false); break;
      case '5.2':
        this.activeCamera = 5; this.activeCamera5Position = 1; this.camera5FocalIndex = 0;
        this.configureCam(this.CAMERA5_POSITIONS[1], this.CAMERA5_TARGET, this.CAMERA5_FOCAL_STEPS[0].fov, 0, false, false); break;
      case '5.3':
        this.activeCamera = 5; this.activeCamera5Position = 2; this.camera5FocalIndex = 0;
        this.configureCam(this.CAMERA5_POSITIONS[2], this.CAMERA5_TARGET, this.CAMERA5_FOCAL_STEPS[0].fov, 0, false, false); break;
      case '6.1':
        this.activeCamera = 6; this.activeCamera6Position = 0;
        this.configureCam(this.CAMERA6_POSITIONS[0], this.trueEndCameraTargetB ?? this.CAMERA6_TARGETS[0], this.trueEndExtrasActive ? 85 : 70, 0, false, true); break;
      case '6.2':
        this.activeCamera = 6; this.activeCamera6Position = 1;
        this.configureCam(this.CAMERA6_POSITIONS[1], this.CAMERA6_TARGETS[1], 70, 0, false, true); break;
      case '6.3':
        this.activeCamera = 6; this.activeCamera6Position = 2;
        this.configureCam(this.CAMERA6_POSITIONS[2], this.CAMERA6_TARGETS[2], 70, 0, false, true); break;
      case '6.4':
        this.activeCamera = 6; this.activeCamera6Position = 3;
        this.configureCam(this.CAMERA6_POSITIONS[3], this.CAMERA6_TARGETS[3], 70, 0, false, true); break;
      case '7':
        this.activeCamera = 7; this.camera7FocalLength = '20mm';
        this.configureCam(this.CAM7_POSITION, this.trueEndCameraTargetB ?? this.CAM7_TARGET, 70, 0, false, false); break;
      default: return;
    }
    this.updateCameraPositionLabel();
  }

  private computeCameraState(): string {
    switch (this.activeCamera) {
      case 1:
        if (this.isCamera1b) return '1.1b';
        if (this.isCamera1d) return '1.2b';
        if (this.isCamera1c) return '1.3b';
        return `1.${this.activeCamera1Position + 1}`;
      case 2: return '2';
      case 3: return `3.${this.activeCamera3Position + 1}`;
      case 4: return '4';
      case 5: return `5.${this.activeCamera5Position + 1}`;
      case 6: return `6.${this.activeCamera6Position + 1}`;
      case 7: return '7';
    }
  }

  private getStateDisplayName(state: string): string {
    const prefixes = ['OUTDOOR', 'BASE CAM', 'RESOURCES', 'FUNCTIONAL'];
    for (let g = 0; g < this.CAMERA_GROUPS.length; g++) {
      const idx = this.CAMERA_GROUPS[g].states.indexOf(state);
      if (idx >= 0) return `${prefixes[g]} ${idx + 1}`;
    }
    return `CAM ${state}`;
  }

  private updateCameraPositionLabel(): void {
    if (!this.cameraPositionLabel) return;

    const state = this.computeCameraState();
    const text  = state ? this.getStateDisplayName(state) : '';

    let rotateHint = '';
    switch (state) {
      case '1.1': case '1.2': case '1.3':
      case '2':
        rotateHint = '← → ↑ ↓  —  rotate camera'; break;
      case '1.1b': case '1.2b': case '1.3b':
      case '4':
      case '6.1': case '6.2': case '6.3': case '6.4':
        rotateHint = '← →  —  rotate camera'; break;
    }

    this.cameraPositionLabel.textContent = text;
    this.cameraPositionLabel.style.display = text ? 'block' : 'none';

    if (this.cameraHintLabel) {
      const bold = (s: string) => `<span style="font-weight:bold">${s}</span>`;
      const thin = (s: string) => `<span style="font-weight:300;opacity:0.65">${s}</span>`;

      const lines: string[] = [
        bold('A / D  —  CHANGE CAMERA GROUP'),
        bold('1 – 8  —  CHANGE CAMERA'),
        ...(rotateHint ? [bold(rotateHint.toUpperCase())] : []),
      ];
      this.cameraHintLabel.innerHTML = lines.join('<br>');
      this.cameraHintLabel.style.display = 'block';
    }

    this.updateGroupButtonHighlights();
    this.updateCameraNumbers();
    this.onCameraStateChanged(state);
  }

  // ─── Animation state helpers ────────────────────────────────────────────────

  private startBubbleAnimation(): void {
    if (this.bubbleActive) return;
    const actors = this.findActorsByDisplayNamePrefix('bubb');
    if (actors.length === 0) return;
    this.bubbleStates = actors.map(actor => {
      actor.setHidden(false);
      const originY = actor.getWorldPosition().y;
      return { actor, originY, startY: originY, delay: Math.random() * this.BUBBLE_MAX_DELAY, elapsed: 0, done: false };
    });
    this.bubbleActive = true;
  }

  private stopBubbleAnimation(): void {
    if (!this.bubbleActive) return;
    this.bubbleActive = false;
    for (const state of this.bubbleStates) {
      const pos = state.actor.getWorldPosition(); pos.y = state.originY;
      state.actor.setWorldPosition(pos); state.actor.setHidden(false);
    }
    this.bubbleStates = [];
  }

  private startPrintAnimation(): void {
    if (this.printScaleActive) return;
    this.printScaleActive = true;
    this.pickNewPrintScaleTarget(this.printCurrentScale, this.printScaleTarget);
    this.pickNewPrintScaleTarget(this.print2CurrentScale, this.print2ScaleTarget);
  }

  private stopPrintAnimation(): void {
    if (!this.printScaleActive) return;
    this.printScaleActive = false;
    this.printCurrentScale.set(0.41, 0.18, 0.3);
    this.print2CurrentScale.set(0.41, 0.18, 0.3);
    if (this.printActor)  this.printActor.setWorldScale(this.printCurrentScale.clone());
    if (this.print2Actor) this.print2Actor.setWorldScale(this.print2CurrentScale.clone());
  }

  private startGeneratorAnimation(): void {
    if (this.genActive) return;
    this.genActive = true;
    this.genStartLoop();
  }

  private stopGeneratorAnimation(): void {
    if (!this.genActive) return;
    this.genActive = false;
    this.genStep = 0; this.genProgress = 0;
    this.genSliderReturnActive = false; this.genSliderReturnProgress = 0;
    this.genDoorClosing = false; this.genDoorCloseProgress = 0;
    if (this.genSliderActor) this.genSliderActor.setWorldPosition(this.GEN_SLIDER_STEP1_START.clone());
    if (this.genCoalActor)   this.genCoalActor.setWorldPosition(this.GEN_COAL_STEP2_START.clone());
    if (this.genDoorActor)   this.genDoorActor.setWorldPosition(this.GEN_DOOR_STEP3_START.clone());
  }

  private startElevatorAnimation(): void {
    if (this.elevatorActivated) return;
    this.elevatorActivated = true;
    this.elevatorProgress  = 0;
    this.elevatorIsMoving  = true;
  }

  private onCameraStateChanged(newState: string): void {
    const prev = this.currentCameraState;
    if (prev === newState) return;
    this.currentCameraState = newState;

    const yStates = ['1.1', '1.1b'];
    const pStates = ['1.2', '1.2b'];
    const kStates = ['1.3', '1.3b', '5.1'];
    const eStates = ['6.3'];

    if (yStates.includes(prev) && !yStates.includes(newState)) this.stopBubbleAnimation();
    if (!yStates.includes(prev) && yStates.includes(newState)) this.startBubbleAnimation();
    if (pStates.includes(prev) && !pStates.includes(newState)) this.stopPrintAnimation();
    if (!pStates.includes(prev) && pStates.includes(newState)) this.startPrintAnimation();
    if (kStates.includes(prev) && !kStates.includes(newState)) this.stopGeneratorAnimation();
    if (!kStates.includes(prev) && kStates.includes(newState)) this.startGeneratorAnimation();
    if (eStates.includes(newState)) this.startElevatorAnimation();

    if (newState === '3.3') this.startFuelCam33Animation();
    if (prev === '3.3' && newState !== '3.3') this.stopFuelCam33Animation();

    if (newState === '2') this.triggerFunctionalCam1Sequence();

    // Typing sound for '6.1' and '7' after TrueEnd redirect
    if (this.trueEndExtrasActive) {
      const typingStates = ['6.1', '7'];
      const enteringTyping = typingStates.includes(newState) && !typingStates.includes(prev);
      const leavingTyping  = typingStates.includes(prev)    && !typingStates.includes(newState);
      if (enteringTyping) this.startTypingSound();
      if (leavingTyping)  this.stopTypingSound();
    }

    this.updateAmbientAudio(newState);
  }

  private triggerFunctionalCam1Sequence(): void {
    if (this.functionalCam1SequencePlayed) return;
    this.functionalCam1SequencePlayed = true;

    // Dismiss the persistent map hint that was shown after the intro sequence.
    if (this.hideMapHintCallback) {
      this.hideMapHintCallback();
      this.hideMapHintCallback = null;
    }

    // Cancel any previously running instance before starting fresh.
    if (this.functionalCam1Sequence) {
      this.functionalCam1Sequence.destroy();
      this.cameraInputBlocked = false;
    }

    this.functionalCam1Sequence = new FunctionalCam1Sequence({
      switchToState: (state) => this.switchToState(state),
      blockCameraInput: (blocked) => {
        this.cameraInputBlocked = blocked;
        this.updateCameraStatusLabel(blocked ? 'controlled' : 'free');
      },
      setPointLight16ColorLocked: (hexColor) => {
        this.pointLight16Locked = true;
        this.applyPointLight16Color(hexColor);
      },
      playGlobalSound: (url) =>
        this.world.globalAudioManager.playGlobalSound(url, {
          volume: 1.0,
          loop: false,
          bus: 'Voice',
        }),
      isSoundPlaying: (handle) =>
        this.world.globalAudioManager.isSoundPlaying(handle),
      resumeAudioContext: async () => {
        const ctx = (this.world.audioListener as THREE.AudioListener | null)?.context;
        if (ctx && ctx.state === 'suspended') {
          await ctx.resume();
        }
      },
      gameContainer: this.world.gameContainer ?? null,
      startMobileAnimation: () => this.startMobileMove(),
      onVO10BaseStart: () => this.dismissSkipTutorialButton(),
      onVO10BaseEnd: () => { this.startFigureMove(); this.startEnemyMoveAfterDelay(); },
    });

    this.functionalCam1Sequence.run().catch(err => {
      if (!(err instanceof FuncCam1CancelledError)) console.error('[FunctionalCam1Sequence] Sequence error:', err);
    });
  }

  // ─── Audio ───────────────────────────────────────────────────────────────────

  private registerAudioOnInteraction(): void {
    const onInteraction = () => {
      document.removeEventListener('keydown', onInteraction);
      document.removeEventListener('click', onInteraction);
      void this.initializeAudio();
    };
    document.addEventListener('keydown', onInteraction);
    document.addEventListener('click', onInteraction);
  }

  private async initializeAudio(): Promise<void> {
    if (this.audioInitialized) return;
    this.audioInitialized = true;

    const audioContext = (this.world.audioListener as THREE.AudioListener | null)?.context;
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    this.soundtrackHandle = await this.world.globalAudioManager.playGlobalSound(
      '@project/assets/sounds/soundtrack.mp3',
      { volume: 1.0, loop: true },
    );

    await this.startAmbientForState(this.currentCameraState);
  }

  private async startAmbientForState(state: string): Promise<void> {
    const audioManager = this.world.globalAudioManager;

    if (this.ambientSoundHandle) {
      audioManager.stopSound(this.ambientSoundHandle);
      this.ambientSoundHandle = null;
    }

    let url: string | null = null;
    if (this.DESERT_STATES.has(state)) {
      url = '@project/assets/sounds/desert.mp3';
    } else if (this.HOWLING_STATES.has(state)) {
      url = '@project/assets/sounds/howling.mp3';
    }

    if (url) {
      this.ambientSoundHandle = await audioManager.playGlobalSound(url, { volume: 1.0, loop: true });
    }
  }

  private updateAmbientAudio(state: string): void {
    if (!this.audioInitialized) return;
    void this.startAmbientForState(state);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  private async waitForLevelLoad(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private findActorByName(namePattern: string): ENGINE.Actor | null {
    return this.world.getActors().find(a =>
      a.name.toLowerCase().includes(namePattern.toLowerCase())
    ) ?? null;
  }

  /**
   * Traverses the Three.js scene graph inside an actor's root component looking for
   * any Object3D whose name contains `pattern`. Works in both editor and published builds.
   */
  private findActorByMeshName(pattern: string): ENGINE.Actor | null {
    const key = pattern.toLowerCase();
    for (const actor of this.world.getActors()) {
      const root = actor.rootComponent as unknown as THREE.Object3D;
      if (!root) continue;
      let found = false;
      root.traverse((obj: THREE.Object3D) => {
        if (!found && obj.name.toLowerCase().includes(key)) found = true;
      });
      if (found) return actor;
    }
    return null;
  }

  /**
   * Like findActorByMeshName but returns all actors that have at least one
   * Object3D node whose name STARTS WITH `prefix`.
   */
  private findActorsByMeshNamePrefix(prefix: string): ENGINE.Actor[] {
    const key = prefix.toLowerCase();
    const result: ENGINE.Actor[] = [];
    for (const actor of this.world.getActors()) {
      const root = actor.rootComponent as unknown as THREE.Object3D;
      if (!root) continue;
      let found = false;
      root.traverse((obj: THREE.Object3D) => {
        if (!found && obj.name.toLowerCase().startsWith(key)) found = true;
      });
      if (found) result.push(actor);
    }
    return result;
  }

  private findActorsByDisplayNamePrefix(prefix: string): ENGINE.Actor[] {
    const key = prefix.toLowerCase();
    // editor / dev builds: editorData.displayName is populated
    const byEditorData = this.world.getActors().filter(actor => {
      const ed = (actor as unknown as { editorData?: { displayName?: string } }).editorData;
      return ed?.displayName?.toLowerCase().startsWith(key);
    });
    if (byEditorData.length > 0) return byEditorData;

    // actor.name fallback (may contain the name if serialized)
    const byName = this.world.getActors().filter(a => a.name.toLowerCase().startsWith(key));
    if (byName.length > 0) return byName;

    // published builds: traverse the Three.js hierarchy for mesh names
    return this.findActorsByMeshNamePrefix(key);
  }

  private findActorByDisplayName(displayName: string): ENGINE.Actor | null {
    const key = displayName.toLowerCase();
    // editor / dev builds
    const byEditorData = this.world.getActors().find(actor => {
      const ed = (actor as unknown as { editorData?: { displayName?: string } }).editorData;
      return ed?.displayName?.toLowerCase() === key;
    }) ?? null;
    if (byEditorData) return byEditorData;

    // actor.name fallback
    const byName = this.findActorByName(key);
    if (byName) return byName;

    // published builds: traverse Three.js hierarchy
    return this.findActorByMeshName(key);
  }

  private findActorNearPosition(position: THREE.Vector3, threshold: number): ENGINE.Actor | null {
    let closestActor: ENGINE.Actor | null = null;
    let minDistance = threshold;
    for (const actor of this.world.getActors()) {
      const d = actor.getWorldPosition().distanceTo(position);
      if (d < minDistance) { minDistance = d; closestActor = actor; }
    }
    return closestActor;
  }

  // ─── Hills ───────────────────────────────────────────────────────────────────

  private handleHillsMove(deltaTime: number): void {
    // Lazy-init: keep retrying until found (works when Three.js meshes finish loading after preStart)
    if (!this.hill1Actor) {
      this.hill1Actor = this.findActorByDisplayName('hill1');
      if (this.hill1Actor) { const p = this.hill1Actor.getWorldPosition(); p.x = this.HILL1_START_X; this.hill1Actor.setWorldPosition(p); }
    }
    if (!this.hill2Actor) {
      this.hill2Actor = this.findActorByDisplayName('hill2');
      if (this.hill2Actor) { const p = this.hill2Actor.getWorldPosition(); p.x = this.HILL2_START_X; p.y = this.HILL2_START_Y; this.hill2Actor.setWorldPosition(p); }
    }
    if (!this.hill3Actor) {
      this.hill3Actor = this.findActorByDisplayName('hill3');
      if (this.hill3Actor) { const p = this.hill3Actor.getWorldPosition(); p.x = this.HILL3_START_X; this.hill3Actor.setWorldPosition(p); }
    }
    if (!this.hill4Actor) {
      this.hill4Actor = this.findActorByDisplayName('hill4');
      if (this.hill4Actor) { const p = this.hill4Actor.getWorldPosition(); p.x = this.HILL4_START_X; this.hill4Actor.setWorldPosition(p); }
    }

    const inputManager = this.world.inputManager;
    const currentTime  = performance.now();
    const hPressed = (inputManager.isKeyDown('h') || inputManager.isKeyDown('H'))
      && currentTime - this.lastKeyPressTime['h'] > this.KEY_PRESS_COOLDOWN;

    if (hPressed) {
      this.lastKeyPressTime['h'] = currentTime;
      if (!this.hillsActivated) {
        this.hillsActivated = true;
      } else {
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

    this.tickHill('hill1', this.hill1Actor, this.HILL1_TARGET_X, deltaTime, hPressed && this.hillsActivated, this.hill1MoveStartPos, this.hill1MoveTargetPos, () => this.hill1MoveProgress, v => { this.hill1MoveProgress = v; }, () => this.hill1IsMoving, v => { this.hill1IsMoving = v; });
    this.tickHill('hill2', this.hill2Actor, this.HILL2_TARGET_X, deltaTime, hPressed && this.hillsActivated, this.hill2MoveStartPos, this.hill2MoveTargetPos, () => this.hill2MoveProgress, v => { this.hill2MoveProgress = v; }, () => this.hill2IsMoving, v => { this.hill2IsMoving = v; });
    this.handleHill2YDescent(deltaTime);
    this.tickHill('hill3', this.hill3Actor, this.HILL3_TARGET_X, deltaTime, hPressed && this.hillsActivated, this.hill3MoveStartPos, this.hill3MoveTargetPos, () => this.hill3MoveProgress, v => { this.hill3MoveProgress = v; }, () => this.hill3IsMoving, v => { this.hill3IsMoving = v; });
    this.tickHill('hill4', this.hill4Actor, this.HILL4_TARGET_X, deltaTime, hPressed && this.hillsActivated, this.hill4MoveStartPos, this.hill4MoveTargetPos, () => this.hill4MoveProgress, v => { this.hill4MoveProgress = v; }, () => this.hill4IsMoving, v => { this.hill4IsMoving = v; });
  }

  private handleHill2YDescent(_deltaTime: number): void {
    if (!this.hill2Actor) return;
    if (!this.hill2IsMoving && this.hill2MoveProgress <= 0) return;
    const triggerProgress = (this.HILL2_START_X - this.HILL2_DESCENT_TRIGGER_X) / (this.HILL2_START_X - this.HILL2_TARGET_X);
    const yProgress = Math.min(this.hill2MoveProgress / triggerProgress, 1);
    const newY = this.HILL2_START_Y + (this.HILL2_DESCENT_TARGET_Y - this.HILL2_START_Y) * yProgress;
    const pos = this.hill2Actor.getWorldPosition(); pos.y = newY; this.hill2Actor.setWorldPosition(pos);
  }

  // ─── Barriers ────────────────────────────────────────────────────────────────

  private registerBarrierKeyListener(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'b' && e.key !== 'B') return;
      const now = performance.now();
      if (now - this.barrierKeyPressTime < this.KEY_PRESS_COOLDOWN) return;
      this.barrierKeyPressTime = now;
      this.toggleBarrier();
    });
  }

  // ─── Ending system ───────────────────────────────────────────────────────────

  private registerEndingKeyListener(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (this.enemyPhase !== 'scanning') return;
      if (this.endingTriggered) return;
      this.endingTriggered = true;

      if (this.scanningTaskHideCallback) {
        this.scanningTaskHideCallback();
        this.scanningTaskHideCallback = null;
      }

      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/generator_expl.mp3', { volume: 1.0, loop: false },
      );

      const elapsedScan = this.scanPhaseProg * this.SCAN_PHASE_DUR;
      const isTrueEnd   = elapsedScan >= this.TRUEEND_START_S && elapsedScan <= this.TRUEEND_END_S;
      if (isTrueEnd) {
        // Stop scanning tick so it no longer overwrites actor positions
        this.enemyPhase = 'idle';

        if (this.enemyActor) {
          this.enemyActor.setWorldPosition(new THREE.Vector3(73, 14, -5));
          this.enemyActor.setWorldRotation(new THREE.Euler(
            THREE.MathUtils.degToRad(-21),
            THREE.MathUtils.degToRad(-37),
            THREE.MathUtils.degToRad(-32),
          ));
        }
        if (this.scanActor) {
          this.scanActor.setWorldPosition(new THREE.Vector3(-8, -35, -20));
        }
        const am = this.world.globalAudioManager;
        if (this.soundtrackHandle)    { am.stopSound(this.soundtrackHandle);    this.soundtrackHandle    = null; }
        if (this.alarmHandle)         { am.stopSound(this.alarmHandle);         this.alarmHandle         = null; }
        if (this.enemyLoopHandle)     { am.stopSound(this.enemyLoopHandle);     this.enemyLoopHandle     = null; }
        if (this.scanningThemeHandle) { am.stopSound(this.scanningThemeHandle); this.scanningThemeHandle = null; }
        if (this.scanSound1Handle)    { am.stopSound(this.scanSound1Handle);    this.scanSound1Handle    = null; }
      }
      this.showEndingOverlay(isTrueEnd ? 'yes' : 'no');
    });
  }

  private showEndingOverlay(text: 'yes' | 'no'): void {
    if (text === 'no') {
      this.showFalseEndScreen();
      return;
    }

    // TrueEnd: 1 s → impact_sound, 4 s → camera shake, 7 s → VO_13_end, 37 s → camera redirect
    setTimeout(() => {
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/impact_sound.mp3',
        { volume: 1.0, loop: false },
      );
    }, 1_000);

    setTimeout(() => { this.startCameraShake(); }, 4_000);

    setTimeout(() => {
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/VO_13_end.mp3',
        { volume: 1.0, loop: false, bus: 'Voice' },
      ).then(h => { if (h) this.pollVO13EndFinish(h); });
    }, 7_000);

    setTimeout(() => { this.activateTrueEndCameraRedirect(); }, 37_000);
  }

  private pollVO13EndFinish(handle: ENGINE.SoundHandle): void {
    const check = () => {
      if (!this.world.globalAudioManager.isSoundPlaying(handle)) {
        // VO_13_end finished — 20 s later show "End of Act I", 5 s after that reload
        setTimeout(() => { this.showEndOfActI(); }, 20_000);
        return;
      }
      setTimeout(check, 200);
    };
    setTimeout(check, 200);
  }

  private showEndOfActI(): void {
    const container = this.world.gameContainer;
    if (!container) return;

    const btn = document.createElement('button');
    btn.textContent = 'End of Act I';
    btn.style.cssText = [
      'position:absolute', 'bottom:24px', 'left:24px',
      "font-family:'Space Mono',monospace",
      'font-size:28px', 'font-weight:bold',
      'color:white',
      'background:transparent',
      'border:none',
      'letter-spacing:0.1em',
      'text-shadow:0 0 20px rgba(255,255,255,0.5)',
      'cursor:pointer',
      'pointer-events:auto', 'user-select:none',
      'z-index:2000',
      'padding:0',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      btn.style.textShadow = '0 0 30px rgba(255,255,255,0.9)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.textShadow = '0 0 20px rgba(255,255,255,0.5)';
    });
    btn.addEventListener('click', () => { window.location.reload(); });
    container.appendChild(btn);
  }

  private startTypingSound(): void {
    if (this.typingSoundHandle) return;
    void this.world.globalAudioManager.playGlobalSound(
      '@project/assets/sounds/typing_sound.mp3',
      { volume: 1.0, loop: true },
    ).then(h => { this.typingSoundHandle = h; });
  }

  private stopTypingSound(): void {
    if (!this.typingSoundHandle) return;
    this.world.globalAudioManager.stopSound(this.typingSoundHandle);
    this.typingSoundHandle = null;
  }

  private async scheduleTaskPanelAtHalfVO12(): Promise<void> {
    const container = this.world.gameContainer;
    if (!container) return;

    const FALLBACK_HALF_MS = 45_000;
    let halfMs = FALLBACK_HALF_MS;

    try {
      const resolved = await ENGINE.resolveAssetPathsInText(
        'src="@project/assets/sounds/VO_12_scaning.mp3"',
      );
      const match = resolved.match(/src="([^"]+)"/);
      const url = match?.[1];
      if (url) {
        const audioCtx = (this.world.audioListener as THREE.AudioListener | null)?.context;
        if (audioCtx) {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          halfMs = (audioBuffer.duration / 2) * 1000;
        }
      }
    } catch (err) {
      console.warn('[ScanningTask] Audio duration fallback used:', err);
    }

    setTimeout(() => {
      if (this.endingTriggered) return;
      this.scanningTaskHideCallback = createTaskPanel(container, [
        { text: 'PRESS ENTER TO DISCHARGE' },
      ]);
    }, halfMs);
  }

  private startCameraShake(): void {
    this.cameraShakeActive  = true;
    this.cameraShakeElapsed = 0;
  }

  private activateTrueEndCameraRedirect(): void {
    // Restore all cameras from blackout
    this.blackedOutStates.clear();
    this.updateCameraNumbers();
    this.updateGroupButtonHighlights();

    // Lower Outdoor 6 (cam '4') position by 15 units
    this.camera4EndPos.y -= 15;

    // Point the 4 designated cameras at their respective targets + enable extras (FOV boost, typing sound)
    this.trueEndCameraTargetA = this.TRUEEND_CAMERA_TARGET_A.clone();
    this.trueEndCameraTargetB = this.TRUEEND_CAMERA_TARGET_B.clone();
    this.trueEndExtrasActive  = true;
    const current = this.computeCameraState();
    if (this.TRUEEND_REDIRECTED_STATES.has(current)) {
      this.switchToState(current);
    }
    // Start typing sound immediately if already on one of the two target states
    if (current === '6.1' || current === '7') {
      this.startTypingSound();
    }
  }

  private handleCameraShake(deltaTime: number): void {
    if (!this.cameraShakeActive || !this.mainCamera) return;

    const computeOffset = (t: number, progress: number): THREE.Vector3 => {
      const intensity = this.CAMERA_SHAKE_INTENSITY * (1 - progress);
      return new THREE.Vector3(
        Math.sin(t * 43.7 + 1.1) * Math.cos(t * 29.3 + 0.7) * intensity,
        Math.sin(t * 37.1 + 2.3) * Math.cos(t * 23.9 + 1.5) * intensity,
        0,
      );
    };

    const prevElapsed  = this.cameraShakeElapsed;
    const prevProgress = Math.min(prevElapsed / this.CAMERA_SHAKE_DURATION, 1);
    const prevOffset   = computeOffset(prevElapsed, prevProgress);

    this.cameraShakeElapsed = Math.min(
      this.cameraShakeElapsed + deltaTime, this.CAMERA_SHAKE_DURATION,
    );
    const currProgress = this.cameraShakeElapsed / this.CAMERA_SHAKE_DURATION;
    const currOffset   = currProgress >= 1
      ? new THREE.Vector3()
      : computeOffset(this.cameraShakeElapsed, currProgress);

    const pos = this.mainCamera.getWorldPosition();
    pos.sub(prevOffset).add(currOffset);
    this.mainCamera.setWorldPosition(pos);

    if (currProgress >= 1) this.cameraShakeActive = false;
  }

  private showFalseEndScreen(): void {
    const container = this.world.gameContainer;
    if (!container) return;

    // Stop all audio immediately
    this.world.globalAudioManager.stopAllSounds();
    this.soundtrackHandle  = null;
    this.ambientSoundHandle = null;

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position: absolute', 'inset: 0',
      'background: #000',
      'display: flex', 'flex-direction: column',
      'align-items: center', 'justify-content: center',
      'gap: 52px',
      'pointer-events: auto', 'user-select: none',
      'z-index: 1000',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'CONNECTION LOST';
    title.style.cssText = [
      "font-family: 'Space Mono', monospace",
      'font-size: 72px', 'font-weight: bold',
      'color: white',
      'letter-spacing: 0.18em',
      'text-shadow: 0 0 40px rgba(255,255,255,0.45)',
    ].join(';');

    const btn = document.createElement('button');
    btn.textContent = 'RESTORE SAVE 138-A';
    btn.style.cssText = [
      "font-family: 'Space Mono', monospace",
      'font-size: 18px', 'font-weight: bold',
      'color: white',
      'background: transparent',
      'border: 2px solid rgba(255,255,255,0.55)',
      'padding: 14px 36px',
      'letter-spacing: 0.14em',
      'cursor: pointer',
      'outline: none',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      btn.style.background    = 'rgba(255,255,255,0.12)';
      btn.style.borderColor   = 'rgba(255,255,255,0.95)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background    = 'transparent';
      btn.style.borderColor   = 'rgba(255,255,255,0.55)';
    });
    btn.addEventListener('click', () => {
      window.location.reload();
    });

    overlay.appendChild(title);
    overlay.appendChild(btn);
    container.appendChild(overlay);
    this.endingOverlayEl = overlay;
  }

  private toggleBarrier(): void {
    if (this.barrierActors.length === 0) {
      this.barrierActors = this.findActorsByDisplayNamePrefix('barrier');
      for (const actor of this.barrierActors) { const pos = actor.getWorldPosition(); pos.y = this.BARRIER_START_Y; actor.setWorldPosition(pos); }
    }
    if (this.barrierActors.length === 0) return;

    if (!this.barrierActivated) {
      this.barrierActivated    = true;
      this.barrierRiseStartY   = this.barrierActors.map(a => a.getWorldPosition().y);
      this.barrierRiseProgress = 0;
      this.barrierIsRising     = true;
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/barriers.mp3', { volume: 1.0, loop: false },
      );
      // Auto-reset after 30 seconds
      if (this.barrierResetTimerId !== null) clearTimeout(this.barrierResetTimerId);
      this.barrierResetTimerId = setTimeout(() => { this.resetBarriers(); }, this.BARRIER_AUTO_RESET_S * 1_000);
    } else {
      if (this.barrierResetTimerId !== null) { clearTimeout(this.barrierResetTimerId); this.barrierResetTimerId = null; }
      this.resetBarriers();
    }
  }

  private resetBarriers(): void {
    this.barrierActivated    = false;
    this.barrierIsRising     = false;
    this.barrierRiseProgress = 0;
    this.barrierResetTimerId = null;
    for (const actor of this.barrierActors) { const pos = actor.getWorldPosition(); pos.y = this.BARRIER_START_Y; actor.setWorldPosition(pos); }
  }

  private handleBarrierRise(deltaTime: number): void {
    if (this.barrierActors.length === 0) {
      this.barrierActors = this.findActorsByDisplayNamePrefix('barrier');
      if (this.barrierActors.length > 0) {
        for (const actor of this.barrierActors) { const pos = actor.getWorldPosition(); pos.y = this.BARRIER_START_Y; actor.setWorldPosition(pos); }
      }
    }
    if (!this.barrierIsRising) return;

    this.barrierRiseProgress = Math.min(this.barrierRiseProgress + deltaTime / this.BARRIER_RISE_DURATION, 1);
    const t = this.barrierRiseProgress;
    for (let i = 0; i < this.barrierActors.length; i++) {
      const pos = this.barrierActors[i].getWorldPosition();
      pos.y = this.barrierRiseStartY[i] + (this.BARRIER_TARGET_Y - this.barrierRiseStartY[i]) * t;
      this.barrierActors[i].setWorldPosition(pos);
    }
    if (this.barrierRiseProgress >= 1) this.barrierIsRising = false;
  }

  // ─── Independent fuel rise (intro sequence phase 8 only) ────────────────────

  private startFuelRiseAnimation(): void {
    if (!this.fuelActor) {
      this.fuelActor = this.findActorByDisplayName('fuel');
    }
    if (this.fuelActor) this.fuelActor.setWorldPosition(this.FUEL_START_POS.clone());
    this.fuelRiseProgress = 0;
    this.fuelRiseActive   = true;
  }

  private stopFuelRiseAnimation(): void {
    this.fuelRiseActive   = false;
    this.fuelRiseProgress = 0;
    if (this.fuelActor) this.fuelActor.setWorldPosition(this.FUEL_START_POS.clone());
  }

  private handleFuelRise(deltaTime: number): void {
    if (!this.fuelRiseActive || !this.fuelActor) return;
    this.fuelRiseProgress = Math.min(this.fuelRiseProgress + deltaTime / this.FUEL_RISE_DURATION, 1);
    const fuelPos = this.FUEL_START_POS.clone();
    fuelPos.y = this.FUEL_START_POS.y + (this.FUEL_END_Y - this.FUEL_START_POS.y) * this.fuelRiseProgress;
    this.fuelActor.setWorldPosition(fuelPos);
    if (this.fuelRiseProgress >= 1) this.fuelRiseActive = false;
  }

  // ─── Print scale ─────────────────────────────────────────────────────────────

  private handlePrintScale(deltaTime: number): void {
    if (!this.printActor) {
      this.printActor = this.findActorByDisplayName('print');
      if (this.printActor) this.printActor.setWorldScale(this.printCurrentScale.clone());
    }
    if (!this.print2Actor) {
      this.print2Actor = this.findActorByDisplayName('print_02');
      if (this.print2Actor) this.print2Actor.setWorldScale(this.print2CurrentScale.clone());
    }

    if (!this.printScaleActive) return;
    const move = this.PRINT_SCALE_SPEED * deltaTime;
    if (this.printActor) {
      if (this.tickPrintScale(this.printCurrentScale, this.printScaleTarget, move)) this.pickNewPrintScaleTarget(this.printCurrentScale, this.printScaleTarget);
      this.printActor.setWorldScale(this.printCurrentScale.clone());
    }
    if (this.print2Actor) {
      if (this.tickPrintScale(this.print2CurrentScale, this.print2ScaleTarget, move)) this.pickNewPrintScaleTarget(this.print2CurrentScale, this.print2ScaleTarget);
      this.print2Actor.setWorldScale(this.print2CurrentScale.clone());
    }
  }

  private tickPrintScale(current: THREE.Vector3, target: THREE.Vector3, move: number): boolean {
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    let allReached = true;
    for (const axis of axes) {
      const diff = target[axis] - current[axis];
      if (Math.abs(diff) > 0.005) { allReached = false; current[axis] += Math.sign(diff) * Math.min(Math.abs(diff), move); }
      else { current[axis] = target[axis]; }
    }
    return allReached;
  }

  private pickNewPrintScaleTarget(cur: THREE.Vector3, target: THREE.Vector3): void {
    const min = this.PRINT_SCALE_MIN, max = this.PRINT_SCALE_MAX;
    const rand = () => min + Math.random() * (max - min);
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    for (let i = axes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [axes[i], axes[j]] = [axes[j], axes[i]]; }
    target[axes[0]] = cur[axes[0]] < max ? cur[axes[0]] + Math.random() * (max - cur[axes[0]]) : rand();
    target[axes[1]] = cur[axes[1]] > min ? min + Math.random() * (cur[axes[1]] - min) : rand();
    target[axes[2]] = rand();
    for (const axis of axes) target[axis] = Math.max(min, Math.min(max, target[axis]));
  }

  // ─── Generator ───────────────────────────────────────────────────────────────

  private handleGeneratorSequence(deltaTime: number): void {
    // Lazy-init generator actors
    if (!this.genSliderActor) {
      this.genSliderActor = this.findActorByDisplayName('slider') ?? this.findActorByDisplayName('slider_02');
      if (this.genSliderActor) this.genSliderActor.setWorldPosition(this.GEN_SLIDER_STEP1_START.clone());
    }
    if (!this.genCoalActor) {
      this.genCoalActor = this.findActorByDisplayName('coal');
      if (this.genCoalActor) this.genCoalActor.setWorldPosition(this.GEN_COAL_STEP2_START.clone());
    }
    if (!this.genDoorActor) {
      this.genDoorActor = this.findActorByDisplayName('door');
      if (this.genDoorActor) this.genDoorActor.setWorldPosition(this.GEN_DOOR_STEP3_START.clone());
    }

    if (!this.genActive || this.genStep === 0) return;

    this.genProgress += deltaTime / this.genCurrentDuration();
    const t = Math.min(this.genProgress, 1);
    this.applyGenStep(t);

    if (this.genSliderReturnActive && this.genSliderActor) {
      this.genSliderReturnProgress = Math.min(this.genSliderReturnProgress + deltaTime / this.GEN_SLIDER_RETURN_DURATION, 1);
      this.genSliderActor.setWorldPosition(new THREE.Vector3().lerpVectors(this.genSliderReturnStartPos, this.GEN_SLIDER_STEP1_START, this.genSliderReturnProgress));
      if (this.genSliderReturnProgress >= 1) this.genSliderReturnActive = false;
    }

    if (this.genStep === 4) {
      if (!this.genDoorClosing && this.genCoalActor) {
        if (this.genCoalActor.getWorldPosition().x >= this.GEN_COAL_DOOR_TRIGGER_X) {
          this.genDoorClosing = true; this.genDoorCloseProgress = 0;
          if (this.genDoorActor) this.genDoorCloseStartPos.copy(this.genDoorActor.getWorldPosition());
        }
      }
      if (this.genDoorClosing && this.genDoorActor) {
        this.genDoorCloseProgress = Math.min(this.genDoorCloseProgress + deltaTime / this.GEN_DOOR_CLOSE_DURATION, 1);
        this.genDoorActor.setWorldPosition(new THREE.Vector3().lerpVectors(this.genDoorCloseStartPos, this.GEN_DOOR_STEP3_START, this.genDoorCloseProgress));
      }
    }

    if (this.genProgress >= 1) {
      if (this.genStep < 4) {
        this.genStep++; this.genProgress = 0;
        if (this.genStep === 3) {
          this.genSliderReturnActive = true; this.genSliderReturnProgress = 0;
          if (this.genSliderActor) this.genSliderReturnStartPos.copy(this.genSliderActor.getWorldPosition());
        }
        if (this.genStep === 4) {
          this.genDoorClosing = false; this.genDoorCloseProgress = 0;
          if (this.genCoalActor) this.genStep3CoalStart.copy(this.genCoalActor.getWorldPosition());
        }
      } else {
        if (this.genCoalActor) this.genCoalActor.setWorldPosition(this.GEN_COAL_STEP2_START.clone());
        this.genStartLoop();
      }
    }
  }

  private genStartLoop(): void {
    this.genStep = 1; this.genProgress = 0;
    this.genSliderReturnActive = false; this.genSliderReturnProgress = 0;
    this.genDoorClosing = false; this.genDoorCloseProgress = 0;
  }

  private genCurrentDuration(): number {
    if (this.genStep === 1) return this.GEN_STEP1_DURATION;
    if (this.genStep === 2) return this.GEN_STEP2_DURATION;
    if (this.genStep === 3) return this.GEN_STEP3_DURATION;
    return this.GEN_STEP4_DURATION;
  }

  private applyGenStep(t: number): void {
    const lerp = (a: THREE.Vector3, b: THREE.Vector3, f: number) => new THREE.Vector3().lerpVectors(a, b, Math.min(f, 1));
    if (this.genStep === 1 && this.genSliderActor) this.genSliderActor.setWorldPosition(lerp(this.GEN_SLIDER_STEP1_START, this.GEN_SLIDER_STEP1_END, t));
    if (this.genStep === 2 && this.genCoalActor)   this.genCoalActor.setWorldPosition(lerp(this.GEN_COAL_STEP2_START, this.GEN_COAL_STEP2_END, t));
    if (this.genStep === 4) {
      if (this.genCoalActor) this.genCoalActor.setWorldPosition(lerp(this.genStep3CoalStart, this.GEN_COAL_STEP3_END, t));
      if (!this.genDoorClosing && this.genDoorActor)
        this.genDoorActor.setWorldPosition(lerp(this.GEN_DOOR_STEP3_START, this.GEN_DOOR_STEP3_END, t * this.GEN_DOOR_SPEED_MULT));
    }
  }

  // ─── Bubbles ─────────────────────────────────────────────────────────────────

  private handleBubbleRise(deltaTime: number): void {
    if (!this.bubbleActive) return;

    let allDone = true;
    for (const state of this.bubbleStates) {
      if (state.done) continue;
      state.elapsed += deltaTime;
      const timeAfterDelay = state.elapsed - state.delay;
      if (timeAfterDelay <= 0) { allDone = false; continue; }
      const progress = Math.min(timeAfterDelay / this.BUBBLE_RISE_DURATION, 1);
      const pos = state.actor.getWorldPosition();
      pos.y = state.startY + this.BUBBLE_RISE_OFFSET * progress;
      state.actor.setWorldPosition(pos);
      if (progress >= 1) { state.done = true; state.actor.setHidden(true); }
      else allDone = false;
    }

    if (allDone) {
      for (const state of this.bubbleStates) {
        const pos = state.actor.getWorldPosition(); pos.y = state.originY;
        state.actor.setWorldPosition(pos); state.actor.setHidden(false);
        state.startY = state.originY; state.delay = Math.random() * this.BUBBLE_MAX_DELAY;
        state.elapsed = 0; state.done = false;
      }
    }
  }

  // ─── Elevator ────────────────────────────────────────────────────────────────

  private handleElevator(deltaTime: number): void {
    if (!this.elevatorActor) {
      this.elevatorActor = this.findActorByDisplayName('elevator');
      if (this.elevatorActor) this.elevatorActor.setWorldPosition(this.ELEVATOR_START.clone());
    }
    if (!this.stanElevatorActor) {
      this.stanElevatorActor = this.findActorByDisplayName('stan_elevator');
      if (this.stanElevatorActor) this.stanElevatorActor.setWorldPosition(this.STAN_ELEVATOR_START.clone());
    }

    if (!this.elevatorIsMoving) return;
    this.elevatorProgress = Math.min(this.elevatorProgress + deltaTime / this.ELEVATOR_DURATION, 1);
    const t = this.elevatorProgress;
    if (this.elevatorActor)     this.elevatorActor.setWorldPosition(new THREE.Vector3().lerpVectors(this.ELEVATOR_START, this.ELEVATOR_END, t));
    if (this.stanElevatorActor) this.stanElevatorActor.setWorldPosition(new THREE.Vector3().lerpVectors(this.STAN_ELEVATOR_START, this.STAN_ELEVATOR_END, t));
    if (this.elevatorProgress >= 1) this.elevatorIsMoving = false;
  }

  // ─── Mobile move (OUTDOOR 1 / state '4') ─────────────────────────────────────

  private startMobileMove(): void {
    if (!this.mobileActor) this.mobileActor = this.findActorByDisplayName('mobile') ?? this.findActorByName('mobile');
    if (!this.mobileActor) return;
    this.mobileActor.setWorldPosition(this.MOBILE_START_POS.clone());
    this.mobileMoveProgress = 0;
    this.mobileIsMoving     = true;
    void this.world.globalAudioManager.playGlobalSound(this.MOBILE_SOUND, { volume: 1.0, loop: false });
  }

  private stopMobileMove(): void {
    this.mobileIsMoving     = false;
    this.mobileMoveProgress = 0;
    if (this.mobileActor) this.mobileActor.setWorldPosition(this.MOBILE_START_POS.clone());
  }

  private handleMobileMove(deltaTime: number): void {
    if (!this.mobileIsMoving || !this.mobileActor) return;
    this.mobileMoveProgress = Math.min(this.mobileMoveProgress + deltaTime / this.MOBILE_MOVE_DURATION, 1);
    this.mobileActor.setWorldPosition(new THREE.Vector3().lerpVectors(this.MOBILE_START_POS, this.MOBILE_END_POS, this.mobileMoveProgress));
    if (this.mobileMoveProgress >= 1) this.mobileIsMoving = false;
  }

  // ─── Figure movement ─────────────────────────────────────────────────────────

  private startFigureMove(): void {
    if (!this.figureActor) {
      this.figureActor = this.findActorByDisplayName('figure');
    }
    if (this.figureActor) this.figureActor.setWorldPosition(this.FIGURE_START_POS.clone());
    this.figureMoveProgress = 0;
    this.figureMoveActive   = true;
  }

  private handleFigureMove(deltaTime: number): void {
    if (!this.figureMoveActive || !this.figureActor) return;
    this.figureMoveProgress = Math.min(this.figureMoveProgress + deltaTime / this.FIGURE_MOVE_DURATION, 1);
    this.figureActor.setWorldPosition(
      new THREE.Vector3().lerpVectors(this.FIGURE_START_POS, this.FIGURE_END_POS, this.figureMoveProgress),
    );
    if (this.figureMoveProgress >= 1) this.figureMoveActive = false;
  }

  // ─── Enemy / Scan sequence ───────────────────────────────────────────────────

  private startEnemyMoveAfterDelay(): void {
    setTimeout(() => {
      if (!this.enemyActor) this.enemyActor = this.findActorByDisplayName('enemy');
      if (!this.scanActor)  this.scanActor  = this.findActorByDisplayName('scan');
      if (this.enemyActor) this.enemyActor.setWorldPosition(this.ENEMY_APPROACH_FROM.clone());
      this.enemyApproachProg       = 0;
      this.enemyPhaseTimer         = 0;
      this.scanningBlackoutStarted = false;
      this.blackedOutStates.clear();
      this.updateCameraNumbers();

      // Reset one-shot audio flags and stop any lingering enemy-sequence sounds
      this.approachAudioPlayed        = false;
      this.approachVO11Played         = false;
      this.approachBridgeSoundPlayed  = false;
      this.bridgeScanSoundPlayed      = false;
      this.scanningAudioPlayed   = false;
      if (this.enemyLoopHandle)     { this.world.globalAudioManager.stopSound(this.enemyLoopHandle);     this.enemyLoopHandle     = null; }
      if (this.scanningThemeHandle) { this.world.globalAudioManager.stopSound(this.scanningThemeHandle); this.scanningThemeHandle = null; }
      if (this.scanSound1Handle)    { this.world.globalAudioManager.stopSound(this.scanSound1Handle);    this.scanSound1Handle    = null; }
      if (this.alarmHandle)         { this.world.globalAudioManager.stopSound(this.alarmHandle);         this.alarmHandle         = null; }

      this.enemyPhase              = 'approach';
    }, this.ENEMY_START_DELAY * 1_000);
  }

  private handleEnemySequence(deltaTime: number): void {
    switch (this.enemyPhase) {
      case 'approach': this.tickApproach(deltaTime); break;
      case 'bridge':   this.tickBridge(deltaTime);   break;
      case 'scanning': this.tickScanning(deltaTime);  break;
    }
  }

  private tickApproach(deltaTime: number): void {
    if (!this.enemyActor) return;
    this.enemyPhaseTimer   += deltaTime;
    this.enemyApproachProg  = Math.min(this.enemyApproachProg + deltaTime / this.ENEMY_APPROACH_DUR, 1);
    this.enemyActor.setWorldPosition(
      new THREE.Vector3().lerpVectors(this.ENEMY_APPROACH_FROM, this.ENEMY_APPROACH_TO, this.enemyApproachProg),
    );

    // On approach start: enemy loop + alarm
    if (!this.approachAudioPlayed) {
      this.approachAudioPlayed = true;
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/enemy.mp3', { volume: 1.0, loop: true },
      ).then(h => { this.enemyLoopHandle = h; });
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/alarm.mp3', { volume: 1.0, loop: false },
      ).then(h => { this.alarmHandle = h; });
    }

    // At 3 s into approach: VO_11_enemy
    if (!this.approachVO11Played && this.enemyPhaseTimer >= 3) {
      this.approachVO11Played = true;
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/VO_11_enemy.mp3', { volume: 1.0, loop: false, bus: 'Voice' },
      );
    }

    // Last 3 s of approach: bridge_sound (plays once, may overlap next phases)
    if (!this.approachBridgeSoundPlayed && this.enemyPhaseTimer >= this.ENEMY_APPROACH_DUR - 3) {
      this.approachBridgeSoundPlayed = true;
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/bridge_sound.mp3', { volume: 1.0, loop: false },
      );
    }

    if (this.enemyApproachProg >= 1) {
      this.enemyPhaseTimer = 0;
      this.scanRiseProg    = 0;
      this.scanRiseActive  = false;
      this.enemyPhase      = 'bridge';
    }
  }

  private tickBridge(deltaTime: number): void {
    this.enemyPhaseTimer += deltaTime;

    // At t=8 s within bridge, raise the scan model over 0.5 s and play scan_sound
    if (this.enemyPhaseTimer >= this.BRIDGE_SCAN_TRIGGER) {
      if (!this.bridgeScanSoundPlayed) {
        this.bridgeScanSoundPlayed = true;
        void this.world.globalAudioManager.playGlobalSound(
          '@project/assets/sounds/scan_sound_1.mp3', { volume: 1.0, loop: false },
        ).then(h => { this.scanSound1Handle = h; });
      }
      if (!this.scanRiseActive && this.scanRiseProg < 1) {
        this.scanRiseActive = true;
        if (this.scanActor) this.scanActor.setWorldPosition(this.SCAN_RISE_FROM.clone());
      }
      if (this.scanRiseActive && this.scanRiseProg < 1) {
        this.scanRiseProg = Math.min(this.scanRiseProg + deltaTime / this.SCAN_RISE_DUR, 1);
        if (this.scanActor) {
          this.scanActor.setWorldPosition(
            new THREE.Vector3().lerpVectors(this.SCAN_RISE_FROM, this.SCAN_RISE_TO, this.scanRiseProg),
          );
        }
        if (this.scanRiseProg >= 1) this.scanRiseActive = false;
      }
    }

    if (this.enemyPhaseTimer >= this.BRIDGE_DURATION) {
      this.enemyPhaseTimer = 0;
      this.scanPhaseProg   = 0;
      // Initialise scan scale state from actual actor scale
      const startScale = this.scanActor?.getWorldScale() ?? new THREE.Vector3(1, 1, 1);
      this.scanScaleFromX = startScale.x;
      this.scanScaleFromZ = startScale.z;
      this.pickNextScanScaleTarget(0);
      this.enemyPhase = 'scanning';
    }
  }

  private pickNextScanScaleTarget(elapsedScanSeconds: number): void {
    const latePhase = elapsedScanSeconds >= this.SCAN_SCALE_LATE_TRIGGER;
    const maxVal = latePhase ? this.SCAN_SCALE_LATE_MAX : Infinity;
    const clamp  = (v: number) => Math.min(Math.max(2, v), maxVal);
    const deltaX = (Math.random() * 2 - 1) * this.SCAN_SCALE_MAX_DELTA;
    const deltaZ = (Math.random() * 2 - 1) * this.SCAN_SCALE_MAX_DELTA;
    this.scanScaleToX  = clamp(this.scanScaleFromX + deltaX);
    this.scanScaleToZ  = clamp(this.scanScaleFromZ + deltaZ);
    this.scanScaleProg = 0;
    this.scanScaleDur  = Math.random() * (this.SCAN_SCALE_MAX_DUR - 0.5) + 0.5; // 0.5–20 s
  }

  private startCameraBlackoutSequence(): void {
    this.blackedOutStates.clear();
    this.CAMERA_BLACKOUT_ORDER.forEach((state, i) => {
      setTimeout(() => {
        this.blackedOutStates.add(state);
        this.updateCameraNumbers();
        // If the player is currently on this camera, eject to functional cam 1
        if (this.computeCameraState() === state) {
          this.switchToState('2');
        }
      }, i * this.BLACKOUT_INTERVAL * 1_000);
    });
  }

  private tickScanning(deltaTime: number): void {
    // On scanning start: VO_12_scaning + scaning_theme
    if (!this.scanningAudioPlayed) {
      this.scanningAudioPlayed = true;
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/VO_12_scaning.mp3', { volume: 1.0, loop: false, bus: 'Voice' },
      );
      void this.world.globalAudioManager.playGlobalSound(
        '@project/assets/sounds/scaning_theme.mp3', { volume: 1.0, loop: true },
      ).then(h => { this.scanningThemeHandle = h; });
      void this.scheduleTaskPanelAtHalfVO12();
    }

    // Move both actors
    this.scanPhaseProg = Math.min(this.scanPhaseProg + deltaTime / this.SCAN_PHASE_DUR, 1);
    if (this.enemyActor) {
      this.enemyActor.setWorldPosition(
        new THREE.Vector3().lerpVectors(this.ENEMY_SCAN_FROM, this.ENEMY_SCAN_TO, this.scanPhaseProg),
      );
    }
    if (this.scanActor) {
      this.scanActor.setWorldPosition(
        new THREE.Vector3().lerpVectors(this.SCAN_SCAN_FROM, this.SCAN_SCAN_TO, this.scanPhaseProg),
      );
    }

    // Random XZ scale animation on scan actor
    const elapsedScan = this.scanPhaseProg * this.SCAN_PHASE_DUR;
    this.scanScaleProg += deltaTime / this.scanScaleDur;
    if (this.scanScaleProg >= 1) {
      this.scanScaleFromX = this.scanScaleToX;
      this.scanScaleFromZ = this.scanScaleToZ;
      this.pickNextScanScaleTarget(elapsedScan);
    }
    // After 5 s, clamp any in-progress target that exceeds the cap
    if (elapsedScan >= this.SCAN_SCALE_LATE_TRIGGER) {
      this.scanScaleToX = Math.min(this.scanScaleToX, this.SCAN_SCALE_LATE_MAX);
      this.scanScaleToZ = Math.min(this.scanScaleToZ, this.SCAN_SCALE_LATE_MAX);
    }
    if (this.scanActor) {
      const t = Math.min(this.scanScaleProg, 1);
      const sx = this.scanScaleFromX + (this.scanScaleToX - this.scanScaleFromX) * t;
      const sz = this.scanScaleFromZ + (this.scanScaleToZ - this.scanScaleFromZ) * t;
      const sy = this.scanActor.getWorldScale().y;
      this.scanActor.setWorldScale(new THREE.Vector3(sx, sy, sz));
    }

    // Camera blackout sequence — starts at 60 s into scanning
    if (elapsedScan >= this.BLACKOUT_START_DELAY && !this.scanningBlackoutStarted) {
      this.scanningBlackoutStarted = true;
      this.startCameraBlackoutSequence();
    }

    if (this.scanPhaseProg >= 1) this.enemyPhase = 'idle';
  }

  // ─── Fuel cam 3.3 descent ────────────────────────────────────────────────────

  private startFuelCam33Animation(): void {
    if (!this.fuelActor) this.fuelActor = this.findActorByDisplayName('fuel');
    if (!this.fuelActor) return;
    const pos = this.fuelActor.getWorldPosition();
    pos.y = this.FUEL_CAM33_START_Y;
    this.fuelActor.setWorldPosition(pos);
    this.fuelCam33Progress = 0;
    this.fuelCam33IsMoving = true;
  }

  private stopFuelCam33Animation(): void {
    this.fuelCam33IsMoving = false;
    this.fuelCam33Progress = 0;
  }

  private handleFuelCam33(deltaTime: number): void {
    if (!this.fuelCam33IsMoving || !this.fuelActor) return;
    this.fuelCam33Progress = Math.min(this.fuelCam33Progress + deltaTime / this.FUEL_CAM33_DURATION, 1);
    const pos = this.fuelActor.getWorldPosition();
    pos.y = this.FUEL_CAM33_START_Y + (this.FUEL_CAM33_END_Y - this.FUEL_CAM33_START_Y) * this.fuelCam33Progress;
    this.fuelActor.setWorldPosition(pos);
    if (this.fuelCam33Progress >= 1) this.fuelCam33IsMoving = false;
  }

  // ─── Directional Light 02 ────────────────────────────────────────────────────

  private handleDirLight02(deltaTime: number): void {
    if (!this.dirLight02Actor) {
      this.dirLight02Actor = this.findActorByDisplayName('Directional Light_02') ?? this.findActorByDisplayName('directional light_02') ?? this.findActorByName('Directional Light_02');
      if (this.dirLight02Actor) this.dirLight02Actor.setWorldPosition(this.DIR_LIGHT02_START.clone());
    }

    const inputManager = this.world.inputManager;
    const currentTime  = performance.now();
    const oPressed = (inputManager.isKeyDown('o') || inputManager.isKeyDown('O'))
      && currentTime - this.lastKeyPressTime['o'] > this.KEY_PRESS_COOLDOWN;

    if (oPressed) {
      this.lastKeyPressTime['o'] = currentTime;
      if (!this.dirLight02Activated) {
        this.dirLight02Activated = true;
        this.dirLight02Progress  = 0;
        this.dirLight02IsMoving  = true;
        if (this.dirLight02Actor) this.dirLight02Actor.setWorldPosition(this.DIR_LIGHT02_START.clone());
      } else {
        this.dirLight02Activated = false;
        this.dirLight02IsMoving  = false;
        this.dirLight02Progress  = 0;
        if (this.dirLight02Actor) this.dirLight02Actor.setWorldPosition(this.DIR_LIGHT02_START.clone());
      }
    }

    if (!this.dirLight02IsMoving || !this.dirLight02Actor) return;
    this.dirLight02Progress = Math.min(this.dirLight02Progress + deltaTime / this.DIR_LIGHT02_DURATION, 1);
    this.dirLight02Actor.setWorldPosition(new THREE.Vector3().lerpVectors(this.DIR_LIGHT02_START, this.DIR_LIGHT02_END, this.dirLight02Progress));
    if (this.dirLight02Progress >= 1) this.dirLight02IsMoving = false;
  }

  // ─── tickHill ────────────────────────────────────────────────────────────────

  private tickHill(
    _displayName: string, actor: ENGINE.Actor | null, targetX: number, deltaTime: number, hPressed: boolean,
    startPos: THREE.Vector3, targetPos: THREE.Vector3,
    getProgress: () => number, setProgress: (v: number) => void,
    getIsMoving: () => boolean, setIsMoving: (v: boolean) => void,
  ): void {
    if (!actor) return;
    if (getIsMoving()) {
      const progress = Math.min(getProgress() + deltaTime / this.HILLS_MOVE_DURATION, 1);
      setProgress(progress);
      if (progress >= 1) { setIsMoving(false); actor.setWorldPosition(targetPos.clone()); return; }
      actor.setWorldPosition(new THREE.Vector3().lerpVectors(startPos, targetPos, progress));
      return;
    }
    if (hPressed) {
      startPos.copy(actor.getWorldPosition());
      targetPos.set(targetX, startPos.y, startPos.z);
      setProgress(0); setIsMoving(true);
    }
  }
}

export function main(container: HTMLElement, options?: Partial<ENGINE.BaseGameLoopOptions>): ENGINE.IGameLoop {
  const game = new MyGame(container, options);
  return game;
}
