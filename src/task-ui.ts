/**
 * Renders a left-side "TASK" panel inside the game container.
 *
 * Layout
 * ──────
 *   TASK
 *   ────
 *   [item 1]
 *   [item 2]
 *   …
 *
 * @param container  The game UI container element.
 * @param items      Items to display below the header.
 *                   `color` defaults to white when omitted.
 * @returns          A cleanup function that removes the panel from the DOM.
 */
export function createTaskPanel(
  container: HTMLElement,
  items: ReadonlyArray<{ text: string; color?: string }>,
): () => void {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute',
    'left:32px',
    'top:80px',
    'pointer-events:none',
    'user-select:none',
    'z-index:100',
  ].join(';');

  // ── "TASK" header ──────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.textContent = 'TASK';
  header.style.cssText = [
    'color:rgba(255,255,255,0.45)',
    "font-family:'Space Mono',sans-serif",
    'font-size:12px',
    'font-weight:bold',
    'letter-spacing:5px',
    'margin-bottom:6px',
    'text-shadow:0 1px 4px rgba(0,0,0,0.8)',
  ].join(';');
  panel.appendChild(header);

  // ── Thin rule ──────────────────────────────────────────────────────────
  const rule = document.createElement('div');
  rule.style.cssText = [
    'width:36px',
    'height:1px',
    'background:rgba(255,255,255,0.25)',
    'margin-bottom:10px',
  ].join(';');
  panel.appendChild(rule);

  // ── Items ──────────────────────────────────────────────────────────────
  for (const { text, color } of items) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = [
      `color:${color ?? '#ffffff'}`,
      "font-family:'Space Mono',sans-serif",
      'font-size:20px',
      'font-weight:bold',
      'letter-spacing:2px',
      'line-height:1.7',
      'white-space:nowrap',
      'text-shadow:0 2px 8px rgba(0,0,0,0.9),0 0 2px rgba(0,0,0,1)',
    ].join(';');
    panel.appendChild(el);
  }

  container.appendChild(panel);
  return () => panel.remove();
}
