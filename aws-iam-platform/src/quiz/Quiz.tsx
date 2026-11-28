import { useEffect, useRef, useState } from 'react'
import bankData from './iam-quiz-questions.json'
import {
  ATTEMPT_SIZE,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  QUESTIONS_PER_DIFFICULTY,
  pickAttempt,
  scoreAttempt,
  type BankQuestion,
  type Difficulty,
  type QuizQuestion,
} from './quizEngine'
import './quiz.css'

const bank = (bankData as { questions: BankQuestion[] }).questions

const STAGE: Record<Difficulty, { step: string; level: string; name: string }> = {
  easy: { step: '01', level: 'N1', name: 'Beginner' },
  medium: { step: '02', level: 'N2', name: 'Intermediate' },
  hard: { step: '03', level: 'N3', name: 'Advanced' },
}

function verdictFor(score: number) {
  if (score === ATTEMPT_SIZE) return 'Perfect score. You are ready to build.'
  if (score >= 7) return 'Strong result. You know how IAM decides access.'
  if (score >= 4) return 'Good start. Revisit the lessons above, then try a new set.'
  return 'Keep practicing. The lessons above explain every answer.'
}

/** Three-stage rail: each stage fills as its questions are answered. */
function StageRail({ position }: { position: number }) {
  return (
    <ol className="qz-rail" aria-hidden="true">
      {DIFFICULTIES.map((level, stageIndex) => {
        const start = stageIndex * QUESTIONS_PER_DIFFICULTY
        const answered = Math.min(Math.max(position - start, 0), QUESTIONS_PER_DIFFICULTY)
        const state =
          answered === QUESTIONS_PER_DIFFICULTY ? 'done' : position >= start ? 'now' : 'next'
        return (
          <li className={`qz-rail-step ${level} ${state}`} key={level}>
            <span className="qz-rail-bar">
              <span style={{ width: `${(answered / QUESTIONS_PER_DIFFICULTY) * 100}%` }} />
            </span>
            <span className="qz-rail-label">
              <b>{STAGE[level].level}</b> {STAGE[level].name}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function Quiz() {
  const [attempt, setAttempt] = useState<QuizQuestion[]>(() => pickAttempt(bank))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(ATTEMPT_SIZE).fill(null))
  const [finished, setFinished] = useState(false)
  const [stageIntro, setStageIntro] = useState<Difficulty | null>(null)

  const continueRef = useRef<HTMLButtonElement | null>(null)
  const stepRef = useRef<HTMLDivElement | null>(null)
  const arrivedFromStage = useRef(false)

  const score = scoreAttempt(attempt, answers)

  // The button that opened the chapter card is gone, so keep keyboard focus in the quiz.
  useEffect(() => {
    if (stageIntro) continueRef.current?.focus()
  }, [stageIntro])

  useEffect(() => {
    if (!arrivedFromStage.current) return
    arrivedFromStage.current = false
    stepRef.current?.focus()
  }, [index])

  function submitAnswer() {
    if (selected === null || submitted) return
    setAnswers((current) => current.map((answer, position) => (position === index ? selected : answer)))
    setSubmitted(true)
  }

  function goTo(position: number) {
    setIndex(position)
    setSelected(null)
    setSubmitted(false)
  }

  function nextQuestion() {
    if (index === attempt.length - 1) {
      setFinished(true)
      return
    }
    const upcoming = attempt[index + 1].difficulty
    if (upcoming !== attempt[index].difficulty) {
      setStageIntro(upcoming)
      return
    }
    goTo(index + 1)
  }

  function continueStage() {
    if (!stageIntro) return
    setStageIntro(null)
    arrivedFromStage.current = true
    goTo(index + 1)
  }

  function restart() {
    setAttempt(pickAttempt(bank))
    setIndex(0)
    setSelected(null)
    setSubmitted(false)
    setAnswers(Array(ATTEMPT_SIZE).fill(null))
    setFinished(false)
    setStageIntro(null)
  }

  if (finished) {
    const levelScore = (level: Difficulty) =>
      attempt.reduce(
        (count, question, position) =>
          count + (question.difficulty === level && answers[position] === question.answer ? 1 : 0),
        0,
      )

    return (
      <div className="qz" id="check-yourself">
        <h4>Check yourself</h4>
        <div className="qz-panel qz-result">
          <p className="qz-kicker">All three stages complete</p>
          <p className="qz-score" aria-live="polite">
            {score}
            <span> / {ATTEMPT_SIZE}</span>
          </p>
          <p className="qz-verdict">{verdictFor(score)}</p>
          <div className="qz-breakdown">
            {DIFFICULTIES.map((level) => (
              <span className={`qz-chip ${level}`} key={level}>
                <b>{STAGE[level].level}</b> {STAGE[level].name}
                <span className="qz-chip-score">
                  {levelScore(level)}/{QUESTIONS_PER_DIFFICULTY}
                </span>
              </span>
            ))}
          </div>
          <div className="qz-result-act">
            <button className="btn" type="button" onClick={restart}>
              Try another 9 questions
            </button>
            <a className="btn alt" href="#lab">
              Enter IAM Lab
            </a>
          </div>
        </div>
      </div>
    )
  }

  const question = attempt[index]
  const answeredCorrectly = submitted && selected === question.answer
  const intro = stageIntro
  const introFrom = intro ? DIFFICULTIES[DIFFICULTIES.indexOf(intro) - 1] : null
  const tone = intro ?? question.difficulty

  return (
    <div className="qz" id="check-yourself">
      <h4>Check yourself</h4>
      <div className={`qz-panel stage-${tone}`}>
        <div className="qz-top">
          <span>
            {intro && introFrom
              ? `Stage ${STAGE[introFrom].step} of 03 complete`
              : `Question ${index + 1} of ${ATTEMPT_SIZE}`}
          </span>
          <span className="qz-top-right">
            <span className={`qz-level ${tone}`}>{DIFFICULTY_LABEL[tone]}</span>
          </span>
        </div>

        <StageRail position={index} />

        {intro && introFrom ? (
          <div className="qz-stagecard" role="status" aria-live="polite" key={intro}>
            <div className="qz-levelup" aria-hidden="true">
              <span className="qz-ring" />
              <span className="qz-ring" />
              <span className="qz-ring" />
              <span className="qz-levelup-num">{STAGE[intro].step}</span>
            </div>
            <p className="qz-kicker">Stage {STAGE[introFrom].step} complete</p>
            <p className="qz-stagecard-title">
              You're moving to Stage {STAGE[intro].step} — {STAGE[intro].name}
            </p>
            <div className="qz-act">
              <button className="btn" type="button" onClick={continueStage} ref={continueRef}>
                Continue →
              </button>
            </div>
          </div>
        ) : (
          <div className="qz-step" key={question.id} ref={stepRef} tabIndex={-1}>
            <fieldset className="qz-q" disabled={submitted}>
              <legend>{question.question}</legend>
              <div className="qz-opts">
                {question.choices.map((choice, choiceIndex) => {
                  const chosen = selected === choiceIndex
                  const look = submitted
                    ? choiceIndex === question.answer
                      ? 'right'
                      : chosen
                        ? 'wrong'
                        : ''
                    : chosen
                      ? 'on'
                      : ''
                  return (
                    <label className={`qz-opt ${look}`} key={choice}>
                      <input
                        type="radio"
                        name={`q-${index}`}
                        checked={chosen}
                        onChange={() => setSelected(choiceIndex)}
                      />
                      <span className="qz-radio" aria-hidden="true" />
                      <span className="qz-text">{choice}</span>
                      {submitted && choiceIndex === question.answer ? (
                        <span className="qz-flag">Right answer</span>
                      ) : null}
                      {submitted && chosen && choiceIndex !== question.answer ? (
                        <span className="qz-flag">Your answer</span>
                      ) : null}
                    </label>
                  )
                })}
              </div>

              {submitted ? (
                <div className={`qz-fb ${answeredCorrectly ? 'ok' : 'no'}`} role="status">
                  <b>{answeredCorrectly ? 'Correct. +1 point' : 'Not quite.'}</b>
                  <span>
                    {answeredCorrectly ? '' : `Correct answer: ${question.choices[question.answer]}. `}
                    {question.explanation}
                  </span>
                </div>
              ) : null}
            </fieldset>

            <div className="qz-act">
              {submitted ? (
                <button className="btn" type="button" onClick={nextQuestion}>
                  {index === attempt.length - 1 ? 'See my score' : 'Next question'}
                </button>
              ) : (
                <button className="btn" type="button" disabled={selected === null} onClick={submitAnswer}>
                  Submit answer
                </button>
              )}
              <span className="qz-count">
                {score} of {ATTEMPT_SIZE} correct so far
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
