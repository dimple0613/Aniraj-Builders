import puppeteer, { Browser, Page } from 'puppeteer';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { existsSync, writeFileSync, unlinkSync } from "fs"
import { env } from 'process';
import { pathToFileURL } from 'url';

interface BrowserPool {
    browser: Browser;
    inUse: boolean;
    lastUsed: number;
}

class PuppeteerManager {
    private static instance: PuppeteerManager;
    private pool: BrowserPool | null = null;
    private maxIdleTime = 60000;
    private maxRetries = 2;
    private launchTimeout = 120000;

    private constructor() { }

    static getInstance(): PuppeteerManager {
        if (!PuppeteerManager.instance) {
            PuppeteerManager.instance = new PuppeteerManager();
        }
        return PuppeteerManager.instance;
    }

    private async getChromePath(): Promise<string> {

        const envPath = env.CHROME_PATH;
        if (envPath && existsSync(envPath)) {
            return envPath;
        }

        // Docker / Linux
        if (process.platform === "linux") {
            const linuxPaths = [
                "/usr/bin/chromium",
                "/usr/bin/chromium-browser",
                "/usr/bin/google-chrome"
            ];

            for (const p of linuxPaths) {
                if (existsSync(p)) {
                    return p;
                }
            }
        }

        // Windows
        if (process.platform === "win32") {
            const winPaths = [
                join(
                    homedir(),
                    ".cache",
                    "puppeteer",
                    "chrome",
                    "win64-146.0.7680.66",
                    "chrome-win64",
                    "chrome.exe"
                ),
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
            ];

            for (const p of winPaths) {
                if (existsSync(p)) {
                    return p;
                }
            }
        }
        throw new Error("Chrome executable not found");
    }

    private async launchBrowser(): Promise<Browser> {
        const executablePath = await this.getChromePath().catch(() => undefined);

        return puppeteer.launch({
            headless: true,
            ...(executablePath ? { executablePath } : {}),

            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--no-zygote",
                "--disable-features=UseDBus",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-default-apps",
                "--disable-translate",
                "--disable-renderer-backgrounding",
                "--memory-pressure-off",
                "--js-flags=--max-old-space-size=512",
            ],

            timeout: 60000,
            protocolTimeout: 60000,

            defaultViewport: {
                width: 1200,
                height: 800,
            },
        });
    } 
    
    async getBrowser(): Promise<Browser> {
        if (this.pool?.browser?.connected) {
            if (!this.pool.inUse) {
                this.pool.inUse = true;
                this.pool.lastUsed = Date.now();
                return this.pool.browser;
            }
            if (Date.now() - this.pool.lastUsed > this.maxIdleTime) {
                await this.cleanup();
            }
        }

        this.pool = {
            browser: await this.launchBrowser(),
            inUse: true,
            lastUsed: Date.now(),
        };

        this.pool.browser.on('disconnected', () => {
            this.pool = null;
        });

        return this.pool.browser;
    }

    releaseBrowser(): void {
        if (this.pool) {
            this.pool.inUse = false;
            this.pool.lastUsed = Date.now();
        }
    }

    async cleanup(): Promise<void> {
        if (this.pool?.browser) {
            try {
                await this.pool.browser.close();
            } catch (e) {
                console.error('Error closing browser:', e);
            }
            this.pool = null;
        }
    }

    async generatePDF(
        html: string,
        options: {
            margin?: { top: string; bottom: string; left: string; right: string };
            format?: 'A4' | 'Letter';
        } = {}
    ): Promise<Buffer> {
        let browser: Browser | null = null;
        let page: Page | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                browser = await this.getBrowser();
                page = await browser.newPage();

                await page.setContent(html, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });

                await page.evaluate(() => {
                    return new Promise<void>((resolve) => {
                        if (document.readyState === 'complete') {
                            resolve();
                        } else {
                            window.addEventListener('load', () => resolve());
                        }
                    });
                });

                const pdf = await page.pdf({
                    format: options.format || 'A4',
                    printBackground: true,
                    margin: options.margin || {
                        top: '20px',
                        bottom: '20px',
                        left: '20px',
                        right: '20px'
                    },
                    timeout: 45000,
                });

                return Buffer.from(pdf);

            } catch (error) {
                lastError = error as Error;
                console.error(`PDF generation attempt ${attempt} failed:`, error);

                if (page) {
                    try { await page.close(); } catch (e) { }
                    page = null;
                }

                if (attempt < this.maxRetries) {
                    await this.cleanup();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } finally {
                if (page) {
                    try { await page.close(); } catch (e) { }
                }
                if (browser) {
                    this.releaseBrowser();
                }
            }
        }

        throw lastError || new Error('PDF generation failed after retries');
    }

    async generatePDFFromFile(
        html: string,
        options: {
            margin?: { top: string; bottom: string; left: string; right: string };
            format?: 'A4' | 'Letter';
        } = {}
    ): Promise<Buffer> {
        let browser: Browser | null = null;
        let page: Page | null = null;
        let lastError: Error | null = null;
        let tmpFilePath: string | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                browser = await this.getBrowser();
                page = await browser.newPage();

                const tmpName = `puppeteer_${Date.now()}_${Math.random().toString(36).slice(2)}.html`;
                tmpFilePath = join(tmpdir(), tmpName);
                writeFileSync(tmpFilePath, html, 'utf-8');

                const fileUrl = pathToFileURL(tmpFilePath).href;
                await page.goto(fileUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000,
                });

                const pdf = await page.pdf({
                    format: options.format || 'A4',
                    printBackground: true,
                    margin: options.margin || {
                        top: '20px',
                        bottom: '20px',
                        left: '20px',
                        right: '20px'
                    },
                    timeout: 120000,
                });

                return Buffer.from(pdf);

            } catch (error) {
                lastError = error as Error;
                console.error(`PDF generation (file) attempt ${attempt} failed:`, error);

                if (page) {
                    try { await page.close(); } catch (e) { }
                    page = null;
                }

                if (attempt < this.maxRetries) {
                    await this.cleanup();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } finally {
                if (page) {
                    try { await page.close(); } catch (e) { }
                }
                if (browser) {
                    this.releaseBrowser();
                }
                if (tmpFilePath) {
                    try { unlinkSync(tmpFilePath); } catch (e) { }
                }
            }
        }

        throw lastError || new Error('PDF generation failed after retries');
    }

    async generateMultiplePDFFromFiles(
        htmlPages: string[],
        options: {
            margin?: { top: string; bottom: string; left: string; right: string };
            format?: 'A4' | 'Letter';
        } = {}
    ): Promise<Buffer[]> {
        let browser: Browser | null = null;
        const results: Buffer[] = [];

        try {
            browser = await this.getBrowser();

            for (const html of htmlPages) {
                let page: Page | null = null;
                try {
                    page = await browser.newPage();

                    await page.setContent(html, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000,
                    });

                    await page.waitForFunction('document.readyState === "complete"', { timeout: 10000 }).catch(() => {});

                    const pdf = await page.pdf({
                        format: options.format || 'A4',
                        printBackground: true,
                        margin: options.margin || {
                            top: '20px',
                            bottom: '20px',
                            left: '20px',
                            right: '20px'
                        },
                        timeout: 60000,
                    });

                    results.push(Buffer.from(pdf));
                } catch (error) {
                    console.error('Single page PDF failed, skipping:', error);
                    results.push(Buffer.alloc(0));
                } finally {
                    if (page) {
                        try { await page.close(); } catch (e) { }
                    }
                }
            }

            return results;
        } catch (error) {
            console.error('Batch PDF generation failed:', error);
            throw error;
        } finally {
            if (browser) {
                this.releaseBrowser();
            }
        }
    }
}

export const puppeteerManager = PuppeteerManager.getInstance();
export { Browser, Page };
