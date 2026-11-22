import type { ReactNode } from 'react'

type Block =
  | { type: 'code'; lang: string; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'p'; text: string }

function inline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g
  let last = 0
  let index = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const id = `${key}-${index++}`
    if (token.startsWith('`')) {
      nodes.push(<code key={id}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={id}>{inline(token.slice(2, -2), id)}</strong>)
    } else {
      nodes.push(<em key={id}>{inline(token.slice(1, -1), id)}</em>)
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ type: 'p', text: paragraph.join(' ') })
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    blocks.push({ type: 'list', ordered: list.ordered, items: list.items })
    list = null
  }
  const flush = () => {
    flushParagraph()
    flushList()
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    if (line.trimStart().startsWith('```')) {
      flush()
      const lang = line.trim().slice(3).trim()
      const buffer: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buffer.push(lines[i])
        i += 1
      }
      blocks.push({ type: 'code', lang, text: buffer.join('\n') })
      continue
    }

    if (!line.trim()) {
      flush()
      continue
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || ordered) {
      flushParagraph()
      const isOrdered = Boolean(ordered)
      const item = (bullet ?? ordered)?.[1] ?? ''
      if (list && list.ordered !== isOrdered) flushList()
      if (!list) list = { ordered: isOrdered, items: [] }
      list.items.push(item)
      continue
    }

    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`
      continue
    }

    flushList()
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line)
    paragraph.push(heading ? `**${heading[1].replace(/\*\*/g, '')}**` : line.trim())
  }

  flush()
  return blocks
}

export function MessageText({ text }: { text: string }) {
  return (
    <>
      {parse(text).map((block, index) => {
        const key = `b${index}`
        if (block.type === 'code') {
          return (
            <pre key={key} className="ky-code">
              <code>{block.text}</code>
            </pre>
          )
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag key={key} className="ky-list">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </Tag>
          )
        }
        return <p key={key}>{inline(block.text, key)}</p>
      })}
    </>
  )
}
