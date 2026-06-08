import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgePlus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  DropletOff,
  FileSpreadsheet,
  FolderOpen,
  Hash,
  MapPin,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import './App.css'

const companyHeaders = [
  'Alexander House',
  'Desroches',
  'JPH',
  'Lavoquer',
] as const

const companyLogos = {
  'Alexander House': '/logos/alexander-house.png',
  Desroches: '/logos/desroches.png',
  JPH: '/logos/jph.png',
  Lavoquer: '/logos/lavoquer.png',
} satisfies Record<CompanyHeader, string>

type ParkingCard = {
  id: string
  cardNumber: string
  name: string
  carNumber: string
  expiryDate: string
  isDuplicate: boolean
  cardMark: CardMark
  pageNumber?: number
}

type CompanyHeader = (typeof companyHeaders)[number]
type CardMark = 'none' | 'duplicate' | 'foc'

type SavedParkingCard = ParkingCard & {
  company: CompanyHeader
  pageNumber: number
  savedAt: string
}

type StoredParkingCard = Omit<SavedParkingCard, 'cardMark'> & {
  cardMark?: CardMark
}

type ParkingDatabase = {
  cards: SavedParkingCard[]
}

type RemotePersistence = {
  database?: ParkingDatabase
  isLoading?: boolean
  replaceCards?: (
    company: CompanyHeader,
    savedCards: SavedParkingCard[],
    cardsToReplace: ParkingCard[],
  ) => Promise<void>
  deleteCard?: (card: SavedParkingCard) => Promise<void>
  clearDatabase?: (adminPassword: string) => Promise<number>
}

type ImportStatus = {
  tone: 'good' | 'warn'
  text: string
}

type PrintSide = 'front' | 'back'

type SheetCell = unknown
type SheetRow = SheetCell[]

const cardsPerPage = 6
const defaultStartNumber = 101
const alexanderHouseStartNumber = 59
const alexanderHouseEndNumber = 139
const alexanderHouseSpecialNumber = '81A'
const alexanderHouseZoneNumber = 'Zone B'
const databaseStorageKey = 'parking-card-database-v1'
const jphResetStorageKey = 'parking-card-jph-reset-v1'
const lastCompanyStorageKey = 'parking-card-last-company-v1'

const nameAliases = ['name', 'names', 'full name', 'fullname', 'driver', 'owner']
const carAliases = [
  'car number',
  'car no',
  'car',
  'vehicle number',
  'vehicle no',
  'plate',
  'plate number',
  'registration',
  'registration number',
]

function createId() {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function defaultExpiryDate() {
  return '2027-06-30'
}

function normalizeCardMark(card: { cardMark?: unknown; isDuplicate?: boolean }) {
  if (card.cardMark === 'duplicate' || card.cardMark === 'foc') {
    return card.cardMark
  }

  return card.isDuplicate ? 'duplicate' : 'none'
}

function isDuplicateCardMark(cardMark: CardMark) {
  return cardMark === 'duplicate'
}

function cardMarkStatusText(card: ParkingCard) {
  if (card.cardMark === 'duplicate') {
    return `Card ${card.cardNumber} marked as duplicate`
  }

  if (card.cardMark === 'foc') {
    return `Card ${card.cardNumber} marked as F.O.C`
  }

  return `Card ${card.cardNumber} mark removed`
}

function defaultStartNumberForCompany(company: CompanyHeader) {
  return company === 'Alexander House'
    ? alexanderHouseStartNumber
    : defaultStartNumber
}

function loadLastSelectedCompany() {
  if (typeof window === 'undefined') {
    return 'JPH'
  }

  const storedCompany = window.localStorage.getItem(lastCompanyStorageKey)

  return companyHeaders.includes(storedCompany as CompanyHeader)
    ? (storedCompany as CompanyHeader)
    : 'JPH'
}

function alexanderHousePrimaryCount() {
  return alexanderHouseEndNumber - alexanderHouseStartNumber + 2
}

function alexanderHouseSequenceIndex(cardNumber: string) {
  const normalizedValue = cardNumber.trim().toUpperCase().replace(/\s+/g, '')

  if (normalizedValue === 'ZONEB') {
    return alexanderHousePrimaryCount()
  }

  if (
    normalizedValue === alexanderHouseSpecialNumber ||
    normalizedValue === `AH${alexanderHouseSpecialNumber}`
  ) {
    return 81 - alexanderHouseStartNumber + 1
  }

  const matchedNumber = normalizedValue.match(/^AH?(\d+)$/)?.[1]
  const parsedNumber = Number.parseInt(matchedNumber ?? normalizedValue, 10)

  if (
    !Number.isFinite(parsedNumber) ||
    parsedNumber < alexanderHouseStartNumber
  ) {
    return Number.POSITIVE_INFINITY
  }

  if (parsedNumber <= 81) {
    return parsedNumber - alexanderHouseStartNumber
  }

  if (parsedNumber <= alexanderHouseEndNumber) {
    return parsedNumber - alexanderHouseStartNumber + 1
  }

  return alexanderHousePrimaryCount()
}

function alexanderHouseCardNumberAtIndex(index: number) {
  if (index < 0) {
    return String(alexanderHouseStartNumber)
  }

  const specialIndex = 81 - alexanderHouseStartNumber + 1

  if (index < specialIndex) {
    return String(alexanderHouseStartNumber + index)
  }

  if (index === specialIndex) {
    return alexanderHouseSpecialNumber
  }

  const cardNumber = alexanderHouseStartNumber + index - 1

  if (cardNumber <= alexanderHouseEndNumber) {
    return String(cardNumber)
  }

  return alexanderHouseZoneNumber
}

function normalizeCardNumber(company: CompanyHeader, value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  if (company !== 'Alexander House') {
    return trimmedValue
  }

  const compactValue = trimmedValue.toUpperCase().replace(/\s+/g, '')

  if (compactValue === 'ZONEB') {
    return alexanderHouseZoneNumber
  }

  if (
    compactValue === alexanderHouseSpecialNumber ||
    compactValue === `AH${alexanderHouseSpecialNumber}`
  ) {
    return alexanderHouseSpecialNumber
  }

  const matchedNumber = compactValue.match(/^AH?(\d+)$/)?.[1]

  if (matchedNumber) {
    return String(Number.parseInt(matchedNumber, 10))
  }

  return trimmedValue
}

function isAlexanderHouseZoneB(company: CompanyHeader, cardNumber: string) {
  return (
    company === 'Alexander House' &&
    normalizeCardNumber(company, cardNumber) === alexanderHouseZoneNumber
  )
}

function cardNumberFromSequence(
  company: CompanyHeader,
  startNumber: number,
  index: number,
) {
  if (company === 'Alexander House') {
    const startIndex = alexanderHouseSequenceIndex(String(startNumber))
    return alexanderHouseCardNumberAtIndex(startIndex + index)
  }

  return String(startNumber + index)
}

function createBlankCards(
  company: CompanyHeader,
  startNumber: number,
  count: number,
  expiryDate: string,
): ParkingCard[] {
  return Array.from({ length: count }, (_, index) => ({
    id: createId(),
    cardNumber: cardNumberFromSequence(company, startNumber, index),
    name: '',
    carNumber: '',
    expiryDate,
    isDuplicate: false,
    cardMark: 'none',
  }))
}

function emptyDatabase(): ParkingDatabase {
  return { cards: [] }
}

function loadDatabase() {
  if (typeof window === 'undefined') {
    return emptyDatabase()
  }

  try {
    const storedDatabase = window.localStorage.getItem(databaseStorageKey)

    if (!storedDatabase) {
      return emptyDatabase()
    }

    const parsedDatabase = JSON.parse(storedDatabase) as {
      cards?: StoredParkingCard[]
    }
    const cards = Array.isArray(parsedDatabase.cards)
      ? dedupeSavedCards(
          parsedDatabase.cards
            .filter((card) => companyHeaders.includes(card.company))
            .map(normalizeSavedCard),
        )
      : []

    if (window.localStorage.getItem(jphResetStorageKey) !== 'done') {
      const cardsWithoutJph = cards.filter((card) => card.company !== 'JPH')
      window.localStorage.setItem(
        databaseStorageKey,
        JSON.stringify({ cards: cardsWithoutJph }),
      )
      window.localStorage.setItem(jphResetStorageKey, 'done')

      return { cards: cardsWithoutJph }
    }

    return { cards }
  } catch {
    return emptyDatabase()
  }
}

function normalizeSavedCard(card: StoredParkingCard): SavedParkingCard {
  const cardNumber = normalizeCardNumber(card.company, card.cardNumber)
  const cardMark = normalizeCardMark(card)

  return {
    ...card,
    cardNumber,
    id: card.id || createId(),
    pageNumber:
      card.pageNumber || pageNumberFromCardNumber(card.company, cardNumber),
    isDuplicate: isDuplicateCardMark(cardMark),
    cardMark,
  }
}

function pageNumberFromCardNumber(
  company: CompanyHeader,
  cardNumber: string,
  zoneBOffset = 0,
) {
  if (company === 'Alexander House') {
    const normalizedCardNumber = normalizeCardNumber(company, cardNumber)
    const sequenceIndex = isAlexanderHouseZoneB(company, normalizedCardNumber)
      ? alexanderHousePrimaryCount() + zoneBOffset
      : alexanderHouseSequenceIndex(normalizedCardNumber)

    if (!Number.isFinite(sequenceIndex)) {
      return 1
    }

    return Math.floor(sequenceIndex / cardsPerPage) + 1
  }

  const parsedNumber = Number.parseInt(cardNumber, 10)

  if (!Number.isFinite(parsedNumber) || parsedNumber < defaultStartNumber) {
    return 1
  }

  return Math.floor((parsedNumber - defaultStartNumber) / cardsPerPage) + 1
}

function startNumberFromPage(company: CompanyHeader, pageNumber: number) {
  const pageStartIndex = (Math.max(1, pageNumber) - 1) * cardsPerPage

  if (company === 'Alexander House') {
    const cardNumber = alexanderHouseCardNumberAtIndex(pageStartIndex)
    const parsedNumber = Number.parseInt(cardNumber.replace(/\D/g, ''), 10)

    return Number.isFinite(parsedNumber)
      ? parsedNumber
      : alexanderHouseEndNumber + 1
  }

  return defaultStartNumber + pageStartIndex
}

function cardSortIndex(company: CompanyHeader, cardNumber: string) {
  if (company === 'Alexander House') {
    return alexanderHouseSequenceIndex(normalizeCardNumber(company, cardNumber))
  }

  const parsedNumber = Number.parseInt(cardNumber, 10)

  return Number.isFinite(parsedNumber) ? parsedNumber : Number.POSITIVE_INFINITY
}

function compareCardNumbers(
  company: CompanyHeader,
  first: Pick<ParkingCard, 'cardNumber' | 'name' | 'carNumber'>,
  second: Pick<ParkingCard, 'cardNumber' | 'name' | 'carNumber'>,
) {
  const firstIndex = cardSortIndex(company, first.cardNumber)
  const secondIndex = cardSortIndex(company, second.cardNumber)

  if (firstIndex !== secondIndex) {
    return firstIndex - secondIndex
  }

  const firstNumber = Number.parseInt(first.cardNumber, 10)
  const secondNumber = Number.parseInt(second.cardNumber, 10)

  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return firstNumber - secondNumber
  }

  return (
    first.cardNumber.localeCompare(second.cardNumber) ||
    first.name.localeCompare(second.name) ||
    first.carNumber.localeCompare(second.carNumber)
  )
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getCellText(value: SheetCell) {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-GB').format(value)
  }

  return String(value ?? '').trim()
}

function findColumnIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader)

  return headers.findIndex((header) =>
    normalizedAliases.includes(normalizeHeader(header)),
  )
}

function getColumnIndex(headers: string[], aliases: string[], fallbackIndex: number) {
  const index = findColumnIndex(headers, aliases)

  return index >= 0 ? index : fallbackIndex
}

function looksLikeHeader(headers: string[]) {
  const aliases = [...nameAliases, ...carAliases].map(normalizeHeader)

  return headers.some((header) => aliases.includes(normalizeHeader(header)))
}

function cardsFromSheetRows(
  rows: SheetRow[],
  company: CompanyHeader,
  startNumber: number,
  expiryDate: string,
): ParkingCard[] {
  const nonEmptyRows = rows.filter((row) => row.some((cell) => getCellText(cell)))
  const headers = nonEmptyRows[0]?.map(getCellText) ?? []
  const hasHeader = looksLikeHeader(headers)
  const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows
  const nameIndex = getColumnIndex(headers, nameAliases, 0)
  const carIndex = getColumnIndex(headers, carAliases, 1)

  return dataRows
    .map<ParkingCard>((row, index) => ({
      id: createId(),
      cardNumber: cardNumberFromSequence(company, startNumber, index),
      name: getCellText(row[nameIndex]),
      carNumber: getCellText(row[carIndex]),
      expiryDate,
      isDuplicate: false,
      cardMark: 'none',
    }))
    .filter((card) => card.name || card.carNumber)
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"' && inQuotes && nextCharacter === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      inQuotes = !inQuotes
    } else if (character === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1
      }

      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  row.push(cell)
  rows.push(row)

  return rows
}

async function readSpreadsheetRows(file: File) {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCsv(await file.text())
  }

  const { readSheet } = await import('read-excel-file/browser')

  return readSheet(file)
}

function chunkCards(cards: ParkingCard[]) {
  const pages: ParkingCard[][] = []

  for (let index = 0; index < cards.length; index += cardsPerPage) {
    pages.push(cards.slice(index, index + cardsPerPage))
  }

  return pages
}

function displayDate(value: string) {
  if (!value) {
    return 'Not set'
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function nextAvailableCardNumber(
  company: CompanyHeader,
  cards: ParkingCard[],
  fallback: number,
) {
  if (company === 'Alexander House') {
    const fallbackIndex = alexanderHouseSequenceIndex(String(fallback)) - 1
    const usedIndexes = cards
      .map((card) => cardSortIndex(company, card.cardNumber))
      .filter(Number.isFinite)
    const maxIndex =
      usedIndexes.length > 0 ? Math.max(...usedIndexes) : fallbackIndex

    return alexanderHouseCardNumberAtIndex(maxIndex + 1)
  }

  const numericCards = cards
    .map((card) => Number.parseInt(card.cardNumber, 10))
    .filter(Number.isFinite)

  if (numericCards.length === 0) {
    return String(fallback)
  }

  return String(Math.max(...numericCards) + 1)
}

function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchesSearch(card: SavedParkingCard, query: string) {
  const normalizedQuery = normalizeSearchValue(query)

  if (!normalizedQuery) {
    return true
  }

  return [card.cardNumber, card.name, card.carNumber].some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery),
  )
}

function createPageCardsFromRecords(
  company: CompanyHeader,
  records: SavedParkingCard[],
  pageNumber: number,
  expiryDate: string,
): ParkingCard[] {
  const pageStartNumber = startNumberFromPage(company, pageNumber)
  const pageStartIndex = (Math.max(1, pageNumber) - 1) * cardsPerPage
  const zoneBRecords = records.filter((record) =>
    isAlexanderHouseZoneB(company, record.cardNumber),
  )

  return Array.from({ length: cardsPerPage }, (_, index) => {
    const absoluteIndex = pageStartIndex + index
    const cardNumber =
      company === 'Alexander House'
        ? alexanderHouseCardNumberAtIndex(absoluteIndex)
        : String(pageStartNumber + index)
    const savedCard = isAlexanderHouseZoneB(company, cardNumber)
      ? zoneBRecords[absoluteIndex - alexanderHousePrimaryCount()]
      : records.find((record) => record.cardNumber === cardNumber)

    if (savedCard) {
      const cardMark = normalizeCardMark(savedCard)

      return {
        id: createId(),
        cardNumber: savedCard.cardNumber,
        name: savedCard.name,
        carNumber: savedCard.carNumber,
        expiryDate: savedCard.expiryDate,
        isDuplicate: isDuplicateCardMark(cardMark),
        cardMark,
        pageNumber: savedCard.pageNumber,
      }
    }

    return {
      id: createId(),
      cardNumber,
      name: '',
      carNumber: '',
      expiryDate,
      isDuplicate: false,
      cardMark: 'none',
      pageNumber,
    }
  })
}

function cardsFromSavedRecords(records: SavedParkingCard[]): ParkingCard[] {
  return records.map((record) => ({
    id: createId(),
    cardNumber: record.cardNumber,
    name: record.name,
    carNumber: record.carNumber,
    expiryDate: record.expiryDate,
    isDuplicate: isDuplicateCardMark(record.cardMark),
    cardMark: record.cardMark,
    pageNumber: record.pageNumber,
  }))
}

function databaseKey(
  company: CompanyHeader,
  cardNumber: string,
  name = '',
  carNumber = '',
) {
  const normalizedCardNumber = normalizeCardNumber(company, cardNumber)

  if (isAlexanderHouseZoneB(company, normalizedCardNumber)) {
    return [
      company,
      normalizeSearchValue(normalizedCardNumber),
      normalizeSearchValue(name),
      normalizeSearchValue(carNumber),
    ].join(':')
  }

  return `${company}:${normalizeSearchValue(normalizedCardNumber)}`
}

function legacyAlexanderHouseDatabaseKey(
  company: CompanyHeader,
  normalizedCardNumber: string,
) {
  if (
    company !== 'Alexander House' ||
    !normalizedCardNumber ||
    isAlexanderHouseZoneB(company, normalizedCardNumber)
  ) {
    return null
  }

  if (
    normalizedCardNumber === alexanderHouseSpecialNumber ||
    /^\d+$/.test(normalizedCardNumber)
  ) {
    return `${company}:${normalizeSearchValue(`AH${normalizedCardNumber}`)}`
  }

  return null
}

function databaseKeys(
  company: CompanyHeader,
  cardNumber: string,
  name = '',
  carNumber = '',
) {
  const normalizedCardNumber = normalizeCardNumber(company, cardNumber)
  const keys = new Set([databaseKey(company, normalizedCardNumber, name, carNumber)])
  const legacyKey = legacyAlexanderHouseDatabaseKey(company, normalizedCardNumber)

  if (legacyKey) {
    keys.add(legacyKey)
  }

  return [...keys]
}

function databaseKeyForCard(
  card: Pick<SavedParkingCard, 'company' | 'cardNumber' | 'name' | 'carNumber'>,
) {
  return databaseKey(card.company, card.cardNumber, card.name, card.carNumber)
}

function databaseKeysForCard(
  card: Pick<SavedParkingCard, 'company' | 'cardNumber' | 'name' | 'carNumber'>,
) {
  return databaseKeys(card.company, card.cardNumber, card.name, card.carNumber)
}

function dedupeSavedCards(cards: SavedParkingCard[]) {
  return Array.from(
    cards.reduce<Map<string, SavedParkingCard>>((dedupedCards, card) => {
      const key = databaseKeyForCard(card)
      const currentCard = dedupedCards.get(key)

      if (!currentCard || card.savedAt >= currentCard.savedAt) {
        dedupedCards.set(key, card)
      }

      return dedupedCards
    }, new Map()),
  ).map(([, card]) => card)
}

function createSavedCards(
  cards: ParkingCard[],
  company: CompanyHeader,
  savedAt: string,
) {
  let zoneBOffset = 0

  return cards
    .filter((card) => card.cardNumber && (card.name || card.carNumber))
    .map((card) => {
      const normalizedCardNumber = normalizeCardNumber(company, card.cardNumber)
      const pageNumber = isAlexanderHouseZoneB(company, normalizedCardNumber)
        ? (card.pageNumber ??
          pageNumberFromCardNumber(
            company,
            normalizedCardNumber,
            zoneBOffset++,
          ))
        : pageNumberFromCardNumber(company, normalizedCardNumber)

      return {
        ...card,
        cardNumber: normalizedCardNumber,
        company,
        pageNumber,
        savedAt,
      }
    })
}

function upsertCards(
  database: ParkingDatabase,
  cardsToSave: SavedParkingCard[],
  cardsToReplace: ParkingCard[],
  company: CompanyHeader,
) {
  const replacementKeys = new Set(
    cardsToReplace
      .filter((card) => card.cardNumber && (card.name || card.carNumber))
      .flatMap((card) =>
        databaseKeys(company, card.cardNumber, card.name, card.carNumber),
      ),
  )
  const savedKeys = new Set(cardsToSave.flatMap(databaseKeysForCard))
  const keysToReplace = new Set([...replacementKeys, ...savedKeys])

  return {
    cards: [
      ...database.cards.filter(
        (card) => !databaseKeysForCard(card).some((key) => keysToReplace.has(key)),
      ),
      ...cardsToSave,
    ],
  }
}

function ConvexParkingCardApp() {
  const remoteCards = useQuery(api.parkingCards.list)
  const replaceCards = useMutation(api.parkingCards.replaceCards)
  const deleteCard = useMutation(api.parkingCards.deleteCard)
  const clearDatabase = useMutation(api.parkingCards.clearDatabase)
  const remoteDatabase = useMemo<ParkingDatabase | undefined>(() => {
    if (!remoteCards) {
      return undefined
    }

    return {
      cards: dedupeSavedCards(
        remoteCards.map((card) =>
          normalizeSavedCard({
            id: card._id,
            company: card.company,
            cardNumber: card.cardNumber,
            name: card.name,
            carNumber: card.carNumber,
            expiryDate: card.expiryDate,
            isDuplicate: card.isDuplicate,
            cardMark: normalizeCardMark(card),
            pageNumber: card.pageNumber,
            savedAt: card.savedAt,
          }),
        ),
      ),
    }
  }, [remoteCards])

  return (
    <ParkingCardApp
      database={remoteDatabase}
      isLoading={remoteCards === undefined}
      replaceCards={async (company, savedCards, cardsToReplace) => {
        await replaceCards({
          keysToReplace: [
            ...cardsToReplace
              .filter((card) => card.cardNumber && (card.name || card.carNumber))
              .flatMap((card) =>
                databaseKeys(company, card.cardNumber, card.name, card.carNumber),
              ),
            ...savedCards.flatMap(databaseKeysForCard),
          ],
          cards: savedCards.map((card) => ({
            databaseKey: databaseKeyForCard(card),
            company: card.company,
            cardNumber: card.cardNumber,
            name: card.name,
            carNumber: card.carNumber,
            expiryDate: card.expiryDate,
            isDuplicate: card.isDuplicate,
            cardMark: card.cardMark,
            pageNumber: card.pageNumber,
            savedAt: card.savedAt,
          })),
        })
      }}
      deleteCard={async (card) => {
        for (const databaseKey of databaseKeysForCard(card)) {
          await deleteCard({ databaseKey })
        }
      }}
      clearDatabase={async (adminPassword) => {
        return await clearDatabase({ adminPassword })
      }}
    />
  )
}

function App() {
  if (import.meta.env.VITE_CONVEX_URL) {
    return <ConvexParkingCardApp />
  }

  return <ParkingCardApp />
}

function ParkingCardApp(remotePersistence: RemotePersistence = {}) {
  const initialCompany = useMemo(() => loadLastSelectedCompany(), [])
  const [selectedCompany, setSelectedCompany] =
    useState<CompanyHeader>(initialCompany)
  const [startNumber, setStartNumber] = useState(
    defaultStartNumberForCompany(initialCompany),
  )
  const [defaultExpiry, setDefaultExpiry] = useState(defaultExpiryDate)
  const [cards, setCards] = useState<ParkingCard[]>(() =>
    createBlankCards(
      initialCompany,
      defaultStartNumberForCompany(initialCompany),
      cardsPerPage,
      defaultExpiryDate(),
    ),
  )
  const [localDatabase, setLocalDatabase] =
    useState<ParkingDatabase>(loadDatabase)
  const [previewPageIndex, setPreviewPageIndex] = useState(0)
  const [printSide, setPrintSide] = useState<PrintSide>('front')
  const [inkSaver, setInkSaver] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    tone: 'good',
    text: remotePersistence.isLoading ? 'Loading Convex database' : 'Ready for data',
  })
  const spreadsheetInputRef = useRef<HTMLInputElement>(null)

  const database = remotePersistence.database ?? localDatabase

  useEffect(() => {
    if (!remotePersistence.replaceCards) {
      window.localStorage.setItem(
        databaseStorageKey,
        JSON.stringify(localDatabase),
      )
    }
  }, [localDatabase, remotePersistence.replaceCards])

  useEffect(() => {
    window.localStorage.setItem(lastCompanyStorageKey, selectedCompany)
  }, [selectedCompany])

  const pages = useMemo(() => chunkCards(cards), [cards])
  const pageCount = Math.max(1, pages.length)
  const currentPreviewPageIndex = Math.min(previewPageIndex, pageCount - 1)
  const currentEditorCards = pages[currentPreviewPageIndex] ?? []
  const selectedCompanyLogo = companyLogos[selectedCompany]
  const isBackPrint = printSide === 'back'

  const currentCompanyRecords = useMemo(
    () =>
      database.cards
        .filter((card) => card.company === selectedCompany)
        .sort((first, second) =>
          compareCardNumbers(selectedCompany, first, second),
        ),
    [database.cards, selectedCompany],
  )
  const searchResults = useMemo(() => {
    const results = searchQuery.trim()
      ? database.cards.filter((card) => matchesSearch(card, searchQuery))
      : database.cards

    return [...results]
      .sort((first, second) => second.savedAt.localeCompare(first.savedAt))
      .slice(0, 10)
  }, [database.cards, searchQuery])
  const companyRecordCounts = useMemo(
    () =>
      companyHeaders.reduce<Record<CompanyHeader, number>>(
        (counts, company) => {
          counts[company] = database.cards.filter(
            (card) => card.company === company,
          ).length

          return counts
        },
        {
          'Alexander House': 0,
          Desroches: 0,
          JPH: 0,
          Lavoquer: 0,
        },
      ),
    [database.cards],
  )

  const persistSavedCards = (
    savedCards: SavedParkingCard[],
    cardsToReplace: ParkingCard[],
    company = selectedCompany,
  ) => {
    setLocalDatabase((currentDatabase) =>
      upsertCards(currentDatabase, savedCards, cardsToReplace, company),
    )

    if (remotePersistence.replaceCards) {
      void remotePersistence
        .replaceCards(company, savedCards, cardsToReplace)
        .catch(() => {
          setImportStatus({
            tone: 'warn',
            text: 'Could not sync that database change to Convex',
          })
        })
    }
  }

  const syncCardsToDatabase = (
    nextCards: ParkingCard[],
    cardsToReplace: ParkingCard[],
    statusText?: string,
  ) => {
    const savedAt = new Date().toISOString()
    const savedCards = createSavedCards(nextCards, selectedCompany, savedAt)

    persistSavedCards(savedCards, cardsToReplace)

    if (statusText) {
      setImportStatus({ tone: 'good', text: statusText })
    }

    return savedCards.length
  }

  const updateCard = (
    id: string,
    field: 'cardNumber' | 'name' | 'carNumber' | 'expiryDate',
    value: string,
  ) => {
    const nextCards = cards.map((card) =>
      card.id === id ? { ...card, [field]: value } : card,
    )

    setCards(nextCards)
    syncCardsToDatabase(nextCards, [...cards, ...nextCards])
  }

  const toggleCardMark = (id: string, cardMark: Exclude<CardMark, 'none'>) => {
    const nextCards: ParkingCard[] = cards.map((card) => {
      if (card.id !== id) {
        return card
      }

      const nextMark: CardMark = card.cardMark === cardMark ? 'none' : cardMark

      return {
        ...card,
        cardMark: nextMark,
        isDuplicate: isDuplicateCardMark(nextMark),
      }
    })
    const targetCard = nextCards.find((card) => card.id === id)

    setCards(nextCards)
    syncCardsToDatabase(
      nextCards,
      [...cards, ...nextCards],
      targetCard ? cardMarkStatusText(targetCard) : undefined,
    )
  }

  const saveCardsToDatabase = () => {
    const savedCards = createSavedCards(
      cards,
      selectedCompany,
      new Date().toISOString(),
    )

    if (savedCards.length === 0) {
      setImportStatus({
        tone: 'warn',
        text: 'Add a name or car number before saving',
      })
      return
    }

    persistSavedCards(savedCards, cards)
    setImportStatus({
      tone: 'good',
      text: `Saved ${savedCards.length} ${selectedCompany} card${
        savedCards.length === 1 ? '' : 's'
      } to database, replacing old matches`,
    })
  }

  const loadCompanyPage = (company: CompanyHeader, pageNumber = 1) => {
    const companyRecords = database.cards
      .filter((card) => card.company === company)
      .sort((first, second) => compareCardNumbers(company, first, second))
    const targetPageNumber = Math.max(1, pageNumber)
    const loadedCards =
      companyRecords.length > 0
        ? cardsFromSavedRecords(companyRecords)
        : createPageCardsFromRecords(
            company,
            companyRecords,
            targetPageNumber,
            defaultExpiry,
          )
    const loadedPageCount = Math.max(
      1,
      Math.ceil(loadedCards.length / cardsPerPage),
    )
    const targetPreviewPageIndex = Math.min(
      targetPageNumber - 1,
      loadedPageCount - 1,
    )
    const pageExpiry = loadedCards.find((card) => card.expiryDate)?.expiryDate

    setSelectedCompany(company)
    setPrintSide('front')
    setStartNumber(startNumberFromPage(company, targetPageNumber))
    setCards(loadedCards)
    setPreviewPageIndex(targetPreviewPageIndex)

    if (pageExpiry) {
      setDefaultExpiry(pageExpiry)
    }

    setImportStatus({
      tone: 'good',
      text:
        companyRecords.length > 0
          ? `Loaded ${company} database (${companyRecords.length} cards, ${loadedPageCount} pages)`
          : `Started ${company} page ${targetPageNumber}`,
    })
  }

  const loadSelectedCompany = () => {
    const firstSavedPage =
      currentCompanyRecords.length > 0
        ? Math.min(...currentCompanyRecords.map((card) => card.pageNumber))
        : 1

    loadCompanyPage(selectedCompany, firstSavedPage)
  }

  const deleteSavedCard = (cardToDelete: SavedParkingCard) => {
    const keyToDelete = databaseKeyForCard(cardToDelete)

    setLocalDatabase((currentDatabase) => ({
      cards: currentDatabase.cards.filter(
        (card) => databaseKeyForCard(card) !== keyToDelete,
      ),
    }))
    if (remotePersistence.deleteCard) {
      void remotePersistence.deleteCard(cardToDelete).catch(() => {
        setImportStatus({
          tone: 'warn',
          text: 'Could not delete that card from Convex',
        })
      })
    }
    setImportStatus({
      tone: 'good',
      text: `Removed ${cardToDelete.company} card ${cardToDelete.cardNumber} from database`,
    })
  }

  const clearDatabase = async () => {
    if (!remotePersistence.clearDatabase) {
      setImportStatus({
        tone: 'warn',
        text: 'Admin clear is only available when Convex is connected',
      })
      return
    }

    const adminPassword = window.prompt(
      'Admin password required to clear the whole database',
    )

    if (!adminPassword) {
      return
    }

    const confirmed = window.confirm(
      'Clear every saved parking card for every company? This cannot be undone.',
    )

    if (!confirmed) {
      return
    }

    try {
      const clearedCount = await remotePersistence.clearDatabase(adminPassword)
      const nextCards = createBlankCards(
        selectedCompany,
        startNumber,
        cardsPerPage,
        defaultExpiry,
      )

      setLocalDatabase(emptyDatabase())
      setCards(nextCards)
      setPreviewPageIndex(0)
      setImportStatus({
        tone: 'good',
        text: `Cleared ${clearedCount} saved card${
          clearedCount === 1 ? '' : 's'
        } from the database`,
      })
    } catch {
      setImportStatus({
        tone: 'warn',
        text: 'Incorrect admin password or admin clear password is not configured',
      })
    }
  }

  const addCard = () => {
    const nextCards: ParkingCard[] = [
      ...cards,
      {
        id: createId(),
        cardNumber: nextAvailableCardNumber(
          selectedCompany,
          cards,
          startNumber,
        ),
        name: '',
        carNumber: '',
        expiryDate: defaultExpiry,
        isDuplicate: false,
        cardMark: 'none',
      },
    ]

    setCards(nextCards)
    setPreviewPageIndex(Math.floor((nextCards.length - 1) / cardsPerPage))
    setImportStatus({ tone: 'good', text: 'Added one card' })
  }

  const resetCards = () => {
    setCards(
      createBlankCards(selectedCompany, startNumber, cardsPerPage, defaultExpiry),
    )
    setPreviewPageIndex(0)
    setImportStatus({ tone: 'good', text: 'Reset to 6 blank cards' })
  }

  const removeCard = (id: string) => {
    const nextCards = cards.filter((card) => card.id !== id)

    setCards(nextCards)
    syncCardsToDatabase(nextCards, cards, 'Card removed and database updated')
  }

  const renumberCards = () => {
    const nextCards = cards.map((card, index) => ({
      ...card,
      cardNumber: cardNumberFromSequence(selectedCompany, startNumber, index),
      pageNumber: undefined,
    }))

    setCards(nextCards)
    syncCardsToDatabase(
      nextCards,
      [...cards, ...nextCards],
      'Cards renumbered and database updated',
    )
  }

  const applyExpiryToAll = (value: string) => {
    const nextCards = cards.map((card) => ({ ...card, expiryDate: value }))

    setDefaultExpiry(value)
    setCards(nextCards)
    syncCardsToDatabase(
      nextCards,
      nextCards,
      'Expiry applied and database updated',
    )
  }

  const handleSpreadsheetUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const rows = await readSpreadsheetRows(file)
      const importedCards = cardsFromSheetRows(
        rows,
        selectedCompany,
        startNumber,
        defaultExpiry,
      )

      if (importedCards.length === 0) {
        setImportStatus({
          tone: 'warn',
          text: 'No rows found. Use columns like Name and Car Number.',
        })
        return
      }

      setCards(importedCards)
      setPreviewPageIndex(0)
      syncCardsToDatabase(
        importedCards,
        importedCards,
        `Imported and auto-saved ${importedCards.length} card${
          importedCards.length === 1 ? '' : 's'
        } from ${file.name}`,
      )
      setImportStatus({
        tone: 'good',
        text: `Imported and auto-saved ${importedCards.length} card${
          importedCards.length === 1 ? '' : 's'
        } from ${file.name}`,
      })
    } catch {
      setImportStatus({
        tone: 'warn',
        text: 'Could not read that spreadsheet',
      })
    } finally {
      event.target.value = ''
    }
  }

  const printablePages = pages.length > 0 ? pages : [[]]

  return (
    <main className="app-shell">
      <aside className="company-sidebar app-chrome" aria-label="Print navigation">
        <div className="sidebar-title">
          <p className="eyebrow">Companies</p>
        </div>

        <div className="company-list">
          {companyHeaders.map((company) => (
            <button
              className={`company-tab ${
                selectedCompany === company && !isBackPrint ? 'is-selected' : ''
              }`}
              type="button"
              onClick={() => loadCompanyPage(company, 1)}
              aria-pressed={selectedCompany === company && !isBackPrint}
              key={company}
            >
              <span className="company-tab-meta">
                <strong>{company}</strong>
                <span>
                  {companyRecordCounts[company]} saved card
                  {companyRecordCounts[company] === 1 ? '' : 's'}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <p className="eyebrow">Parking Back</p>
          <button
            className={`company-tab ${isBackPrint ? 'is-selected' : ''}`}
            type="button"
            aria-pressed={isBackPrint}
            onClick={() => {
              setPrintSide('back')
              setPreviewPageIndex(0)
            }}
          >
            <span className="company-tab-meta">
              <strong>Parking Back</strong>
              <span>
                {pageCount} back sheet{pageCount === 1 ? '' : 's'}
              </span>
            </span>
          </button>
        </div>
      </aside>

      <section className="workspace-panel app-chrome" aria-label="Card editor">
        <div className="brand-strip">
          <div>
            <p className="eyebrow">Parking press</p>
            <h1>Parking card maker</h1>
          </div>
          <button
            className="icon-action print-action"
            type="button"
            onClick={() => window.print()}
            title="Print cards"
            aria-label="Print cards"
          >
            <Printer size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="control-grid">
          <label className="control-block">
            <span>
              <Hash size={16} aria-hidden="true" />
              Start number
            </span>
            <input
              min="1"
              type="number"
              value={startNumber}
              onChange={(event) =>
                setStartNumber(Number.parseInt(event.target.value, 10) || 1)
              }
            />
          </label>

          <label className="control-block">
            <span>
              <CalendarDays size={16} aria-hidden="true" />
              Expiry
            </span>
            <input
              type="date"
              value={defaultExpiry}
              onChange={(event) => applyExpiryToAll(event.target.value)}
            />
          </label>
        </div>

        <div className="button-row">
          <button type="button" onClick={renumberCards}>
            <BadgePlus size={18} aria-hidden="true" />
            Renumber
          </button>
          <button type="button" onClick={addCard}>
            <Plus size={18} aria-hidden="true" />
            Add card
          </button>
          <button type="button" onClick={resetCards}>
            <RotateCcw size={18} aria-hidden="true" />
            Reset
          </button>
        </div>

        <div className="upload-row">
          <input
            ref={spreadsheetInputRef}
            className="sr-only"
            type="file"
            accept=".xlsx,.csv"
            onChange={handleSpreadsheetUpload}
          />
          <button
            type="button"
            onClick={() => spreadsheetInputRef.current?.click()}
          >
            <FileSpreadsheet size={18} aria-hidden="true" />
            Excel
          </button>
        </div>

        <div className="database-row">
          <button type="button" onClick={saveCardsToDatabase}>
            <Save size={18} aria-hidden="true" />
            Save database
          </button>
          <button type="button" onClick={loadSelectedCompany}>
            <FolderOpen size={18} aria-hidden="true" />
            Load company
          </button>
        </div>

        <div className="status-line" data-tone={importStatus.tone}>
          <span>{importStatus.text}</span>
          <strong>
            {cards.length} card{cards.length === 1 ? '' : 's'} / {pageCount}{' '}
            page{pageCount === 1 ? '' : 's'}
          </strong>
        </div>

        <div className="logo-chip" aria-live="polite">
          <span>Active company</span>
          <strong>{selectedCompany}</strong>
        </div>

        <section className="registry-panel" aria-label="Parking database">
          <div className="registry-heading">
            <Database size={18} aria-hidden="true" />
            <div>
              <p>Database</p>
              <strong>
                {database.cards.length} saved card
                {database.cards.length === 1 ? '' : 's'}
              </strong>
            </div>
          </div>

          <label className="search-control">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search database</span>
            <input
              value={searchQuery}
              placeholder="Search card, name, car number"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <div className="result-list">
            {searchResults.length === 0 ? (
              <p className="empty-results">No saved cards found</p>
            ) : (
              searchResults.map((card) => (
                <article
                  className="result-card"
                  key={databaseKeyForCard(card)}
                >
                  <div>
                    <span>
                      {card.company} / page {card.pageNumber}
                    </span>
                    <strong>
                      #{card.cardNumber} {card.name || 'No name'}
                    </strong>
                    <p>{card.carNumber || 'No car number'}</p>
                  </div>
                  <div className="result-actions">
                    <button
                      className="icon-action"
                      type="button"
                      title={`Load ${card.company} page ${card.pageNumber}`}
                      aria-label={`Load ${card.company} page ${card.pageNumber}`}
                      onClick={() =>
                        loadCompanyPage(card.company, card.pageNumber)
                      }
                    >
                      <FolderOpen size={16} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-action danger"
                      type="button"
                      title={`Delete ${card.company} card ${card.cardNumber}`}
                      aria-label={`Delete ${card.company} card ${card.cardNumber}`}
                      onClick={() => deleteSavedCard(card)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <button
            className="clear-database-button danger"
            type="button"
            onClick={clearDatabase}
          >
            <Trash2 size={16} aria-hidden="true" />
            Clear database
          </button>
        </section>

        <div className="table-frame">
          <table>
            <thead>
              <tr>
                <th>Card</th>
                <th>Name</th>
                <th>Car number</th>
                <th>Expiry</th>
                <th>Mark</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {currentEditorCards.map((card) => (
                <tr key={card.id}>
                  <td>
                    <input
                      className="number-input"
                      aria-label={`Card number ${card.cardNumber}`}
                      value={card.cardNumber}
                      onChange={(event) =>
                        updateCard(card.id, 'cardNumber', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Name for card ${card.cardNumber}`}
                      placeholder="Name"
                      value={card.name}
                      onChange={(event) =>
                        updateCard(card.id, 'name', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Car number for card ${card.cardNumber}`}
                      placeholder="Car number"
                      value={card.carNumber}
                      onChange={(event) =>
                        updateCard(card.id, 'carNumber', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Expiry for card ${card.cardNumber}`}
                      type="date"
                      value={card.expiryDate}
                      onChange={(event) =>
                        updateCard(card.id, 'expiryDate', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <div className="card-mark-actions">
                      <button
                        className={`card-mark-button is-duplicate-mark ${
                          card.cardMark === 'duplicate' ? 'is-active' : ''
                        }`}
                        type="button"
                        aria-pressed={card.cardMark === 'duplicate'}
                        onClick={() => toggleCardMark(card.id, 'duplicate')}
                      >
                        <Copy size={15} aria-hidden="true" />
                        Duplicate
                      </button>
                      <button
                        className={`card-mark-button is-foc-mark ${
                          card.cardMark === 'foc' ? 'is-active' : ''
                        }`}
                        type="button"
                        aria-pressed={card.cardMark === 'foc'}
                        onClick={() => toggleCardMark(card.id, 'foc')}
                      >
                        <BadgePlus size={15} aria-hidden="true" />
                        FOC
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      className="icon-action danger"
                      type="button"
                      onClick={() => removeCard(card.id)}
                      title="Remove card"
                      aria-label={`Remove card ${card.cardNumber}`}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="editor-page-nav app-chrome" aria-label="Editor pages">
          <button
            className="icon-action"
            type="button"
            onClick={() =>
              setPreviewPageIndex((pageIndex) => Math.max(0, pageIndex - 1))
            }
            disabled={currentPreviewPageIndex === 0}
            title="Previous editor page"
            aria-label="Previous editor page"
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <span className="page-counter">
            {currentPreviewPageIndex + 1} / {pageCount}
          </span>
          <button
            className="icon-action"
            type="button"
            onClick={() =>
              setPreviewPageIndex((pageIndex) =>
                Math.min(pageCount - 1, pageIndex + 1),
              )
            }
            disabled={currentPreviewPageIndex === pageCount - 1}
            title="Next editor page"
            aria-label="Next editor page"
          >
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section
        className={`preview-stage ${inkSaver ? 'is-ink-saver' : ''}`}
        aria-label="Printable preview"
      >
        <div className="preview-header app-chrome">
          <div>
            <p className="eyebrow">A4 portrait</p>
            <h2>
              {isBackPrint ? 'Parking Back' : 'Page'}{' '}
              {currentPreviewPageIndex + 1} of {pageCount}
            </h2>
          </div>
          <div className="preview-actions">
            <button
              className={`ink-toggle ${inkSaver ? 'is-active' : ''}`}
              type="button"
              aria-pressed={inkSaver}
              title={inkSaver ? 'Ink saver is on' : 'Ink saver is off'}
              onClick={() => setInkSaver((isEnabled) => !isEnabled)}
            >
              <DropletOff size={18} aria-hidden="true" />
              Ink saver
            </button>
            <button type="button" onClick={() => window.print()}>
              <Printer size={18} aria-hidden="true" />
              Print all
            </button>
          </div>
        </div>

        <div className="sheet-stack">
          {printablePages.map((page, pageIndex) => {
            const slots: Array<ParkingCard | null> = Array.from(
              { length: cardsPerPage },
              (_, slotIndex) => page[slotIndex] ?? null,
            )

            return (
              <article
                className={`print-sheet ${
                  pageIndex === currentPreviewPageIndex ? 'is-active' : ''
                }`}
                aria-hidden={pageIndex !== currentPreviewPageIndex}
                key={`page-${pageIndex}`}
              >
                <div className="sheet-grid">
                  {slots.map((card, slotIndex) => {
                    if (isBackPrint) {
                      return card ? (
                        <ParkingCardBack key={`back-${card.id}`} />
                      ) : (
                        <div
                          className="parking-card-back empty-slot"
                          key={`empty-back-${pageIndex}-${slotIndex}`}
                        />
                      )
                    }

                    return card ? (
                      <ParkingCardPreview
                        card={card}
                        company={selectedCompany}
                        logoUrl={selectedCompanyLogo}
                        onUpdateCard={updateCard}
                        key={card.id}
                      />
                    ) : (
                      <div
                        className="parking-card empty-slot"
                        key={`empty-${pageIndex}-${slotIndex}`}
                      />
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>

        <div className="page-nav app-chrome" aria-label="Preview pages">
          <button
            className="icon-action"
            type="button"
            onClick={() =>
              setPreviewPageIndex((pageIndex) => Math.max(0, pageIndex - 1))
            }
            disabled={currentPreviewPageIndex === 0}
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <span className="page-counter">
            {currentPreviewPageIndex + 1} / {pageCount}
          </span>
          <button
            className="icon-action"
            type="button"
            onClick={() =>
              setPreviewPageIndex((pageIndex) =>
                Math.min(pageCount - 1, pageIndex + 1),
              )
            }
            disabled={currentPreviewPageIndex === pageCount - 1}
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  )
}

function ParkingCardBack() {
  return (
    <section className="parking-card-back" aria-label="Parking card back">
      <p>
        The management will not accept responsibility for any loss or damage to
        your vehicle
      </p>
      <p>
        A fee of Rs 300 will be charged in case of loss/misplacement among
        others.
      </p>
    </section>
  )
}

function ParkingCardPreview({
  card,
  company,
  logoUrl,
  onUpdateCard,
}: {
  card: ParkingCard
  company: CompanyHeader
  logoUrl: string
  onUpdateCard: (
    id: string,
    field: 'name' | 'carNumber',
    value: string,
  ) => void
}) {
  const watermarkText =
    card.cardMark === 'duplicate'
      ? 'Duplicate'
      : card.cardMark === 'foc'
        ? 'F.O.C'
        : null

  return (
    <section className={`parking-card ${watermarkText ? 'is-duplicate' : ''}`}>
      {watermarkText ? (
        <span className="duplicate-watermark">{watermarkText}</span>
      ) : null}

      <div className="card-header">
        {logoUrl ? (
          <img src={logoUrl} alt={`${company} logo`} />
        ) : (
          <div className="logo-placeholder" aria-hidden="true" />
        )}
      </div>

      <div className="card-number">
        {company === 'Alexander House' ? (
          <MapPin
            className="card-number-location"
            size={36}
            strokeWidth={2.6}
            aria-hidden="true"
          />
        ) : null}
        <strong>{card.cardNumber || '000'}</strong>
      </div>

      <div className="card-fields">
        <div className="field-block">
          <span>Name</span>
          <input
            className="card-field-input"
            aria-label={`Name for card ${card.cardNumber}`}
            placeholder="Full Name"
            value={card.name}
            onChange={(event) =>
              onUpdateCard(card.id, 'name', event.target.value)
            }
          />
        </div>

        <div className="field-block highlight">
          <span>Car number</span>
          <input
            className="card-field-input car-number-input"
            aria-label={`Car number for card ${card.cardNumber}`}
            placeholder="CAR NUMBER"
            value={card.carNumber}
            onChange={(event) =>
              onUpdateCard(card.id, 'carNumber', event.target.value)
            }
          />
        </div>

        <div className="field-block">
          <span>Expiry date</span>
          <strong>{displayDate(card.expiryDate)}</strong>
        </div>
      </div>

      <div className="card-footer">
        <span className="display-instruction">
          This side of the card should always be displayed.
        </span>
        <span className="permit-signature">
          <span className="signature-line" aria-hidden="true" />
          <span>auth. sig</span>
        </span>
      </div>
    </section>
  )
}

export default App
