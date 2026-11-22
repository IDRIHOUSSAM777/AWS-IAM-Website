import { useState } from 'react'

const questions = [
  {
    question: '1. A policy has no statement that mentions an action. What does IAM do?',
    options: [
      'Allows it, because nothing blocks it',
      'Denies it, because everything is denied by default',
      'Asks the user to confirm',
    ],
    answer: 1,
    explanation: 'Everything is denied by default, so with no Allow IAM refuses.',
  },
  {
    question: '2. One policy allows s3:GetObject and another explicitly denies it. What is the result?',
    options: ['Allow wins, because it was attached first', 'The newest policy wins', 'Deny wins'],
    answer: 2,
    explanation: 'An explicit Deny always wins over any Allow.',
  },
  {
    question: '3. Which statement follows least privilege?',
    options: [
      'Allow s3:GetObject on one bucket',
      'Allow s3:* on all resources',
      'Give every developer AdministratorAccess',
    ],
    answer: 0,
    explanation: 'Least privilege grants one action on one resource.',
  },
]

export default function SelfCheck() {
  const [answers, setAnswers] = useState<Array<number | null>>([null, null, null])
  const correctCount = answers.reduce<number>(
    (count, answer, index) => count + (answer === questions[index].answer ? 1 : 0),
    0,
  )

  return (
    <>
      <h4>Check yourself</h4>
      <div className="c" id="qz">
        {questions.map((question, questionIndex) => {
          const answer = answers[questionIndex]
          const answeredCorrectly = answer === question.answer
          return (
            <fieldset className="q" key={question.question}>
              <legend className="qq">{question.question}</legend>
              {question.options.map((option, optionIndex) => (
                <label
                  key={option}
                  className={answer === optionIndex ? (answeredCorrectly ? 'ok' : 'no') : ''}
                >
                  <input
                    type="radio"
                    name={`q${questionIndex + 1}`}
                    value={optionIndex}
                    checked={answer === optionIndex}
                    onChange={() => setAnswers((current) => current.map((item, index) => (
                      index === questionIndex ? optionIndex : item
                    )))}
                  />
                  {option}
                </label>
              ))}
              <p className="qe" aria-live="polite">
                {answer !== null
                  ? `${answeredCorrectly ? 'Correct. ' : 'Not quite. '}${question.explanation}`
                  : ''}
              </p>
            </fieldset>
          )
        })}
        <p className="note" aria-live="polite">{correctCount} of 3 correct</p>
      </div>
    </>
  )
}
