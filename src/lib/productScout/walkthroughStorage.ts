const STORAGE_KEY = 'creatorexec-product-scout-walkthrough-dismissed'

export function isProductScoutWalkthroughDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function dismissProductScoutWalkthrough(): void {
  localStorage.setItem(STORAGE_KEY, 'true')
}

export function resetProductScoutWalkthroughDismissed(): void {
  localStorage.removeItem(STORAGE_KEY)
}
