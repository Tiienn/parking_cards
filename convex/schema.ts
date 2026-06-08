import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  parkingCards: defineTable({
    databaseKey: v.string(),
    company: v.union(
      v.literal('Alexander House'),
      v.literal('Desroches'),
      v.literal('JPH'),
      v.literal('Lavoquer'),
    ),
    cardNumber: v.string(),
    name: v.string(),
    carNumber: v.string(),
    expiryDate: v.string(),
    isDuplicate: v.boolean(),
    cardMark: v.optional(
      v.union(v.literal('none'), v.literal('duplicate'), v.literal('foc')),
    ),
    pageNumber: v.number(),
    savedAt: v.string(),
  })
    .index('by_database_key', ['databaseKey'])
    .index('by_company', ['company']),
})
