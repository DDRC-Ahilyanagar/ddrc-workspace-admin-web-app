import { chromium, Browser, Page } from 'playwright'

const DEMO_BASE_URL = process.env.DEMO_URL || 'http://localhost:3000'
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'admin@example.com'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'admin123'

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
  playAudioBeforeAction?: boolean
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

    const audioUrl = `${DEMO_BASE_URL}/demo-recording/${audioFile}`

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

    const audioUrl = `${DEMO_BASE_URL}/demo-recording/${audioFile}`

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
    await this.page.goto(`${DEMO_BASE_URL}${url}`, { waitUntil: 'networkidle' })
    await this.page.waitForFunction(
      () => document.body && document.body.innerHTML.length > 100,
      { timeout: 10000 }
    )
    if (selector) {
      await this.page.waitForSelector(selector, { timeout: 10000, state: 'visible' })
    }
    // Re-initialize visual enhancements after navigation
    await this.initVisualEnhancements()
    await this.idleCursor(500)
    await this.wait(1500)
  }

  async login() {
    if (!this.page) throw new Error('Page not initialized')
    
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/login')) {
      await this.page.goto(`${DEMO_BASE_URL}/login`, { waitUntil: 'networkidle' })
      await this.page.waitForSelector('input[type="email"]', { timeout: 10000 })
      await this.wait(1000)
    }

    await this.moveCursorTo('input[type="email"]')
    await this.wait(300)
    await this.page.fill('input[type="email"]', DEMO_EMAIL)
    await this.wait(500)
    
    await this.moveCursorTo('input[type="password"]')
    await this.wait(300)
    await this.page.fill('input[type="password"]', DEMO_PASSWORD)
    await this.wait(500)
    
    await this.moveCursorTo('button[type="submit"]')
    await this.wait(500)
    await this.page.click('button[type="submit"]')
    
    // Wait briefly to check if navigation occurred or validation error appeared
    await this.wait(1000)
    
    // Check if still on login page or validation error is visible
    const stillOnLogin = this.page.url().includes('/login')
    const hasValidationError = await this.page.evaluate(() => {
      const errorText = document.body.textContent || ''
      return errorText.includes('Password is required') || 
             errorText.includes('password is required') ||
             errorText.includes('Invalid') ||
             document.querySelector('[role="alert"]') !== null ||
             document.querySelector('.error') !== null ||
             document.querySelector('.text-red-500') !== null ||
             document.querySelector('.text-red-600') !== null
    }).catch(() => false)
    
    // If still on login page or validation error exists, retry with password fill
    if (stillOnLogin || hasValidationError) {
      console.log('Login validation error detected or still on login page, retrying...')
      
      // Move cursor to password field and ensure it's filled
      await this.moveCursorTo('input[type="password"]')
      await this.wait(300)
      
      // Clear and refill password field
      await this.page.fill('input[type="password"]', '')
      await this.wait(200)
      await this.page.fill('input[type="password"]', DEMO_PASSWORD)
      await this.wait(500)
      
      // Click login again
      await this.moveCursorTo('button[type="submit"]')
      await this.wait(500)
      await this.page.click('button[type="submit"]')
    }
    
    // Wait for navigation to dashboard
    await this.page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {})
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

  async run() {
    try {
      await this.init()

      const steps: DemoStep[] = [
        // AUDIO UNLOCK & LOGIN
        {
          action: async () => {
            await this.page!.goto(`${DEMO_BASE_URL}/login`, { waitUntil: 'networkidle' })
            await this.page!.waitForFunction(
              () => document.body && document.body.innerHTML.length > 100,
              { timeout: 10000 }
            )
            await this.page!.waitForSelector('input[type="email"]', { timeout: 10000, state: 'visible' })
            await this.page!.waitForSelector('input[type="password"]', { timeout: 10000, state: 'visible' })
            
            // Initialize visual enhancements
            await this.initVisualEnhancements()
            
            await this.wait(500)
          },
          audioFile: '', // No intro audio
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
              await this.page!.waitForSelector('input[type="email"]', { timeout: 10000, state: 'visible' })
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

            await this.playAudio('01_login.mp3') // MUST finish fully

            // Verify we're still on login before proceeding
            const routeAfterAudio = this.page!.url()
            console.log(`Route after audio: ${routeAfterAudio}`)
            if (!routeAfterAudio.includes('/login')) {
              throw new Error(`Expected to be on /login but was on ${routeAfterAudio}`)
            }

            await this.login() // type only AFTER audio ends
            
            // Verify we navigated to dashboard
            await this.page!.waitForURL('**/dashboard**', { timeout: 10000 })
            console.log(`Login successful! Current route: ${this.page!.url()}`)
          },
          audioFile: '',
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

        // CUSTOMERS SECTION
        {
          action: async () => {
            await this.navigateToCustomers()
          },
          audioFile: 'customers.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },
        {
          action: async () => {
            // Click the "Add Customer" button
            if (!this.page) throw new Error('Page not initialized')
            
            // Wait for the Add Customer button to be visible
            const addButton = this.page.locator(
              'a[href="/customers/new"], ' +
              'a[href*="/customers/new"], ' +
              'button:has-text("Add Customer"), ' +
              'a:has-text("Add Customer")'
            ).first()
            
            await addButton.waitFor({ state: 'visible', timeout: 10000 })
            await this.moveCursorToLocator(addButton)
            await this.wait(300)
            await addButton.click()
            
            // Wait for navigation to /customers/new
            await this.page.waitForURL('**/customers/new**', { timeout: 10000 })
            await this.waitForPageStable()
          },
          audioFile: '',
          waitAfter: 1000,
        },
        {
          action: async () => {
            // Ensure we're on the new customer page (should already be there from previous step)
            if (!this.page) throw new Error('Page not initialized')
            const currentUrl = this.page.url()
            if (!currentUrl.includes('/customers/new')) {
              await this.navigateToNewCustomerPage()
            }
          },
          audioFile: 'customers-new.mp3',
          playAudioBeforeAction: true,
          waitAfter: 1000,
          highlightSelector: 'input[placeholder*="Name"], input[name*="name"]',
        },
        {
          action: async () => {
            await this.fillAndSubmitCustomerForm()
          },
          audioFile: '',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.viewCustomerDetail()
          },
          audioFile: 'customers-detail.mp3',
          waitAfter: 2000,
        },

        // SUPPLIERS SECTION
        {
          action: async () => {
            await this.navigateToSuppliers()
          },
          audioFile: 'suppliers.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },
        {
          action: async () => {
            await this.clickAddButton('/suppliers/new', ['Add Supplier', 'New Supplier'])
          },
          audioFile: '',
          waitAfter: 1000,
        },
        {
          action: async () => {
            // Ensure we're on the new supplier page (should already be there from previous step)
            if (!this.page) throw new Error('Page not initialized')
            const currentUrl = this.page.url()
            if (!currentUrl.includes('/suppliers/new')) {
              await this.navigateAndWait('/suppliers/new')
              await this.waitForPageStable()
            }
            // Now fill the form
            await this.createNewSupplier()
          },
          audioFile: 'suppliers-new.mp3',
          playAudioBeforeAction: true,
          waitAfter: 3000,
        },
        {
          action: async () => {
            await this.viewSupplierDetail()
          },
          audioFile: 'suppliers-detail.mp3',
          waitAfter: 2000,
        },

        // MEDICINES SECTION
        {
          action: async () => {
            await this.navigateToMedicines()
          },
          audioFile: 'medicines.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },
        {
          action: async () => {
            await this.clickAddButton('/medicines/new', ['Add Medicine', 'New Medicine'])
          },
          audioFile: '',
          waitAfter: 1000,
        },
        {
          action: async () => {
            // Ensure we're on the new medicine page (should already be there from previous step)
            if (!this.page) throw new Error('Page not initialized')
            const currentUrl = this.page.url()
            if (!currentUrl.includes('/medicines/new')) {
              await this.navigateAndWait('/medicines/new')
              await this.waitForPageStable()
            }
            // Now fill the form
            await this.createNewMedicine()
          },
          audioFile: 'medicines-new.mp3',
          playAudioBeforeAction: true,
          waitAfter: 3000,
        },
        {
          action: async () => {
            await this.viewMedicineDetail()
          },
          audioFile: 'medicines-detail.mp3',
          waitAfter: 2000,
        },

        // SALES SECTION
        {
          action: async () => {
            await this.navigateToSales()
          },
          audioFile: 'sales.mp3',
          waitAfter: 2000,
          highlightSelector: 'body',
        },
        {
          action: async () => {
            await this.clickAddButton('/sales/new', ['New Sale', 'Add Sale', 'Create Sale'])
          },
          audioFile: '',
          waitAfter: 1000,
        },
        {
          action: async () => {
            // Ensure we're on the new sale page (should already be there from previous step)
            if (!this.page) throw new Error('Page not initialized')
            const currentUrl = this.page.url()
            if (!currentUrl.includes('/sales/new')) {
              await this.navigateAndWait('/sales/new')
              await this.waitForPageStable()
            }
            // Now fill the form
            await this.createNewSale()
          },
          audioFile: 'sales-new.mp3',
          playAudioBeforeAction: true,
          waitAfter: 3000,
          highlightSelector: 'input[placeholder*="Search"], input[type="search"]',
          // Type in search bar while audio is explaining about search
          typeInSearchDuringAudio: true,
        },
        {
          action: async () => {
            await this.viewSaleDetail()
          },
          audioFile: 'sales-detail.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToSalesReturns()
          },
          audioFile: 'sales-returns.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.clickAddButton('/sales/returns/new', ['New Return', 'Add Return', 'Create Return'])
          },
          audioFile: '',
          waitAfter: 1000,
        },
        {
          action: async () => {
            // Ensure we're on the new sales return page (should already be there from previous step)
            if (!this.page) throw new Error('Page not initialized')
            const currentUrl = this.page.url()
            if (!currentUrl.includes('/sales/returns/new')) {
              await this.navigateAndWait('/sales/returns/new')
              await this.waitForPageStable()
            }
            // Now fill the form
            await this.createSalesReturn()
          },
          audioFile: 'sales-returns-new.mp3',
          playAudioBeforeAction: true,
          waitAfter: 3000,
        },

        // PURCHASES SECTION
        {
          action: async () => {
            await this.navigateToPurchaseOrders()
          },
          audioFile: 'purchases-orders.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.clickAddButton('/purchases/orders/new', ['New Order', 'Add Order', 'Create Order'])
          },
          audioFile: '',
          waitAfter: 1000,
        },
        {
          action: async () => {
            // Ensure we're on the new purchase order page (should already be there from previous step)
            if (!this.page) throw new Error('Page not initialized')
            const currentUrl = this.page.url()
            if (!currentUrl.includes('/purchases/orders/new')) {
              await this.navigateAndWait('/purchases/orders/new')
              await this.waitForPageStable()
            }
            // Now fill the form
            await this.createPurchaseOrder()
          },
          audioFile: 'purchases-orders-new.mp3',
          playAudioBeforeAction: true,
          waitAfter: 3000,
        },
        {
          action: async () => {
            await this.navigateToPurchaseReceipts()
          },
          audioFile: 'purchases-receipts.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.clickAddButton('/purchases/receipts/new', ['New Receipt', 'Add Receipt', 'Create Receipt'])
          },
          audioFile: '',
          waitAfter: 1000,
        },
        {
          action: async () => {
            // Ensure we're on the new purchase receipt page (should already be there from previous step)
            if (!this.page) throw new Error('Page not initialized')
            const currentUrl = this.page.url()
            if (!currentUrl.includes('/purchases/receipts/new')) {
              await this.navigateAndWait('/purchases/receipts/new')
              await this.waitForPageStable()
            }
            // Now fill the form
            await this.createPurchaseReceipt()
          },
          audioFile: 'purchases-receipts-new.mp3',
          playAudioBeforeAction: true,
          waitAfter: 3000,
        },
        {
          action: async () => {
            await this.navigateToPurchaseReturns()
          },
          audioFile: 'purchases-returns.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.clickAddButton('/purchases/returns/new', ['New Return', 'Add Return', 'Create Return'])
          },
          audioFile: '',
          waitAfter: 1000,
        },
        {
          action: async () => {
            // Ensure we're on the new purchase return page (should already be there from previous step)
            if (!this.page) throw new Error('Page not initialized')
            const currentUrl = this.page.url()
            if (!currentUrl.includes('/purchases/returns/new')) {
              await this.navigateAndWait('/purchases/returns/new')
              await this.waitForPageStable()
            }
            // Now fill the form
            await this.createPurchaseReturn()
          },
          audioFile: 'purchases-returns-new.mp3',
          playAudioBeforeAction: true,
          waitAfter: 3000,
        },

        // INVENTORY SECTION
        {
          action: async () => {
            await this.navigateToInventory()
          },
          audioFile: 'inventory.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToInventoryAdjust()
          },
          audioFile: 'inventory-adjust.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToInventoryTransfer()
          },
          audioFile: 'inventory-transfer.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToInventoryAudit()
          },
          audioFile: 'inventory-audit.mp3',
          waitAfter: 2000,
        },

        // EXPIRY SECTION
        {
          action: async () => {
            await this.navigateToExpiry()
          },
          audioFile: 'expiry-management.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToExpiryReports()
          },
          audioFile: 'expiry-reports.mp3',
          waitAfter: 2000,
        },

        // REPORTS SECTION
        {
          action: async () => {
            await this.navigateToReports()
          },
          audioFile: 'reports.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToSalesReports()
          },
          audioFile: 'reports-sales.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToPurchasesReports()
          },
          audioFile: 'reports-purchases.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToInventoryReports()
          },
          audioFile: 'reports-inventory.mp3',
          waitAfter: 2000,
        },

        // FINANCIAL SECTION
        {
          action: async () => {
            await this.navigateToProfitLoss()
          },
          audioFile: 'profit-loss.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToBalanceSheet()
          },
          audioFile: 'balance-sheet.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToCashFlow()
          },
          audioFile: 'cash-flow.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToReceivables()
          },
          audioFile: 'accounts-receivable.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToPayables()
          },
          audioFile: 'accounts-payable.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToTaxReports()
          },
          audioFile: 'tax-reports.mp3',
          waitAfter: 2000,
        },

        // RETURNS ANALYTICS
        {
          action: async () => {
            await this.navigateToReturnsAnalytics()
          },
          audioFile: 'return-analytics.mp3',
          waitAfter: 2000,
        },

        // ANALYTICS
        {
          action: async () => {
            await this.navigateToAnalytics()
          },
          audioFile: 'advanced-analytics.mp3',
          waitAfter: 2000,
        },

        // SETTINGS SECTION
        {
          action: async () => {
            await this.navigateToSettings()
          },
          audioFile: 'settings.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToSettingsProfile()
          },
          audioFile: 'settings-profile.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToSettingsStore()
          },
          audioFile: 'settings-store.mp3',
          waitAfter: 2000,
        },
        {
          action: async () => {
            await this.navigateToSettingsSystem()
          },
          audioFile: 'settings-system.mp3',
          waitAfter: 2000,
        },

        // OUTRO
        {
          action: async () => {
            // Ensure we're on a page (stay on current page or go to dashboard)
            if (!this.page!.url().includes('/dashboard')) {
              await this.navigateToDashboard()
            }
            await this.wait(1000)
          },
          audioFile: '08_outro.mp3',
          waitAfter: 2000,
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
          
          // Play audio before action if requested
          if (step.playAudioBeforeAction && step.audioFile) {
            await this.waitForPageStable()
            await this.playAudio(step.audioFile)
          }
          
          // Execute action
          await step.action()
          
          // Log route after action
          if (this.page) {
            const routeAfter = this.page.url()
            console.log(`  Route after step: ${routeAfter}`)
          }
          
          // Play audio after action (if audioFile exists and not already played)
          if (step.audioFile && !step.playAudioBeforeAction) {
            await this.playAudio(step.audioFile)
          }
          
          // Wait after audio or after action
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
          
          // Stop demo on critical failures (login, navigation errors)
          if (error instanceof Error && (
            error.message.includes('login') ||
            error.message.includes('navigation') ||
            error.message.includes('Timeout') ||
            currentRoute.includes('/login')
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

