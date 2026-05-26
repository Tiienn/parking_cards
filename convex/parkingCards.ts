import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

declare const process: {
  env: {
    ADMIN_CLEAR_PASSWORD?: string
  }
}

const company = v.union(
  v.literal('Alexander House'),
  v.literal('Desroches'),
  v.literal('JPH'),
  v.literal('Lavoquer'),
)

const cardInput = v.object({
  databaseKey: v.string(),
  company,
  cardNumber: v.string(),
  name: v.string(),
  carNumber: v.string(),
  expiryDate: v.string(),
  isDuplicate: v.boolean(),
  pageNumber: v.number(),
  savedAt: v.string(),
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('parkingCards').collect()
  },
})

export const replaceCards = mutation({
  args: {
    keysToReplace: v.array(v.string()),
    cards: v.array(cardInput),
  },
  handler: async (ctx, args) => {
    for (const key of args.keysToReplace) {
      const matches = await ctx.db
        .query('parkingCards')
        .withIndex('by_database_key', (q) => q.eq('databaseKey', key))
        .collect()

      for (const match of matches) {
        await ctx.db.delete(match._id)
      }
    }

    for (const card of args.cards) {
      await ctx.db.insert('parkingCards', card)
    }
  },
})

export const deleteCard = mutation({
  args: {
    databaseKey: v.string(),
  },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query('parkingCards')
      .withIndex('by_database_key', (q) =>
        q.eq('databaseKey', args.databaseKey),
      )
      .collect()

    for (const match of matches) {
      await ctx.db.delete(match._id)
    }
  },
})

export const clearDatabase = mutation({
  args: {
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const configuredPassword = process.env.ADMIN_CLEAR_PASSWORD

    if (!configuredPassword || args.adminPassword !== configuredPassword) {
      throw new Error('Not authorized to clear the parking card database')
    }

    const cards = await ctx.db.query('parkingCards').collect()

    for (const card of cards) {
      await ctx.db.delete(card._id)
    }

    return cards.length
  },
})
