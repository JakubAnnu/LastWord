import * as ENGINE from '@gnsx/genesys.js';

/**
 * Plays a fullscreen intro video over the game container.
 * Resolves when the video ends naturally or the user presses Enter to skip.
 */
export async function playIntroVideo(container: HTMLElement): Promise<void> {
  const videoUrl = await ENGINE.resolveAssetPathsInText('@project/assets/video/LW_video.mp4');

  return new Promise<void>((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 9999;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const video = document.createElement('video');
    video.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
    `;
    video.src = videoUrl;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;

    const hint = document.createElement('div');
    hint.textContent = 'Press Enter to skip';
    hint.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255, 255, 255, 0.75);
      font-family: sans-serif;
      font-size: 14px;
      letter-spacing: 0.05em;
      pointer-events: none;
      user-select: none;
      text-shadow: 0 1px 4px rgba(0,0,0,0.8);
    `;

    overlay.appendChild(video);
    overlay.appendChild(hint);
    container.appendChild(overlay);

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      resolve();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        cleanup();
      }
    };

    video.addEventListener('ended', cleanup, { once: true });
    document.addEventListener('keydown', onKeyDown);

    video.play().catch(() => {
      // Autoplay may be blocked; attempt muted playback as fallback
      video.muted = true;
      video.play().catch(cleanup);
    });
  });
}
