import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { GuidedMode } from './GuidedMode'
import type { ScenarioPack, ScenarioState } from '@/lib/api'

const mocks = vi.hoisted(() => ({
  listScenarioPacks: vi.fn(),
  getScenarioPack: vi.fn(),
  startScenario: vi.fn(),
  updateScenarioParams: vi.fn(),
  stepScenario: vi.fn(),
  getScenarioMetrics: vi.fn(),
  getScenarioExportUrl: vi.fn(),
}))

vi.mock('@/lib/api', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api')>()
  return {
    ...actual,
    api: mocks,
  }
})

const buildPack = (): ScenarioPack => ({
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
      expected_observation: ['Observe quota ratio'],
      expected_rules: [
        {
          metric: 'drg.quota.ratio',
          operator: '>=',
          threshold: 0.9,
          window: 'last_settle',
        },
      ],
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
})

const buildState = (): ScenarioState => ({
  scenario_id: 'scenario-1',
  params: {
    region_id: 'beijing_drg_demo',
    seed: 1,
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
})

describe('GuidedMode checklist', () => {
  beforeEach(() => {
    mocks.listScenarioPacks.mockResolvedValue([{ id: 'pack-1', title: 'Pack One' }])
    mocks.getScenarioPack.mockResolvedValue(buildPack())
    mocks.startScenario.mockResolvedValue({ state: buildState() })
    mocks.updateScenarioParams.mockResolvedValue({ state: buildState(), message: 'ok' })
    mocks.stepScenario.mockResolvedValue({ state: buildState(), new_events: [], message: 'ok' })
    mocks.getScenarioMetrics.mockResolvedValue({
      window: 'last_settle',
      metrics: { 'drg.quota.ratio': 0.95 },
      null_reasons: {},
      catalog: {},
    })
    mocks.getScenarioExportUrl.mockReturnValue('http://localhost/export')
  })

  it('allows execute step when scenario not started', async () => {
    const user = userEvent.setup()

    render(
      <GuidedMode
        scenarioState={null}
        events={[]}
        onScenarioChange={() => undefined}
      />
    )

    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, 'pack-1')

    const executeButton = await screen.findByRole('button', { name: '执行本步' })
    expect(executeButton).toBeEnabled()
  })

  it('shows checklist metric status and value', async () => {
    const user = userEvent.setup()

    render(
      <GuidedMode
        scenarioState={buildState()}
        events={[]}
        onScenarioChange={() => undefined}
      />
    )

    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, 'pack-1')

    const executeButton = await screen.findByRole('button', { name: '执行本步' })
    await user.click(executeButton)

    await waitFor(() => {
      expect(screen.getByText('已达成')).toBeInTheDocument()
    })

    expect(screen.getByText('drg.quota.ratio >= 0.9 · last_settle')).toBeInTheDocument()
    expect(screen.getByText('0.9500')).toBeInTheDocument()
  })

  it('shows failure detail and hints', async () => {
    const user = userEvent.setup()
    const pack = buildPack()
    pack.steps[0].hints = ['再快进6批', '提高 aggressiveness']
    mocks.getScenarioPack.mockResolvedValue(pack)
    mocks.getScenarioMetrics.mockResolvedValue({
      window: 'last_settle',
      metrics: { 'drg.quota.ratio': 0.5 },
      null_reasons: {},
      catalog: {},
    })

    render(
      <GuidedMode
        scenarioState={buildState()}
        events={[]}
        onScenarioChange={() => undefined}
      />
    )

    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, 'pack-1')

    const executeButton = await screen.findByRole('button', { name: '执行本步' })
    await user.click(executeButton)

    await waitFor(() => {
      expect(screen.getByText('当前值：0.5000 | 阈值：0.9 (drg.quota.ratio >= last_settle)')).toBeInTheDocument()
    })

    expect(screen.getByText('0.5000')).toBeInTheDocument()
    expect(screen.getByText('再快进6批')).toBeInTheDocument()
    expect(screen.getByText('提高 aggressiveness')).toBeInTheDocument()
  })

  it('handles missing metrics response without crashing', async () => {
    const user = userEvent.setup()
    mocks.getScenarioMetrics.mockResolvedValue(undefined as any)

    render(
      <GuidedMode
        scenarioState={buildState()}
        events={[]}
        onScenarioChange={() => undefined}
      />
    )

    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, 'pack-1')

    const executeButton = await screen.findByRole('button', { name: '执行本步' })
    await user.click(executeButton)

    await waitFor(() => {
      expect(screen.getByText('drg.quota.ratio: 指标不可用')).toBeInTheDocument()
    })
  })
})
