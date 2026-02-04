import { describe, expect, it } from 'vitest'

import { buildDebriefMarkdown } from './debrief'
import type { ScenarioPack, ScenarioState } from '@/lib/api'

const pack: ScenarioPack = {
  id: 'pack-1',
  title: 'Pack One',
  timebox_minutes: 10,
  learning_objective: 'Goal',
  region_id: 'beijing_drg_demo',
  seed: 1,
  initial_params: {},
  policy_version_tag: 'v1',
  steps: [
    {
      step_id: 's1',
      instruction: 'Do step',
      action: {
        type: 'advance',
        payload: { batches: 1 },
      },
      expected_observation: ['Observe'],
      expected_rules: [],
      pass_condition: {
        metric: 'drg.quota.ratio',
        operator: '>=',
        threshold: 0.9,
        window: 'last_settle',
      },
      explain_check: {
        question: 'Q?',
        options: ['A', 'B'],
        correct_option_index: 0,
        rationale: 'Because',
      },
    },
  ],
  completion: {
    export_required: true,
    artifacts: [],
    summary_template: 'done',
  },
}

const state: ScenarioState = {
  scenario_id: 'scenario-1',
  params: {
    region_id: 'beijing_drg_demo',
    seed: 1,
    budget: 100000,
  },
  current_day: 1,
  current_batch: 'morning',
  is_finished: false,
  quota_used_drg: 0,
  quota_max_drg: 1,
  quota_used_dip: 0,
  quota_max_dip: 1,
  region_total_points: 0,
  multiplier: 1,
  external_points: 0,
}

describe('buildDebriefMarkdown', () => {
  it('appends answer details with selection and rationale', () => {
    const markdown = buildDebriefMarkdown({
      pack,
      state,
      events: [],
      exportUrl: 'http://localhost/export',
      answers: [
        {
          stepId: 's1',
          selected: 1,
          correct: false,
          rationale: 'Because',
        },
      ],
    })

    expect(markdown).toContain('答题记录')
    expect(markdown).toContain('作答')
    expect(markdown).toContain('错误')
    expect(markdown).toContain('解析')
  })
})
