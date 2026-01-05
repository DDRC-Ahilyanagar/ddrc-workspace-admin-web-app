import { chromium, Browser, Page } from 'playwright'

const DEMO_BASE_URL = process.env.DEMO_URL || 'http://localhost:3000'
const DEMO_PHONE = process.env.DEMO_PHONE || '9999999999' // Admin bypass phone (no OTP required)
const DEMO_OTP = process.env.DEMO_OTP || '000000' // Any OTP works for admin bypass

declare global {
  interface Window {
    __demoCursor?: {
      moveTo: (selector: string) => Promise<void>
      moveToPoint: (x: number, y: number) => Promise<void>
      idle: (duration: number) => Promise<void>
      highlight: (selector: string, duration: number) => Promise<void>
      init: () => void
    }
    __introAudio?: HTMLAudioElement
    __demoEnhancements?: boolean
    __audioUnlocked?: boolean
  }
}

interface DemoStep {
  action: () => Promise<void>
  audioFile: string
  waitAfter?: number
  highlightSelector?: string
  typeInSearchDuringAudio?: boolean // For sales form - type in search while audio explains
  playAudioBeforeAction?: boolean // Deprecated - audio always plays first now
  executeActionBeforeAudio?: boolean // Special flag: execute action first, then play audio (for intro)
}

class ComprehensiveDemoRunner {
  private browser: Browser | null = null
  private page: Page | null = null
  private createdData: {
    customerId?: string
    supplierId?: string
    medicineId?: string
    saleId?: string
    purchaseOrderId?: string
  } = {}

  async init() {
    await this.waitForServer()
    
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 300,
      args: [
        '--start-maximized',
      ],
    })
    const context = await this.browser.newContext({
      viewport: null,
    })
    this.page = await context.newPage()
  }

  async initVisualEnhancements() {
    if (!this.page) return
    
    const result = await this.page.evaluate(`
      (function() {
        // Check localStorage first - if already unlocked, never show again
        const wasUnlocked = localStorage.getItem('__demo_audio_unlocked') === 'true'
        if (wasUnlocked) {
          window.__audioUnlocked = true
        }
        
        if (!window.__audioUnlocked) {
          const overlay = document.createElement('div')
          overlay.id = '__demo_audio_unlock'
          overlay.style.cssText = 
            'position:fixed;' +
            'inset:0;' +
            'background:rgba(0,0,0,0.75);' +
            'color:#fff;' +
            'display:flex;' +
            'align-items:center;' +
            'justify-content:center;' +
            'z-index:1000000;' +
            'font-size:18px;' +
            'cursor:pointer;' +
            'pointer-events:auto;'
          overlay.innerText = 'Click anywhere to start demo'
          
          function unlock() {
            window.__audioUnlocked = true
            localStorage.setItem('__demo_audio_unlocked', 'true')
            overlay.remove()
          }
          
          overlay.onclick = unlock
          overlay.onpointerdown = unlock
          document.body.appendChild(overlay)
          console.log('Audio unlock overlay created')
        }

        if (window.__demoEnhancements && window.__demoCursor) {
          if (window.__demoCursor.init && document.body) {
            try {
              window.__demoCursor.init()
            } catch(e) {
              console.warn('Cursor init error:', e)
            }
          }
          return 'already_initialized'
        }
        
        window.__demoEnhancements = true
        
        var cursorElement = null
        var highlightElement = null
        var cursorX = window.innerWidth / 2
        var cursorY = window.innerHeight / 2
        var animationFrameId = null
        
        function createCursor() {
          if (cursorElement) return
          cursorElement = document.createElement('div')
          cursorElement.id = '__demo_cursor'
          cursorElement.style.cssText = \`
            position: fixed;
            width: 20px;
            height: 20px;
            pointer-events: none;
            z-index: 999999;
            transform: translate(-50%, -50%);
            transition: none;
          \`
          cursorElement.innerHTML = \`
            <svg width="20" height="20" viewBox="0 0 20 20" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
              <path d="M 0 0 L 0 12 L 4 8 L 7 15 L 10 13 L 7 6 L 12 6 Z" fill="#000" stroke="#fff" stroke-width="0.5"/>
            </svg>
          \`
          document.body.appendChild(cursorElement)
          updateCursorPosition(cursorX, cursorY)
        }
        
        function updateCursorPosition(x, y) {
          cursorX = x
          cursorY = y
          if (cursorElement) {
            cursorElement.style.left = x + 'px'
            cursorElement.style.top = y + 'px'
          }
        }
        
        function easeInOutCubic(t) {
          return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        }
        
        function moveCursorToPoint(targetX, targetY, duration = 800) {
          return new Promise((resolve) => {
            const startX = cursorX
            const startY = cursorY
            const startTime = performance.now()
            
            function animate(currentTime) {
              const elapsed = currentTime - startTime
              const progress = Math.min(elapsed / duration, 1)
              const eased = easeInOutCubic(progress)
              
              const x = startX + (targetX - startX) * eased
              const y = startY + (targetY - startY) * eased
              
              updateCursorPosition(x, y)
              
              if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate)
              } else {
                animationFrameId = null
                resolve()
              }
            }
            
            if (animationFrameId) {
              cancelAnimationFrame(animationFrameId)
            }
            animationFrameId = requestAnimationFrame(animate)
          })
        }
        
        function moveCursorToElement(selector) {
          return new Promise((resolve) => {
            if (!document.body) {
              resolve()
              return
            }
            
            const element = document.querySelector(selector)
            if (!element) {
              console.warn('Element not found for cursor:', selector)
              resolve()
              return
            }
            
            const rect = element.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) {
              console.warn('Element has zero size:', selector)
              resolve()
              return
            }
            
            const x = rect.left + rect.width / 2
            const y = rect.top + rect.height / 2
            
            const distance = Math.sqrt(
              Math.pow(x - cursorX, 2) + Math.pow(y - cursorY, 2)
            )
            const duration = Math.min(Math.max(distance * 0.8, 300), 1200)
            
            moveCursorToPoint(x, y, duration).then(resolve)
          })
        }
        
        function idleCursor(durationMs = 2000) {
          return new Promise((resolve) => {
            const startTime = performance.now()
            const baseX = cursorX
            const baseY = cursorY
            const jitterAmount = 3
            
            function jitter() {
              const elapsed = performance.now() - startTime
              if (elapsed >= durationMs) {
                updateCursorPosition(baseX, baseY)
                resolve()
                return
              }
              
              const jitterX = baseX + (Math.random() - 0.5) * jitterAmount
              const jitterY = baseY + (Math.random() - 0.5) * jitterAmount
              updateCursorPosition(jitterX, jitterY)
              
              setTimeout(jitter, 50 + Math.random() * 100)
            }
            
            jitter()
          })
        }
        
        function highlightElement(selector, durationMs = 2500) {
          return new Promise((resolve) => {
            if (!document.body) {
              resolve()
              return
            }
            
            if (highlightElement) {
              highlightElement.remove()
              highlightElement = null
            }
            
            const element = document.querySelector(selector)
            if (!element) {
              console.warn('Element not found for highlight:', selector)
              resolve()
              return
            }
            
            const rect = element.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) {
              console.warn('Element has zero size for highlight:', selector)
              resolve()
              return
            }
            
            highlightElement = document.createElement('div')
            highlightElement.id = '__demo_highlight'
            highlightElement.style.cssText = \`
              position: fixed;
              left: \${rect.left}px;
              top: \${rect.top}px;
              width: \${rect.width}px;
              height: \${rect.height}px;
              border: 3px solid #3b82f6;
              border-radius: 4px;
              pointer-events: none;
              z-index: 999998;
              box-shadow: 0 0 20px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(59, 130, 246, 0.2);
              animation: pulse 1.5s ease-in-out infinite;
            \`
            
            let style = document.getElementById('__demo_highlight_style')
            if (!style) {
              style = document.createElement('style')
              style.id = '__demo_highlight_style'
              style.textContent = \`
                @keyframes pulse {
                  0%, 100% { opacity: 0.8; transform: scale(1); }
                  50% { opacity: 1; transform: scale(1.02); }
                }
              \`
              document.head.appendChild(style)
            }
            
            document.body.appendChild(highlightElement)
            
            setTimeout(() => {
              if (highlightElement) {
                highlightElement.style.transition = 'opacity 0.3s ease-out'
                highlightElement.style.opacity = '0'
                setTimeout(() => {
                  if (highlightElement) {
                    highlightElement.remove()
                    highlightElement = null
                  }
                  resolve()
                }, 300)
              } else {
                resolve()
              }
            }, durationMs)
          })
        }
        
        window.__demoCursor = {
          moveTo: moveCursorToElement,
          moveToPoint: moveCursorToPoint,
          idle: idleCursor,
          highlight: function(selector, duration) { return highlightElement(selector, duration) },
          init: createCursor
        }
        
        if (document.body) {
          createCursor()
        } else {
          document.addEventListener('DOMContentLoaded', createCursor)
        }
        
        return 'initialized'
      })()
    `).catch(() => 'error')
    
    if (result === 'error') {
      console.warn('Failed to initialize visual enhancements, continuing anyway...')
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close()
    }
  }



  async playAudio(audioFile: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized')

    const audioUrl = `${DEMO_BASE_URL}/explainations/${audioFile}`

    console.log(`Playing audio: ${audioFile}`)

    return await this.page.evaluate(`
      (function() {
        return new Promise(function(resolve) {
          // Reuse already-playing login audio if it exists
          if (window.__introAudio && ${JSON.stringify(audioFile)} === '01_login.mp3' && !window.__introAudio.ended) {
            window.__introAudio.onended = function() {
              resolve()
            }
            return
          }

          const url = ${JSON.stringify(audioUrl)}
          const a = document.createElement('audio')
          a.src = url
          a.autoplay = true
          a.volume = 1
          a.style.display = 'none'
          document.body.appendChild(a)

          let resolved = false

          function resolveOnce() {
            if (!resolved) {
              resolved = true
              resolve()
            }
          }

          a.onerror = function() {
            console.error('Audio playback error for:', url)
            resolveOnce()
          }

          a.onended = function() {
            console.log('Audio finished playing:', url)
            resolveOnce()
          }
        })
      })()
    `)
  }

  async waitForPageStable() {
    if (!this.page) return
    await this.page.waitForLoadState('networkidle').catch(() => {})
    await this.page.waitForFunction(() => document.visibilityState === 'visible')
    await this.wait(300)
  }

  async playAudioAsync(audioFile: string): Promise<number> {
    // Start audio in parallel (non-blocking)
    // Returns a promise that resolves when audio finishes playing
    if (!this.page) throw new Error('Page not initialized')

    const audioUrl = `${DEMO_BASE_URL}/explainations/${audioFile}`

    console.log(`Starting audio (async): ${audioFile}`)

    return await this.page.evaluate(`
      (function() {
        return new Promise(function(resolve) {
          const url = ${JSON.stringify(audioUrl)}
          const a = new Audio(url)
          a.volume = 1

          let duration = 3000
          let resolved = false

          function resolveOnce(value) {
            if (!resolved) {
              resolved = true
              resolve(value)
            }
          }

          a.onloadedmetadata = function() {
            duration = Math.max(a.duration * 1000, 2000)
            setTimeout(function() {
              if (!a.ended && !resolved) {
                console.warn('Audio timeout, resolving with duration:', duration)
                resolveOnce(duration)
              }
            }, duration + 10000)
          }

          a.onerror = function() {
            console.error('Audio playback error for:', url)
            resolveOnce(duration)
          }

          a.onended = function() {
            console.log('Audio finished playing:', url)
            resolveOnce(duration)
          }

          a.play().catch(function(err) {
            console.error('Failed to play audio:', err)
            resolveOnce(duration)
          })

          setTimeout(function() {
            if (!resolved) {
              console.warn('Audio metadata timeout, using default duration:', duration)
              resolveOnce(duration)
            }
          }, 5000)
        })
      })()
    `)
  }

  async wait(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  async moveCursorTo(selector: string) {
    if (!this.page) return
    await this.page.evaluate((sel: string) => {
      if (window.__demoCursor) {
        return window.__demoCursor.moveTo(sel)
      }
    }, selector)
  }

  async moveCursorToLocator(locator: any) {
    if (!this.page) return
    try {
      const selector = await locator.evaluate((el: HTMLElement) => {
        if (el.id) return `#${el.id}`
        if (el.className) {
          const classes = el.className.split(' ').filter(c => c).slice(0, 2).join('.')
          if (classes) return `.${classes}`
        }
        return el.tagName.toLowerCase()
      }).catch(() => null)
      
      if (selector) {
        await this.moveCursorTo(selector)
      } else {
        const box = await locator.boundingBox()
        if (box) {
          await this.moveCursorToPoint(box.x + box.width / 2, box.y + box.height / 2)
        }
      }
    } catch (error) {
      console.warn('Failed to move cursor to locator:', error)
    }
  }

  async waitForRequiredFields(formSelector?: string) {
    if (!this.page) return
    
    await this.page.waitForFunction((selector) => {
      const form = selector ? document.querySelector(selector) : document.querySelector('form')
      if (!form) return true
      
      const requiredInputs = form.querySelectorAll('input[required], select[required], textarea[required]')
      for (const input of Array.from(requiredInputs)) {
        const el = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        if (!el.value || el.value.trim() === '') {
          return false
        }
      }
      
      const ariaRequired = form.querySelectorAll('[aria-required="true"]')
      for (const input of Array.from(ariaRequired)) {
        const el = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          if (!el.value || el.value.trim() === '') {
            return false
          }
        }
      }
      
      return true
    }, formSelector || 'form', { timeout: 5000 }).catch(() => {})
  }

  async fillRequiredFields() {
    if (!this.page) return
    
    const requiredFields = await this.page.locator('input[required], select[required], textarea[required], [aria-required="true"]').all()
    
    for (const field of requiredFields) {
      try {
        const tagName = await field.evaluate((el: HTMLElement) => el.tagName.toLowerCase())
        const fieldType = await field.getAttribute('type')
        const fieldName = await field.getAttribute('name') || ''
        const isFilled = await field.evaluate((el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
          return el.value && el.value.trim() !== ''
        })
        
        if (isFilled) continue
        
        if (tagName === 'input') {
          if (fieldType === 'number' || fieldName.toLowerCase().includes('credit') || fieldName.toLowerCase().includes('limit')) {
            await this.moveCursorToLocator(field)
            await this.wait(300)
            await field.fill('0')
            await this.wait(500)
          } else if (fieldType === 'email') {
            await this.moveCursorToLocator(field)
            await this.wait(300)
            await field.fill('demo@example.com')
            await this.wait(500)
          } else if (fieldType === 'tel' || fieldName.toLowerCase().includes('phone')) {
            await this.moveCursorToLocator(field)
            await this.wait(300)
            await field.fill('9876543210')
            await this.wait(500)
          } else {
            await this.moveCursorToLocator(field)
            await this.wait(300)
            await field.fill('Demo Value')
            await this.wait(500)
          }
        } else if (tagName === 'select') {
          const options = await field.locator('option').all()
          if (options.length > 1) {
            await this.moveCursorToLocator(field)
            await this.wait(300)
            await field.selectOption({ index: 1 })
            await this.wait(500)
          }
        }
      } catch (error) {
        console.warn('Failed to fill required field:', error)
      }
    }
  }

  async fillAllFields() {
    if (!this.page) return
    
    // Get ALL form fields (not just required ones)
    const allFields = await this.page.locator('form input:not([type="hidden"]):not([type="submit"]):not([type="button"]), form select, form textarea').all()
    
    for (const field of allFields) {
      try {
        const tagName = await field.evaluate((el: HTMLElement) => el.tagName.toLowerCase())
        const fieldType = await field.getAttribute('type')
        const fieldName = await field.getAttribute('name') || ''
        const placeholder = await field.getAttribute('placeholder') || ''
        const isDisabled = await field.isDisabled().catch(() => false)
        const isReadOnly = await field.getAttribute('readonly') !== null
        
        // Skip disabled or readonly fields
        if (isDisabled || isReadOnly) continue
        
        // Check if already filled
        const isFilled = await field.evaluate((el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
          return el.value && el.value.trim() !== ''
        })
        
        if (isFilled) continue
        
        await this.moveCursorToLocator(field)
        await this.wait(300)
        
        if (tagName === 'input') {
          if (fieldType === 'number' || fieldType === 'tel' || 
              fieldName.toLowerCase().includes('credit') || 
              fieldName.toLowerCase().includes('limit') ||
              fieldName.toLowerCase().includes('phone') ||
              fieldName.toLowerCase().includes('quantity') ||
              fieldName.toLowerCase().includes('qty') ||
              fieldName.toLowerCase().includes('mrp') ||
              fieldName.toLowerCase().includes('price') ||
              fieldName.toLowerCase().includes('amount') ||
              fieldName.toLowerCase().includes('discount') ||
              placeholder.toLowerCase().includes('phone') ||
              placeholder.toLowerCase().includes('quantity') ||
              placeholder.toLowerCase().includes('price') ||
              placeholder.toLowerCase().includes('amount')) {
            // Numeric fields
            if (fieldName.toLowerCase().includes('credit') || fieldName.toLowerCase().includes('limit')) {
              await field.fill('50000')
            } else if (fieldName.toLowerCase().includes('quantity') || fieldName.toLowerCase().includes('qty')) {
              await field.fill('2')
            } else if (fieldName.toLowerCase().includes('mrp') || fieldName.toLowerCase().includes('price')) {
              await field.fill('100')
            } else if (fieldName.toLowerCase().includes('phone') || fieldType === 'tel') {
              await field.fill('9876543210')
            } else {
              await field.fill('0')
            }
          } else if (fieldType === 'email' || fieldName.toLowerCase().includes('email')) {
            await field.fill('demo@example.com')
          } else if (fieldType === 'date' || fieldName.toLowerCase().includes('date') || fieldName.toLowerCase().includes('dob') || fieldName.toLowerCase().includes('birth')) {
            // Date fields
            if (fieldType === 'date') {
              await field.fill('1990-01-15')
            } else {
              await field.fill('15-01-1990')
            }
          } else if (fieldType === 'text' || !fieldType) {
            // Text fields
            if (fieldName.toLowerCase().includes('address') || placeholder.toLowerCase().includes('address')) {
              await field.fill('123 Demo Street, Demo City, 400001')
            } else if (fieldName.toLowerCase().includes('name') || placeholder.toLowerCase().includes('name')) {
              // Skip if already filled (might be auto-filled)
              const currentValue = await field.inputValue().catch(() => '')
              if (!currentValue) {
                await field.fill('Demo Value')
              }
            } else {
              await field.fill('Demo Value')
            }
          }
        } else if (tagName === 'select') {
          const options = await field.locator('option:not([value=""])').all()
          if (options.length > 0) {
            // Select first non-empty option
            await field.selectOption({ index: 0 })
          }
        } else if (tagName === 'textarea') {
          if (fieldName.toLowerCase().includes('address') || placeholder.toLowerCase().includes('address')) {
            await field.fill('123 Demo Street, Demo City, 400001')
          } else if (fieldName.toLowerCase().includes('medical') || fieldName.toLowerCase().includes('allerg') || placeholder.toLowerCase().includes('medical')) {
            await field.fill('No known allergies. Regular checkups.')
          } else if (fieldName.toLowerCase().includes('note') || fieldName.toLowerCase().includes('comment') || placeholder.toLowerCase().includes('note')) {
            await field.fill('Demo notes for testing purposes.')
          } else {
            await field.fill('Demo text area content.')
          }
        }
        
        await this.wait(500)
      } catch (error) {
        console.warn('Failed to fill field:', error)
      }
    }
  }

  async moveCursorToPoint(x: number, y: number) {
    if (!this.page) return
    await this.page.evaluate((pos: { x: number; y: number }) => {
      if (window.__demoCursor) {
        return window.__demoCursor.moveToPoint(pos.x, pos.y)
      }
    }, { x, y })
  }

  async idleCursor(durationMs: number = 2000) {
    if (!this.page) return
    await this.page.evaluate((duration: number) => {
      if (window.__demoCursor) {
        return window.__demoCursor.idle(duration)
      }
    }, durationMs)
  }

  async highlightElement(selector: string, durationMs: number = 2500) {
    if (!this.page) return
    await this.page.evaluate(({ sel, duration }: { sel: string; duration: number }) => {
      if (window.__demoCursor) {
        return window.__demoCursor.highlight(sel, duration)
      }
    }, { sel: selector, duration: durationMs })
  }

  async waitForServer(maxRetries = 30, delay = 1000) {
    console.log(`Checking if server is running at ${DEMO_BASE_URL}...`)
    for (let i = 0; i < maxRetries; i++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        const response = await fetch(`${DEMO_BASE_URL}/login`, {
          signal: controller.signal,
          method: 'GET',
        })
        clearTimeout(timeoutId)
        if (response.status === 200 || response.status === 404) {
          console.log('✓ Server is ready!')
          return true
        }
      } catch (error) {
        if (i === 0) {
          console.log('Waiting for server to start...')
        }
        if (i < maxRetries - 1) {
          process.stdout.write('.')
          await this.wait(delay)
        }
      }
    }
    console.log('\n')
    throw new Error(`\n❌ Server at ${DEMO_BASE_URL} is not responding.\n\nPlease start the dev server first:\n  npm run dev\n\nThen run the demo in another terminal:\n  npm run demo`)
  }

  async navigateAndWait(url: string, selector?: string) {
    if (!this.page) throw new Error('Page not initialized')
    
    const fullUrl = `${DEMO_BASE_URL}${url}`
    console.log(`  🧭 Navigating to: ${fullUrl}`)
    
    try {
      await this.page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 })
      
      // Wait for page to be ready
      await this.page.waitForFunction(
        () => document.body && document.body.innerHTML.length > 100,
        { timeout: 15000 }
      )
      
      // Wait for URL to match (in case of redirects)
      await this.page.waitForURL(`**${url}**`, { timeout: 10000 }).catch(() => {
        // If URL doesn't match exactly, check if we're close
        const currentUrl = this.page!.url()
        console.log(`  ⚠️ URL mismatch: expected ${url}, got ${currentUrl}`)
      })
      
      if (selector) {
        await this.page.waitForSelector(selector, { timeout: 10000, state: 'visible' })
      }
      
      // Verify we're on the right page
      const currentUrl = this.page.url()
      if (!currentUrl.includes(url.split('?')[0])) {
        console.log(`  ⚠️ Navigation warning: Expected ${url}, but on ${currentUrl}`)
        // Try to navigate again
        await this.page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 })
      }
      
      // Re-initialize visual enhancements after navigation
      await this.initVisualEnhancements()
      await this.idleCursor(500)
      await this.wait(1500)
      
      console.log(`  ✅ Successfully navigated to: ${this.page.url()}`)
    } catch (error: any) {
      console.error(`  ❌ Navigation error to ${url}:`, error.message)
      // Try one more time
      try {
        await this.page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await this.wait(2000)
        console.log(`  ✅ Retry successful for: ${url}`)
      } catch (retryError: any) {
        console.error(`  ❌ Retry also failed for ${url}:`, retryError.message)
        throw retryError
      }
    }
  }

  async login() {
    if (!this.page) throw new Error('Page not initialized')
    
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/login')) {
      await this.page.goto(`${DEMO_BASE_URL}/login`, { waitUntil: 'networkidle' })
      await this.page.waitForSelector('input[type="tel"]', { timeout: 10000 })
      await this.wait(1000)
    }

    // Fill admin bypass phone number (9999999999 - bypasses OTP)
    await this.moveCursorTo('input[type="tel"]')
    await this.wait(300)
    await this.page.fill('input[type="tel"]', DEMO_PHONE)
    await this.wait(500)
    
    // Click OTP send button (will bypass OTP for admin phone)
    await this.moveCursorTo('button[type="submit"]')
    await this.wait(500)
    await this.page.click('button[type="submit"]')
    
    // Wait for navigation to OTP page
    await this.page.waitForURL('**/otp**', { timeout: 10000 }).catch(() => {})
    await this.wait(2000)
    
    // Fill OTP (any OTP works for admin bypass phone 9999999999)
    const otpInput = this.page.locator('input[type="text"][maxlength="6"], input[type="tel"][maxlength="6"]').first()
    if (await otpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.moveCursorToLocator(otpInput)
      await this.wait(300)
      // Admin bypass phone accepts any OTP
      await otpInput.fill(DEMO_OTP)
      await this.wait(1000)
      
      // Try to click verify button if it exists, but don't wait too long
      // OTP may auto-verify when 6 digits are entered
      const verifyButton = this.page.locator('button:has-text("पडताळा"), button:has-text("Verify"), button[type="submit"]').first()
      if (await verifyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.moveCursorToLocator(verifyButton)
        await this.wait(300)
        await verifyButton.click().catch(() => {}) // Don't fail if click doesn't work
      }
    }
    
    // Wait for navigation to dashboard (OTP may auto-verify)
    // Give it more time and check if we're already on dashboard
    const maxWait = 15000
    const startTime = Date.now()
    while (Date.now() - startTime < maxWait) {
      const currentUrl = this.page.url()
      if (currentUrl.includes('/dashboard')) {
        console.log('Successfully navigated to dashboard')
        break
      }
      await this.wait(500)
    }
    
    // Final check - if still not on dashboard, try navigating directly
    if (!this.page.url().includes('/dashboard')) {
      console.log('Not on dashboard yet, navigating directly...')
      await this.page.goto(`${DEMO_BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
    }
    
    await this.wait(2000)
  }

  // ========== CUSTOMERS ==========
  async navigateToCustomers() {
    await this.navigateAndWait('/customers')
  }

  // Helper function to click "Add" button for any page
  async clickAddButton(route: string, buttonTexts: string[]) {
    if (!this.page) throw new Error('Page not initialized')
    
    // Build selector for the add button
    const selectors = [
      `a[href="${route}"], a[href*="${route}"]`,
      ...buttonTexts.map(text => `button:has-text("${text}"), a:has-text("${text}")`)
    ].join(', ')
    
    const addButton = this.page.locator(selectors).first()
    await addButton.waitFor({ state: 'visible', timeout: 10000 })
    await this.moveCursorToLocator(addButton)
    await this.wait(300)
    await addButton.click()
    
    // Wait for navigation
    await this.page.waitForURL(`**${route}**`, { timeout: 10000 })
    await this.waitForPageStable()
  }

  async navigateToNewCustomerPage() {
    if (!this.page) throw new Error('Page not initialized')
    await this.navigateAndWait('/customers/new')
    await this.waitForPageStable()
  }

  async fillAndSubmitCustomerForm() {
    if (!this.page) throw new Error('Page not initialized')
    // Assume we're already on /customers/new page
    await this.wait(1000)
    
    // 1. Customer Name (required)
    const nameInput = this.page.locator('input[name*="name"], input[placeholder*="Name"], input[placeholder*="Customer Name"]').first()
    if (await nameInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(nameInput)
      await this.wait(300)
      await nameInput.fill('Demo Customer')
      await this.wait(500)
    }

    // 2. Phone Number
    const phoneInput = this.page.locator('input[name*="phone"], input[type="tel"], input[placeholder*="Phone"]').first()
    if (await phoneInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(phoneInput)
      await this.wait(300)
      await phoneInput.fill('9876543210')
      await this.wait(500)
    }

    // 3. Email
    const emailInput = this.page.locator('input[name*="email"], input[type="email"], input[placeholder*="Email"]').first()
    if (await emailInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(emailInput)
      await this.wait(300)
      await emailInput.fill('demo@customer.com')
      await this.wait(500)
    }

    // 4. Address (textarea)
    const addressInput = this.page.locator('textarea[name*="address"], textarea[placeholder*="Address"], textarea[placeholder*="address"]').first()
    if (await addressInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(addressInput)
      await this.wait(300)
      await addressInput.fill('123 Demo Street, Demo City, 400001')
      await this.wait(500)
    }

    // 5. Date of Birth
    const dobInput = this.page.locator('input[name*="dob"], input[name*="dateOfBirth"], input[name*="birth"], input[type="date"], input[placeholder*="Date of Birth"], input[placeholder*="dd-mm-yyyy"]').first()
    if (await dobInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(dobInput)
      await this.wait(300)
      // Fill with a valid date format (dd-mm-yyyy or yyyy-mm-dd depending on input type)
      const inputType = await dobInput.getAttribute('type')
      if (inputType === 'date') {
        await dobInput.fill('1990-01-15')
      } else {
        await dobInput.fill('15-01-1990')
      }
      await this.wait(500)
    }

    // 6. Customer Type (dropdown/select)
    const customerTypeSelect = this.page.locator('select[name*="type"], select[name*="customerType"], select[placeholder*="Customer Type"]').first()
    if (await customerTypeSelect.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(customerTypeSelect)
      await this.wait(300)
      // Try to select the first non-empty option
      const options = await customerTypeSelect.locator('option').all()
      if (options.length > 1) {
        await customerTypeSelect.selectOption({ index: 1 })
      } else if (options.length === 1) {
        await customerTypeSelect.selectOption({ index: 0 })
      }
      await this.wait(500)
    }

    // 7. Credit Limit (required numeric field)
    const creditLimitInput = this.page.locator('input[name*="credit"], input[name*="limit"], input[placeholder*="Credit Limit"], input[placeholder*="Credit"]').first()
    if (await creditLimitInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(creditLimitInput)
      await this.wait(300)
      // Clear first, then fill
      await creditLimitInput.clear()
      await creditLimitInput.fill('50000')
      await this.wait(500)
    }

    // 8. Medical History/Allergies (textarea)
    const medicalHistoryInput = this.page.locator('textarea[name*="medical"], textarea[name*="allerg"], textarea[placeholder*="Medical"], textarea[placeholder*="Allergies"]').first()
    if (await medicalHistoryInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(medicalHistoryInput)
      await this.wait(300)
      await medicalHistoryInput.fill('No known allergies. Regular checkups.')
      await this.wait(500)
    }

    // Fill ALL fields in the form (not just required ones)
    await this.fillAllFields()
    await this.wait(1000)
    
    // Wait for all required fields to be filled and validated
    await this.waitForRequiredFields()
    await this.wait(500)

    // Find submit button with more specific selectors
    const submitButton = this.page.locator(
      'button[type="submit"], ' +
      'button:has-text("Create Customer"), ' +
      'button:has-text("Create"), ' +
      'button:has-text("Save")'
    ).first()
    
    if (await submitButton.isVisible({ timeout: 5000 })) {
      await this.moveCursorToLocator(submitButton)
      await this.wait(500)
      
      // Click and wait for navigation away from /new page
      const urlBefore = this.page.url()
      await submitButton.click()
      
      // Wait for URL to change (navigation away from /new)
      try {
        await this.page.waitForFunction(
          (urlBefore) => {
            const currentUrl = window.location.href
            return currentUrl !== urlBefore && !currentUrl.includes('/new')
          },
          urlBefore,
          { timeout: 10000 }
        )
      } catch (e) {
        console.warn('Navigation timeout, checking current URL...')
      }
      
      // Wait for navigation to complete
      await this.wait(2000)
      
      // Verify we're no longer on the form page
      const currentUrl = this.page.url()
      if (currentUrl.includes('/new')) {
        console.warn('Still on form page after submission - customer may not have been created')
        // Try to find validation errors
        const errorMessages = await this.page.locator('[role="alert"], .error, .text-red-500, .text-red-600').all()
        if (errorMessages.length > 0) {
          console.warn('Form validation errors detected')
        }
      } else {
        console.log(`✓ Customer created successfully, navigated to: ${currentUrl}`)
      }
    } else {
      console.warn('Submit button not found')
    }
  }

  async viewCustomerDetail() {
    if (!this.page) throw new Error('Page not initialized')
    
    // Navigate to customers list if not already there
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/customers') || currentUrl.includes('/new')) {
      await this.navigateToCustomers()
      await this.wait(1500)
    }
    
    // Wait for customer cards/list to load
    await this.wait(1000)
    
    // Strategy 1: Look for "Demo Customer" text and find its parent card
    // The card should contain the email "demo@customer.com" we just created
    let customerCard = this.page.locator('text="demo@customer.com"').locator('xpath=ancestor::*[contains(@class, "card") or contains(@class, "Card") or @role="button" or @onclick]').first()
    
    if (!(await customerCard.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Strategy 2: Find card containing "Demo Customer" name
      customerCard = this.page.locator('text="Demo Customer"').locator('xpath=ancestor::*[contains(@class, "card") or contains(@class, "Card") or @role="button" or @onclick]').first()
    }
    
    if (!(await customerCard.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Strategy 3: Look for direct links to customer details
      customerCard = this.page.locator(
        'a[href*="/customers/"]:not([href*="/new"]), ' +
        'a[href*="/customer/"]:not([href*="/new"])'
      ).first()
    }
    
    if (!(await customerCard.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Strategy 4: Find any card that contains customer data (email, credit limit, etc.)
      // Look for elements containing ₹ (rupee symbol) or email pattern
      const cardsWithData = await this.page.locator('*:has-text("₹"), *:has-text("@")').all()
      for (const card of cardsWithData) {
        const text = await card.textContent().catch(() => '')
        const tagName = await card.evaluate((el: HTMLElement) => el.tagName.toLowerCase()).catch(() => '')
        // Skip buttons and small elements
        if (tagName === 'button' || tagName === 'a' || tagName === 'span') continue
        // Check if it looks like a card (has multiple lines of text)
        if (text && text.split('\n').length > 3) {
          customerCard = card
          break
        }
      }
    }
    
    // Final fallback: Use page.evaluate to find clickable card
    if (!(await customerCard.isVisible({ timeout: 2000 }).catch(() => false))) {
      const cardSelector = await this.page.evaluate(() => {
        // Find all elements that might be customer cards
        const allElements = document.querySelectorAll('div, article, section')
        for (const el of Array.from(allElements)) {
          const text = el.textContent || ''
          // Look for elements containing customer data
          if ((text.includes('@') || text.includes('₹') || text.includes('Credit Limit')) && 
              !text.includes('Add') && !text.includes('New') && !text.includes('Create')) {
            // Check if it's clickable (has onclick, is a link, or has cursor pointer)
            const style = window.getComputedStyle(el)
            const htmlEl = el as HTMLElement
            if ((htmlEl as any).onclick || el.getAttribute('onclick') || 
                style.cursor === 'pointer' || 
                el.closest('a') ||
                el.getAttribute('role') === 'button') {
              // Return a unique selector
              if (el.id) return `#${el.id}`
              if (el.className) {
                const classes = el.className.split(' ').filter(c => c).join('.')
                if (classes) return `.${classes}`
              }
            }
          }
        }
        return null
      })
      
      if (cardSelector) {
        customerCard = this.page.locator(cardSelector).first()
      }
    }
    
    if (await customerCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Make sure we're clicking the card, not Edit/Delete buttons
      // Click in the center/upper area of the card to avoid buttons
      const box = await customerCard.boundingBox()
      if (box) {
        // Click in the upper-middle area (avoid bottom where buttons are)
        await this.moveCursorToPoint(box.x + box.width / 2, box.y + box.height * 0.3)
        await this.wait(300)
        await this.page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3)
      } else {
        await this.moveCursorToLocator(customerCard)
        await this.wait(500)
        await customerCard.click()
      }
      
      // Wait for URL to change to a customer detail page
      const urlBeforeClick = this.page.url()
      try {
        await this.page.waitForFunction(
          (urlBefore) => {
            const currentUrl = window.location.href
            return currentUrl !== urlBefore && 
                   currentUrl.includes('/customers/') && 
                   !currentUrl.includes('/new') && 
                   !currentUrl.endsWith('/customers')
          },
          urlBeforeClick,
          { timeout: 10000 }
        )
      } catch (e) {
        console.warn('Navigation timeout, checking current URL...')
      }
      
      // Wait for detail page to load
      await this.wait(2000)
      
      // Verify we're on a customer detail page
      const detailUrl = this.page.url()
      if (detailUrl.includes('/customers/') && !detailUrl.includes('/new') && !detailUrl.endsWith('/customers')) {
        console.log(`✓ Navigated to customer detail page: ${detailUrl}`)
      } else {
        console.warn(`⚠ May not be on customer detail page: ${detailUrl}`)
      }
    } else {
      console.warn('No customer card found to click')
    }
  }

  // ========== SUPPLIERS ==========
  async navigateToSuppliers() {
    await this.navigateAndWait('/suppliers')
  }

  async createNewSupplier() {
    if (!this.page) throw new Error('Page not initialized')
    // Only navigate if not already on the page
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/suppliers/new')) {
      await this.navigateAndWait('/suppliers/new')
    }
    
    const nameInput = this.page.locator('input[name*="name"], input[placeholder*="Name"]').first()
    if (await nameInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(nameInput)
      await this.wait(300)
      await nameInput.fill('Demo Supplier')
      await this.wait(500)
    }

    const phoneInput = this.page.locator('input[name*="phone"], input[type="tel"]').first()
    if (await phoneInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(phoneInput)
      await this.wait(300)
      await phoneInput.fill('9876543211')
      await this.wait(500)
    }

    // Fill ALL fields in the form (not just required ones)
    await this.fillAllFields()
    await this.wait(1000)
    
    // Wait for all required fields to be filled
    await this.waitForRequiredFields()
    await this.wait(500)

    const submitButton = this.page.locator(
      'button[type="submit"], ' +
      'button:has-text("Create Supplier"), ' +
      'button:has-text("Create"), ' +
      'button:has-text("Save")'
    ).first()
    
    if (await submitButton.isVisible({ timeout: 5000 })) {
      await this.moveCursorToLocator(submitButton)
      await this.wait(500)
      
      const urlBefore = this.page.url()
      await submitButton.click()
      
      // Wait for URL to change
      try {
        await this.page.waitForFunction(
          (urlBefore) => {
            const currentUrl = window.location.href
            return currentUrl !== urlBefore && !currentUrl.includes('/new')
          },
          urlBefore,
          { timeout: 10000 }
        )
      } catch (e) {
        console.warn('Navigation timeout, checking current URL...')
      }
      
      await this.wait(2000)
      
      const currentUrl = this.page.url()
      if (currentUrl.includes('/new')) {
        console.warn('Still on form page after submission')
      } else {
        console.log(`✓ Supplier created successfully, navigated to: ${currentUrl}`)
      }
    } else {
      console.warn('Submit button not found')
    }
  }

  async viewSupplierDetail() {
    if (!this.page) throw new Error('Page not initialized')
    await this.navigateToSuppliers()
    await this.wait(1000)
    
    const firstSupplier = this.page.locator('a[href*="/suppliers/"], button:has-text("View")').first()
    if (await firstSupplier.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(firstSupplier)
      await this.wait(500)
      await firstSupplier.click()
      await this.wait(2000)
    }
  }

  // ========== MEDICINES ==========
  async navigateToMedicines() {
    await this.navigateAndWait('/medicines')
  }

  async createNewMedicine() {
    if (!this.page) throw new Error('Page not initialized')
    // Only navigate if not already on the page
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/medicines/new')) {
      await this.navigateAndWait('/medicines/new')
    }
    
    const nameInput = this.page.locator('input[name*="name"], input[placeholder*="Name"]').first()
    if (await nameInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(nameInput)
      await this.wait(300)
      await nameInput.fill('Demo Medicine')
      await this.wait(500)
    }

    const mrpInput = this.page.locator('input[name*="mrp"], input[name*="price"]').first()
    if (await mrpInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(mrpInput)
      await this.wait(300)
      await mrpInput.fill('100')
      await this.wait(500)
    }

    // Fill ALL fields in the form (not just required ones)
    await this.fillAllFields()
    await this.wait(1000)
    
    // Wait for all required fields to be filled
    await this.waitForRequiredFields()
    await this.wait(500)

    const submitButton = this.page.locator(
      'button[type="submit"], ' +
      'button:has-text("Create Medicine"), ' +
      'button:has-text("Create"), ' +
      'button:has-text("Save")'
    ).first()
    
    if (await submitButton.isVisible({ timeout: 5000 })) {
      await this.moveCursorToLocator(submitButton)
      await this.wait(500)
      
      const urlBefore = this.page.url()
      await submitButton.click()
      
      // Wait for URL to change
      try {
        await this.page.waitForFunction(
          (urlBefore) => {
            const currentUrl = window.location.href
            return currentUrl !== urlBefore && !currentUrl.includes('/new')
          },
          urlBefore,
          { timeout: 10000 }
        )
      } catch (e) {
        console.warn('Navigation timeout, checking current URL...')
      }
      
      await this.wait(2000)
      
      const currentUrl = this.page.url()
      if (currentUrl.includes('/new')) {
        console.warn('Still on form page after submission')
      } else {
        console.log(`✓ Medicine created successfully, navigated to: ${currentUrl}`)
      }
    } else {
      console.warn('Submit button not found')
    }
  }

  async viewMedicineDetail() {
    if (!this.page) throw new Error('Page not initialized')
    await this.navigateToMedicines()
    await this.wait(1000)
    
    const firstMedicine = this.page.locator('a[href*="/medicines/"], button:has-text("View")').first()
    if (await firstMedicine.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(firstMedicine)
      await this.wait(500)
      await firstMedicine.click()
      await this.wait(2000)
    }
  }

  // ========== SALES ==========
  async navigateToSales() {
    await this.navigateAndWait('/sales')
  }

  async createNewSale() {
    if (!this.page) throw new Error('Page not initialized')
    // Only navigate if not already on the page
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/sales/new')) {
      await this.navigateAndWait('/sales/new')
    }
    await this.wait(1000)
    
    // Wait for page to be ready
    const searchInput = this.page.locator('input[placeholder*="Search"], input[type="search"]').first()
    await searchInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  }

  async typeInSearchBar() {
    if (!this.page) throw new Error('Page not initialized')
    
    const searchInput = this.page.locator('input[placeholder*="Search"], input[type="search"]').first()
    if (await searchInput.isVisible({ timeout: 3000 })) {
      // Type character by character to make it look natural
      const searchText = 'paracetamol'
      await this.moveCursorToLocator(searchInput)
      await this.wait(300)
      await searchInput.click()
      await this.wait(200)
      
      // Type character by character with small delays
      for (let i = 0; i < searchText.length; i++) {
        await searchInput.type(searchText[i], { delay: 100 })
      }
      
      await this.wait(1500)
      
      const medicineOption = this.page.locator('text=/paracetamol/i').first()
      if (await medicineOption.isVisible({ timeout: 2000 })) {
        await this.moveCursorToLocator(medicineOption)
        await this.wait(500)
        await medicineOption.click()
        await this.wait(1000)
      }
    }
  }

  async completeSaleForm() {
    if (!this.page) throw new Error('Page not initialized')
    
    const quantityInput = this.page.locator('input[type="number"]').first()
    if (await quantityInput.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(quantityInput)
      await this.wait(300)
      await quantityInput.fill('2')
      await this.wait(500)
    }

    // Fill ALL fields in the form (not just required ones)
    await this.fillAllFields()
    await this.wait(1000)
    
    // Wait for all required fields to be filled
    await this.waitForRequiredFields()
    await this.wait(500)

    // Look for submit/complete button for sales
    const submitButton = this.page.locator(
      'button[type="submit"], ' +
      'button:has-text("Complete"), ' +
      'button:has-text("Create Sale"), ' +
      'button:has-text("Create"), ' +
      'button:has-text("Save")'
    ).first()
    
    if (await submitButton.isVisible({ timeout: 5000 })) {
      await this.moveCursorToLocator(submitButton)
      await this.wait(500)
      await submitButton.click()
      await this.wait(2000)
    }
    
    await this.wait(2000)
  }

  async viewSaleDetail() {
    if (!this.page) throw new Error('Page not initialized')
    await this.navigateToSales()
    await this.wait(1000)
    
    const firstSale = this.page.locator('a[href*="/sales/"], button:has-text("View")').first()
    if (await firstSale.isVisible({ timeout: 3000 })) {
      await this.moveCursorToLocator(firstSale)
      await this.wait(500)
      await firstSale.click()
      await this.wait(2000)
    }
  }

  async navigateToSalesReturns() {
    await this.navigateAndWait('/sales/returns')
  }

  async createSalesReturn() {
    if (!this.page) throw new Error('Page not initialized')
    // Only navigate if not already on the page
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/sales/returns/new')) {
      await this.navigateAndWait('/sales/returns/new')
    }
    await this.wait(1000)
    
    // Fill ALL fields in the form
    await this.fillAllFields()
    await this.wait(1000)
    
    // Wait for all required fields to be filled
    await this.waitForRequiredFields()
    await this.wait(500)
    
    const submitButton = this.page.locator(
      'button[type="submit"], ' +
      'button:has-text("Create"), ' +
      'button:has-text("Save")'
    ).first()
    
    if (await submitButton.isVisible({ timeout: 5000 })) {
      await this.moveCursorToLocator(submitButton)
      await this.wait(500)
      await submitButton.click()
      await this.wait(2000)
    }
  }

  // ========== PURCHASES ==========
  async navigateToPurchaseOrders() {
    await this.navigateAndWait('/purchases/orders')
  }

  async createPurchaseOrder() {
    if (!this.page) throw new Error('Page not initialized')
    // Only navigate if not already on the page
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/purchases/orders/new')) {
      await this.navigateAndWait('/purchases/orders/new')
    }
    await this.wait(1000)
    
    // Fill ALL fields in the form
    await this.fillAllFields()
    await this.wait(1000)
    
    // Wait for all required fields to be filled
    await this.waitForRequiredFields()
    await this.wait(500)
    
    const submitButton = this.page.locator(
      'button[type="submit"], ' +
      'button:has-text("Create"), ' +
      'button:has-text("Save")'
    ).first()
    
    if (await submitButton.isVisible({ timeout: 5000 })) {
      await this.moveCursorToLocator(submitButton)
      await this.wait(500)
      await submitButton.click()
      await this.wait(2000)
    }
  }

  async navigateToPurchaseReceipts() {
    await this.navigateAndWait('/purchases/receipts')
  }

  async createPurchaseReceipt() {
    if (!this.page) throw new Error('Page not initialized')
    // Only navigate if not already on the page
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/purchases/receipts/new')) {
      await this.navigateAndWait('/purchases/receipts/new')
    }
    await this.wait(1000)
    
    // Fill ALL fields in the form
    await this.fillAllFields()
    await this.wait(1000)
    
    // Wait for all required fields to be filled
    await this.waitForRequiredFields()
    await this.wait(500)
    
    const submitButton = this.page.locator(
      'button[type="submit"], ' +
      'button:has-text("Create"), ' +
      'button:has-text("Save")'
    ).first()
    
    if (await submitButton.isVisible({ timeout: 5000 })) {
      await this.moveCursorToLocator(submitButton)
      await this.wait(500)
      await submitButton.click()
      await this.wait(2000)
    }
  }

  async navigateToPurchaseReturns() {
    await this.navigateAndWait('/purchases/returns')
  }

  async createPurchaseReturn() {
    if (!this.page) throw new Error('Page not initialized')
    // Only navigate if not already on the page
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/purchases/returns/new')) {
      await this.navigateAndWait('/purchases/returns/new')
    }
    await this.wait(1000)
    
    // Fill ALL fields in the form
    await this.fillAllFields()
    await this.wait(1000)
    
    // Wait for all required fields to be filled
    await this.waitForRequiredFields()
    await this.wait(500)
    
    const submitButton = this.page.locator(
      'button[type="submit"], ' +
      'button:has-text("Create"), ' +
      'button:has-text("Save")'
    ).first()
    
    if (await submitButton.isVisible({ timeout: 5000 })) {
      await this.moveCursorToLocator(submitButton)
      await this.wait(500)
      await submitButton.click()
      await this.wait(2000)
    }
  }

  // ========== INVENTORY ==========
  async navigateToInventory() {
    await this.navigateAndWait('/inventory')
  }

  async navigateToInventoryAdjust() {
    await this.navigateAndWait('/inventory/adjust')
  }

  async navigateToInventoryTransfer() {
    await this.navigateAndWait('/inventory/transfer')
  }

  async navigateToInventoryAudit() {
    await this.navigateAndWait('/inventory/audit')
  }

  // ========== REPORTS ==========
  async navigateToReports() {
    await this.navigateAndWait('/reports')
  }

  async navigateToSalesReports() {
    await this.navigateAndWait('/reports/sales')
  }

  async navigateToPurchasesReports() {
    await this.navigateAndWait('/reports/purchases')
  }

  async navigateToInventoryReports() {
    await this.navigateAndWait('/reports/inventory')
  }

  // ========== FINANCIAL ==========
  async navigateToProfitLoss() {
    await this.navigateAndWait('/financial/profit-loss')
  }

  async navigateToBalanceSheet() {
    await this.navigateAndWait('/financial/balance-sheet')
  }

  async navigateToCashFlow() {
    await this.navigateAndWait('/financial/cash-flow')
  }

  async navigateToReceivables() {
    await this.navigateAndWait('/financial/receivable')
  }

  async navigateToPayables() {
    await this.navigateAndWait('/financial/payable')
  }

  async navigateToTaxReports() {
    await this.navigateAndWait('/financial/tax')
  }

  // ========== EXPIRY ==========
  async navigateToExpiry() {
    await this.navigateAndWait('/expiry')
  }

  async navigateToExpiryReports() {
    await this.navigateAndWait('/expiry/reports')
  }

  // ========== RETURNS ANALYTICS ==========
  async navigateToReturnsAnalytics() {
    await this.navigateAndWait('/returns/analytics')
  }

  // ========== ANALYTICS ==========
  async navigateToAnalytics() {
    await this.navigateAndWait('/analytics')
  }

  // ========== SETTINGS ==========
  async navigateToSettings() {
    await this.navigateAndWait('/settings')
  }

  async navigateToSettingsProfile() {
    await this.navigateAndWait('/settings/profile')
  }

  async navigateToSettingsStore() {
    await this.navigateAndWait('/settings/store')
  }

  async navigateToSettingsSystem() {
    await this.navigateAndWait('/settings/system')
  }

  // ========== DASHBOARD ==========
  async navigateToDashboard() {
    await this.navigateAndWait('/dashboard')
  }

  // Map audio files to their expected routes
  // Returns the route that should be active when this audio plays
  getExpectedRouteForAudio(audioFile: string): string | null {
    const routeMap: Record<string, string | null> = {
      'intro.mp3': null,  // Intro doesn't need a specific route - plays on login page
      'outro.mp3': '/api-docs',  // Outro plays after API docs
      'login.mp3': '/login',  // Login page
      'otp.mp3': '/otp',  // OTP verification page
      'dashboard.mp3': '/dashboard',  // Dashboard page
      'survekshan.mp3': '/survekshan',  // Surveys list page
      'surveys-detail.mp3': '/surveys/',  // Survey detail page (any survey ID)
      'sections.mp3': '/sections',  // Sections management page
      'questions.mp3': '/questions',  // Questions management page
      'officers.mp3': '/officers',  // Field officers page
      'access-requests.mp3': '/access-requests',  // Access requests page
      'admin-rate.mp3': '/admin/rate',  // Admin rate page
      'api-docs.mp3': '/api-docs',  // API documentation page
      'public.mp3': '/public',  // Public page
      'public-form.mp3': '/public-form',  // Public form page
      'public-survey-form.mp3': '/public-survey-form',  // Public survey form page
    }
    const route = routeMap[audioFile]
    // Return null if explicitly set to null (for intro) or if not found
    return route === undefined ? null : route
  }

  async verifyRouteBeforeAudio(audioFile: string): Promise<boolean> {
    if (!this.page) return false
    
    const expectedRoute = this.getExpectedRouteForAudio(audioFile)
    if (!expectedRoute) {
      // No route mapping - allow audio to play (might be a general audio)
      return true
    }
    
    const currentUrl = this.page.url()
    
    // Special handling for dynamic routes like /surveys/[id]
    // For surveys-detail, we check if URL matches /surveys/ followed by any ID
    if (audioFile === 'surveys-detail.mp3' && expectedRoute === '/surveys/') {
      const isOnSurveyDetail = /\/surveys\/\d+/.test(currentUrl)
      if (isOnSurveyDetail) {
        const surveyIdMatch = currentUrl.match(/\/surveys\/(\d+)/)
        const surveyId = surveyIdMatch ? surveyIdMatch[1] : 'unknown'
        console.log(`  ✅ Route verified: On survey detail page with ID: ${surveyId}`)
        return true
      } else {
        console.log(`  ⚠️ Route mismatch: Expected survey detail page (/surveys/[id]), but on ${currentUrl}`)
        // Try to navigate to a survey detail page by clicking on the first survey
        try {
          // First, make sure we're on the survekshan page
          if (!currentUrl.includes('/survekshan')) {
            await this.navigateAndWait('/survekshan')
            await this.waitForPageStable()
          }
          
          // Wait for DataTable to load
          await this.page.waitForSelector('table.dataTable, button.btn-outline-primary', { timeout: 10000 })
          await this.wait(1000)
          
          // Find and click the first view button
          const viewButton = this.page.locator('button.btn-outline-primary:has(i.bi-eye), button[title="पहा"], button[onclick*="handleViewSurvey"]').first()
          if (await viewButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await viewButton.click()
            await this.page.waitForURL('**/surveys/**', { timeout: 10000 })
            const newUrl = this.page.url()
            const newSurveyIdMatch = newUrl.match(/\/surveys\/(\d+)/)
            if (newSurveyIdMatch) {
              console.log(`  ✅ Successfully navigated to survey detail page with ID: ${newSurveyIdMatch[1]}`)
              return true
            }
          }
        } catch (error: any) {
          console.error(`  ❌ Navigation error: ${error.message}`)
          return false
        }
        return false
      }
    }
    
    // For other routes, use standard matching
    const isOnCorrectRoute = currentUrl.includes(expectedRoute)
    
    if (!isOnCorrectRoute) {
      console.log(`  ⚠️ Route mismatch: Expected ${expectedRoute}, but on ${currentUrl}`)
      console.log(`  🧭 Navigating to ${expectedRoute} before playing audio...`)
      
      try {
        await this.navigateAndWait(expectedRoute)
        // Verify navigation succeeded
        const newUrl = this.page.url()
        if (newUrl.includes(expectedRoute)) {
          console.log(`  ✅ Successfully navigated to ${expectedRoute}`)
          return true
        } else {
          console.log(`  ❌ Navigation failed: Still on ${newUrl}`)
          return false
        }
      } catch (error: any) {
        console.error(`  ❌ Navigation error: ${error.message}`)
        return false
      }
    }
    
    console.log(`  ✅ Route verified: On ${expectedRoute}`)
    return true
  }

  async run() {
    try {
      await this.init()

      const steps: DemoStep[] = [
        // INTRO - Play before starting demo
        {
          action: async () => {
            // Navigate to login page first (but don't interact yet)
            await this.page!.goto(`${DEMO_BASE_URL}/login`, { waitUntil: 'networkidle' })
            await this.page!.waitForFunction(
              () => document.body && document.body.innerHTML.length > 100,
              { timeout: 10000 }
            )
            await this.page!.waitForSelector('input[type="tel"]', { timeout: 10000, state: 'visible' })
            
            // Wait for page to be fully stable before playing intro
            await this.waitForPageStable()
            
            // Initialize visual enhancements
            await this.initVisualEnhancements()
            
            // Additional wait to ensure everything is ready
            await this.wait(1000)
          },
          audioFile: 'intro.mp3', // Intro audio plays AFTER page is fully loaded
          executeActionBeforeAudio: true, // Execute action (navigation) first, then play audio
          waitAfter: 1000,
          highlightSelector: 'body',
        },
        // AUDIO UNLOCK & LOGIN
        {
          action: async () => {
            // Ensure we're still on login page
            const currentUrl = this.page!.url()
            if (!currentUrl.includes('/login')) {
              await this.page!.goto(`${DEMO_BASE_URL}/login`, { waitUntil: 'networkidle' })
              await this.page!.waitForSelector('input[type="tel"]', { timeout: 10000, state: 'visible' })
            }
            await this.wait(500)
          },
          audioFile: '', // No audio here, login audio comes next
          waitAfter: 500,
        },
        {
          action: async () => {
            // Ensure we're on login page (should already be there from previous step)
            const currentUrl = this.page!.url()
            console.log(`Current route: ${currentUrl}`)
            
            if (!currentUrl.includes('/login')) {
              console.log('Navigating to /login...')
              await this.page!.goto(`${DEMO_BASE_URL}/login`, { waitUntil: 'networkidle' })
              await this.page!.waitForSelector('input[type="tel"]', { timeout: 10000, state: 'visible' })
            }

            // Auto-unlock audio with synthetic gesture (no manual click needed)
            console.log('Auto-unlocking audio with synthetic gesture...')
            await this.page!.evaluate(() => {
              // Create synthetic trusted click event
              const body = document.body
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                isTrusted: true
              } as any)
              body.dispatchEvent(clickEvent)
              
              // Also trigger focus
              body.focus()
              
              // Unlock audio immediately and save to localStorage (persists forever)
              window.__audioUnlocked = true
              localStorage.setItem('__demo_audio_unlocked', 'true')
              
              // Remove overlay if it exists
              const overlay = document.getElementById('__demo_audio_unlock')
              if (overlay) overlay.remove()
            })
            
            console.log('Audio unlocked! Current route:', this.page!.url())

            // Audio will play first (handled by main loop), then this action executes
            try {
              await this.login()
              
              // Verify we navigated to dashboard
              const currentUrl = this.page!.url()
              if (!currentUrl.includes('/dashboard')) {
                console.log('Not on dashboard after login, navigating...')
                await this.page!.goto(`${DEMO_BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
              }
              console.log(`Login successful! Current route: ${this.page!.url()}`)
            } catch (error: any) {
              console.log(`Login error (may have succeeded anyway): ${error.message}`)
              // Try to navigate to dashboard anyway
              const currentUrl = this.page!.url()
              if (!currentUrl.includes('/dashboard')) {
                await this.page!.goto(`${DEMO_BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
              }
            }
          },
          audioFile: 'login.mp3', // Audio plays FIRST, then action executes
          waitAfter: 1000,
        },

        // DASHBOARD
        {
          action: async () => {
            await this.navigateToDashboard()
          },
          audioFile: 'dashboard.mp3',
          waitAfter: 3000,
          highlightSelector: 'body',
        },

        // SURVEKSHAN (Surveys List)
        {
          action: async () => {
            console.log('  📋 Navigating to Survekshan page...')
            await this.navigateAndWait('/survekshan')
            console.log('  ✅ On Survekshan page')
          },
          audioFile: 'survekshan.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },
        {
          action: async () => {
            // Click on first survey to view details
            if (!this.page) throw new Error('Page not initialized')
            
            // Wait for DataTable to load
            await this.page.waitForSelector('table.dataTable, button.btn-outline-primary', { timeout: 10000 })
            await this.wait(1000) // Give DataTable time to render
            
            // Find the view button (the button with onclick that calls handleViewSurvey)
            // Look for button with eye icon or "पहा" title, or any button in the actions column
            const viewButton = this.page.locator('button.btn-outline-primary:has(i.bi-eye), button[title="पहा"], button[onclick*="handleViewSurvey"]').first()
            
            if (await viewButton.isVisible({ timeout: 5000 }).catch(() => false)) {
              // Extract survey ID from the button's onclick attribute before clicking
              const onclickAttr = await viewButton.getAttribute('onclick').catch(() => '') || ''
              const surveyIdMatch = onclickAttr.match(/handleViewSurvey\((\d+)\)/)
              const expectedSurveyId = surveyIdMatch ? surveyIdMatch[1] : null
              
              console.log(`  📋 Clicking survey view button${expectedSurveyId ? ` (ID: ${expectedSurveyId})` : ''}...`)
              
              await this.moveCursorToLocator(viewButton)
              await this.wait(300)
              await viewButton.click()
              
              // Wait for navigation to survey detail page with ID
              if (expectedSurveyId) {
                await this.page.waitForURL(`**/surveys/${expectedSurveyId}`, { timeout: 10000 })
                const currentUrl = this.page.url()
                if (currentUrl.includes(`/surveys/${expectedSurveyId}`)) {
                  console.log(`  ✅ Successfully navigated to survey detail page with ID: ${expectedSurveyId}`)
                } else {
                  console.log(`  ⚠️ Navigation may have failed. Expected ID ${expectedSurveyId}, but URL is: ${currentUrl}`)
                }
              } else {
                // Fallback: just wait for any /surveys/ URL
                await this.page.waitForURL('**/surveys/**', { timeout: 10000 })
                const currentUrl = this.page.url()
                const urlIdMatch = currentUrl.match(/\/surveys\/(\d+)/)
                if (urlIdMatch) {
                  console.log(`  ✅ Navigated to survey detail page with ID: ${urlIdMatch[1]}`)
                }
              }
              
              await this.waitForPageStable()
            } else {
              console.log('  ⚠️ Survey view button not found, trying alternative selectors...')
              // Fallback: try clicking any link or button that might navigate to surveys
              const fallbackLink = this.page.locator('a[href*="/surveys/"]').first()
              if (await fallbackLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                await fallbackLink.click()
                await this.page.waitForURL('**/surveys/**', { timeout: 10000 })
                await this.waitForPageStable()
              }
            }
          },
          audioFile: 'surveys-detail.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },

        // SECTIONS
        {
          action: async () => {
            console.log('  📋 Navigating to Sections page...')
            await this.navigateAndWait('/sections')
            console.log('  ✅ On Sections page')
          },
          audioFile: 'sections.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },

        // QUESTIONS
        {
          action: async () => {
            console.log('  📋 Navigating to Questions page...')
            await this.navigateAndWait('/questions')
            console.log('  ✅ On Questions page')
          },
          audioFile: 'questions.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },

        // OFFICERS (Field Officers)
        {
          action: async () => {
            console.log('  📋 Navigating to Officers page...')
            await this.navigateAndWait('/officers')
            console.log('  ✅ On Officers page')
          },
          audioFile: 'officers.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },

        // ACCESS REQUESTS
        {
          action: async () => {
            console.log('  📋 Navigating to Access Requests page...')
            await this.navigateAndWait('/access-requests')
            console.log('  ✅ On Access Requests page')
          },
          audioFile: 'access-requests.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },

        // ADMIN RATE
        {
          action: async () => {
            console.log('  📋 Navigating to Admin Rate page...')
            await this.navigateAndWait('/admin/rate')
            console.log('  ✅ On Admin Rate page')
          },
          audioFile: 'admin-rate.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },

        // API DOCS
        {
          action: async () => {
            console.log('  📋 Navigating to API Docs page...')
            await this.navigateAndWait('/api-docs')
            console.log('  ✅ On API Docs page')
          },
          audioFile: 'api-docs.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },
        // OUTRO - Play at the end after API docs
        {
          action: async () => {
            // Stay on API docs page for outro
            const currentUrl = this.page!.url()
            if (!currentUrl.includes('/api-docs')) {
              await this.navigateAndWait('/api-docs')
              await this.waitForPageStable()
            }
            await this.wait(500)
          },
          audioFile: 'outro.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },
      ]

      for (const step of steps) {
        if (step.audioFile) {
          console.log(`Executing step with audio: ${step.audioFile}`)
        } else if (step.action.toString().includes('playAudio')) {
          console.log(`Executing step: login (audio in action)`)
        } else {
          console.log(`Executing step: setup/initialization`)
        }
        
        // Log current route before step
        if (this.page) {
          const routeBefore = this.page.url()
          console.log(`  Route before step: ${routeBefore}`)
        }
        
        try {
          // Ensure visual enhancements are initialized (skip if already done on login)
          // Only initialize if not already initialized to avoid unnecessary work
          const isInitialized = await this.page!.evaluate(() => {
            return !!(window.__demoEnhancements && window.__demoCursor)
          })
          
          if (!isInitialized) {
            await this.initVisualEnhancements()
            await this.wait(500)
          } else {
            // Just ensure cursor is visible
            await this.page!.evaluate(() => {
              const cursor = document.getElementById('__demo_cursor')
              if (cursor && cursor.style.display === 'none') {
                cursor.style.display = ''
              }
            })
          }
          
          // ============================================================
          // SPECIAL HANDLING: Intro step executes action first, then audio
          // ============================================================
          if (step.executeActionBeforeAudio && step.audioFile) {
            // For intro: Execute action first (navigate to page), then play audio
            console.log(`  🎬 Executing action first (intro step), then playing audio...`)
            await step.action()
            await this.waitForPageStable()
            
            // Now play audio after page is loaded
            console.log(`  🔍 Verifying route before playing: ${step.audioFile}`)
            const routeVerified = await this.verifyRouteBeforeAudio(step.audioFile)
            if (routeVerified) {
              console.log(`  🔊 Playing audio after page loaded: ${step.audioFile}`)
              await this.playAudio(step.audioFile)
              console.log(`  ✅ Audio finished completely`)
            } else {
              console.error(`  ❌ Route verification failed for ${step.audioFile}, skipping audio`)
            }
          } else {
            // ============================================================
            // ROUTE VERIFICATION: Check route before playing audio
            // ============================================================
            // Verify we're on the correct route before playing audio
            // If not on the correct route, navigate first
            if (step.audioFile) {
              await this.waitForPageStable()
              console.log(`  🔍 Verifying route before playing: ${step.audioFile}`)
              
              const routeVerified = await this.verifyRouteBeforeAudio(step.audioFile)
              if (!routeVerified) {
                console.error(`  ❌ Route verification failed for ${step.audioFile}, skipping audio`)
                // Continue with action anyway - might still work
              } else {
                // ============================================================
                // AUDIO FIRST: Always play audio first, wait for it to finish
                // ============================================================
                // Audio plays FIRST, then waits for it to COMPLETELY finish
                // before executing any action. This ensures users hear the
                // explanation before seeing the action.
                console.log(`  🔊 Playing audio first: ${step.audioFile}`)
                await this.playAudio(step.audioFile) // Blocks until audio finishes (onended event)
                console.log(`  ✅ Audio finished completely, starting action...`)
              }
            }
            
            // ============================================================
            // ACTION: Execute action AFTER audio has finished
            // ============================================================
            await step.action()
          }
          
          // Log route after action
          if (this.page) {
            const routeAfter = this.page.url()
            console.log(`  Route after step: ${routeAfter}`)
          }
          
          // Wait after action
          await this.wait(step.waitAfter || 1000)
          
          // Handle highlights after action
          if (step.highlightSelector && step.highlightSelector !== 'body') {
            await this.moveCursorTo(step.highlightSelector)
            await this.wait(300)
            await this.highlightElement(step.highlightSelector, 2500)
          } else if (step.highlightSelector === 'body') {
            await this.idleCursor(500)
          }
        } catch (error) {
          const currentRoute = this.page?.url() || 'unknown'
          console.error(`Error in step ${step.audioFile || 'unknown'}:`, error)
          console.error(`  Current route when error occurred: ${currentRoute}`)
          
          // Don't stop if we're already on the target route (e.g., dashboard after login)
          const isOnTargetRoute = 
            (step.audioFile === 'login.mp3' && currentRoute.includes('/dashboard')) ||
            (step.audioFile === 'dashboard.mp3' && currentRoute.includes('/dashboard'))
          
          if (isOnTargetRoute) {
            console.log('  ⚠️ Error occurred but we\'re on the correct route, continuing...')
            await this.wait(2000)
            continue
          }
          
          // Stop demo on critical failures (but not if we're on the right page)
          if (error instanceof Error && (
            (error.message.includes('login') && !currentRoute.includes('/dashboard')) ||
            (error.message.includes('navigation') && !currentRoute.includes('/dashboard')) ||
            (error.message.includes('Timeout') && !currentRoute.includes('/dashboard') && currentRoute.includes('/login'))
          )) {
            console.error('Critical error detected. Stopping demo.')
            throw error
          }
          
          await this.wait(2000)
        }
      }

      console.log('Demo completed. Waiting 3 seconds before closing...')
      await this.wait(3000)
    } catch (error) {
      console.error('Demo error:', error)
      throw error
    } finally {
      await this.cleanup()
    }
  }
}

async function main() {
  const runner = new ComprehensiveDemoRunner()
  await runner.run()
}

main().catch(console.error)

