import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useIncomeTracker } from '../../hooks/useIncomeTracker'
import type { IncomeMonthEntry } from '../../types/incomeTracker'
import {
  MONTH_NAMES,
  calcTotalIncome,
  formatCurrency,
  formatMonthLabel,
  monthKey,
  moneyInputValue,
  parseMoneyInput,
  sortMonthKeys,
  yearsFromStore,
} from '../../lib/income/incomeUtils'

type ViewMode = 'month' | 'year'

const MANUAL_FIELDS: {
  key: keyof IncomeMonthEntry
  label: string
  hint?: string
}[] = [
  { key: 'gmvTotal', label: 'GMV Total', hint: 'Sales volume — not counted in Total Income' },
  { key: 'estimatedCommission', label: 'Estimated Commission' },
  { key: 'settledCommission', label: 'Settled Commission' },
  { key: 'brandDealsIncome', label: 'Brand Deals / Retainer Income' },
  { key: 'bonusesRewards', label: 'Bonuses / Rewards' },
]

function currentMonthKey(): string {
  const now = new Date()
  return monthKey(now.getFullYear(), now.getMonth() + 1)
}

export function IncomeTracker() {
  const { store, createMonth, updateMonthField } = useIncomeTracker()
  const monthKeys = useMemo(() => sortMonthKeys(Object.keys(store)), [store])
  const availableYears = useMemo(() => yearsFromStore(monthKeys), [monthKeys])

  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [showAddMonth, setShowAddMonth] = useState(false)
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1)
  const [newYear, setNewYear] = useState(new Date().getFullYear())

  useEffect(() => {
    if (monthKeys.length === 0) return
    if (!store[selectedMonthKey]) {
      setSelectedMonthKey(monthKeys[monthKeys.length - 1])
    }
  }, [monthKeys, selectedMonthKey, store])

  const selectedEntry = store[selectedMonthKey]
  const selectedTotal = selectedEntry ? calcTotalIncome(selectedEntry) : 0

  const handleAddMonth = () => {
    const key = monthKey(newYear, newMonth)
    createMonth(key)
    setSelectedMonthKey(key)
    setShowAddMonth(false)
    setViewMode('month')
  }

  const yearlyRows = useMemo(() => {
    return MONTH_NAMES.map((name, index) => {
      const key = monthKey(selectedYear, index + 1)
      const entry = store[key]
      return {
        key,
        name,
        entry,
        totalIncome: entry ? calcTotalIncome(entry) : 0,
        gmv: entry?.gmvTotal ?? 0,
        hasEntry: Boolean(entry),
      }
    })
  }, [selectedYear, store])

  const yearIncomeTotal = yearlyRows.reduce((sum, row) => sum + row.totalIncome, 0)
  const yearGmvTotal = yearlyRows.reduce((sum, row) => sum + row.gmv, 0)

  return (
    <div className="fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">Income Tracker</h1>
          <p className="mt-2 font-body text-sm text-stone sm:text-base">
            Log monthly GMV and income manually — your spreadsheet replacement.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border-warm">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-5 py-2.5 font-body text-sm font-medium transition ${
              viewMode === 'month' ? 'bg-emerald text-white' : 'bg-white text-stone hover:text-ink'
            }`}
          >
            Month View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('year')}
            className={`px-5 py-2.5 font-body text-sm font-medium transition ${
              viewMode === 'year' ? 'bg-emerald text-white' : 'bg-white text-stone hover:text-ink'
            }`}
          >
            Yearly View
          </button>
        </div>
      </div>

      {viewMode === 'month' ? (
        <>
          <div className="mb-8 flex flex-col gap-4 border border-border-warm bg-white p-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label htmlFor="income-month-select" className="label-caps mb-2 block">
                Month
              </label>
              {monthKeys.length > 0 ? (
                <select
                  id="income-month-select"
                  value={monthKeys.includes(selectedMonthKey) ? selectedMonthKey : monthKeys[0]}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="input-field w-full max-w-xs px-4 py-3 font-body text-sm"
                >
                  {monthKeys.map((key) => (
                    <option key={key} value={key}>
                      {formatMonthLabel(key)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="font-body text-sm text-stone">No months yet — add your first month below.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowAddMonth((v) => !v)}
              className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Month
            </button>
          </div>

          {showAddMonth && (
            <div className="mb-8 border border-border-warm bg-white p-6">
              <h2 className="font-display text-xl font-bold text-ink">Add a month</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-income-month" className="label-caps mb-2 block">
                    Month
                  </label>
                  <select
                    id="new-income-month"
                    value={newMonth}
                    onChange={(e) => setNewMonth(parseInt(e.target.value, 10))}
                    className="input-field w-full px-4 py-3 font-body text-sm"
                  >
                    {MONTH_NAMES.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="new-income-year" className="label-caps mb-2 block">
                    Year
                  </label>
                  <input
                    id="new-income-year"
                    type="number"
                    min={2000}
                    max={2100}
                    value={newYear}
                    onChange={(e) => setNewYear(parseInt(e.target.value, 10) || newYear)}
                    className="input-field w-full px-4 py-3 font-body text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={handleAddMonth} className="btn-primary px-6 py-3 text-sm">
                  Create {formatMonthLabel(monthKey(newYear, newMonth))}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMonth(false)}
                  className="btn-outline px-6 py-3 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedEntry ? (
            <>
              <div className="stat-card-primary mb-6 px-4 py-6 text-center sm:mb-8 sm:px-6 sm:py-8">
                <p className="stat-label">Total Income</p>
                <p className="font-display mt-2 text-[26px] leading-tight font-bold text-stat-forest sm:mt-3 sm:text-[30px] md:text-[34px] md:leading-none">
                  {formatCurrency(selectedTotal)}
                </p>
                <p className="form-helper-text mt-3 font-body text-sm text-stone">
                  Settled Commission + Brand Deals / Retainer + Bonuses / Rewards
                </p>
              </div>

              <div className="space-y-5 border border-border-warm p-6">
                {MANUAL_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label htmlFor={`income-${field.key}`} className="label-caps mb-2 block">
                      {field.label}
                    </label>
                    <input
                      id={`income-${field.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={moneyInputValue(selectedEntry[field.key])}
                      onChange={(e) =>
                        updateMonthField(
                          selectedMonthKey,
                          field.key,
                          parseMoneyInput(e.target.value),
                        )
                      }
                      className="input-field w-full px-4 py-3 font-body text-sm"
                      placeholder="0.00"
                    />
                    {field.hint && (
                      <p className="form-helper-text mt-1.5 font-body text-xs text-stone">{field.hint}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            !showAddMonth && (
              <div className="border border-border-warm bg-white px-6 py-12 text-center">
                <p className="font-body text-base text-stone">
                  Select or add a month to start tracking income.
                </p>
              </div>
            )
          )}
        </>
      ) : (
        <>
          <div className="mb-8 border border-border-warm bg-stat-sage p-6">
            <label htmlFor="income-year-select" className="label-caps mb-2 block">
              Year
            </label>
            <select
              id="income-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="input-field w-full max-w-xs px-4 py-3 font-body text-sm"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto border border-border-warm">
            <table className="w-full min-w-[320px] border-collapse font-body text-sm">
              <thead>
                <tr className="border-b border-border-warm bg-white">
                  <th className="px-5 py-4 text-left font-body text-xs font-semibold uppercase tracking-[0.12em] text-stone">
                    Month
                  </th>
                  <th className="px-5 py-4 text-right font-body text-xs font-semibold uppercase tracking-[0.12em] text-stone">
                    Total Income
                  </th>
                  <th className="px-5 py-4 text-right font-body text-xs font-semibold uppercase tracking-[0.12em] text-stone">
                    GMV
                  </th>
                </tr>
              </thead>
              <tbody>
                {yearlyRows.map((row) => (
                  <tr key={row.key} className="border-b border-border-warm last:border-b-0">
                    <td className="px-5 py-4 text-ink">{row.name}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-ink">
                      {row.hasEntry ? formatCurrency(row.totalIncome) : '—'}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-stone">
                      {row.hasEntry && row.gmv > 0 ? formatCurrency(row.gmv) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-emerald bg-stat-sage">
                  <td className="px-5 py-4 font-body font-semibold text-ink">Year total</td>
                  <td className="px-5 py-4 text-right font-display text-lg font-bold tabular-nums text-emerald">
                    {formatCurrency(yearIncomeTotal)}
                  </td>
                  <td className="px-5 py-4 text-right font-body font-semibold tabular-nums text-stone">
                    {formatCurrency(yearGmvTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="form-helper-text mt-4 font-body text-xs text-stone">
            Year total income sums settled commission, brand deals, and bonuses only. GMV is shown
            separately as sales volume.
          </p>
        </>
      )}
    </div>
  )
}
