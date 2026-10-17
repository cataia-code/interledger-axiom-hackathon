import { bigint, boolean, index, integer, pgTable, smallint, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './schema.js';
import { payment } from './payments.js';

// Wallets de Open Payments vinculadas a un usuario (varias). La URL es el id de la wallet; `name` lo pone el usuario para
// reconocerla. Exactamente una es la principal: el comprador paga con ella salvo que elija otra, y la tienda cobra en la suya.
export const userWallet = pgTable(
  'user_wallet',
  {
    id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name'),
    address: text('address').notNull(),
    assetCode: text('asset_code').notNull(),
    assetScale: smallint('asset_scale').notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('user_wallet_user_address_unique').on(t.userId, t.address),
    uniqueIndex('user_wallet_one_primary').on(t.userId).where(sql`${t.isPrimary}`),
    index('user_wallet_user_idx').on(t.userId),
  ],
);

// Lo que hay que recordar entre el checkout y la vuelta del navegador. Una cotización por sesión: si vence, se crea otra.
// continue_token es secreto: nunca se devuelve por la API.
export const paymentSession = pgTable(
  'payment_session',
  {
    id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
    paymentId: bigint('payment_id', { mode: 'number' })
      .notNull()
      .references(() => payment.id, { onDelete: 'cascade' }),
    status: text('status').default('pending').notNull(), // pending | completed | denied | failed | superseded
    nonce: text('nonce').notNull(),
    finishNonce: text('finish_nonce').notNull(), // `interact.finish` del servidor de autorización: entra en el hash de vuelta
    redirectUrl: text('redirect_url').notNull(),
    continueUri: text('continue_uri').notNull(),
    continueToken: text('continue_token').notNull(),
    quoteId: text('quote_id').notNull(),
    quoteExpiresAt: timestamp('quote_expires_at').notNull(),
    incomingPaymentId: text('incoming_payment_id').notNull(),
    incomingToken: text('incoming_token').notNull(),
    buyerWallet: text('buyer_wallet').notNull(),
    sellerWallet: text('seller_wallet').notNull(),
    buyerAuthServer: text('buyer_auth_server').notNull(),
    buyerResourceServer: text('buyer_resource_server').notNull(),
    receiveValue: text('receive_value').notNull(),
    receiveAssetCode: text('receive_asset_code').notNull(),
    receiveAssetScale: smallint('receive_asset_scale').notNull(),
    debitValue: text('debit_value').notNull(),
    debitAssetCode: text('debit_asset_code').notNull(),
    debitAssetScale: smallint('debit_asset_scale').notNull(),
    outgoingPaymentId: text('outgoing_payment_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('payment_session_payment_idx').on(t.paymentId)],
);
