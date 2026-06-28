/** Strip hashtags and bracket promo text for schedule display. */
export function stripSchedulePromoText(name: string): string {
  let result = name
    .replace(/#\w+/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')

  const leadingBlock = /^\s*(?:\[[^\]]*\]|【[^】]*】|\([^)]*\))\s*/
  while (leadingBlock.test(result)) {
    result = result.replace(leadingBlock, '').trim()
  }

  return result.replace(/\s+/g, ' ').trim()
}

export function formatScheduleProductName(name: string): string {
  const cleaned = stripSchedulePromoText(name)
  if (cleaned.length <= 40) return cleaned
  return `${cleaned.slice(0, 40)}...`
}
