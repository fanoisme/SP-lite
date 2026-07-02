// SP-lite — access resolution. Verbatim port of SO-Platform's pure
// computeAccess / isFeatureAllowed (no I/O) so behaviour stays identical.
// buildAccessContext / resolveUserAccess fetch the four access tables from
// Supabase instead of PGlite; RLS exposes exactly the rows each caller needs.

import { MODULE_REGISTRY } from './modules.js'
import { supabase } from './supabase.js'

const FEATURES_BY_MODULE = Object.fromEntries(
  MODULE_REGISTRY.map(m => [m.id, (m.features || []).map(f => f.id)]),
)

/**
 * @param {{id:string, role:string}} user
 * @param {{disabledModules:Set<string>, roleModules:Set<string>,
 *          roleFeatures:Map<string,Set<string>>,
 *          userOverrides:Array<{moduleId:string, featureId:string, mode:'grant'|'deny'}>}} ctx
 * @returns {{modules:string[], features:Object<string,string[]>}}
 */
export function computeAccess(user, ctx) {
  const { disabledModules, roleModules, roleFeatures, userOverrides } = ctx

  if (user.role === 'Admin') {
    const modules = []
    const features = {}
    for (const m of MODULE_REGISTRY) {
      if (disabledModules.has(m.id)) continue
      modules.push(m.id)
      features[m.id] = FEATURES_BY_MODULE[m.id].slice()
    }
    return { modules, features }
  }

  const modules = new Set()
  const features = {}
  for (const mId of roleModules) {
    if (disabledModules.has(mId)) continue
    modules.add(mId)
    const explicit = roleFeatures.get(mId)
    features[mId] = explicit
      ? new Set([...explicit])
      : new Set(FEATURES_BY_MODULE[mId] || []) // default-all
  }

  // Overrides — deny wins; grants skipped if a deny covers same/broader scope.
  const deniesWhole = new Set()
  const deniesFeat = new Set()
  const grants = []
  for (const ov of userOverrides) {
    const fId = ov.featureId || ''
    if (ov.mode === 'deny') {
      if (fId === '') deniesWhole.add(ov.moduleId)
      else deniesFeat.add(`${ov.moduleId}|${fId}`)
    } else {
      grants.push({ moduleId: ov.moduleId, featureId: fId })
    }
  }

  for (const mId of deniesWhole) {
    modules.delete(mId)
    delete features[mId]
  }
  for (const key of deniesFeat) {
    const [mId, fId] = key.split('|')
    if (features[mId]) features[mId].delete(fId)
  }

  for (const { moduleId: mId, featureId: fId } of grants) {
    if (disabledModules.has(mId)) continue
    if (deniesWhole.has(mId)) continue
    if (fId !== '' && deniesFeat.has(`${mId}|${fId}`)) continue
    if (fId === '') {
      modules.add(mId)
      features[mId] = new Set(FEATURES_BY_MODULE[mId] || [])
    } else {
      modules.add(mId)
      if (!features[mId]) features[mId] = new Set()
      features[mId].add(fId)
    }
  }

  return {
    modules: [...modules],
    features: Object.fromEntries(
      Object.entries(features).map(([k, v]) => [k, [...v]]),
    ),
  }
}

export function isFeatureAllowed(user, ctx, moduleId, featureId) {
  const { features } = computeAccess(user, ctx)
  return (features[moduleId] || []).includes(featureId)
}

/** Fetch the per-user access context from Supabase. */
export async function buildAccessContext(user) {
  const { data: disabled } = await supabase
    .from('module_state').select('module_id').eq('is_enabled', false)
  const disabledModules = new Set((disabled || []).map(r => r.module_id))

  const { data: rm } = await supabase
    .from('module_access').select('module_id').eq('role', user.role)
  const roleModules = new Set((rm || []).map(r => r.module_id))

  const { data: rf } = await supabase
    .from('feature_access').select('module_id, feature_id').eq('role', user.role)
  const roleFeatures = new Map()
  for (const r of (rf || [])) {
    if (!roleFeatures.has(r.module_id)) roleFeatures.set(r.module_id, new Set())
    roleFeatures.get(r.module_id).add(r.feature_id)
  }

  const { data: uo } = await supabase
    .from('user_access').select('module_id, feature_id, mode').eq('user_id', user.id)
  const userOverrides = (uo || []).map(r => ({
    moduleId: r.module_id,
    featureId: r.feature_id || '',
    mode: r.mode,
  }))

  return { disabledModules, roleModules, roleFeatures, userOverrides }
}

/** Resolve final {modules, features} for a user (used by login + admin preview). */
export async function resolveUserAccess(user) {
  const ctx = await buildAccessContext(user)
  return computeAccess(user, ctx)
}
