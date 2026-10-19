/** `Shipping box (RSC)` → `shipping box (RSC)`: only the first letter, so a code in brackets keeps its capitals. */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
