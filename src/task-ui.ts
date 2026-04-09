/**
 * Renders a "TASK" panel in the bottom-right corner of the game container,
 * styled to match the camera table visual language.
 *
 * Layout (4 rows, each 38 px tall):
 *   ┌──────────────────────────────┐
 *   │  TASK:                       │  ← row 1  (header)
 *   ├──────────────────────────────┤
 *   │  [item 1]                    │  ← row 2
 *   ├──────────────────────────────┤
 *   │  [item 2]                    │  ← row 3
 *   ├──────────────────────────────┤
 *   │  [item 3]                    │  ← row 4
 *   └──────────────────────────────┘
 *
 * @param container  The game UI container element.
 * @param items      Up to 3 items displayed in rows 2–4.
 *                   `color` defaults to white when omitted.
 * @returns          A cleanup function that removes the panel from the DOM.
 */
export function createTaskPanel(
  container: HTMLElement,
  items: ReadonlyArray<{ text: string; color?: string }>,
): () => void {
  const ROW_HEIGHT = '38px';
  const FONT = "'Space Mono', sans-serif";
  const BG   = 'rgba(0,0,0,0.72)';
  const BORDER_COLOR = 'rgba(255,255,255,0.13)';

  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute',
    'bottom:0',
    'right:0',
    'z-index:1',
    `background:${BG}`,
    `border-top:1px solid ${BORDER_COLOR}`,
    `border-left:1px solid ${BORDER_COLOR}`,
    'min-width:280px',
    'display:flex',
    'flex-direction:column',
    'pointer-events:none',
    'user-select:none',
  ].join(';');

  const makeRow = (content: string, isHeader: boolean, color: string): HTMLElement => {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:flex',
      'align-items:center',
      `min-height:${ROW_HEIGHT}`,
      `border-bottom:1px solid rgba(255,255,255,0.07)`,
      'padding:0 16px',
    ].join(';');

    const text = document.createElement('div');
    text.textContent = content;
    text.style.cssText = [
      `font-family:${FONT}`,
      `font-size:${isHeader ? '11px' : '13px'}`,
      'font-weight:bold',
      `letter-spacing:${isHeader ? '3px' : '1.5px'}`,
      `color:${color}`,
      'text-shadow:0 1px 4px rgba(0,0,0,0.9)',
      'white-space:nowrap',
    ].join(';');
    row.appendChild(text);
    return row;
  };

  // Row 1 — "TASK:" header
  panel.appendChild(makeRow('TASK:', true, 'rgba(255,255,255,0.45)'));

  // Rows 2–4 — item content (pad with empty rows if fewer than 3 items)
  for (let i = 0; i < 3; i++) {
    const item  = items[i];
    const label = item?.text ?? '';
    const color = item?.color ?? 'rgba(255,255,255,0.85)';
    panel.appendChild(makeRow(label, false, color));
  }

  container.appendChild(panel);
  return () => panel.remove();
}
