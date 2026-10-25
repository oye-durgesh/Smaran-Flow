/** Layout rules for the shared composer. Use container width, not viewport. */
export const COMPOSER_STACK_ACTIONS_BELOW = 400;
export const COMPOSER_PILL_INLINE_MIN = 420;
export const TEXTAREA_MIN_HEIGHT_PX = 72;

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
