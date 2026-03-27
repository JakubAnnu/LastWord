import * as ENGINE from '@gnsx/genesys.js';
import { createTaskPanel } from './task-ui.js';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface FunctionalCam1Callbacks {
  /** Switch the main camera to a named state (e.g. '5.1') */
  switchToState: (state: string) => void;
  /** Block or unblock camera-group/number-key switching (not full input) */
  blockCameraInput: (blocked: boolean) => void;
  /** Set PointLight_16 to the given hex colour and lock it (disables L key) */
  setPointLight16ColorLocked: (hexColor: number) => void;
  /** Play a global audio file; resolves to a handle or null on failure */
  playGlobalSound: (url: string) => Promise<ENGINE.SoundHandle | null>;
  /** Check whether a specific sound handle is still playing */
  isSoundPlaying: (handle: ENGINE.SoundHandle) => boolean;
  /** Resume the AudioContext if suspended (browser autoplay policy) */
  resumeAudioContext: () => Promise<void>;
  /** The DOM element used as the game UI container */
  gameContainer: HTMLElement | null;
  /** Called when VO_8_route starts — triggers the mobile model animation */
  startMobileAnimation: () => void;
  /** Called when VO_10_base finishes playing — triggers the figure movement */
  onVO10BaseEnd?: () => void;
}

// ─── Sequence ─────────────────────────────────────────────────────────────────

/**
 * Runs the Functional Camera 1 (state '2') scripted interaction.
 *
 * Sequence overview
 * -----------------
 * 1.  Block camera-switching; play VO_9_themap; wait for it to finish.
 * 2.  Play VO_7_select and simultaneously show the three option overlays.
 * 3.  Wait for the player to press Z.
 * 4.  Set PointLight_16 to red (overrides / replaces the L-key behaviour).
 * 5.  Hide overlays; wait 2 seconds.
 * 6.  Switch to Outdoor 1 (5.1); play VO_8_route.
 * 7.  3 seconds after VO_8_route: play VO_10_base.
 * 8.  5 seconds after VO_8_route (2 s after VO_10_base): restore camera control.
 *
 * Notes
 * -----
 * - X and C are shown in the UI as labelled options. Their full logic is not
 *   yet specified, so only Z is functional at this time.
 * - Camera input is blocked for the duration (A/D group switching, 1–8 camera
 *   numbers). Arrow-key rotation on camera 2 continues to work.
 */
export class FunctionalCam1Sequence {
  private readonly cbs: FunctionalCam1Callbacks;
  private hideOverlaysFn: (() => void) | null = null;
  private zKeyListener: ((e: KeyboardEvent) => void) | null = null;

  // ─── Timing constants (seconds) ──────────────────────────────────────────
  private readonly AFTER_Z_PRESS_S   = 2;
  private readonly VO10_BASE_DELAY_S = 2;   // delay from VO_8_route start
  private readonly RESTORE_DELAY_S   = 5;   // total delay from VO_8_route start

  // ─── Asset paths ─────────────────────────────────────────────────────────
  private readonly VO9_THEMAP    = '@project/assets/sounds/VO_9_themap.mp3';
  private readonly VO7_SELECT    = '@project/assets/sounds/VO_7_select.mp3';
  private readonly VO8           = '@project/assets/sounds/VO_8_route.mp3';
  private readonly VO10_BASE     = '@project/assets/sounds/VO_10_base.mp3';
  private readonly CAM_OUTDOOR_1 = '5.1';

  constructor(cbs: FunctionalCam1Callbacks) {
    this.cbs = cbs;
  }

  // ─── Main entry point ────────────────────────────────────────────────────

  public async run(): Promise<void> {
    // ── Step 1: lock camera, play VO_9_themap, wait for it to finish ──────
    this.cbs.blockCameraInput(true);
    await this.cbs.resumeAudioContext();
    const vo9 = await this.cbs.playGlobalSound(this.VO9_THEMAP);
    await this.waitForSoundEnd(vo9);

    // ── Step 2: play VO_7_select + show option overlays simultaneously ────
    void this.cbs.playGlobalSound(this.VO7_SELECT);
    this.showOverlays();

    // ── Step 3: wait for Z key ────────────────────────────────────────────
    await this.waitForZPress();

    // ── Step 4: colour PointLight_16 red (locks out L-key handler) ────────
    this.cbs.setPointLight16ColorLocked(0xff0000);
    this.hideOverlays();

    // ── Step 5: 2-second pause ────────────────────────────────────────────
    await this.delay(this.AFTER_Z_PRESS_S);

    // ── Step 6: switch to Outdoor 1 + VO_8_route ─────────────────────────
    this.cbs.switchToState(this.CAM_OUTDOOR_1);
    await this.cbs.resumeAudioContext();
    this.cbs.startMobileAnimation();
    void this.cbs.playGlobalSound(this.VO8);

    // ── Step 7: 2 s after VO_8_route → VO_10_base ────────────────────────
    await this.delay(this.VO10_BASE_DELAY_S);
    const vo10 = await this.cbs.playGlobalSound(this.VO10_BASE);

    // ── Step 8: 3 s later (5 s total from VO_8_route) → restore control ──
    await this.delay(this.RESTORE_DELAY_S - this.VO10_BASE_DELAY_S);
    this.cbs.blockCameraInput(false);

    // ── Step 9: when VO_10_base finishes → trigger figure movement ────────
    this.waitForSoundEnd(vo10).then(() => { this.cbs.onVO10BaseEnd?.(); });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private delay(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1_000));
  }

  private waitForSoundEnd(handle: ENGINE.SoundHandle | null): Promise<void> {
    if (!handle) return Promise.resolve();
    return new Promise(resolve => {
      const poll = () => {
        if (!this.cbs.isSoundPlaying(handle)) { resolve(); return; }
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  private waitForZPress(): Promise<void> {
    return new Promise(resolve => {
      this.zKeyListener = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() !== 'z') return;
        if (this.zKeyListener) {
          document.removeEventListener('keydown', this.zKeyListener);
          this.zKeyListener = null;
        }
        resolve();
      };
      document.addEventListener('keydown', this.zKeyListener);
    });
  }

  /** Render the three white option prompts in the left-side TASK panel. */
  private showOverlays(): void {
    const container = this.cbs.gameContainer;
    if (!container) return;
    this.hideOverlays();
    this.hideOverlaysFn = createTaskPanel(container, [
      { text: 'STREAK-press Z' },
      { text: 'SCORFAG-press X' },
      { text: 'BLUE CLAY-press C' },
    ]);
  }

  private hideOverlays(): void {
    if (this.hideOverlaysFn) { this.hideOverlaysFn(); this.hideOverlaysFn = null; }
  }

  /** Clean up listeners and UI (call if the game is reset mid-sequence). */
  public destroy(): void {
    if (this.zKeyListener) {
      document.removeEventListener('keydown', this.zKeyListener);
      this.zKeyListener = null;
    }
    this.hideOverlays();
  }
}
