/**
 * Verifies Product Scout persist lock: a slow "mount" upsert cannot overwrite
 * a later submit once the lock serializes snapshot reads.
 *
 * Run: npx tsx scripts/verify-product-scout-persist-race.ts
 */
import assert from 'node:assert/strict'

/** Minimal copy of the lock used in sync.ts — keep behavior identical. */
function createLock() {
  let lock: Promise<void> = Promise.resolve()
  return async function withLock<T>(task: () => Promise<T>): Promise<T> {
    const previous = lock
    let release!: () => void
    lock = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await task()
    } finally {
      release()
    }
  }
}

async function main() {
  const withLock = createLock()
  let snapshot = 'weak'
  const writes: string[] = []

  const mount = withLock(async () => {
    const seen = snapshot
    await new Promise((r) => setTimeout(r, 80))
    writes.push(`mount:${seen}`)
  })

  // Submit updates snapshot while mount holds the lock, then waits.
  await new Promise((r) => setTimeout(r, 10))
  snapshot = 'strong'
  const submit = withLock(async () => {
    const seen = snapshot
    writes.push(`submit:${seen}`)
  })

  await Promise.all([mount, submit])

  assert.deepEqual(writes, ['mount:weak', 'submit:strong'])
  assert.equal(writes.at(-1), 'submit:strong')

  console.log('verify-product-scout-persist-race: PASS')
  console.log(`- write order: ${writes.join(' → ')} (last writer = strong submit)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
