// SP-lite — access predicates over the session-resolved module/feature set.
import { useAuth } from './useAuth.js'

export function useAccess() {
  const { userModules, userFeatures } = useAuth()
  const canModule = (m) => userModules.value.includes(m)
  const canFeature = (m, f) =>
    userModules.value.includes(m) && (userFeatures.value[m]?.includes(f) ?? false)
  return { canModule, canFeature }
}
