import {
  Check,
  Database,
  DropletOff,
  FileSpreadsheet,
  FolderOpen,
  MousePointer2,
  Pencil,
  Printer,
  Save,
} from 'lucide-react'
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import './ParkingCardsHowTo.css'

type Card = {
  cardNumber: string
  name: string
  carNumber: string
  expiry: string
}

type Step = {
  label: string
  title: string
  copy: string
  icon: 'excel' | 'ink' | 'edit'
}

const sampleCards: Card[] = [
  {
    cardNumber: '101',
    name: 'Asha Naiken',
    carNumber: 'JPH 4582',
    expiry: '30 Jun 2027',
  },
  {
    cardNumber: '102',
    name: 'Ravi Mohun',
    carNumber: 'JPH 6014',
    expiry: '30 Jun 2027',
  },
  {
    cardNumber: '103',
    name: 'Priya Beeharry',
    carNumber: 'JPH 3391',
    expiry: '30 Jun 2027',
  },
  {
    cardNumber: '104',
    name: 'Kevin Ramtohul',
    carNumber: 'JPH 7740',
    expiry: '30 Jun 2027',
  },
  {
    cardNumber: '105',
    name: 'Maya Seewooruthun',
    carNumber: 'JPH 2848',
    expiry: '30 Jun 2027',
  },
  {
    cardNumber: '106',
    name: 'Dev Bundhoo',
    carNumber: 'JPH 9186',
    expiry: '30 Jun 2027',
  },
]

const blankCards = Array.from({ length: 6 }, (_, index) => ({
  cardNumber: String(101 + index),
  name: '',
  carNumber: '',
  expiry: '30 Jun 2027',
}))

const steps: Step[] = [
  {
    label: 'Step 1',
    title: 'Upload the JPH spreadsheet',
    copy: 'Click Excel and select the file. Names and car numbers fill the table and preview automatically.',
    icon: 'excel',
  },
  {
    label: 'Step 2',
    title: 'Switch on Ink saver',
    copy: 'Use Ink saver before printing. Color fills drop out while the JPH logo stays visible.',
    icon: 'ink',
  },
  {
    label: 'Step 3',
    title: 'Edit one parking card',
    copy: 'Change a row whenever needed. The card preview updates while you type.',
    icon: 'edit',
  },
]

function ease(frame: number, start: number, duration: number) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

function between(frame: number, start: number, end: number) {
  return frame >= start && frame < end
}

function activeStepIndex(frame: number) {
  if (frame < 390) {
    return 0
  }

  if (frame < 690) {
    return 1
  }

  return 2
}

function visibleCards(frame: number) {
  const uploaded = ease(frame, 126, 72)
  const rowCount = Math.floor(interpolate(uploaded, [0, 1], [0, 6]))
  const cards = rowCount > 0 ? sampleCards.slice(0, rowCount) : blankCards
  const editProgress = ease(frame, 744, 80)

  if (editProgress <= 0) {
    return cards
  }

  const editedName = typedValue('Asha Naiken', 'Asha N.', editProgress)
  const editedCar = typedValue('JPH 4582', 'JPH 4590', editProgress)

  return cards.map((card, index) =>
    index === 0
      ? {
          ...card,
          name: editedName,
          carNumber: editedCar,
        }
      : card,
  )
}

function typedValue(from: string, to: string, progress: number) {
  if (progress <= 0) {
    return from
  }

  if (progress >= 1) {
    return to
  }

  const backspaceProgress = Math.min(progress / 0.45, 1)
  const typeProgress = Math.max((progress - 0.45) / 0.55, 0)
  const shortenedLength = Math.max(
    0,
    Math.round(interpolate(backspaceProgress, [0, 1], [from.length, 0])),
  )

  if (progress < 0.45) {
    return from.slice(0, shortenedLength)
  }

  return to.slice(0, Math.max(1, Math.round(typeProgress * to.length)))
}

function cursorPosition(frame: number) {
  if (frame < 118) {
    const p = ease(frame, 44, 48)
    return {
      x: interpolate(p, [0, 1], [1060, 384]),
      y: interpolate(p, [0, 1], [828, 420]),
    }
  }

  if (frame < 438) {
    const p = ease(frame, 370, 50)
    return {
      x: interpolate(p, [0, 1], [384, 1357]),
      y: interpolate(p, [0, 1], [420, 236]),
    }
  }

  if (frame < 716) {
    const p = ease(frame, 650, 45)
    return {
      x: interpolate(p, [0, 1], [1357, 400]),
      y: interpolate(p, [0, 1], [236, 716]),
    }
  }

  const p = ease(frame, 726, 42)

  return {
    x: interpolate(p, [0, 1], [400, 446]),
    y: interpolate(p, [0, 1], [716, 737]),
  }
}

function highlightStyle(frame: number) {
  const uploadGlow = ease(frame, 74, 28) - ease(frame, 204, 28)
  const inkGlow = ease(frame, 402, 28) - ease(frame, 570, 34)
  const editGlow = ease(frame, 704, 32) - ease(frame, 884, 36)

  if (uploadGlow > inkGlow && uploadGlow > editGlow) {
    return {
      left: 318,
      top: 378,
      width: 176,
      height: 72,
      opacity: uploadGlow,
    }
  }

  if (inkGlow > editGlow) {
    return {
      left: 1238,
      top: 196,
      width: 247,
      height: 70,
      opacity: inkGlow,
    }
  }

  return {
    left: 316,
    top: 693,
    width: 606,
    height: 72,
    opacity: editGlow,
  }
}

export function ParkingCardsHowTo() {
  const frame = useCurrentFrame()
  const cards = visibleCards(frame)
  const activeStep = activeStepIndex(frame)
  const inkSaver = frame >= 510
  const status =
    frame < 138
      ? 'Ready for JPH data'
      : frame < 690
        ? 'Imported and auto-saved 6 cards from JPH-parking.xlsx'
        : 'Edited card 101 and updated the preview'
  const cursor = cursorPosition(frame)
  const clickPulse =
    Number(between(frame, 104, 122)) ||
    Number(between(frame, 486, 504)) ||
    Number(between(frame, 744, 762))
  const highlight = highlightStyle(frame)
  const intro = ease(frame, 0, 50)
  const outro = ease(frame, 1008, 44)

  return (
    <AbsoluteFill className="howto-root">
      <div
        className="howto-stage"
        style={{
          opacity: intro,
          transform: `translateY(${interpolate(intro, [0, 1], [28, 0])}px) scale(${interpolate(outro, [0, 1], [1, 0.985])})`,
        }}
      >
        <header className="video-topbar">
          <div>
            <p>Parking Card Maker</p>
            <h1>How to create JPH parking cards</h1>
          </div>
          <div className="company-lockup">
            <span>Company</span>
            <strong>JPH</strong>
          </div>
        </header>

        <div className="app-demo">
          <JphSidebar />
          <EditorPanel cards={cards} status={status} activeStep={activeStep} />
          <PreviewPanel cards={cards} inkSaver={inkSaver} />
        </div>

        <StepCard step={steps[activeStep]} index={activeStep} />
        <Timeline activeStep={activeStep} frame={frame} />

        <div
          className="focus-ring"
          style={{
            left: highlight.left,
            top: highlight.top,
            width: highlight.width,
            height: highlight.height,
            opacity: highlight.opacity,
          }}
        />

        <Cursor x={cursor.x} y={cursor.y} clickPulse={clickPulse} />
      </div>

      <div
        className="final-card"
        style={{
          opacity: outro,
          transform: `translate(-50%, calc(-50% + ${interpolate(outro, [0, 1], [24, 0])}px))`,
        }}
      >
        <Check size={34} aria-hidden="true" />
        <div>
          <strong>Ready to print JPH cards</strong>
          <span>Upload, save ink, edit, then print all.</span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function JphSidebar() {
  return (
    <aside className="demo-sidebar">
      <p className="demo-eyebrow">Company</p>
      <div className="demo-company is-selected">
        <strong>JPH</strong>
        <span>6 saved cards</span>
      </div>
    </aside>
  )
}

function EditorPanel({
  cards,
  status,
  activeStep,
}: {
  cards: Card[]
  status: string
  activeStep: number
}) {
  return (
    <section className="demo-editor">
      <div className="demo-brand">
        <div>
          <p className="demo-eyebrow">Parking press</p>
          <h2>Parking card maker</h2>
        </div>
        <button type="button" aria-label="Print cards">
          <Printer size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="demo-controls">
        <label>
          <span>Start number</span>
          <strong>101</strong>
        </label>
        <label>
          <span>Expiry</span>
          <strong>2027-06-30</strong>
        </label>
      </div>

      <div className="demo-button-row">
        <button type="button">Renumber</button>
        <button type="button">Add card</button>
        <button type="button">Reset</button>
      </div>

      <button className="excel-button" type="button">
        <FileSpreadsheet size={22} aria-hidden="true" />
        Excel
      </button>

      <div className="demo-database-actions">
        <button type="button">
          <Save size={18} aria-hidden="true" />
          Save database
        </button>
        <button type="button">
          <FolderOpen size={18} aria-hidden="true" />
          Load company
        </button>
      </div>

      <div className="demo-status">
        <span>{status}</span>
        <strong>{cards.length} cards / 1 page</strong>
      </div>

      <div className="demo-registry">
        <Database size={20} aria-hidden="true" />
        <div>
          <span>Database</span>
          <strong>{activeStep === 0 ? 'JPH import' : '6 saved JPH cards'}</strong>
        </div>
      </div>

      <div className="demo-table">
        <div className="demo-table-head">
          <span>Card</span>
          <span>Name</span>
          <span>Car number</span>
          <span>Expiry</span>
        </div>
        {cards.map((card, index) => (
          <div
            className={`demo-row ${index === 0 && activeStep === 2 ? 'is-editing' : ''}`}
            key={card.cardNumber}
          >
            <span>{card.cardNumber}</span>
            <span>{card.name || 'Name'}</span>
            <span>{card.carNumber || 'Car number'}</span>
            <span>{card.expiry}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function PreviewPanel({ cards, inkSaver }: { cards: Card[]; inkSaver: boolean }) {
  return (
    <section className={`demo-preview ${inkSaver ? 'is-ink-saver' : ''}`}>
      <div className="preview-controls">
        <div>
          <p className="demo-eyebrow">A4 portrait</p>
          <h2>Page 1 of 1</h2>
        </div>
        <button className={`ink-button ${inkSaver ? 'is-active' : ''}`} type="button">
          <DropletOff size={20} aria-hidden="true" />
          Ink saver
        </button>
        <button className="print-button" type="button">
          <Printer size={20} aria-hidden="true" />
          Print all
        </button>
      </div>

      <div className="paper-sheet">
        {cards.map((card) => (
          <MiniCard card={card} key={card.cardNumber} />
        ))}
      </div>
    </section>
  )
}

function MiniCard({ card }: { card: Card }) {
  return (
    <article className="mini-card">
      <div className="mini-logo">
        <Img src={staticFile('logos/jph.png')} alt="JPH logo" />
      </div>
      <strong className="mini-number">{card.cardNumber}</strong>
      <div className="mini-field">
        <span>Name</span>
        <strong>{card.name || 'Full Name'}</strong>
      </div>
      <div className="mini-field is-plate">
        <span>Car number</span>
        <strong>{card.carNumber || 'CAR NUMBER'}</strong>
      </div>
      <div className="mini-field">
        <span>Expiry date</span>
        <strong>{card.expiry}</strong>
      </div>
    </article>
  )
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const Icon =
    step.icon === 'excel'
      ? FileSpreadsheet
      : step.icon === 'ink'
        ? DropletOff
        : Pencil

  return (
    <aside className="step-card">
      <div className="step-icon">
        <Icon size={30} aria-hidden="true" />
      </div>
      <div>
        <span>{step.label} / 3</span>
        <h2>{step.title}</h2>
        <p>{step.copy}</p>
      </div>
      <strong>{index + 1}</strong>
    </aside>
  )
}

function Timeline({ activeStep, frame }: { activeStep: number; frame: number }) {
  const progress = interpolate(frame, [0, 1080], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div className="video-timeline">
      <div className="timeline-track">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      {steps.map((step, index) => (
        <div className={index <= activeStep ? 'is-active' : ''} key={step.title}>
          <span>{index + 1}</span>
          <strong>{step.title}</strong>
        </div>
      ))}
    </div>
  )
}

function Cursor({
  x,
  y,
  clickPulse,
}: {
  x: number
  y: number
  clickPulse: number
}) {
  return (
    <div
      className="video-cursor"
      style={{
        left: x,
        top: y,
      }}
    >
      <span
        style={{
          opacity: clickPulse,
          transform: `translate(-50%, -50%) scale(${interpolate(clickPulse, [0, 1], [1.8, 0.85])})`,
        }}
      />
      <MousePointer2 size={42} aria-hidden="true" />
    </div>
  )
}
