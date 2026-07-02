// SP-lite — no auth, no backend, everything is open. Kept as a stub so the
// copied module views (which call useAccess for feature-gating) work unchanged.

export function useAccess() {
  const canModule = () => true
  const canFeature = () => true
  return { canModule, canFeature }
}
