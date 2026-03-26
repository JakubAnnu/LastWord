import * as ENGINE from '@gnsx/genesys.js';

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
 *     Outdoor 1 (5.1), play VO_3_press_B and show "Press B" prompt.
 * 4.  Wait for the player to press B.
 * 5.  Stay on Outdoor 1 for 3 more seconds.
 * 6.  Switch to Resource 5 (3.1), play VO_4_note; stay for 2 seconds.
 * 7.  Switch to Resource 7 (3.3), play VO_5_deficite; wait for it to end.
 * 8.  Restore input, play VO_6_map, show final map hint on screen.
 */
export class IntroSequence {
  private readonly cbs: IntroSequenceCallbacks;
  private uiElement: HTMLElement | null = null;
  private bKeyListener: ((e: KeyboardEvent) => void) | null = null;

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
  /** Reset the camera here before handing off to the scripted sequence */
  private readonly CAM_HOME        = '1.1';
  /** Outdoor 1  = 1st position of Camera 5 / OUTDOOR CAM group */
  private readonly CAM_OUTDOOR_1   = '5.1';
  /** Resource 5 = 5th entry of RECOURCES group (1.1, 1.1b, 1.2, 1.3, 3.1 …) */
  private readonly CAM_RESOURCE_5  = '3.1';
  /** Resource 7 = 7th entry of RECOURCES group (… 3.2, 3.3 …) */
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

    // ── Phase 4: VO_3_press_B + "Press B" prompt ──────────────────────────────
    void this.playVO(this.VO3);
    this.showUI('PRESS B');

    // ── Phase 5: wait for B key ───────────────────────────────────────────────
    await this.waitForBPress();
    this.hideUI();

    // ── Phase 6: stay on Outdoor 1 for 3 seconds ─────────────────────────────
    await this.delay(this.AFTER_B_PRESS_S);

    // ── Phase 7: Resource 5 (2 seconds) + VO_4_note ───────────────────────────
    this.cbs.switchToState(this.CAM_RESOURCE_5);
    void this.playVO(this.VO4);
    await this.delay(this.RESOURCE5_DISPLAY_S);

    // ── Phase 8: Resource 7 + VO_5_deficite ──────────────────────────────────
    this.cbs.switchToState(this.CAM_RESOURCE_7);
    const vo5 = await this.playVO(this.VO5);
    await this.waitForSoundEnd(vo5);

    // ── Phase 9: restore controls, VO_6_map, map hint ────────────────────────
    this.cbs.setInputEnabled(true);
    void this.playVO(this.VO6);
    this.showUI('Access the map\nCamera Group 4 — Camera 1', true);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private delay(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1_000));
  }

  private async playVO(url: string): Promise<ENGINE.SoundHandle | null> {
    await this.cbs.resumeAudioContext();
    return this.cbs.playGlobalSound(url);
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

  private waitForBPress(): Promise<void> {
    return new Promise(resolve => {
      this.bKeyListener = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() !== 'b') return;
        if (this.bKeyListener) {
          document.removeEventListener('keydown', this.bKeyListener);
          this.bKeyListener = null;
        }
        resolve();
      };
      document.addEventListener('keydown', this.bKeyListener);
    });
  }

  /**
   * Display a text overlay in the centre of the game container.
   * @param message    Text to show (supports \n for line breaks).
   * @param persistent When true the overlay stays until destroy() is called.
   */
  private showUI(message: string, persistent = false): void {
    this.hideUI();
    const container = this.cbs.gameContainer;
    if (!container) return;

    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'color:#ffffff',
      'font-family:monospace',
      'font-size:28px',
      'font-weight:bold',
      'letter-spacing:3px',
      'text-align:center',
      'white-space:pre-line',
      'line-height:1.5',
      'text-shadow:0 2px 8px rgba(0,0,0,0.9),0 0 2px rgba(0,0,0,1)',
      'pointer-events:none',
      'user-select:none',
      'z-index:100',
    ].join(';');
    el.textContent = message;
    container.appendChild(el);
    this.uiElement = el;

    // Non-persistent overlays are removed only via an explicit hideUI() call.
    // Persistent overlays stay until destroy() is called.
    void persistent;
  }

  private hideUI(): void {
    if (this.uiElement) { this.uiElement.remove(); this.uiElement = null; }
  }

  /** Clean up any active listeners and UI elements (call if the game is reset). */
  public destroy(): void {
    if (this.bKeyListener) {
      document.removeEventListener('keydown', this.bKeyListener);
      this.bKeyListener = null;
    }
    this.hideUI();
  }
}
