// Candidate findings require WCAG exception review before remediation status is assigned.
import type { Locator } from '@playwright/test'

export type AuditStatus = 'pass' | 'fail' | 'blocked' | 'not_applicable'

export type AuditFinding = {
  code: 'accessible-name' | 'focus-activation' | 'focus-obscured' | 'overflow' | 'reduced-motion' | 'target-size'
  severity: 'serious' | 'candidate'
  element: string
  detail: string
}

export type AuditException = {
  code: 'overflow'
  classification: 'not_applicable' | 'supported_scroll'
  element: string
  detail: string
  reason: string
  owner: string
  alternativeOperation: string
}

export type CrossScreenComputedAudit = {
  viewport: { width: number, height: number }
  root: { clientWidth: number, scrollWidth: number }
  interactiveCount: number
  stateSemantics: { alerts: number, busy: number, live: number, progress: number, statuses: number }
  findings: AuditFinding[]
  exceptions: AuditException[]
  criterionStatuses: Record<`AC-SQ016-00${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`, AuditStatus>
}

export async function collectCrossScreenComputedAudit(
  root: Locator,
  { minTargetSize = 24 }: { minTargetSize?: number } = {}
): Promise<CrossScreenComputedAudit> {
  return root.evaluate((rootElement, options) => {
    const findings: AuditFinding[] = []
    const exceptions: AuditException[] = []
    const interactiveSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([type="hidden"]):not([disabled])',
      'select:not([disabled])',
      'summary',
      'textarea:not([disabled])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="link"]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',')

    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0
    }

    const describe = (element: Element) => {
      const htmlElement = element as HTMLElement
      const name = element.getAttribute('aria-label')
        ?? element.getAttribute('title')
        ?? element.getAttribute('placeholder')
        ?? htmlElement.innerText?.trim()
        ?? ''
      const identity = element.id ? `#${element.id}` : element.classList.length > 0 ? `.${[...element.classList].slice(0, 2).join('.')}` : ''
      return `${element.tagName.toLowerCase()}${identity}${name ? ` (${name.replace(/\s+/g, ' ').slice(0, 60)})` : ''}`
    }

    const hasAccessibleNameCandidate = (element: Element) => {
      if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.getAttribute('title')) return true
      if (element instanceof HTMLInputElement && (element.labels?.length || element.placeholder || element.value)) return true
      if (element instanceof HTMLSelectElement && element.labels?.length) return true
      if (element instanceof HTMLTextAreaElement && (element.labels?.length || element.placeholder)) return true
      return Boolean((element as HTMLElement).innerText?.trim())
    }

    const durationIsNonZero = (value: string) => value.split(',').some((duration) => {
      const trimmed = duration.trim()
      const numeric = Number.parseFloat(trimmed)
      if (!Number.isFinite(numeric)) return false
      return trimmed.endsWith('ms') ? numeric > 0 : numeric * 1000 > 0
    })

    const exceptionForOverflow = (element: HTMLElement, overflowX: string): AuditException | undefined => {
      const detail = `scrollWidth=${element.scrollWidth} clientWidth=${element.clientWidth} overflowX=${overflowX}`
      const rootOwner = rootElement.getAttribute('aria-label') ?? 'AppView owner'
      if (element.closest('.sr-only')) {
        return {
          code: 'overflow',
          classification: 'not_applicable',
          element: describe(element),
          detail,
          reason: 'visually-hidden labelの1px clippingはaccessible nameを提供するための意図した実装です',
          owner: 'shared .sr-only utility',
          alternativeOperation: '関連controlのaccessible nameとして全文を支援技術へ公開します'
        }
      }
      if (element.classList.contains('empty-orbit')) {
        return {
          code: 'overflow',
          classification: 'not_applicable',
          element: describe(element),
          detail,
          reason: '疑似要素の装飾ringだけがcontainer外へ描画され、user contentは含みません',
          owner: 'chat empty-state visual',
          alternativeOperation: '状態説明は隣接する見出しと本文で提供します'
        }
      }
      if (element instanceof HTMLInputElement && ['clip', 'hidden'].includes(overflowX)) {
        return {
          code: 'overflow',
          classification: 'supported_scroll',
          element: describe(element),
          detail,
          reason: 'native inputのtext viewport内で長い値を保持し、値自体はDOMから失われません',
          owner: rootOwner,
          alternativeOperation: 'inputへfocusし、矢印/Home/Endで値の表示位置を移動できます'
        }
      }

      let ancestor = element.parentElement
      while (ancestor && rootElement.contains(ancestor)) {
        const ancestorOverflowX = window.getComputedStyle(ancestor).overflowX
        if (['auto', 'scroll'].includes(ancestorOverflowX) && ancestor.tabIndex >= 0) {
          return {
            code: 'overflow',
            classification: 'supported_scroll',
            element: describe(element),
            detail,
            reason: `contentはfocus可能な${describe(ancestor)}のscroll領域内に保持されます`,
            owner: rootOwner,
            alternativeOperation: 'scroll領域へTabで移動し、矢印キーまたはShift+wheelで横方向を確認できます'
          }
        }
        ancestor = ancestor.parentElement
      }
      return undefined
    }

    const rootRect = rootElement.getBoundingClientRect()
    const rootHtml = rootElement as HTMLElement
    if (rootHtml.scrollWidth > rootHtml.clientWidth + 1) {
      findings.push({
        code: 'overflow',
        severity: 'serious',
        element: describe(rootElement),
        detail: `root scrollWidth=${rootHtml.scrollWidth} clientWidth=${rootHtml.clientWidth}`
      })
    }

    const overflowElements = [...rootElement.querySelectorAll<HTMLElement>('*')].filter((element) => {
      if (!isVisible(element) || element.scrollWidth <= element.clientWidth + 1) return false
      const overflowX = window.getComputedStyle(element).overflowX
      return !['auto', 'scroll'].includes(overflowX)
    })
    for (const element of overflowElements.slice(0, 50)) {
      const overflowX = window.getComputedStyle(element).overflowX
      const exception = exceptionForOverflow(element, overflowX)
      if (exception) {
        exceptions.push(exception)
        continue
      }
      findings.push({
        code: 'overflow',
        severity: 'candidate',
        element: describe(element),
        detail: `scrollWidth=${element.scrollWidth} clientWidth=${element.clientWidth} overflowX=${overflowX}`
      })
    }

    const interactiveElements = [...rootElement.querySelectorAll<HTMLElement>(interactiveSelector)].filter(isVisible)
    for (const element of interactiveElements) {
      const descriptor = describe(element)
      const rect = element.getBoundingClientRect()
      const requiredTargetSize = element.dataset.auditTarget === 'primary' ? 44 : options.minTargetSize
      if (!hasAccessibleNameCandidate(element)) {
        findings.push({ code: 'accessible-name', severity: 'serious', element: descriptor, detail: 'accessible name candidateが見つかりません' })
      }
      if (rect.width < requiredTargetSize || rect.height < requiredTargetSize) {
        findings.push({
          code: 'target-size',
          severity: 'candidate',
          element: descriptor,
          detail: `${Math.round(rect.width)}×${Math.round(rect.height)} CSS px; required=${requiredTargetSize}px; WCAG exception review required`
        })
      }

      element.focus({ preventScroll: true })
      if (document.activeElement !== element) {
        findings.push({ code: 'focus-activation', severity: 'serious', element: descriptor, detail: 'programmatic focusを保持できません' })
        continue
      }
      const centerX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2))
      const centerY = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2))
      if (rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth) {
        const topElement = document.elementFromPoint(centerX, centerY)
        if (topElement && topElement !== element && !element.contains(topElement) && !topElement.contains(element)) {
          findings.push({ code: 'focus-obscured', severity: 'candidate', element: descriptor, detail: `center point is covered by ${describe(topElement)}` })
        }
      }
    }

    const motionElements = [...rootElement.querySelectorAll<HTMLElement>('*')].filter((element) => {
      if (!isVisible(element)) return false
      const style = window.getComputedStyle(element)
      return (style.animationName !== 'none' && durationIsNonZero(style.animationDuration)) || durationIsNonZero(style.transitionDuration)
    })
    for (const element of motionElements.slice(0, 50)) {
      const style = window.getComputedStyle(element)
      findings.push({
        code: 'reduced-motion',
        severity: 'candidate',
        element: describe(element),
        detail: `animation=${style.animationName} ${style.animationDuration}; transition=${style.transitionDuration}`
      })
    }

    const serious = (code: AuditFinding['code']) => findings.some((finding) => finding.code === code && finding.severity === 'serious')
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      root: { clientWidth: Math.round(rootRect.width), scrollWidth: rootHtml.scrollWidth },
      interactiveCount: interactiveElements.length,
      stateSemantics: {
        alerts: rootElement.querySelectorAll('[role="alert"]').length,
        busy: rootElement.querySelectorAll('[aria-busy="true"]').length,
        live: rootElement.querySelectorAll('[aria-live]').length,
        progress: rootElement.querySelectorAll('[role="progressbar"]').length,
        statuses: rootElement.querySelectorAll('[role="status"]').length
      },
      findings,
      exceptions,
      criterionStatuses: {
        'AC-SQ016-001': serious('overflow')
          ? 'fail'
          : findings.some((finding) => finding.code === 'overflow') ? 'blocked' : 'pass',
        'AC-SQ016-002': serious('focus-activation') ? 'fail' : 'blocked',
        'AC-SQ016-003': serious('accessible-name') ? 'fail' : 'blocked',
        'AC-SQ016-004': 'blocked',
        'AC-SQ016-005': findings.some((finding) => finding.code === 'target-size') ? 'blocked' : 'pass',
        'AC-SQ016-006': findings.some((finding) => finding.code === 'reduced-motion') ? 'blocked' : 'pass',
        'AC-SQ016-007': 'blocked',
        'AC-SQ016-008': 'not_applicable'
      }
    } satisfies CrossScreenComputedAudit
  }, { minTargetSize })
}
