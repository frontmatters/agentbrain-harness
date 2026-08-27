// Keyless browser e2e: a user who configures some OTHER provider is not asked
// for a default-provider key again, and first-run onboarding is something they
// can dismiss. The vendor-neutral pi-ai `default` route stays mounted without a
// credential throughout, so the only thing that ends onboarding here is the
// provider the user configures through the real wire. Zero model calls:
// configuration is pure settings/credentials/llm-domain traffic.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  acknowledgeReloadConnectionLoss, assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/onboarding-usable-provider', import.meta.url))
const DISMISSED_EXPECTED = join(SNAPSHOT_DIR, 'dismissed.expected.md')
const MODE = webSnapshotMode()
const CREDENTIAL_STEP = 'Connect a model to get started'
const CUSTOM_PROVIDER = 'Custom (OpenAI-compatible)'

describe.skipIf(MODE === 'record')('web e2e: another usable provider ends first-run onboarding', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({ deepSeekMissingCredential: true })
    browser = await chromium.launch()
    // The scenario asserts English copy; the browser asks for it.
    page = await browser.newPage({ viewport: { width: 1440, height: 960 }, locale: 'en-US' })
    tripwire = watchConsole(page)
    // A local Ollama runtime on the host would flip onboarding to "Start with a
    // local model"; block the discovery probe so the API-key path shows
    // deterministically.
    await page.route('**/llm.discoverModels', route => route.abort())
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('dismisses first-run onboarding and still lets the user add another provider', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-onboarding-setup-card-cancel'))
    const credentialStep = page.getByRole('dialog', { name: CREDENTIAL_STEP })
    await credentialStep.waitFor({ timeout: 15_000 })
    await credentialStep.getByRole('button', { name: 'Configure later' }).click()
    await credentialStep.waitFor({ state: 'detached', timeout: 15_000 })

    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await settings.waitFor({ timeout: 10_000 })
    // The onboarding step no longer navigates into Settings on dismissal, so
    // enter the Models section explicitly before exercising its normal cards.
    await settings.getByRole('button', { name: 'Models' }).click()
    // The vendor-neutral default provider is a plain row with no stored key: it
    // reports the missing credential and offers an edit, not an auto-open setup
    // card, once onboarding has been dismissed.
    await settings.getByText(CUSTOM_PROVIDER, { exact: true }).first().locator('xpath=ancestor::li').getByRole('button', { name: 'Edit' }).waitFor({ timeout: 10_000 })
    expect(await settings.getByRole('textbox', { name: 'API key', exact: true }).count()).toBe(0)

    const add = settings.getByRole('button', { name: 'Add provider' })
    await expect.poll(async () => add.isEnabled(), { timeout: 10_000 }).toBe(true)
    await add.click()
    const pick = settings.getByLabel('Provider', { exact: true })
    await pick.waitFor({ timeout: 10_000 })
    await pick.selectOption('minimax-cn')
    // The add-provider draft is the only card carrying an API-key field.
    await expect.poll(
      async () => settings.getByRole('textbox', { name: 'API key', exact: true }).count(),
      { timeout: 10_000 },
    ).toBe(1)

    // Cancelling the add-provider draft closes it without touching the default
    // provider row, which keeps its edit affordance.
    await settings.getByRole('button', { name: 'Cancel', exact: true }).first().click()
    await expect.poll(
      async () => settings.getByLabel('Provider', { exact: true }).count(),
      { timeout: 10_000 },
    ).toBe(0)
    await expect.poll(
      async () => settings.getByRole('textbox', { name: 'API key', exact: true }).count(),
      { timeout: 10_000 },
    ).toBe(0)
    await settings.getByText(CUSTOM_PROVIDER, { exact: true }).first().locator('xpath=ancestor::li').getByRole('button', { name: 'Edit' }).waitFor({ timeout: 10_000 })
    const dismissed = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(DISMISSED_EXPECTED, dismissed, MODE)

    expect(tripwire.warnings).toEqual([])
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('stops prompting for a key once another provider can serve requests', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-onboarding-other-provider'))
    const settings = page.getByRole('dialog', { name: 'Settings' })
    // Re-open the add-provider draft for minimax-cn and give it a usable key.
    await settings.getByRole('button', { name: 'Add provider' }).click()
    const pick = settings.getByLabel('Provider', { exact: true })
    await pick.waitFor({ timeout: 10_000 })
    await pick.selectOption('minimax-cn')
    await settings.getByRole('textbox', { name: 'API key', exact: true }).fill('sk-e2e-minimax')
    await settings.getByRole('button', { name: 'Apply', exact: true }).click()
    await settings.getByText('Saved minimax-cn.', { exact: true }).waitFor({ timeout: 15_000 })

    // Only minimax-cn is reachable; the default provider still holds no key.
    const document = await readFile(join(scaffold.harnessHome, 'settings.yaml'), 'utf8')
    expect(document).toContain('apiKeyEnv: MINIMAX_CN_API_KEY')
    const credentials = await readFile(join(scaffold.harnessHome, '.credentials.yaml'), 'utf8')
    expect(credentials).toContain('MINIMAX_CN_API_KEY: sk-e2e-minimax')
    expect(credentials).not.toContain('ABH_LLM_API_KEY')

    const warningsBefore = tripwire.warnings.length
    await page.reload({ waitUntil: 'load' })
    acknowledgeReloadConnectionLoss(tripwire, warningsBefore)
    await page.waitForSelector('[class*="frame"]', { timeout: 15_000 })
    // The regression: the step read only the default route's credential, so a
    // fully configured user was taken over on every blank session.
    await expect.poll(
      async () => page.getByRole('dialog', { name: CREDENTIAL_STEP }).count(),
      { timeout: 10_000 },
    ).toBe(0)
    expect(await page.locator('#root').evaluate(root => (root as HTMLElement).inert)).toBe(false)

    // The Models page agrees: the default provider stays a row rather than
    // reopening its setup card over a user who already has somewhere to send a
    // request.
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await settings.waitFor({ timeout: 10_000 })
    await settings.getByRole('button', { name: 'Models' }).click()
    await settings.getByText(CUSTOM_PROVIDER, { exact: true }).first().locator('xpath=ancestor::li').getByRole('button', { name: 'Edit' }).waitFor({ timeout: 10_000 })
    expect(await settings.getByRole('textbox', { name: 'API key', exact: true }).count()).toBe(0)

    expect((await page.content()).includes('sk-e2e-minimax')).toBe(false)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('keeps the fixture inventory closed', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, ['dismissed.expected.md'])
  })
})
