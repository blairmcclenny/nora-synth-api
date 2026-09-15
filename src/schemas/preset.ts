import { z } from 'zod'

const parameterSchema = z.number().min(0).max(1)

export const synthParametersSchema = z.strictObject({
  filter: parameterSchema,
  mood: parameterSchema,
  movement: parameterSchema,
  space: parameterSchema,
  expression: parameterSchema,
  attack: parameterSchema,
  decay: parameterSchema,
  sustain: parameterSchema,
  release: parameterSchema,
})
