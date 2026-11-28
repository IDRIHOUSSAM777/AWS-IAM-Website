import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CheckCircle2, Lightbulb, Pencil, Play, RotateCcw, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import {
  duplicateName,
  evaluateAccess,
  SIMULATION_SCOPE,
  validName,
  validPolicyAction,
  validPolicyResource,
  validRequestAction,
  validRequestResource,
  validTrust,
  type Effect,
  type Policy,
  type Principal,
  type SimState,
} from './iamEngine'
import './lab.css'

type Mode = 'closed' | 'missions' | 'sandbox'
type FlowPhase = 'idle' | 'identity' | 'iam' | 'result'
type Verdict = { decision: 'ALLOW' | 'DENY'; reason: string }
type PolicyDraft = Pick<Policy, 'effect' | 'action' | 'resource' | 'requireMfa'>

const DEFAULT_DRAFT: PolicyDraft = {
  effect: 'Allow',
  action: 's3:GetObject',
  resource: 'arn:aws:s3:::student-demo-bucket/*',
  requireMfa: false,
}

const DEFAULT_CALLERS = ['lambda.amazonaws.com', 'ec2.amazonaws.com', 's3.amazonaws.com']

const INITIAL_STATE: SimState = {
  users: ['sara.dev'],
  mfaUsers: [],
  groups: { Developers: ['sara.dev'], Finance: [] },
  policies: {
    ReadOrdersBucket: {
      effect: 'Allow',
      action: 's3:GetObject',
      resource: 'arn:aws:s3:::student-demo-bucket/*',
      requireMfa: false,
    },
    DenyAllS3: {
      effect: 'Deny',
      action: 's3:*',
      resource: '*',
      requireMfa: false,
    },
  },
  attachedGroupPolicies: { Developers: [], Finance: [] },
  attachedUserPolicies: {},
  roles: {
    OrderFunctionRole: { trust: 'lambda.amazonaws.com', policies: [] },
  },
  addedMemberships: [],
}

const MISSIONS = [
  {
    id: 1,
    title: 'Create a user & MFA',
    goal: 'Create one more user and turn on MFA for someone.',
    hint: 'Type a name such as "karim.dev", click Create, then flip the MFA switch on.',
    check: (s: SimState) => s.users.length >= 2 && s.mfaUsers.length >= 1,
  },
  {
    id: 2,
    title: 'Group & policy',
    goal: 'Put a user in a group and attach ReadOrdersBucket to it.',
    hint: 'Pick a group and a user, click Add, then attach ReadOrdersBucket.',
    check: (s: SimState) =>
      s.addedMemberships.some(
        (membership) =>
          (s.groups[membership.group] ?? []).includes(membership.user) &&
          (s.attachedGroupPolicies[membership.group] ?? []).includes('ReadOrdersBucket'),
      ),
  },
  {
    id: 3,
    title: 'Lambda role',
    goal: 'Attach ReadOrdersBucket to OrderFunctionRole.',
    hint: 'In the role card, choose ReadOrdersBucket in the select, then click Attach.',
    check: (s: SimState) => (s.roles.OrderFunctionRole?.policies ?? []).includes('ReadOrdersBucket'),
  },
]

const RESOURCES = [
  { title: 'S3 bucket', detail: 'student-demo-bucket', y: 16 },
  { title: 'DynamoDB table', detail: 'orders', y: 92 },
  { title: 'Billing', detail: 'cost reports', y: 168 },
]

function initials(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '')
  return (clean.slice(0, 2) || '?').toUpperCase()
}

function nameError(value: string, label: string, names: string[], max = 64): string {
  if (!value) return `Enter a ${label} name.`
  if (!validName(value, max)) return `Use 1–${max} characters: letters, numbers, and + = , . @ _ - only.`
  if (duplicateName(names, value)) return `The ${label} "${value}" already exists.`
  return ''
}

interface IamLabProps {
  mode: Mode
  onClose: () => void
  onSwitchMode: (mode: Exclude<Mode, 'closed'>) => void
}

export default function IamLab({ mode, onClose, onSwitchMode }: IamLabProps) {
  const [state, setState] = useState<SimState>(INITIAL_STATE)

  const [newUser, setNewUser] = useState('')
  const [userError, setUserError] = useState('')

  const [newGroup, setNewGroup] = useState('')
  const [groupError, setGroupError] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('Developers')
  const [selectedMember, setSelectedMember] = useState('sara.dev')
  const [selectedGroupPolicy, setSelectedGroupPolicy] = useState('ReadOrdersBucket')

  const [selectedUser, setSelectedUser] = useState('sara.dev')
  const [selectedUserPolicy, setSelectedUserPolicy] = useState('ReadOrdersBucket')

  const [newRole, setNewRole] = useState('')
  const [newTrust, setNewTrust] = useState('lambda.amazonaws.com')
  const [roleError, setRoleError] = useState('')
  const [rolePolicyPick, setRolePolicyPick] = useState<Record<string, string>>({})

  const [newPolicyName, setNewPolicyName] = useState('')
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(DEFAULT_DRAFT)
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null)
  const [policyError, setPolicyError] = useState('')

  const [simPrincipal, setSimPrincipal] = useState('user:sara.dev')
  const [simCaller, setSimCaller] = useState('lambda.amazonaws.com')
  const [simAction, setSimAction] = useState('s3:GetObject')
  const [simResource, setSimResource] = useState('arn:aws:s3:::student-demo-bucket/notes.pdf')
  const [simError, setSimError] = useState('')

  const [showHint, setShowHint] = useState<Record<number, boolean>>({})
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('idle')
  const [tested, setTested] = useState<Verdict | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const flowTimers = useRef<number[]>([])
  const toastTimer = useRef(0)
  const celebrateTimer = useRef(0)
  const previousCompleted = useRef<number[]>([])
  const simRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [confetti] = useState(() =>
    Array.from({ length: 26 }, (_, index) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.6 + Math.random() * 1.1,
      color: ['#ffb020', '#38bdf8', '#34d399', '#f472b6', '#facc15'][index % 5],
      rotate: Math.random() * 360,
    })),
  )

  const groupNames = Object.keys(state.groups)
  const roleNames = Object.keys(state.roles)
  const policyNames = Object.keys(state.policies)

  // Selections can point at something that was just deleted. Fall back without extra effects.
  const activeGroup = state.groups[selectedGroup] ? selectedGroup : groupNames[0] ?? ''
  const activeMember = state.users.includes(selectedMember) ? selectedMember : state.users[0] ?? ''
  const activeGroupPolicy = state.policies[selectedGroupPolicy] ? selectedGroupPolicy : policyNames[0] ?? ''
  const activeUser = state.users.includes(selectedUser) ? selectedUser : state.users[0] ?? ''
  const activeUserPolicy = state.policies[selectedUserPolicy] ? selectedUserPolicy : policyNames[0] ?? ''
  const principalOptions = [
    ...state.users.map((user) => `user:${user}`),
    ...roleNames.map((role) => `role:${role}`),
  ]
  const activePrincipal = principalOptions.includes(simPrincipal)
    ? simPrincipal
    : principalOptions[0] ?? ''
  const simIsRole = activePrincipal.startsWith('role:')
  const simName = activePrincipal.slice(activePrincipal.indexOf(':') + 1)
  const simRole = simIsRole ? state.roles[simName] : undefined
  const callerOptions = [
    ...new Set(
      [...DEFAULT_CALLERS, ...roleNames.map((role) => state.roles[role].trust), simRole?.trust ?? ''].filter(
        (caller): caller is string => Boolean(caller),
      ),
    ),
  ]

  const completedMissions = MISSIONS.filter((mission) => mission.check(state))
  const completedIds = completedMissions.map((mission) => mission.id)
  const completedKey = completedIds.join(',')
  const allDone = completedMissions.length === MISSIONS.length
  const activeMission = MISSIONS.find((mission) => !completedIds.includes(mission.id)) ?? null

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    const ids = completedKey ? completedKey.split(',').map(Number) : []
    const newly = ids.filter((id) => !previousCompleted.current.includes(id))
    previousCompleted.current = ids
    if (newly.length === 0) return

    window.clearTimeout(toastTimer.current)
    setToast(`Mission ${newly[0]} complete!`)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)

    if (ids.length === MISSIONS.length) {
      setCelebrate(true)
      window.clearTimeout(celebrateTimer.current)
      celebrateTimer.current = window.setTimeout(() => setCelebrate(false), 2600)
    }
  }, [completedKey])

  useEffect(() => () => {
    flowTimers.current.forEach((timer) => window.clearTimeout(timer))
    window.clearTimeout(toastTimer.current)
    window.clearTimeout(celebrateTimer.current)
  }, [])

  function resetFlow() {
    flowTimers.current.forEach((timer) => window.clearTimeout(timer))
    flowTimers.current = []
    setFlowPhase('idle')
    setTested(null)
  }

  function createUser() {
    const name = newUser.trim()
    const error = nameError(name, 'user', state.users, 64)
    if (error) {
      setUserError(error)
      return
    }
    setState((prev) => ({ ...prev, users: [...prev.users, name] }))
    setNewUser('')
    setUserError('')
  }

  function deleteUser(user: string) {
    setState((prev) => {
      const groups = Object.fromEntries(
        Object.entries(prev.groups).map(([group, members]) => [group, members.filter((member) => member !== user)]),
      )
      const attachedUserPolicies = { ...prev.attachedUserPolicies }
      delete attachedUserPolicies[user]
      return {
        ...prev,
        users: prev.users.filter((item) => item !== user),
        mfaUsers: prev.mfaUsers.filter((item) => item !== user),
        groups,
        attachedUserPolicies,
      }
    })
    if (activePrincipal === `user:${user}`) {
      const fallback = state.users.find((item) => item !== user)
      setSimPrincipal(fallback ? `user:${fallback}` : roleNames[0] ? `role:${roleNames[0]}` : '')
    }
  }

  function toggleMfa(user: string) {
    setState((prev) => ({
      ...prev,
      mfaUsers: prev.mfaUsers.includes(user)
        ? prev.mfaUsers.filter((item) => item !== user)
        : [...prev.mfaUsers, user],
    }))
  }

  function createGroup() {
    const name = newGroup.trim()
    const error = nameError(name, 'group', groupNames, 128)
    if (error) {
      setGroupError(error)
      return
    }
    setState((prev) => ({
      ...prev,
      groups: { ...prev.groups, [name]: [] },
      attachedGroupPolicies: { ...prev.attachedGroupPolicies, [name]: [] },
    }))
    setSelectedGroup(name)
    setNewGroup('')
    setGroupError('')
  }

  function deleteGroup(group: string) {
    setState((prev) => {
      const groups = { ...prev.groups }
      const attachedGroupPolicies = { ...prev.attachedGroupPolicies }
      delete groups[group]
      delete attachedGroupPolicies[group]
      return { ...prev, groups, attachedGroupPolicies }
    })
    if (activeGroup === group) {
      setSelectedGroup(groupNames.find((name) => name !== group) ?? '')
    }
  }

  function addUserToGroup() {
    if (!activeGroup) {
      setGroupError('Create a group first.')
      return
    }
    if (!activeMember) {
      setGroupError('Create a user first.')
      return
    }
    if ((state.groups[activeGroup] ?? []).includes(activeMember)) {
      setGroupError(`${activeMember} is already in ${activeGroup}.`)
      return
    }
    setState((prev) => ({
      ...prev,
      groups: { ...prev.groups, [activeGroup]: [...(prev.groups[activeGroup] ?? []), activeMember] },
      addedMemberships: [...prev.addedMemberships, { group: activeGroup, user: activeMember }],
    }))
    setGroupError('')
  }

  function removeUserFromGroup(group: string, user: string) {
    setState((prev) => ({
      ...prev,
      groups: { ...prev.groups, [group]: (prev.groups[group] ?? []).filter((member) => member !== user) },
    }))
  }

  function attachPolicyToGroup() {
    if (!activeGroup) {
      setGroupError('Create a group first.')
      return
    }
    if (!activeGroupPolicy) {
      setGroupError('Create a policy first.')
      return
    }
    if ((state.attachedGroupPolicies[activeGroup] ?? []).includes(activeGroupPolicy)) {
      setGroupError(`${activeGroupPolicy} is already attached to ${activeGroup}.`)
      return
    }
    setState((prev) => ({
      ...prev,
      attachedGroupPolicies: {
        ...prev.attachedGroupPolicies,
        [activeGroup]: [...(prev.attachedGroupPolicies[activeGroup] ?? []), activeGroupPolicy],
      },
    }))
    setGroupError('')
  }

  function detachPolicyFromGroup(group: string, policy: string) {
    setState((prev) => ({
      ...prev,
      attachedGroupPolicies: {
        ...prev.attachedGroupPolicies,
        [group]: (prev.attachedGroupPolicies[group] ?? []).filter((name) => name !== policy),
      },
    }))
  }

  function attachPolicyToUser() {
    if (!activeUser) {
      setUserError('Create a user first.')
      return
    }
    if (!activeUserPolicy) {
      setUserError('Create a policy first.')
      return
    }
    if ((state.attachedUserPolicies[activeUser] ?? []).includes(activeUserPolicy)) {
      setUserError(`${activeUserPolicy} is already attached to ${activeUser}.`)
      return
    }
    setState((prev) => ({
      ...prev,
      attachedUserPolicies: {
        ...prev.attachedUserPolicies,
        [activeUser]: [...(prev.attachedUserPolicies[activeUser] ?? []), activeUserPolicy],
      },
    }))
    setUserError('')
  }

  function detachPolicyFromUser(user: string, policy: string) {
    setState((prev) => ({
      ...prev,
      attachedUserPolicies: {
        ...prev.attachedUserPolicies,
        [user]: (prev.attachedUserPolicies[user] ?? []).filter((name) => name !== policy),
      },
    }))
  }

  function createRole() {
    const name = newRole.trim()
    const trust = newTrust.trim()
    const error = nameError(name, 'role', roleNames, 64)
    if (error) {
      setRoleError(error)
      return
    }
    if (!trust) {
      setRoleError('Enter the service principal that can assume this role.')
      return
    }
    if (!validTrust(trust)) {
      setRoleError('Use a service principal such as lambda.amazonaws.com.')
      return
    }
    setState((prev) => ({ ...prev, roles: { ...prev.roles, [name]: { trust, policies: [] } } }))
    setNewRole('')
    setRoleError('')
  }

  function deleteRole(role: string) {
    setState((prev) => {
      const roles = { ...prev.roles }
      delete roles[role]
      return { ...prev, roles }
    })
    if (activePrincipal === `role:${role}`) {
      setSimPrincipal(state.users[0] ? `user:${state.users[0]}` : '')
    }
  }

  function attachPolicyToRole(role: string) {
    const policy = rolePolicyPick[role] ?? ''
    if (!policy) {
      setRoleError('Choose a policy to attach.')
      return
    }
    if ((state.roles[role]?.policies ?? []).includes(policy)) {
      setRoleError(`${policy} is already attached to ${role}.`)
      return
    }
    setState((prev) => ({
      ...prev,
      roles: {
        ...prev.roles,
        [role]: { ...prev.roles[role], policies: [...(prev.roles[role]?.policies ?? []), policy] },
      },
    }))
    setRolePolicyPick((prev) => ({ ...prev, [role]: '' }))
    setRoleError('')
  }

  function detachPolicyFromRole(role: string, policy: string) {
    setState((prev) => ({
      ...prev,
      roles: {
        ...prev.roles,
        [role]: { ...prev.roles[role], policies: (prev.roles[role]?.policies ?? []).filter((name) => name !== policy) },
      },
    }))
  }

  function startEditPolicy(name: string) {
    const policy = state.policies[name]
    if (!policy) return
    setEditingPolicy(name)
    setNewPolicyName(name)
    setPolicyDraft({
      effect: policy.effect,
      action: policy.action,
      resource: policy.resource,
      requireMfa: policy.requireMfa,
    })
    setPolicyError('')
  }

  function cancelPolicyEdit() {
    setEditingPolicy(null)
    setNewPolicyName('')
    setPolicyDraft(DEFAULT_DRAFT)
    setPolicyError('')
  }

  function savePolicy() {
    const name = newPolicyName.trim()
    const action = policyDraft.action.trim()
    const resource = policyDraft.resource.trim()
    if (!name) {
      setPolicyError('Enter a policy name.')
      return
    }
    if (!validName(name, 128)) {
      setPolicyError('Use 1–128 characters for the policy name: letters, numbers, and + = , . @ _ - only.')
      return
    }
    if (!editingPolicy && duplicateName(policyNames, name)) {
      setPolicyError(`The policy "${name}" already exists.`)
      return
    }
    if (!action) {
      setPolicyError('Enter an action such as s3:GetObject or s3:*.')
      return
    }
    if (!validPolicyAction(action)) {
      setPolicyError('Use service:Action, for example s3:GetObject, s3:*, or *.')
      return
    }
    if (!resource) {
      setPolicyError('Enter a resource ARN or *.')
      return
    }
    if (!validPolicyResource(resource)) {
      setPolicyError('Use * or an ARN such as arn:aws:s3:::student-demo-bucket/*.')
      return
    }
    setState((prev) => ({
      ...prev,
      policies: {
        ...prev.policies,
        [name]: { effect: policyDraft.effect, action, resource, requireMfa: policyDraft.requireMfa },
      },
    }))
    setPolicyError('')
    setEditingPolicy(null)
    setNewPolicyName('')
    setPolicyDraft(DEFAULT_DRAFT)
  }

  function deletePolicy(name: string) {
    setState((prev) => {
      const policies = { ...prev.policies }
      delete policies[name]
      const strip = (map: Record<string, string[]>) =>
        Object.fromEntries(Object.entries(map).map(([key, value]) => [key, value.filter((item) => item !== name)]))
      const roles = Object.fromEntries(
        Object.entries(prev.roles).map(([role, info]) => [
          role,
          { ...info, policies: info.policies.filter((item) => item !== name) },
        ]),
      )
      return {
        ...prev,
        policies,
        attachedGroupPolicies: strip(prev.attachedGroupPolicies),
        attachedUserPolicies: strip(prev.attachedUserPolicies),
        roles,
      }
    })
    if (editingPolicy === name) cancelPolicyEdit()
  }

  function resetAll() {
    resetFlow()
    window.clearTimeout(toastTimer.current)
    window.clearTimeout(celebrateTimer.current)
    setState(INITIAL_STATE)
    setNewUser('')
    setUserError('')
    setNewGroup('')
    setGroupError('')
    setSelectedGroup('Developers')
    setSelectedMember('sara.dev')
    setSelectedGroupPolicy('ReadOrdersBucket')
    setSelectedUser('sara.dev')
    setSelectedUserPolicy('ReadOrdersBucket')
    setNewRole('')
    setNewTrust('lambda.amazonaws.com')
    setRoleError('')
    setRolePolicyPick({})
    setNewPolicyName('')
    setPolicyDraft(DEFAULT_DRAFT)
    setEditingPolicy(null)
    setPolicyError('')
    setSimPrincipal('user:sara.dev')
    setSimCaller('lambda.amazonaws.com')
    setSimAction('s3:GetObject')
    setSimResource('arn:aws:s3:::student-demo-bucket/notes.pdf')
    setSimError('')
    setShowHint({})
    setToast(null)
    setCelebrate(false)
    previousCompleted.current = []
  }

  function switchMode(next: Exclude<Mode, 'closed'>) {
    resetFlow()
    onSwitchMode(next)
  }

  function runTest() {
    if (!activePrincipal) {
      setSimError('Create a user or a role before running a request.')
      resetFlow()
      return
    }
    const action = simAction.trim()
    const resource = simResource.trim()
    if (!validRequestAction(action)) {
      setSimError('Use one action such as s3:GetObject. Wildcards belong in policies, not in a request.')
      resetFlow()
      return
    }
    if (!validRequestResource(resource)) {
      setSimError('Use one concrete ARN such as arn:aws:s3:::student-demo-bucket/notes.pdf. Wildcards belong in policies, not in a request.')
      resetFlow()
      return
    }

    setSimError('')
    resetFlow()
    const principal: Principal = activePrincipal.startsWith('role:')
      ? { kind: 'role', name: activePrincipal.slice(5), caller: simCaller }
      : { kind: 'user', name: activePrincipal.slice(5) }
    const result = evaluateAccess(state, principal, action, resource)

    setFlowPhase('identity')
    flowTimers.current.push(window.setTimeout(() => setFlowPhase('iam'), 550))
    flowTimers.current.push(
      window.setTimeout(() => {
        setTested(result)
        setFlowPhase('result')
      }, 1200),
    )
  }

  function startTest() {
    simRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    flowTimers.current.push(window.setTimeout(runTest, 420))
  }

  if (mode === 'closed') return null

  const doneCount = completedMissions.length
  const simLabel = simName.length > 16 ? `${simName.slice(0, 15)}…` : simName
  const targetIndex = simAction.startsWith('s3:') || simResource.includes('s3')
    ? 0
    : simAction.startsWith('dynamodb:') || simResource.includes('dynamodb')
      ? 1
      : 2
  const packetTransform = flowPhase === 'iam'
    ? 'translate(305px, 120px)'
    : flowPhase === 'result'
      ? `translate(440px, ${RESOURCES[targetIndex].y + 28}px)`
      : 'translate(110px, 120px)'
  const running = flowPhase === 'identity' || flowPhase === 'iam'
  const flowStatus = flowPhase === 'identity'
    ? 'Request received'
    : flowPhase === 'iam'
      ? 'Checking policy'
      : flowPhase === 'result'
        ? tested?.decision === 'ALLOW' ? 'Allowed' : 'Denied'
        : 'Ready'
  const verdict = tested

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="lab-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="IAM Lab simulation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="lab-modal">
        <header className="lab-head">
          <div className="lab-brand">
            <span className="lab-logo" aria-hidden="true">&gt;_</span>
            <div>
              <p className="lab-eyebrow">Safe practice account</p>
              <h2 className="lab-title">IAM Lab</h2>
            </div>
          </div>
          <div className="lab-switch" role="group" aria-label="Lab mode">
            <button type="button" className={mode === 'missions' ? 'on' : ''} onClick={() => switchMode('missions')}>
              Guided missions
            </button>
            <button type="button" className={mode === 'sandbox' ? 'on' : ''} onClick={() => switchMode('sandbox')}>
              Free sandbox
            </button>
          </div>
          <div className="lab-actions">
            <button type="button" className="lab-icon-btn" onClick={resetAll} title="Reset simulation" aria-label="Reset simulation">
              <RotateCcw size={15} />
            </button>
            <button type="button" className="lab-icon-btn" onClick={onClose} title="Exit lab" aria-label="Exit lab">
              <X size={17} />
            </button>
          </div>
        </header>

        {mode === 'missions' ? (
          <>
            <div className="lab-progress">
              <div className="lab-progress-text">
                <span>Mission progress</span>
                <b>{doneCount} / {MISSIONS.length}</b>
              </div>
              <div className="lab-progress-track"><i style={{ width: `${(doneCount / MISSIONS.length) * 100}%` }} /></div>
            </div>

            <div className="lab-missions">
              {MISSIONS.map((mission) => {
                const done = completedIds.includes(mission.id)
                const active = activeMission?.id === mission.id
                return (
                  <article key={mission.id} className={`lab-mission${done ? ' done' : ''}${active ? ' active' : ''}`}>
                    <span className="lab-mission-num" aria-hidden="true">
                      {done ? <CheckCircle2 size={17} /> : mission.id}
                    </span>
                    <div className="lab-mission-copy">
                      <div className="lab-mission-head">
                        <strong>{mission.title}</strong>
                        <span className="lab-mission-state">{done ? 'Done' : active ? 'Active' : 'Next'}</span>
                      </div>
                      <p>{mission.goal}</p>
                      {showHint[mission.id] && <p className="lab-hint-text">{mission.hint}</p>}
                    </div>
                    <button
                      type="button"
                      className="lab-hint-btn"
                      onClick={() => setShowHint((current) => ({ ...current, [mission.id]: !current[mission.id] }))}
                    >
                      <Lightbulb size={13} /> Hint
                    </button>
                  </article>
                )
              })}
            </div>

            {allDone && (
              <div className="lab-complete">
                <span className="lab-complete-icon" aria-hidden="true"><Sparkles size={18} /></span>
                <div>
                  <strong>Lab complete!</strong>
                  <p>You built a user, used a group policy, and trusted a role with a policy.</p>
                </div>
                <button type="button" className="btn lab-btn" onClick={startTest}>
                  <Play size={13} aria-hidden="true" /> Test a request
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="lab-sandbox-note">
            <Sparkles size={14} aria-hidden="true" /> Everything is unlocked. Create users, groups, roles and policies, then test any request below.
          </p>
        )}

        <p className="lab-scope">
          <ShieldCheck size={14} aria-hidden="true" />
          <span><b>Simulation scope:</b> {SIMULATION_SCOPE}</span>
        </p>

        <div className="lab-grid">
          <section className="lab-box">
            <div className="lab-box-head">
              <span className="lab-box-num">01</span>
              <div>
                <p className="lab-box-kicker">Identity</p>
                <h3>Users &amp; MFA</h3>
              </div>
            </div>
            <div className="lab-row">
              <input
                type="text"
                value={newUser}
                onChange={(event) => { setNewUser(event.target.value); setUserError('') }}
                onKeyDown={(event) => { if (event.key === 'Enter') createUser() }}
                placeholder="e.g. karim.dev"
                aria-label="New IAM username"
              />
              <button type="button" className="btn lab-btn" onClick={createUser}>Create</button>
            </div>
            {userError && <p className="lab-error" role="alert">{userError}</p>}
            <ul className="lab-user-list">
              {state.users.map((user) => {
                const hasMfa = state.mfaUsers.includes(user)
                const directPolicies = state.attachedUserPolicies[user] ?? []
                return (
                  <li key={user} className="lab-user">
                    <span className="lab-user-avatar" aria-hidden="true">{initials(user)}</span>
                    <span className="lab-user-name">
                      <code>{user}</code>
                      <small>{hasMfa ? 'MFA on' : 'MFA off'}</small>
                      {directPolicies.length > 0 && (
                        <span className="lab-policy-row">
                          {directPolicies.map((policy) => (
                            <span key={policy} className="lab-policy">
                              {policy}
                              <button
                                type="button"
                                className="lab-x"
                                aria-label={`Detach ${policy} from ${user}`}
                                onClick={() => detachPolicyFromUser(user, policy)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className={`lab-mfa${hasMfa ? ' on' : ''}`}
                      onClick={() => toggleMfa(user)}
                      aria-pressed={hasMfa}
                      aria-label={`Turn MFA ${hasMfa ? 'off' : 'on'} for ${user}`}
                    />
                    <button
                      type="button"
                      className="lab-mini"
                      aria-label={`Delete user ${user}`}
                      onClick={() => deleteUser(user)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                )
              })}
            </ul>
            {state.users.length === 0 && <p className="lab-empty">No users yet.</p>}

            <p className="lab-sub">Direct user policies</p>
            <div className="lab-row">
              <select aria-label="User for a direct policy" value={activeUser} onChange={(event) => setSelectedUser(event.target.value)}>
                {state.users.map((user) => <option key={user} value={user}>{user}</option>)}
              </select>
              <select aria-label="Policy to attach directly to a user" value={activeUserPolicy} onChange={(event) => setSelectedUserPolicy(event.target.value)}>
                {policyNames.map((policy) => <option key={policy} value={policy}>{policy}</option>)}
              </select>
              <button type="button" className="btn lab-btn alt" onClick={attachPolicyToUser} disabled={!activeUser || !activeUserPolicy}>Attach</button>
            </div>
          </section>

          <section className="lab-box">
            <div className="lab-box-head">
              <span className="lab-box-num">02</span>
              <div>
                <p className="lab-box-kicker">Documents</p>
                <h3>Policies</h3>
              </div>
            </div>
            <div className="lab-policy-form">
              <div className="lab-row">
                <input
                  type="text"
                  value={newPolicyName}
                  onChange={(event) => { setNewPolicyName(event.target.value); setPolicyError('') }}
                  placeholder="Policy name"
                  aria-label="Policy name"
                  disabled={editingPolicy !== null}
                />
                <select
                  value={policyDraft.effect}
                  onChange={(event) => setPolicyDraft((current) => ({ ...current, effect: event.target.value as Effect }))}
                  aria-label="Policy effect"
                >
                  <option value="Allow">Allow</option>
                  <option value="Deny">Deny</option>
                </select>
              </div>
              <div className="lab-row">
                <input
                  type="text"
                  value={policyDraft.action}
                  onChange={(event) => { setPolicyDraft((current) => ({ ...current, action: event.target.value })); setPolicyError('') }}
                  placeholder="s3:GetObject or s3:*"
                  aria-label="Policy action"
                />
              </div>
              <div className="lab-row">
                <input
                  type="text"
                  value={policyDraft.resource}
                  onChange={(event) => { setPolicyDraft((current) => ({ ...current, resource: event.target.value })); setPolicyError('') }}
                  placeholder="arn:aws:s3:::bucket/* or *"
                  aria-label="Policy resource"
                />
              </div>
              <label className="lab-check">
                <input
                  type="checkbox"
                  checked={policyDraft.requireMfa}
                  onChange={(event) => setPolicyDraft((current) => ({ ...current, requireMfa: event.target.checked }))}
                />
                Require MFA (aws:MultiFactorAuthPresent)
              </label>
              <div className="lab-row">
                <button type="button" className="btn lab-btn" onClick={savePolicy}>
                  {editingPolicy ? 'Save policy' : 'Create policy'}
                </button>
                {editingPolicy && (
                  <button type="button" className="btn lab-btn alt" onClick={cancelPolicyEdit}>Cancel</button>
                )}
              </div>
              {policyError && <p className="lab-error" role="alert">{policyError}</p>}
            </div>

            <div className="lab-policy-list">
              {policyNames.map((policyName) => {
                const policy = state.policies[policyName]
                return (
                  <div key={policyName} className="lab-policy-card">
                    <div className="lab-policy-card-head">
                      <strong>{policyName}</strong>
                      <span className={`lab-effect ${policy.effect.toLowerCase()}`}>{policy.effect}</span>
                      <span className="lab-policy-tools">
                        <button
                          type="button"
                          className="lab-mini"
                          aria-label={`Edit policy ${policyName}`}
                          onClick={() => startEditPolicy(policyName)}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          className="lab-mini"
                          aria-label={`Delete policy ${policyName}`}
                          onClick={() => deletePolicy(policyName)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </div>
                    <code>{policy.action}</code>
                    <code>{policy.resource}</code>
                    {policy.requireMfa && <small>Requires MFA</small>}
                  </div>
                )
              })}
              {policyNames.length === 0 && <p className="lab-empty">No policies yet.</p>}
            </div>
          </section>

          <section className="lab-box">
            <div className="lab-box-head">
              <span className="lab-box-num">03</span>
              <div>
                <p className="lab-box-kicker">Permissions</p>
                <h3>Groups &amp; policies</h3>
              </div>
            </div>
            <div className="lab-row">
              <input
                type="text"
                value={newGroup}
                onChange={(event) => { setNewGroup(event.target.value); setGroupError('') }}
                onKeyDown={(event) => { if (event.key === 'Enter') createGroup() }}
                placeholder="New group name"
                aria-label="New group name"
              />
              <button type="button" className="btn lab-btn alt" onClick={createGroup}>Create group</button>
            </div>
            <div className="lab-row">
              <select value={activeGroup} onChange={(event) => setSelectedGroup(event.target.value)} aria-label="Group">
                {groupNames.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
              <select value={activeMember} onChange={(event) => setSelectedMember(event.target.value)} aria-label="User to add">
                {state.users.map((user) => <option key={user} value={user}>{user}</option>)}
              </select>
              <button type="button" className="btn lab-btn alt" onClick={addUserToGroup} disabled={!activeGroup || !activeMember}>Add</button>
            </div>
            <div className="lab-row">
              <select value={activeGroupPolicy} onChange={(event) => setSelectedGroupPolicy(event.target.value)} aria-label="Policy">
                {policyNames.map((policy) => <option key={policy} value={policy}>{policy}</option>)}
              </select>
              <button type="button" className="btn lab-btn" onClick={attachPolicyToGroup} disabled={!activeGroup || !activeGroupPolicy}>Attach</button>
            </div>
            {groupError && <p className="lab-error" role="alert">{groupError}</p>}
            <div className="lab-groups">
              {groupNames.map((group) => {
                const members = state.groups[group] ?? []
                const policies = state.attachedGroupPolicies[group] ?? []
                return (
                  <div key={group} className="lab-group">
                    <div className="lab-group-head">
                      <strong>{group}</strong>
                      <span className="lab-group-tools">
                        {members.length} member{members.length === 1 ? '' : 's'}
                        <button
                          type="button"
                          className="lab-mini"
                          aria-label={`Delete group ${group}`}
                          onClick={() => deleteGroup(group)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </div>
                    <div className="lab-chips">
                      {members.length
                        ? members.map((member) => (
                            <span key={member} className="lab-chip">
                              {member}
                              <button
                                type="button"
                                className="lab-x"
                                aria-label={`Remove ${member} from ${group}`}
                                onClick={() => removeUserFromGroup(group, member)}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        : <span className="lab-empty">No members yet</span>}
                    </div>
                    <div className="lab-policy-row">
                      {policies.length
                        ? policies.map((policy) => (
                            <span key={policy} className="lab-policy">
                              <ShieldCheck size={11} />{policy}
                              <button
                                type="button"
                                className="lab-x"
                                aria-label={`Detach ${policy} from ${group}`}
                                onClick={() => detachPolicyFromGroup(group, policy)}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        : <span className="lab-empty">No policy attached</span>}
                    </div>
                  </div>
                )
              })}
              {groupNames.length === 0 && <p className="lab-empty">No groups yet.</p>}
            </div>
          </section>

          <section className="lab-box">
            <div className="lab-box-head">
              <span className="lab-box-num">04</span>
              <div>
                <p className="lab-box-kicker">Temporary access</p>
                <h3>Roles</h3>
              </div>
            </div>
            <div className="lab-row">
              <input
                type="text"
                value={newRole}
                onChange={(event) => { setNewRole(event.target.value); setRoleError('') }}
                placeholder="New role name"
                aria-label="New role name"
              />
              <input
                type="text"
                value={newTrust}
                onChange={(event) => { setNewTrust(event.target.value); setRoleError('') }}
                placeholder="lambda.amazonaws.com"
                aria-label="Trusted service principal"
              />
              <button type="button" className="btn lab-btn alt" onClick={createRole}>Create role</button>
            </div>
            {roleError && <p className="lab-error" role="alert">{roleError}</p>}
            {roleNames.map((roleName) => {
              const roleInfo = state.roles[roleName]
              return (
                <div key={roleName} className="lab-role">
                  <div className="lab-role-head">
                    <span className="lab-role-icon" aria-hidden="true"><ShieldCheck size={15} /></span>
                    <div>
                      <strong>{roleName}</strong>
                      <small>Trusted by {roleInfo.trust}</small>
                    </div>
                    <button
                      type="button"
                      className="lab-mini"
                      aria-label={`Delete role ${roleName}`}
                      onClick={() => deleteRole(roleName)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="lab-role-flow" aria-hidden="true">
                    <span>Caller</span><i>→</i><span>assumes role</span><i>→</i><span>policy</span>
                  </div>
                  <div className="lab-row">
                    <select
                      value={rolePolicyPick[roleName] ?? ''}
                      onChange={(event) => setRolePolicyPick((current) => ({ ...current, [roleName]: event.target.value }))}
                      aria-label={`Policy to attach to ${roleName}`}
                    >
                      <option value="">Choose policy</option>
                      {policyNames.map((policy) => <option key={policy} value={policy}>{policy}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn lab-btn alt"
                      onClick={() => attachPolicyToRole(roleName)}
                      disabled={!rolePolicyPick[roleName]}
                    >
                      Attach
                    </button>
                  </div>
                  <div className="lab-policy-row">
                    {roleInfo.policies.length
                      ? roleInfo.policies.map((policy) => (
                          <span key={policy} className="lab-policy">
                            <ShieldCheck size={11} />{policy}
                            <button
                              type="button"
                              className="lab-x"
                              aria-label={`Detach ${policy} from ${roleName}`}
                              onClick={() => detachPolicyFromRole(roleName, policy)}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      : <span className="lab-empty">No policy attached</span>}
                  </div>
                </div>
              )
            })}
            {roleNames.length === 0 && <p className="lab-empty">No roles yet.</p>}
          </section>

          <section ref={simRef} className="lab-box lab-sim-box">
            <div className="lab-box-head">
              <span className="lab-box-num">05</span>
              <div>
                <p className="lab-box-kicker">Animated check</p>
                <h3>Request tester</h3>
              </div>
              <span className="lab-sim-state on">Live</span>
            </div>

            <div className="lab-sim">
                <div className="lab-sim-form">
                  <label>
                    Identity
                    <select
                      value={activePrincipal}
                      onChange={(event) => { setSimPrincipal(event.target.value); setSimError(''); resetFlow() }}
                    >
                      {state.users.map((user) => <option key={user} value={`user:${user}`}>IAM user · {user}</option>)}
                      {roleNames.map((role) => <option key={role} value={`role:${role}`}>IAM role · {role}</option>)}
                    </select>
                  </label>
                  {simIsRole && (
                    <label>
                      Assumed by
                      <select
                        value={simCaller}
                        onChange={(event) => { setSimCaller(event.target.value); setSimError(''); resetFlow() }}
                      >
                        {callerOptions.map((caller) => <option key={caller} value={caller}>{caller}</option>)}
                      </select>
                    </label>
                  )}
                  <label>
                    Action
                    <input
                      type="text"
                      value={simAction}
                      onChange={(event) => { setSimAction(event.target.value); setSimError(''); resetFlow() }}
                    />
                  </label>
                  <label>
                    Resource ARN
                    <input
                      type="text"
                      value={simResource}
                      onChange={(event) => { setSimResource(event.target.value); setSimError(''); resetFlow() }}
                    />
                  </label>
                  {simError && <p className="lab-error" role="alert">{simError}</p>}
                  <button type="button" className="btn lab-btn lab-run" onClick={runTest} disabled={running}>
                    <Play size={13} aria-hidden="true" />
                    {running ? 'Checking…' : 'Run request'}
                  </button>
                </div>

                <div className="lab-flow-panel">
                  <div className="lab-flow-head">
                    <span>Request flow</span>
                    <span className={`lab-flow-status${tested ? tested.decision === 'ALLOW' ? ' ok' : ' no' : ''}`}>{flowStatus}</span>
                  </div>
                  <svg className="lab-flow-svg" viewBox="0 0 620 240" role="img" aria-label={`Request from ${simName} through IAM to the selected resource`}>
                    <g className={`lab-flow-node${flowPhase !== 'idle' ? ' on' : ''}`}>
                      <rect x="8" y="88" width="150" height="64" rx="9" />
                      <text className="lab-node-kicker" x="83" y="110" textAnchor="middle">IDENTITY</text>
                      <text className="lab-node-name" x="83" y="132" textAnchor="middle">{simLabel}</text>
                    </g>
                    <path className="lab-wire" d="M158 120 H240" />
                    <g className={`lab-flow-node${flowPhase === 'iam' || flowPhase === 'result' ? ' on' : ''}`}>
                      <rect x="240" y="78" width="130" height="84" rx="9" />
                      <text className="lab-node-title" x="305" y="112" textAnchor="middle">IAM</text>
                      <text className="lab-node-sub" x="305" y="130" textAnchor="middle">policy check</text>
                    </g>
                    {RESOURCES.map((resource) => (
                      <path key={`wire-${resource.title}`} className="lab-wire" d={`M370 120 L440 ${resource.y + 28}`} />
                    ))}
                    {RESOURCES.map((resource, index) => {
                      const isTarget = tested !== null && targetIndex === index
                      return (
                        <g key={resource.title} className={`lab-flow-node lab-resource${isTarget ? tested?.decision === 'ALLOW' ? ' ok' : ' no' : ''}`}>
                          <rect x="440" y={resource.y} width="170" height="56" rx="9" />
                          <text className="lab-node-res-title" x="525" y={resource.y + 23} textAnchor="middle">{resource.title}</text>
                          <text className="lab-node-res-sub" x="525" y={resource.y + 39} textAnchor="middle">{resource.detail}</text>
                          {isTarget && <text className={`lab-node-badge${tested?.decision === 'DENY' ? ' no' : ''}`} x="525" y={resource.y + 52} textAnchor="middle">{tested?.decision}</text>}
                        </g>
                      )
                    })}
                    <g
                      className={`lab-packet${tested?.decision === 'DENY' ? ' no' : ''}`}
                      style={{ transform: packetTransform, opacity: flowPhase === 'idle' ? 0 : 1 }}
                    >
                      <rect x="-60" y="-12" width="120" height="24" rx="6" />
                      <text y="4" textAnchor="middle">{simAction.slice(0, 18)}</text>
                    </g>
                  </svg>

                  {verdict ? (
                    <div className={`lab-verdict ${verdict.decision === 'ALLOW' ? 'allow' : 'deny'}`} aria-live="polite">
                      <ShieldCheck size={17} />
                      <div>
                        <strong>{verdict.decision}</strong>
                        <p>{verdict.reason}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="lab-verdict idle">
                      <Play size={15} />
                      <div>
                        <strong>Ready</strong>
                        <p>Run the request to watch it travel through IAM.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </section>
        </div>
      </div>

      {toast && (
        <div className="lab-toast" role="status">
          <CheckCircle2 size={15} /> {toast}
        </div>
      )}

      {celebrate && (
        <div className="lab-confetti" aria-hidden="true">
          {confetti.map((piece, index) => (
            <i
              key={index}
              style={{
                '--x': `${piece.left}%`,
                '--d': `${piece.delay}s`,
                '--dur': `${piece.duration}s`,
                '--c': piece.color,
                '--r': `${piece.rotate}deg`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  )
}
