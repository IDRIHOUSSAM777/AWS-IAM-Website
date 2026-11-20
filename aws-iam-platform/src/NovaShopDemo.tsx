import { useEffect, useRef, useState } from 'react'

const policies = [
  {
    name: 'group Developers',
    statements: [
      {
        id: 'OrderFiles',
        action: 's3:GetObject, s3:PutObject',
        resource: 'arn:aws:s3:::novashop-orders/*',
      },
      {
        id: 'DevServers',
        action: 'ec2:StartInstances, ec2:StopInstances',
        resource: 'arn:aws:ec2:*:*:instance/*',
      },
    ],
  },
  {
    name: 'role OrderFunctionRole',
    statements: [
      {
        id: 'ReadOrderFiles',
        action: 's3:GetObject',
        resource: 'arn:aws:s3:::novashop-orders/*',
      },
      {
        id: 'OrdersTable',
        action: 'dynamodb:Query, dynamodb:PutItem',
        resource: 'arn:aws:dynamodb:*:*:table/orders',
      },
    ],
  },
  {
    name: 'group Finance',
    statements: [
      { id: 'ViewBilling', action: 'ce:GetCostAndUsage', resource: '*' },
    ],
  },
]

const requests = [
  {
    identity: 0,
    policy: 0,
    action: 's3:GetObject',
    resource: 0,
    match: 0,
    explanation: [
      'Sara, a developer, asks to read an order file from the novashop-orders bucket.',
      'Authentication: IAM confirms the request is signed by Sara. Authorization: IAM loads the policy of her group, Developers.',
      'The OrderFiles statement lists this action and this bucket, and its Effect is Allow.',
      'ALLOW. The request reaches S3 and the file is returned.',
    ],
  },
  {
    identity: 2,
    policy: 1,
    action: 'dynamodb:Query',
    resource: 1,
    match: 1,
    explanation: [
      'The order-processing Lambda function asks to query the orders table.',
      'The function has no password. It assumed OrderFunctionRole, so IAM loads the policy attached to that role.',
      'The OrdersTable statement lists dynamodb:Query on this table.',
      'ALLOW. Temporary role credentials are enough, and no key is stored in code.',
    ],
  },
  {
    identity: 1,
    policy: 2,
    action: 'ce:GetCostAndUsage',
    resource: 2,
    match: 0,
    explanation: [
      'Karim, a finance analyst, asks to read the cost reports in Billing.',
      'IAM confirms Karim, then loads the policy of his group, Finance.',
      'The ViewBilling statement lists this action, and its Effect is Allow.',
      'ALLOW. Finance can open Billing.',
    ],
  },
  {
    identity: 1,
    policy: 2,
    action: 's3:GetObject',
    resource: 0,
    match: -1,
    explanation: [
      'Now Karim asks to read an order file from S3.',
      'Same person, same Finance policy.',
      'No statement mentions s3:GetObject. Nothing allows it.',
      'DENY. With no Allow, IAM refuses by default. Order files stay closed to Finance.',
    ],
  },
]

const identities = ['Sara', 'Karim', 'Order Lambda']
const resources = [
  ['S3 bucket', 'novashop-orders'],
  ['DynamoDB table', 'orders'],
  ['Billing', 'cost reports'],
]

function policyLines(policyIndex: number) {
  const policy = policies[policyIndex]
  const lines = ['{', '  "Version": "2012-10-17",', '  "Statement": [']
  const ranges: Array<[number, number]> = []
  policy.statements.forEach((statement, index) => {
    const first = lines.length
    const actions = statement.action.split(', ').map((action) => `"${action}"`)
    lines.push(
      '    {',
      `      "Sid": "${statement.id}",`,
      '      "Effect": "Allow",',
      `      "Action": ${actions.length === 1 ? actions[0] : `[${actions.join(', ')}]`},`,
      `      "Resource": "${statement.resource}",`,
      `    }${index < policy.statements.length - 1 ? ',' : ''}`,
    )
    ranges.push([first, lines.length - 1])
  })
  lines.push('  ]', '}')
  return { lines, ranges }
}

type Props = { reducedMotion: boolean }

export default function NovaShopDemo({ reducedMotion }: Props) {
  const [requestIndex, setRequestIndex] = useState(-1)
  const [activeStatement, setActiveStatement] = useState(-1)
  const [matchedStatement, setMatchedStatement] = useState(-1)
  const [phase, setPhase] = useState<'idle' | 'identity' | 'iam' | 'result'>('idle')
  const [message, setMessage] = useState('Press Play all, or pick one request, to watch how NovaShop’s identities use resources.')
  const [status, setStatus] = useState('Waiting for a request')
  const [paused, setPaused] = useState(false)
  const [playing, setPlaying] = useState(false)
  const runId = useRef(0)
  const pausedRef = useRef(false)
  const rootRef = useRef<HTMLElement>(null)
  const request = requestIndex < 0 ? null : requests[requestIndex]
  const selectedPolicy = policyLines(request?.policy ?? 0)

  const wait = async (duration: number, id: number) => {
    let elapsed = 0
    while (elapsed < duration && id === runId.current) {
      await new Promise((resolve) => window.setTimeout(resolve, 50))
      if (!pausedRef.current) elapsed += 50
    }
    return id === runId.current
  }

  const runRequest = async (index: number, id: number) => {
    const current = requests[index]
    setRequestIndex(index)
    setActiveStatement(-1)
    setMatchedStatement(-1)
    setPhase('identity')
    setMessage(current.explanation[0])
    setStatus('Request received')
    if (!(await wait(1500, id))) return false

    setPhase('iam')
    setMessage(current.explanation[1])
    setStatus(`Loading the policy of ${policies[current.policy].name.split(' ')[1]}`)
    if (!(await wait(1700, id))) return false

    setMessage(current.explanation[2])
    const statementCount = policies[current.policy].statements.length
    for (let statement = 0; statement < statementCount; statement += 1) {
      setActiveStatement(statement)
      setStatus(`Checking statement ${statement + 1} of ${statementCount}`)
      if (!(await wait(900, id))) return false
      if (statement === current.match) {
        setMatchedStatement(statement)
        setStatus(`Match: ${policies[current.policy].statements[statement].id} (Allow)`)
        break
      }
    }
    if (current.match < 0) setStatus('Match: none, nothing allows this action')
    if (!(await wait(900, id))) return false

    setPhase('result')
    setMessage(current.explanation[3])
    await wait(1400, id)
    return id === runId.current
  }

  const start = async (indices: number[]) => {
    const id = ++runId.current
    pausedRef.current = false
    setPaused(false)
    setPlaying(true)
    for (const index of indices) {
      if (!(await runRequest(index, id))) return
      if (indices.length > 1 && index !== indices[indices.length - 1]) {
        if (!(await wait(500, id))) return
      }
    }
    if (id !== runId.current) return
    setPlaying(false)
    setPhase('idle')
    setStatus(indices.length > 1 ? '4 requests, 3 policies' : 'Request complete')
    if (indices.length > 1) {
      setMessage('Each identity has its own policy, and IAM judges every request against that policy only.')
    }
  }

  const pause = () => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  useEffect(() => {
    if (reducedMotion || !rootRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect()
        start([0, 1, 2, 3])
      }
    }, { threshold: 0.5 })
    observer.observe(rootRef.current)
    return () => {
      observer.disconnect()
      runId.current += 1
    }
  }, [reducedMotion])

  const activeRequestIndex = requestIndex
  const identityPosition = activeRequestIndex < 0 ? 0 : [119, 159, 199][requests[activeRequestIndex].identity]
  const resourcePosition = request ? [50, 150, 250][request.resource] : 50
  const packetTransform = phase === 'identity'
    ? `translate(182px, ${identityPosition}px)`
    : phase === 'iam'
      ? 'translate(310px, 170px)'
      : `translate(409px, ${resourcePosition}px)`
  const packetVisible = phase !== 'idle' && request !== null

  return (
    <section className="demo" id="demo" ref={rootRef}>
      <div className="c">
        <div className="dt">
          {requests.map((item, index) => (
            <button
              key={item.action + item.identity}
              type="button"
              data-i={index}
              aria-pressed={requestIndex === index}
              onClick={() => start([index])}
            >
              {index + 1} {['Sara reads orders', 'Lambda queries table', 'Karim opens billing', 'Karim reads orders'][index]}
            </button>
          ))}
          <button className="dp" type="button" onClick={() => start([0, 1, 2, 3])}>
            {playing ? 'Playing' : 'Play all'}
          </button>
          <button type="button" disabled={!playing} onClick={pause}>{paused ? 'Resume' : 'Pause'}</button>
        </div>
        <div className="sc">
          <svg className="demo-diagram" viewBox="0 0 600 300" role="img" aria-label="NovaShop identities send requests through IAM to S3, DynamoDB, and Billing">
            <rect className="sb" x="2" y="50" width="116" height="200" />
            <text className="sx" x="60" y="74" textAnchor="middle">NovaShop</text>
            <text className="sm2" x="60" y="89" textAnchor="middle">identities</text>
            {identities.map((identity, index) => (
              <g key={identity} className={`mb ${request?.identity === index ? 'on' : ''}`}>
                <rect x="12" y={104 + index * 40} width="96" height="30" />
                <text className="mt" x="60" y={123 + index * 40} textAnchor="middle">{identity}</text>
              </g>
            ))}
            <path className="wire" d="M118 150H270" />
            <path className="wire" d="M350 150L470 50" />
            <path className="wire" d="M350 150H470" />
            <path className="wire" d="M350 150L470 250" />
            <g className="iam">
              <rect x="270" y="100" width="80" height="100" />
              <text className="sx iam-title" x="310" y="126" textAnchor="middle">IAM</text>
              <text className="sm2" x="310" y="143" textAnchor="middle">policy check</text>
            </g>
            {resources.map(([name, detail], index) => {
              const isResult = phase === 'result' && request?.resource === index
              const isAllowed = isResult && request?.match !== -1
              return (
                <g key={name} className={`resource-node ${isResult ? (isAllowed ? 'ok' : 'no') : ''}`}>
                  <rect x="470" y={18 + index * 100} width="128" height="64" />
                  <text className="sx" x="534" y={40 + index * 100} textAnchor="middle">{name}</text>
                  <text className="sm2" x="534" y={55 + index * 100} textAnchor="middle">{detail}</text>
                  {isResult && <text className="bd" x="534" y={73 + index * 100} textAnchor="middle">{isAllowed ? 'ALLOW' : 'DENY'}</text>}
                </g>
              )
            })}
            {request && (
              <g className={`packet ${request.match < 0 ? 'no' : ''}`} style={{ transform: packetTransform, opacity: packetVisible ? 1 : 0 }}>
                <rect x="-62" y="-11" width="124" height="22" rx="2" />
                <text y="4" textAnchor="middle">{request.action}</text>
              </g>
            )}
          </svg>
        </div>
        <p className="say" aria-live="polite">{message}</p>
      </div>

      <div className="c slide">
        <div className="sbar"><i /><i /><i /><span>policy.json</span><em>attached to {policies[request?.policy ?? 0].name}</em></div>
        <div className="cd" role="region" aria-label="policy.json">
          {selectedPolicy.lines.map((line, index) => {
            const statement = selectedPolicy.ranges.findIndex(([first, last]) => index >= first && index <= last)
            const lineState = statement < 0 || statement !== activeStatement
              ? ''
              : statement === matchedStatement
                ? 'ok'
                : request?.match === -1
                  ? 'miss'
                  : 'on'
            return (
              <div key={`${request?.policy ?? 0}-${index}`} className={lineState}>
                <i>{index + 1}</i>
                <span>
                  {line.split(/("(?:[^"\\]|\\.)*")/g).map((part, partIndex) => {
                    if (!part.startsWith('"') || !part.endsWith('"')) return part
                    const afterPart = line.slice(line.indexOf(part) + part.length).trimStart()
                    return <span key={partIndex} className={afterPart.startsWith(':') ? 'ky' : 'st'}>{part}</span>
                  })}
                </span>
              </div>
            )
          })}
        </div>
        <p className="sm" aria-live="polite">{paused ? 'Paused' : status}</p>
      </div>
    </section>
  )
}
