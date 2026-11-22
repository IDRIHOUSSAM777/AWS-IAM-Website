import type { CSSProperties } from 'react'
import awsCloudImage from './assets/aws-cloud-keyless.png'
import iamKeyImage from './assets/iam-key.png'
import CloudParticles from './CloudParticles'

const decorations = [
  { left: '.6%', top: '2.4%', color: '#38bdf8', mobile: true },
  { left: '3.25%', top: '2.4%', color: '#ff9900', mobile: true },
  { left: '.6%', top: '7.67%', color: '#ff9900', mobile: true },
  { left: '25%', top: '2.4%', green: true, mobile: true },
  { left: '50.12%', top: '10.79%', color: '#ff9900' },
  { left: '47.36%', top: '21.58%', color: '#c4b5fd' },
  { left: '47.36%', top: '26.86%', color: '#99f6e4' },
  { left: '58.17%', top: '29.98%', color: '#38bdf8' },
  { left: '.6%', top: '76.5%', color: '#38bdf8' },
  { left: '.6%', top: '82%', color: '#a855f7' },
  { left: '3.25%', top: '82%', color: '#ff9900' },
  { left: '43.75%', top: '76.74%', color: '#ff9900' },
  { left: '40.99%', top: '82.25%', color: '#ff9900' },
  { left: '43.75%', top: '82.25%', dark: true },
  { left: '46.39%', top: '82.25%', color: '#38bdf8' },
  { left: '43.75%', top: '87.53%', color: '#c4b5fd' },
  { left: '95.67%', top: '77.46%', green: true },
  { left: '94.71%', top: '95.2%', color: '#38bdf8' },
]

export default function HeroStage() {
  return (
    <div className="stage">
      <div className="dec" aria-hidden="true">
        {decorations.map((decoration, index) => (
          <i
            key={index}
            className={`${decoration.green ? 'gr ' : ''}${decoration.dark ? 'dk ' : ''}${decoration.mobile ? 'm' : ''}`}
            style={{
              left: decoration.left,
              top: decoration.top,
              background: decoration.color,
            } as CSSProperties}
          />
        ))}
        <svg className="chip" viewBox="0 0 50 50">
          <rect width="50" height="50" fill="#0f1620" />
          <rect x=".5" y=".5" width="49" height="49" fill="none" stroke="#2a3646" />
          <path
            fill="#ac5bff"
            shapeRendering="crispEdges"
            transform="translate(10 10) scale(3.333)"
            d="M2 0h1v1h-1zM4 0h1v1h-1zM6 0h1v1h-1zM2 1h5v1h-5zM0 2h2v1h-2zM7 2h2v1h-2zM1 3h1v1h-1zM7 3h1v1h-1zM0 4h2v1h-2zM7 4h2v1h-2zM1 5h1v1h-1zM7 5h1v1h-1zM0 6h2v1h-2zM7 6h2v1h-2zM2 7h5v1h-5zM2 8h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1z"
          />
        </svg>
      </div>

      <div className="brand">
        <b><span className="tw" style={{ '--n': 3, '--d': '.35s', '--t': '.3s' } as CSSProperties}>AWS</span><br /><span className="tw" style={{ '--n': 7, '--d': '.7s', '--t': '.65s' } as CSSProperties}>STUDENT</span></b>
        <div className="bl">
          <em className="tw" style={{ '--n': 8, '--d': '.75s', '--t': '1.4s' } as CSSProperties}>builder!</em>
          <i className="cur" aria-hidden="true" />
        </div>
        <p>
          <span className="tw" style={{ '--n': 5, '--d': '.5s', '--t': '2.15s' } as CSSProperties}>learn</span>
          <span className="tw" style={{ '--n': 5, '--d': '.5s', '--t': '2.7s' } as CSSProperties}>build</span>
          <span className="tw" style={{ '--n': 6, '--d': '.6s', '--t': '3.25s' } as CSSProperties}>Growth</span>
        </p>
      </div>

      <div className="ttl"><span>AWS Identity and Access<br />Management (IAM)</span></div>
      <div className="cw">
        <div className="cloud-art">
          <img src={awsCloudImage} alt="AWS cloud and IAM logo" />
          <span className="iam-key-stage" aria-hidden="true">
            <img className="iam-key" src={iamKeyImage} alt="" />
          </span>
        </div>
        <CloudParticles />
      </div>
      <p className="bc">AWS Identity and Access Management</p>
    </div>
  )
}
