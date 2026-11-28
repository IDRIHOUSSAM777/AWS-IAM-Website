// Pure IAM simulation logic for the IAM Lab. No React and no DOM: the UI calls these helpers and
// they can be tested on their own. The model is deliberately small; see SIMULATION_SCOPE below.

export type Effect = 'Allow' | 'Deny'

export interface Policy {
  effect: Effect
  action: string
  resource: string
  /** Models the single condition `aws:MultiFactorAuthPresent = true`. */
  requireMfa: boolean
}

export interface Role {
  /** Service principal allowed to assume the role, for example lambda.amazonaws.com. */
  trust: string
  policies: string[]
}

export interface MembershipAdd {
  group: string
  user: string
}

export interface SimState {
  users: string[]
  mfaUsers: string[]
  groups: Record<string, string[]>
  policies: Record<string, Policy>
  attachedGroupPolicies: Record<string, string[]>
  attachedUserPolicies: Record<string, string[]>
  roles: Record<string, Role>
  /** Memberships created with the explicit Add action, used by Guided Mission 2. */
  addedMemberships: MembershipAdd[]
}

export type Principal =
  | { kind: 'user'; name: string }
  | { kind: 'role'; name: string; caller: string }

export interface Verdict {
  decision: 'ALLOW' | 'DENY'
  reason: string
}

/** IAM names: letters, numbers and + = , . @ _ - */
export const NAME_PATTERN = /^[A-Za-z0-9+=,.@_-]+$/
/** A service principal such as lambda.amazonaws.com (and the aws-cn partition form). */
export const TRUST_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.amazonaws\.com(\.cn)?$/
/** A policy action: service:Action with optional * and ? wildcards, or the global *. IAM action names are case-insensitive. */
export const ACTION_PATTERN = /^(\*|[A-Za-z0-9-]+:[A-Za-z0-9*?]+)$/
/** A request names one concrete action; wildcards are not API calls. */
export const REQUEST_ACTION_PATTERN = /^[A-Za-z0-9-]+:[A-Za-z0-9]+$/
/** A policy resource: * or an ARN, with optional wildcards. */
export const ARN_PATTERN = /^arn:[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]*:([0-9]{0,12}|\*):.+$/
/** A request targets one concrete ARN. */
export const REQUEST_ARN_PATTERN = /^arn:[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]*:[0-9]{0,12}:.+$/

export const SIMULATION_SCOPE =
  'Each policy has one Effect, one Action and one Resource (with * and ? wildcards) plus an optional MFA condition. A role trusts one service principal, and that trust is enforced against the caller you choose; role sessions are treated as without MFA. Conditions other than MFA, permission boundaries, SCPs and raw policy JSON are not modelled.'

export function validName(value: string, max = 64): boolean {
  return value.length > 0 && value.length <= max && NAME_PATTERN.test(value)
}

export function duplicateName(names: string[], value: string): boolean {
  return names.some((name) => name.toLowerCase() === value.toLowerCase())
}

export function validTrust(value: string): boolean {
  return TRUST_PATTERN.test(value)
}

export function validPolicyAction(value: string): boolean {
  return ACTION_PATTERN.test(value)
}

export function validRequestAction(value: string): boolean {
  return REQUEST_ACTION_PATTERN.test(value)
}

export function validPolicyResource(value: string): boolean {
  return value === '*' || (ARN_PATTERN.test(value) && !value.includes(' '))
}

export function validRequestResource(value: string): boolean {
  return !/[*?]/.test(value) && REQUEST_ARN_PATTERN.test(value) && !value.includes(' ')
}

/**
 * Matches an IAM pattern against a value. `*` matches any run of characters, `?` matches one.
 * Action names are case-insensitive in IAM; resource ARNs are case-sensitive.
 */
export function wildcardMatch(pattern: string, value: string, caseInsensitive = false): boolean {
  let source = '^'
  for (const char of pattern) {
    if (char === '*') source += '.*'
    else if (char === '?') source += '.'
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  source += '$'
  return new RegExp(source, caseInsensitive ? 'i' : '').test(value)
}

function policiesForUser(state: SimState, user: string): string[] {
  const names = [...(state.attachedUserPolicies[user] ?? [])]
  for (const [group, members] of Object.entries(state.groups)) {
    if (!members.includes(user)) continue
    names.push(...(state.attachedGroupPolicies[group] ?? []))
  }
  return names
}

/**
 * Evaluates one request. Explicit Deny wins over Allow, a missing Allow is an implicit deny,
 * and an MFA condition is only met for an IAM user whose MFA switch is on.
 */
export function evaluateAccess(
  state: SimState,
  principal: Principal,
  action: string,
  resource: string,
): Verdict {
  let policyNames: string[] = []
  let mfaPresent = false

  if (principal.kind === 'user') {
    if (!state.users.includes(principal.name)) {
      return { decision: 'DENY', reason: 'This user no longer exists.' }
    }
    mfaPresent = state.mfaUsers.includes(principal.name)
    policyNames = policiesForUser(state, principal.name)
  } else {
    const role = state.roles[principal.name]
    if (!role) return { decision: 'DENY', reason: 'This role no longer exists.' }
    if (!principal.caller) {
      return { decision: 'DENY', reason: 'Choose the principal that assumes this role.' }
    }
    if (role.trust !== principal.caller) {
      return {
        decision: 'DENY',
        reason: `The role trust policy allows ${role.trust} to assume this role, not ${principal.caller}.`,
      }
    }
    policyNames = [...role.policies]
    // Role sessions are treated as not carrying MFA in this simulation.
    mfaPresent = false
  }

  const statements = policyNames
    .map((name) => ({ name, policy: state.policies[name] }))
    .filter((item): item is { name: string; policy: Policy } => Boolean(item.policy))
    .filter(
      (item) =>
        wildcardMatch(item.policy.action, action, true) &&
        wildcardMatch(item.policy.resource, resource, false),
    )

  if (statements.length === 0) {
    return {
      decision: 'DENY',
      reason: 'Implicit default deny: no attached policy allows this action on this resource.',
    }
  }

  const applicable = statements.filter((item) => !item.policy.requireMfa || mfaPresent)
  const blockedByMfa = statements.filter((item) => item.policy.requireMfa && !mfaPresent)

  if (applicable.some((item) => item.policy.effect === 'Deny')) {
    return {
      decision: 'DENY',
      reason: 'An explicit Deny matched this request and wins over every Allow.',
    }
  }
  if (applicable.some((item) => item.policy.effect === 'Allow')) {
    return {
      decision: 'ALLOW',
      reason: 'A matching Allow policy was found, with no Deny to block it.',
    }
  }
  if (blockedByMfa.some((item) => item.policy.effect === 'Allow')) {
    return {
      decision: 'DENY',
      reason:
        'A matching Allow requires MFA, but MFA is not active for this identity, so its condition is not met.',
    }
  }
  return {
    decision: 'DENY',
    reason: 'Implicit default deny: no attached policy allows this action on this resource.',
  }
}
