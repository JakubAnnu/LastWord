import * as ENGINE from '@gnsx/genesys.js';
import { createTaskPanel } from './task-ui.js';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface IntroSequenceCallbacks {
  /** Play a global VO audio file; resolves to a handle or null on failure */
  playGlobalSound: (url: string) => Promise<ENGINE.SoundHandle | null>;
  /** Check whether a specific sound is still playing */
  isSoundPlaying:  (handle: ENGINE.SoundHandle) => boolean;
  /** Resume the AudioContext if suspended (browser autoplay policy) */
  resumeAudioContext: () => Promise<void>;
  /** Switch the main camera to a named state (e.g. '5.1', '3.1') */
  switchToState:   (state: string) => void;
  /** Block or restore all player input */
  setInputEnabled: (enabled: boolean) => void;
  /** The DOM element used as the game UI container */
  gameContainer:   HTMLElement | null;
  /**
   * Called when the persistent map-hint panel is displayed.
   * The argument is a function that removes the panel from the DOM —
   * store it in game.ts and call it when the player enters Functional Camera 1.
   */
  onMapHintShown?: (hide: () => void) => void;
  /** Start the independent fuel-rise animation (phase 8 only) */
  startFuelAnimation?: () => void;
  /** Stop and reset the fuel-rise animation */
  stopFuelAnimation?: () => void;
}

// ─── Cancellation error ───────────────────────────────────────────────────────

export class SequenceCancelledError extends Error {
  constructor() { super('Sequence cancelled'); this.name = 'SequenceCancelledError'; }
}

// ─── Intro sequence ───────────────────────────────────────────────────────────

/**
 * Scripted intro / tutorial sequence that runs once after the intro video.
 *
 * Sequence overview
 * -----------------
 * 1.  Wait VO1_DELAY_S seconds, then play VO_1.
 * 2.  3 seconds after VO_1 ends, play VO_2_drill.
 * 3.  After VO_2_drill ends: lock input, position camera at home, switch to
 *     Outdoor 1 (5.1), play VO_3_press_B and show "Activate barrier - press B".
 * 4.  Wait for the player to press B.
 * 5.  Stay on Outdoor 1 for 3 more seconds.
 * 6.  Switch to Resource 5 (3.1), play VO_4_note; stay for 2 seconds.
 * 7.  Switch to Resource 7 (3.3); wait for VO_4 to end; play VO_5_deficite.
 * 8.  Restore input, play VO_6_map, show persistent map hint on screen.
 */
export class IntroSequence {
  private readonly cbs: IntroSequenceCallbacks;
  private taskHide: (() => void) | null = null;
  private bKeyListener: ((e: KeyboardEvent) => void) | null = null;

  // Cancellation — set by destroy(); every async helper checks this and rejects.
  private cancelled = false;
  private cancelCurrent: (() => void) | null = null;

  // ─── Timing constants (seconds) ──────────────────────────────────────────
  private readonly VO1_DELAY_S          = 2;
  private readonly AFTER_VO1_DELAY_S    = 3;
  private readonly AFTER_B_PRESS_S      = 3;
  private readonly RESOURCE5_DISPLAY_S  = 2;

  // ─── VO audio asset paths ─────────────────────────────────────────────────
  private readonly VO1 = '@project/assets/sounds/VO_1.mp3';
  private readonly VO2 = '@project/assets/sounds/VO_2_drill.mp3';
  private readonly VO3 = '@project/assets/sounds/VO_3_press_B.mp3';
  private readonly VO4 = '@project/assets/sounds/VO_4_note.mp3';
  private readonly VO5 = '@project/assets/sounds/VO_5_deficite.mp3';
  private readonly VO6 = '@project/assets/sounds/VO_6_map.mp3';

  // ─── Camera state identifiers ─────────────────────────────────────────────
  private readonly CAM_HOME        = '1.1';
  private readonly CAM_OUTDOOR_1   = '5.1';
  private readonly CAM_RESOURCE_5  = '3.1';
  private readonly CAM_RESOURCE_7  = '3.3';

  constructor(cbs: IntroSequenceCallbacks) {
    this.cbs = cbs;
  }

  // ─── Main entry point ─────────────────────────────────────────────────────

  public async run(): Promise<void> {
    // ── Phase 1: VO_1 ────────────────────────────────────────────────────────
    await this.delay(this.VO1_DELAY_S);
    const vo1 = await this.playVO(this.VO1);
    await this.waitForSoundEnd(vo1);

    // ── Phase 2: pause → VO_2_drill ──────────────────────────────────────────
    await this.delay(this.AFTER_VO1_DELAY_S);
    const vo2 = await this.playVO(this.VO2);
    await this.waitForSoundEnd(vo2);

    // ── Phase 3: lock controls, position camera, switch to Outdoor 1 ─────────
    this.cbs.setInputEnabled(false);
    this.cbs.switchToState(this.CAM_HOME);
    this.cbs.switchToState(this.CAM_OUTDOOR_1);

    // ── Phase 4: VO_3_press_B + task prompt ───────────────────────────────────
    void this.playVO(this.VO3);
    this.showTask('Activate barrier - press B');

    // ── Phase 5: wait for B key ───────────────────────────────────────────────
    await this.waitForBPress();
    this.clearTask();

    // ── Phase 6: stay on Outdoor 1 for 3 seconds ─────────────────────────────
    await this.delay(this.AFTER_B_PRESS_S);

    // ── Phase 7: Resource 5 (2 seconds) + VO_4_note ───────────────────────────
    this.cbs.switchToState(this.CAM_RESOURCE_5);
    const vo4 = await this.playVO(this.VO4);
    await this.delay(this.RESOURCE5_DISPLAY_S);

    // ── Phase 8: Resource 7 – switch camera immediately, but wait for VO_4 ──
    // VO_5_deficite starts only after VO_4_note finishes.
    // Fuel rise animation runs exclusively during this phase.
    this.cbs.switchToState(this.CAM_RESOURCE_7);
    await this.waitForSoundEnd(vo4);
    this.cbs.startFuelAnimation?.();
    const vo5 = await this.playVO(this.VO5);
    await this.waitForSoundEnd(vo5);
    this.cbs.stopFuelAnimation?.();

    // ── Phase 9: restore controls, VO_6_map, persistent map hint ─────────────
    this.cbs.setInputEnabled(true);
    void this.playVO(this.VO6);
    this.showPersistentTask('MAP: Enter the Functional Camera 1 group');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private delay(seconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.cancelled) { reject(new SequenceCancelledError()); return; }
      const id = setTimeout(() => {
        this.cancelCurrent = null;
        if (this.cancelled) { reject(new SequenceCancelledError()); return; }
        resolve();
      }, seconds * 1_000);
      this.cancelCurrent = () => { clearTimeout(id); reject(new SequenceCancelledError()); };
    });
  }

  private async playVO(url: string): Promise<ENGINE.SoundHandle | null> {
    if (this.cancelled) throw new SequenceCancelledError();
    await this.cbs.resumeAudioContext();
    return this.cbs.playGlobalSound(url);
  }

  private waitForSoundEnd(handle: ENGINE.SoundHandle | null): Promise<void> {
    if (!handle) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (this.cancelled) { reject(new SequenceCancelledError()); return; }
      this.cancelCurrent = () => reject(new SequenceCancelledError());
      const poll = () => {
        if (this.cancelled) { reject(new SequenceCancelledError()); return; }
        if (!this.cbs.isSoundPlaying(handle)) { this.cancelCurrent = null; resolve(); return; }
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  private waitForBPress(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.cancelled) { reject(new SequenceCancelledError()); return; }
      this.cancelCurrent = () => {
        if (this.bKeyListener) {
          document.removeEventListener('keydown', this.bKeyListener);
          this.bKeyListener = null;
        }
        reject(new SequenceCancelledError());
      };
      this.bKeyListener = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() !== 'b') return;
        if (this.bKeyListener) {
          document.removeEventListener('keydown', this.bKeyListener);
          this.bKeyListener = null;
        }
        this.cancelCurrent = null;
        resolve();
      };
      document.addEventListener('keydown', this.bKeyListener);
    });
  }

  /** Show a transient TASK panel (cleared by clearTask). */
  private showTask(text: string): void {
    this.clearTask();
    const container = this.cbs.gameContainer;
    if (!container) return;
    this.taskHide = createTaskPanel(container, [{ text }]);
  }

  private clearTask(): void {
    if (this.taskHide) { this.taskHide(); this.taskHide = null; }
  }

  /**
   * Show a persistent TASK panel that outlives the sequence.
   * The hide function is forwarded to `onMapHintShown` so game.ts
   * can dismiss it at the right moment.
   */
  private showPersistentTask(text: string): void {
    const container = this.cbs.gameContainer;
    if (!container) return;
    const hide = createTaskPanel(container, [{ text }]);
    this.cbs.onMapHintShown?.(hide);
  }

  /** Cancel the running sequence immediately and clean up all listeners and UI. */
  public destroy(): void {
    this.cancelled = true;
    if (this.cancelCurrent) {
      this.cancelCurrent();
      this.cancelCurrent = null;
    }
    if (this.bKeyListener) {
      document.removeEventListener('keydown', this.bKeyListener);
      this.bKeyListener = null;
    }
    this.clearTask();
  }
}
