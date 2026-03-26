import * as ENGINE from '@gnsx/genesys.js';

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
  /** Resume the AudioContext if suspended (browser autoplay policy) */
  resumeAudioContext: () => Promise<void>;
  /** The DOM element used as the game UI container */
  gameContainer: HTMLElement | null;
}

// ─── Sequence ─────────────────────────────────────────────────────────────────

/**
 * Runs the Functional Camera 1 (state '2') scripted interaction.
 *
 * Sequence overview
 * -----------------
 * 1.  Block camera-switching; play VO_9_themap; show three coloured option overlays.
 * 2.  Wait for the player to press Z.
 * 3.  Set PointLight_16 to red (overrides / replaces the L-key behaviour).
 * 4.  Hide overlays; wait 2 seconds.
 * 5.  Switch to Outdoor 1 (5.1) + play VO_8_route.
 * 6.  After 5 seconds restore camera control to the player.
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
  private uiElements: HTMLElement[] = [];
  private zKeyListener: ((e: KeyboardEvent) => void) | null = null;

  // ─── Timing constants (seconds) ──────────────────────────────────────────
  private readonly AFTER_Z_PRESS_S = 2;
  private readonly AFTER_VO8_S     = 5;

  // ─── Asset paths ─────────────────────────────────────────────────────────
  private readonly VO9_THEMAP    = '@project/assets/sounds/VO_9_themap.mp3';
  private readonly VO8           = '@project/assets/sounds/VO_8_route.mp3';
  private readonly CAM_OUTDOOR_1 = '5.1';

  constructor(cbs: FunctionalCam1Callbacks) {
    this.cbs = cbs;
  }

  // ─── Main entry point ────────────────────────────────────────────────────

  public async run(): Promise<void> {
    // ── Step 1: lock camera switching, play VO_9_themap, show overlays ────
    this.cbs.blockCameraInput(true);
    await this.cbs.resumeAudioContext();
    void this.cbs.playGlobalSound(this.VO9_THEMAP);
    this.showOverlays();

    // ── Step 2: wait for Z key ────────────────────────────────────────────
    await this.waitForZPress();

    // ── Step 3: colour PointLight_16 red (locks out L-key handler) ────────
    this.cbs.setPointLight16ColorLocked(0xff0000);
    this.hideOverlays();

    // ── Step 4: 2-second pause ────────────────────────────────────────────
    await this.delay(this.AFTER_Z_PRESS_S);

    // ── Step 5: switch to Outdoor 1 + VO_8_route ─────────────────────────
    this.cbs.switchToState(this.CAM_OUTDOOR_1);
    await this.cbs.resumeAudioContext();
    void this.cbs.playGlobalSound(this.VO8);

    // ── Step 6: 5 seconds then restore camera control ────────────────────
    await this.delay(this.AFTER_VO8_S);
    this.cbs.blockCameraInput(false);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private delay(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1_000));
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

  /**
   * Render three vertically stacked, colour-coded prompt labels.
   * Items are centred on screen, each 52 px apart.
   */
  private showOverlays(): void {
    const container = this.cbs.gameContainer;
    if (!container) return;

    const items: Array<{ text: string; color: string }> = [
      { text: 'STREAK — press Z',    color: '#ff3333' },
      { text: 'SCORFAG — press X',   color: '#ffcc00' },
      { text: 'BLUE CLAY — press C', color: '#4499ff' },
    ];

    items.forEach((item, i) => {
      const el = document.createElement('div');
      // Centre vertically; offset each row by 52 px relative to mid-point.
      const yOffset = (i - 1) * 52;
      el.style.cssText = [
        'position:absolute',
        'top:50%',
        'left:50%',
        `transform:translate(-50%, calc(-50% + ${yOffset}px))`,
        `color:${item.color}`,
        'font-family:monospace',
        'font-size:26px',
        'font-weight:bold',
        'letter-spacing:3px',
        'text-align:center',
        'white-space:nowrap',
        'text-shadow:0 2px 8px rgba(0,0,0,0.95),0 0 2px rgba(0,0,0,1)',
        'pointer-events:none',
        'user-select:none',
        'z-index:100',
      ].join(';');
      el.textContent = item.text;
      container.appendChild(el);
      this.uiElements.push(el);
    });
  }

  private hideOverlays(): void {
    for (const el of this.uiElements) el.remove();
    this.uiElements = [];
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
