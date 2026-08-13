export const DEFAULT_NAME_COLUMN_WIDTH = 220;
export const MIN_NAME_COLUMN_WIDTH = 120;
export const MAX_NAME_COLUMN_WIDTH = 1000;
/** Cap for the auto-fit-to-longest-name default, kept well below MAX_NAME_COLUMN_WIDTH
 * so a single very long item name can't swallow the whole table on load; users can still
 * drag the column wider manually up to MAX_NAME_COLUMN_WIDTH. */
export const AUTO_FIT_MAX_NAME_COLUMN_WIDTH = 400;

export function gridTemplate(columnCount: number, nameWidth: number = DEFAULT_NAME_COLUMN_WIDTH) {
  return `32px ${nameWidth}px repeat(${columnCount}, 160px) 40px`;
}
