export const DEFAULT_NAME_COLUMN_WIDTH = 220;
export const MIN_NAME_COLUMN_WIDTH = 120;
export const MAX_NAME_COLUMN_WIDTH = 1000;
/** Cap for the auto-fit-to-longest-name default, kept well below MAX_NAME_COLUMN_WIDTH
 * so a single very long item name can't swallow the whole table on load; users can still
 * drag the column wider manually up to MAX_NAME_COLUMN_WIDTH. */
export const AUTO_FIT_MAX_NAME_COLUMN_WIDTH = 400;

/** Grid template for the data-columns pane only (everything except the
 * frozen checkbox+name columns, which live in a separate non-scrolling pane
 * — see FrozenPane/DataPane in BoardTable.tsx). */
export function gridTemplate(columnCount: number) {
  return `repeat(${columnCount}, 160px) 40px`;
}

export function frozenPaneWidth(nameWidth: number) {
  return 32 + nameWidth;
}
