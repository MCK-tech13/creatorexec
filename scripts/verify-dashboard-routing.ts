import {
  buildIncomeHomePreview,
  buildProductScoutHomePreview,
  buildRetainerHomePreview,
  buildSprintHomePreview,
  formatIncomeSnapshot,
} from '../src/lib/dashboard/homePreview'
import type { BrandDeal } from '../src/types/pipeline'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const sampleDeal: BrandDeal = {
  id: 'deal-1',
  brandName: 'GlowLab',
  product: 'Serum',
  stage: 'filming',
  contractSigned: true,
  videoDeliverables: [],
  isRetainer: true,
  retainerTotalVideos: 10,
  retainerDeadlineDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
  filmingChecklist: [{ id: '1', completed: false }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const sprintSetup = buildSprintHomePreview({
  sprintOnboardingComplete: false,
  hasProductData: false,
  hasActiveRetainers: false,
  schedule: [],
  productCount: 0,
  videosPerDay: 5,
})
assert(sprintSetup.kind === 'setup', 'New user sprint card should prompt setup')

const sprintSchedule = buildSprintHomePreview({
  sprintOnboardingComplete: true,
  hasProductData: true,
  hasActiveRetainers: false,
  schedule: [
    { day: 1, videos: [{}, {}, {}] as never[] },
    { day: 2, videos: [{}, {}] as never[] },
  ],
  productCount: 12,
  videosPerDay: 5,
})
assert(sprintSchedule.kind === 'preview', 'Schedule should show preview')
assert(sprintSchedule.upcomingDays?.length === 2, 'Should list upcoming days')

const retainers = buildRetainerHomePreview([sampleDeal])
assert(retainers.activeCount === 1, 'Should count active retainer')
assert(retainers.pipelineCount === 1, 'Should count pipeline deal')

const incomeEmpty = buildIncomeHomePreview([])
assert(incomeEmpty.monthLabel === null, 'Empty income store has no month label')

const scoutEmpty = buildProductScoutHomePreview([])
assert(scoutEmpty.count === 0, 'Empty scout shortlist')

const incomeSnapshot = formatIncomeSnapshot({
  monthLabel: 'July 2026',
  gmv: 1200,
  totalIncome: 400,
  estimatedCommission: 350,
})
assert(incomeSnapshot?.includes('GMV') === true, 'Income snapshot formats GMV')

console.log('Dashboard routing preview checks passed.')
