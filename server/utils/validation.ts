import { z } from 'zod'
// Imported explicitly rather than relying on Nitro's auto-import: this module
// is also loaded directly by the Vitest suites, which run outside Nitro.
import { createError } from 'h3'
import { isValidIban } from './iban'

/** Reject the obvious throwaway passwords while keeping the rule explainable. */
const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password is too long')
  .refine((value) => /[a-z]/.test(value), 'Password must contain a lowercase letter')
  .refine((value) => /[A-Z]/.test(value), 'Password must contain an uppercase letter')
  .refine((value) => /\d/.test(value), 'Password must contain a digit')

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password,
  firstName: z.string().trim().min(2, 'First name is too short').max(60),
  lastName: z.string().trim().min(2, 'Last name is too short').max(60),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{7,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+([.,]\d{1,2})?$/, 'Enter an amount like 120.50')

export const transferSchema = z.object({
  sourceAccountId: z.string().uuid('Select an account to send from'),
  destinationIban: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, '').toUpperCase())
    .refine(isValidIban, 'Recipient IBAN is not valid'),
  amount: amountSchema,
  title: z.string().trim().min(3, 'Add a transfer title').max(140),
  externalName: z.string().trim().max(120).optional(),
})

export const depositSchema = z.object({
  accountId: z.string().uuid(),
  amount: amountSchema,
  title: z.string().trim().min(3).max(140).default('Deposit'),
})

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is too short').max(60),
  lastName: z.string().trim().min(2, 'Last name is too short').max(60),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{7,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: password,
    confirmPassword: z.string().min(1, 'Repeat the new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const statementExportSchema = z.object({
  accountId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
})

export const accountRenameSchema = z.object({
  name: z.string().trim().min(2, 'Give the account a name').max(60),
})

export const accountCreateSchema = z.object({
  name: z.string().trim().min(2, 'Give the account a name').max(60),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT']).default('CHECKING'),
  currency: z.enum(['PLN', 'EUR', 'USD', 'GBP']).default('PLN'),
})

export const beneficiarySchema = z.object({
  name: z.string().trim().min(2, 'Enter the recipient name').max(120),
  iban: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, '').toUpperCase())
    .refine(isValidIban, 'IBAN is not valid'),
  bankName: z.string().trim().max(120).optional(),
})

export const adminUserQuerySchema = z.object({
  search: z.string().trim().max(140).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminTransferQuerySchema = z.object({
  search: z.string().trim().max(140).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export const adminAuditQuerySchema = z.object({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
})

/** Path parameters are user input too — validate before they reach Prisma. */
export function requireUuidParam(value: string | undefined, label = 'Resource'): string {
  if (!value || !z.string().uuid().safeParse(value).success) {
    throw createError({ statusCode: 404, statusMessage: `${label} not found` })
  }

  return value
}

export const standingOrderSchema = z.object({
  sourceAccountId: z.string().uuid('Select an account to pay from'),
  destinationIban: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, '').toUpperCase())
    .refine(isValidIban, 'Recipient IBAN is not valid'),
  recipientName: z.string().trim().min(2, 'Enter the recipient name').max(120),
  title: z.string().trim().min(3, 'Add a reference').max(140),
  amount: amountSchema,
  interval: z.enum(['WEEKLY', 'MONTHLY']).default('MONTHLY'),
  startsOn: z.string().date('Choose a start date'),
})

export const spendingQuerySchema = z.object({
  currency: z.enum(['PLN', 'EUR', 'USD', 'GBP']).optional(),
  days: z.coerce.number().int().min(7).max(365).default(90),
})

export const lowBalanceSchema = z.object({
  /** Null clears the alert. */
  amount: amountSchema.nullable(),
})

export const transactionQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'DEPOSIT', 'WITHDRAWAL']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
  search: z.string().trim().max(140).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * Parse a payload and translate a Zod failure into an H3 422 whose `data.errors`
 * maps field -> first message, which is the shape the forms render.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const result = schema.safeParse(payload)

  if (!result.success) {
    const errors: Record<string, string> = {}

    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'form'
      errors[key] ??= issue.message
    }

    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: { errors },
    })
  }

  return result.data
}
