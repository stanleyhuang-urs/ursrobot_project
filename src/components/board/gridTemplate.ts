export const DEFAULT_NAME_COLUMN_WIDTH = 220;
export const MIN_NAME_COLUMN_WIDTH = 120;
export const MAX_NAME_COLUMN_WIDTH = 1000;

export function gridTemplate(columnCount: number, nameWidth: number = DEFAULT_NAME_COLUMN_WIDTH) {
  return `32px ${nameWidth}px repeat(${columnCount}, 160px) 40px`;
}
