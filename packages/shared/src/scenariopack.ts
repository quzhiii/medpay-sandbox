import { z } from 'zod'

export const ScenarioActionSchema = z.object({
  type: z.enum(['set_param', 'toggle_strategy', 'advance']),
  payload: z.record(z.any()).default({}),
})

export const ScenarioExplainCheckSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2),
  correct_option_index: z.number().int().nonnegative(),
  rationale: z.string().min(1),
})

export const ScenarioPassConditionSchema = z.object({
  metric: z.string().min(1),
  operator: z.enum(['>', '>=', '<', '<=', '==']),
  threshold: z.number(),
  window: z.string().optional(),
  suggest: z.string().optional(),
})

export const ScenarioStepSchema = z.object({
  step_id: z.string().min(1),
  instruction: z.string().min(1),
  action: ScenarioActionSchema,
  expected_observation: z.array(z.string()).min(2),
  expected_rules: z.array(ScenarioPassConditionSchema).optional(),
  pass_condition: ScenarioPassConditionSchema,
  explain_check: ScenarioExplainCheckSchema,
})

export const ScenarioCompletionSchema = z.object({
  export_required: z.literal(true),
  artifacts: z.array(z.string()).min(1),
  summary_template: z.string().min(1),
})

export const ScenarioPackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  timebox_minutes: z.number().int().positive(),
  learning_objective: z.string().min(1),
  region_id: z.string().min(1),
  seed: z.number().int(),
  initial_params: z.record(z.any()).default({}),
  policy_version_tag: z.string().min(1),
  steps: z.array(ScenarioStepSchema).min(1),
  completion: ScenarioCompletionSchema,
})

export type ScenarioPack = z.infer<typeof ScenarioPackSchema>
export type ScenarioStep = z.infer<typeof ScenarioStepSchema>
export type ScenarioPassCondition = z.infer<typeof ScenarioPassConditionSchema>
