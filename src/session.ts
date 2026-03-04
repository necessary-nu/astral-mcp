import { type Browser, launch, type Page } from "@astral/astral";

export type Celestial = ReturnType<Page["unsafelyGetCelestialBindings"]>;

export interface ConsoleEntry {
  type: string;
  text: string;
  timestamp: number;
}

export interface PageErrorEntry {
  message: string;
  timestamp: number;
}

export interface NetworkEntry {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  mimeType?: string;
  timestamp: number;
}

export interface TrackedPage {
  id: number;
  page: Page;
  celestial: Celestial;
  createdAt: number;
  consoleLogs: ConsoleEntry[];
  pageErrors: PageErrorEntry[];
  networkLog: NetworkEntry[];
  stylesheets: Map<string, { sourceURL: string; origin: string }>;
}

const MAX_BUFFER = 500;

function pushCapped<T>(arr: T[], item: T) {
  if (arr.length >= MAX_BUFFER) arr.shift();
  arr.push(item);
}

export class Session {
  #browser: Browser | null = null;
  #pages = new Map<number, TrackedPage>();
  #activePageId = -1;
  #nextPageId = 0;

  async getBrowser(): Promise<Browser> {
    if (!this.#browser || this.#browser.closed) {
      this.#browser = await launch();
    }
    return this.#browser;
  }

  async getActivePage(): Promise<TrackedPage> {
    const tracked = this.#pages.get(this.#activePageId);
    if (!tracked) {
      return await this.newPage();
    }
    return tracked;
  }

  async getPage(pageId?: number): Promise<TrackedPage> {
    if (pageId === undefined) return this.getActivePage();
    const tracked = this.#pages.get(pageId);
    if (!tracked) throw new Error(`No page with id ${pageId}`);
    return tracked;
  }

  async newPage(url?: string): Promise<TrackedPage> {
    const browser = await this.getBrowser();
    const page = await browser.newPage(url);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const celestial = page.unsafelyGetCelestialBindings();

    const id = this.#nextPageId++;
    const tracked: TrackedPage = {
      id,
      page,
      celestial,
      createdAt: Date.now(),
      consoleLogs: [],
      pageErrors: [],
      networkLog: [],
      stylesheets: new Map(),
    };

    // Buffer console events
    page.addEventListener("console", (e) => {
      pushCapped(tracked.consoleLogs, {
        type: e.detail.type,
        text: e.detail.text,
        timestamp: Date.now(),
      });
    });

    // Buffer page errors
    page.addEventListener("pageerror", (e) => {
      pushCapped(tracked.pageErrors, {
        message: e.detail.message,
        timestamp: Date.now(),
      });
    });

    // Buffer network requests
    celestial.addEventListener("Network.requestWillBeSent", (e) => {
      const { request, type } = e.detail;
      pushCapped(tracked.networkLog, {
        url: request.url,
        method: request.method,
        resourceType: type ?? "Other",
        timestamp: Date.now(),
      });
    });

    celestial.addEventListener("Network.responseReceived", (e) => {
      const { response, type } = e.detail;
      // Find the matching request and update it with response info
      const entry = [...tracked.networkLog].reverse().find(
        (n) => n.url === response.url && n.status === undefined,
      );
      if (entry) {
        entry.status = response.status;
        entry.statusText = response.statusText;
        entry.mimeType = response.mimeType;
        entry.resourceType = type ?? entry.resourceType;
      }
    });

    // Enable CSS and DOM domains for style queries
    await celestial.CSS.enable();
    await celestial.DOM.enable({});

    celestial.addEventListener("CSS.styleSheetAdded", (e) => {
      const { styleSheetId, sourceURL, origin } = e.detail.header;
      tracked.stylesheets.set(styleSheetId, { sourceURL, origin });
    });

    this.#pages.set(id, tracked);
    this.#activePageId = id;
    return tracked;
  }

  async closePage(pageId: number): Promise<void> {
    const tracked = this.#pages.get(pageId);
    if (!tracked) throw new Error(`No page with id ${pageId}`);
    await tracked.page.close();
    this.#pages.delete(pageId);
    if (this.#activePageId === pageId) {
      const ids = [...this.#pages.keys()];
      this.#activePageId = ids.length > 0 ? ids[ids.length - 1] : -1;
    }
  }

  setActivePage(pageId: number): void {
    if (!this.#pages.has(pageId)) throw new Error(`No page with id ${pageId}`);
    this.#activePageId = pageId;
  }

  listPages(): { id: number; url: string; isActive: boolean }[] {
    return [...this.#pages.entries()].map(([id, t]) => ({
      id,
      url: t.page.url,
      isActive: id === this.#activePageId,
    }));
  }

  async restart(): Promise<{ pagesLost: number }> {
    const pagesLost = this.#pages.size;
    try {
      if (this.#browser && !this.#browser.closed) {
        await this.#browser.close();
      }
    } catch {
      // Browser may be unresponsive — ignore close errors
    }
    this.#browser = null;
    this.#pages.clear();
    this.#activePageId = -1;
    await this.getBrowser();
    return { pagesLost };
  }

  async close(): Promise<void> {
    if (this.#browser && !this.#browser.closed) {
      await this.#browser.close();
    }
    this.#browser = null;
    this.#pages.clear();
    this.#activePageId = -1;
  }
}
