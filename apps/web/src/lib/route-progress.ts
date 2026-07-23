import NProgress from "nprogress"

NProgress.configure({ showSpinner: false, trickleSpeed: 100, minimum: 0.15 })

// Local/fast navigations can complete in under a frame — without a floor,
// the bar starts and finishes within the same paint and is never actually
// seen. Keeping it visible for at least this long makes it register.
const MIN_VISIBLE_MS = 300
let startedAt = 0

export function startProgress() {
  startedAt = Date.now()
  NProgress.start()
}

export function doneProgress() {
  const remaining = MIN_VISIBLE_MS - (Date.now() - startedAt)
  if (remaining > 0) setTimeout(() => NProgress.done(), remaining)
  else NProgress.done()
}
