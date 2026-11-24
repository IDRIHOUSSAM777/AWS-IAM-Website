import { useState } from 'react'
import kyubiNormal from '../assets/kyubi-avatars/normal.svg'
import kyubiThinking from '../assets/kyubi-avatars/thinking.svg'
import kyubiHappy from '../assets/kyubi-avatars/happy.svg'
import kyubiExplaining from '../assets/kyubi-avatars/explaining.svg'
import kyubiError from '../assets/kyubi-avatars/error.svg'
import kyubiPeace from '../assets/kyubi-avatars/peace.svg'
import './quiz.css'

const COLORS = ['#ff9900', '#38bdf8', '#a855f7', '#5eead4', '#f472b6', '#facc15']
const CHARACTERS = [
  kyubiNormal,
  kyubiThinking,
  kyubiHappy,
  kyubiExplaining,
  kyubiError,
  kyubiPeace,
]

function colorFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) % 9973
  return COLORS[hash % COLORS.length]
}

/** Round avatar showing a random Kyubi portrait when `randomCharacter` is enabled, or the first letter otherwise. */
export default function Avatar({
  name,
  size = 48,
  randomCharacter = false,
}: {
  name: string
  size?: number
  randomCharacter?: boolean
}) {
  const color = colorFor(name)
  const [portrait] = useState(
    () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)],
  )

  if (randomCharacter) {
    return (
      <span
        className="av av-img"
        aria-hidden="true"
        style={{ width: size, height: size, borderColor: color }}
      >
        <img src={portrait} alt="" />
      </span>
    )
  }

  return (
    <span
      className="av"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.44),
        background: `linear-gradient(145deg, ${color}, #1b2433)`,
        borderColor: color,
      }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}
