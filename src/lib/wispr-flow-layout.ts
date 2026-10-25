/** Layout rules for the shared composer. Use container width, not viewport. */
export const COMPOSER_STACK_ACTIONS_BELOW = 400;
export const COMPOSER_PILL_INLINE_MIN = 420;
export const TEXTAREA_MIN_HEIGHT_PX = 48;
export const TEXTAREA_MIN_HEIGHT_DEFAULT_PX = 56;
export const TEXTAREA_MAX_HEIGHT_COMPACT_PX = 120;
export const TEXTAREA_MAX_HEIGHT_DEFAULT_PX = 160;

export function composerHeaderInlinePill(containerWidth: number): boolean {
  return containerWidth >= COMPOSER_PILL_INLINE_MIN;
}

export function composerActionsShareInputRow(containerWidth: number): boolean {
  return containerWidth >= COMPOSER_STACK_ACTIONS_BELOW;
}

export function textareaHasUsableWidth(containerWidth: number, stacked: boolean): boolean {
  if (stacked) return containerWidth - 32 >= 180;
  return containerWidth - 200 >= 160;
}
