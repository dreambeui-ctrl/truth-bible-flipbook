'use client';

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Minimize,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PublicationPage = {
  number: number;
  src: string;
};

type PublicationManifest = {
  title: string;
  edition: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  aspectRatio: number;
  pdfUrl?: string | null;
  pages: PublicationPage[];
};

type FlipEvent<T> = {
  data: T;
};

type PageFlipApi = {
  destroy: () => void;
  update: () => void;
  loadFromHTML: (pages: HTMLElement[]) => void;
  flipNext: (corner?: 'top' | 'bottom') => void;
  flipPrev: (corner?: 'top' | 'bottom') => void;
  getCurrentPageIndex: () => number;
  getOrientation: () => 'portrait' | 'landscape';
  on: <T>(event: string, callback: (event: FlipEvent<T>) => void) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

function publicAssetUrl(path: string | null | undefined) {
  if (!path) return '';
  if (
    /^(?:[a-z]+:)?\/\//i.test(path) ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path;
  }
  return new URL(path.replace(/^\/+/, ''), document.baseURI).pathname;
}

function formatPageNumber(page: number) {
  return String(page).padStart(2, '0');
}

function hydrateAround(images: HTMLImageElement[], center: number, radius = 3) {
  const start = Math.max(0, center - radius);
  const end = Math.min(images.length - 1, center + radius);

  for (let index = start; index <= end; index += 1) {
    const image = images[index];
    if (!image.src && image.dataset.src) {
      image.src = image.dataset.src;
      image.removeAttribute('data-src');
    }
  }
}

export function FlipbookViewer() {
  const shellRef = useRef<HTMLElement>(null);
  const flipbookMountRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<PageFlipApi | null>(null);
  const pageImagesRef = useRef<HTMLImageElement[]>([]);
  const manifestRef = useRef<PublicationManifest | null>(null);
  const currentPageRef = useRef(0);

  const [manifest, setManifest] = useState<PublicationManifest | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    'portrait',
  );
  const [loadedPages, setLoadedPages] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [statusMessage, setStatusMessage] = useState('Preparing publication');
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      setError(null);
      setStatusMessage('Loading publication details');
      setIsReady(false);

      try {
        const response = await fetch(
          publicAssetUrl('/publication/manifest.json'),
          {
            cache: 'force-cache',
          },
        );

        if (!response.ok) {
          throw new Error(`Publication manifest returned ${response.status}`);
        }

        const data = (await response.json()) as PublicationManifest;

        if (!data.pages?.length || data.pageCount !== data.pages.length) {
          throw new Error('Publication manifest is incomplete');
        }

        if (!cancelled) {
          manifestRef.current = data;
          setManifest(data);
          setStatusMessage('Building the book');
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setError(
            'The publication could not be prepared. Please check your connection and try again.',
          );
        }
      }
    }

    void loadManifest();
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  useEffect(() => {
    if (!manifest || !flipbookMountRef.current) {
      return;
    }

    let cancelled = false;
    let activeFlip: PageFlipApi | null = null;
    const mount = flipbookMountRef.current;
    const aspectRatio = manifest.aspectRatio;
    const bookRoot = document.createElement('div');
    bookRoot.className = 'flipbook-host';
    mount.replaceChildren(bookRoot);

    const pageElements = manifest.pages.map((page, index) => {
      const pageElement = document.createElement('div');
      pageElement.className = 'publication-page';
      pageElement.dataset.pageNumber = String(page.number);

      if (index === 0 || index === manifest.pages.length - 1) {
        pageElement.dataset.density = 'hard';
      }

      const image = document.createElement('img');
      image.alt = `${manifest.title} ${manifest.edition}, page ${page.number}`;
      image.decoding = 'async';
      image.draggable = false;
      const pageUrl = publicAssetUrl(page.src);
      image.dataset.src = pageUrl;

      if (index <= 3) {
        image.src = pageUrl;
        image.removeAttribute('data-src');
      }

      image.addEventListener('load', () => {
        setLoadedPages((count) => Math.min(manifest.pageCount, count + 1));
        pageElement.classList.add('is-loaded');
      });
      image.addEventListener('error', () => {
        pageElement.classList.add('has-error');
        image.alt = `Page ${page.number} could not be loaded`;
      });

      const fallback = document.createElement('span');
      fallback.className = 'page-error-message';
      fallback.textContent = `Page ${page.number} unavailable`;

      pageElement.appendChild(image);
      pageElement.appendChild(fallback);
      return pageElement;
    });

    const images = pageElements.map((pageElement) =>
      pageElement.querySelector('img'),
    ) as HTMLImageElement[];
    pageImagesRef.current = images;

    async function initializeFlipbook() {
      try {
        const pageFlipModule = await import('page-flip');
        if (cancelled) return;

        const PageFlipConstructor = pageFlipModule.PageFlip as unknown as new (
          element: HTMLElement,
          settings: Record<string, unknown>,
        ) => PageFlipApi;

        const baseWidth = 620;
        const baseHeight = Math.round(baseWidth / aspectRatio);
        const flip = new PageFlipConstructor(bookRoot, {
          width: baseWidth,
          height: baseHeight,
          size: 'stretch',
          minWidth: 270,
          maxWidth: 720,
          minHeight: Math.round(270 / aspectRatio),
          maxHeight: Math.round(720 / aspectRatio),
          drawShadow: true,
          flippingTime: 720,
          usePortrait: true,
          startZIndex: 2,
          startPage: currentPageRef.current,
          autoSize: true,
          maxShadowOpacity: 0.34,
          showCover: true,
          mobileScrollSupport: true,
          swipeDistance: 24,
          clickEventForward: true,
          useMouseEvents: true,
          disableFlipByClick: false,
        });

        activeFlip = flip;
        pageFlipRef.current = flip;

        flip.on<number>('flip', (event) => {
          const nextPage = Number(event.data) || 0;
          currentPageRef.current = nextPage;
          setCurrentPage(nextPage);
          hydrateAround(images, nextPage, 4);
        });
        flip.on<'portrait' | 'landscape'>('changeOrientation', (event) => {
          setOrientation(event.data);
        });
        flip.on<{ page: number; mode: 'portrait' | 'landscape' }>(
          'init',
          (event) => {
            currentPageRef.current = event.data.page;
            setCurrentPage(event.data.page);
            setOrientation(event.data.mode);
            setStatusMessage('Publication ready');
            setIsReady(true);
            hydrateAround(images, event.data.page, 4);
          },
        );

        flip.loadFromHTML(pageElements);
      } catch (initializationError) {
        console.error(initializationError);
        if (!cancelled) {
          setError(
            'The page-turning view could not start. A simple page reader is available instead.',
          );
          setIsReady(true);
        }
      }
    }

    void initializeFlipbook();

    return () => {
      cancelled = true;
      pageFlipRef.current = null;
      pageImagesRef.current = [];
      try {
        activeFlip?.destroy();
      } catch {
        bookRoot.remove();
      }
      mount.replaceChildren();
    };
  }, [manifest]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === shellRef.current;
      setIsFullscreen(active);
      window.requestAnimationFrame(() => pageFlipRef.current?.update());
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const goNext = useCallback(() => {
    const total = manifestRef.current?.pageCount ?? 0;
    if (currentPageRef.current >= total - 1) return;

    hydrateAround(pageImagesRef.current, currentPageRef.current + 1, 4);
    if (pageFlipRef.current) {
      pageFlipRef.current.flipNext('bottom');
    } else {
      const nextPage = Math.min(total - 1, currentPageRef.current + 1);
      currentPageRef.current = nextPage;
      setCurrentPage(nextPage);
    }
  }, []);

  const goPrevious = useCallback(() => {
    if (currentPageRef.current <= 0) return;

    hydrateAround(pageImagesRef.current, currentPageRef.current - 1, 4);
    if (pageFlipRef.current) {
      pageFlipRef.current.flipPrev('bottom');
    } else {
      const previousPage = Math.max(0, currentPageRef.current - 1);
      currentPageRef.current = previousPage;
      setCurrentPage(previousPage);
    }
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((value) =>
      Math.min(MAX_ZOOM, Number((value + ZOOM_STEP).toFixed(2))),
    );
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((value) =>
      Math.max(MIN_ZOOM, Number((value - ZOOM_STEP).toFixed(2))),
    );
  }, []);

  const resetZoom = useCallback(() => setZoom(MIN_ZOOM), []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (shellRef.current?.requestFullscreen) {
        await shellRef.current.requestFullscreen();
      } else {
        setStatusMessage('Fullscreen is not supported by this browser');
      }
    } catch (fullscreenError) {
      console.error(fullscreenError);
      setStatusMessage('Fullscreen could not be opened');
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element?.matches('input, textarea, select, [contenteditable="true"]'))
        return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn();
      } else if (event.key === '-') {
        event.preventDefault();
        zoomOut();
      } else if (event.key === '0') {
        event.preventDefault();
        resetZoom();
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.key === 'Escape' && zoom > MIN_ZOOM) {
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrevious, resetZoom, toggleFullscreen, zoom, zoomIn, zoomOut]);

  const zoomPages = useMemo(() => {
    if (!manifest) return [];

    const selected = [manifest.pages[currentPage]].filter(Boolean);
    if (
      orientation === 'landscape' &&
      currentPage > 0 &&
      currentPage < manifest.pageCount - 1 &&
      manifest.pages[currentPage + 1]
    ) {
      selected.push(manifest.pages[currentPage + 1]);
    }
    return selected;
  }, [currentPage, manifest, orientation]);

  const progress = manifest
    ? Math.max(
        isReady ? 100 : 12,
        Math.min(96, (loadedPages / Math.min(5, manifest.pageCount)) * 100),
      )
    : 8;
  const canGoBack = currentPage > 0;
  const canGoForward = Boolean(
    manifest && currentPage < manifest.pageCount - 1,
  );

  return (
    <main className="reader-shell" ref={shellRef}>
      <header className="reader-header">
        <div className="brand-lockup" aria-label="Truth Bible digital edition">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <div>
            <p className="brand-kicker">Digital edition</p>
            <h1>Truth Bible</h1>
          </div>
        </div>

        <div className="header-actions">
          <p className="edition-label">St Joseph&apos;s Church · 2026</p>
          {manifest?.pdfUrl ? (
            <a
              className="pdf-link"
              href={publicAssetUrl(manifest.pdfUrl)}
              target="_blank"
              rel="noreferrer"
            >
              <Download aria-hidden="true" />
              <span>Original PDF</span>
            </a>
          ) : null}
        </div>
      </header>

      <section className="book-stage" aria-label="Truth Bible flipbook reader">
        <div className="ambient-glow" aria-hidden="true" />

        {error && !manifest ? (
          <div className="reader-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
              <RefreshCw aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : (
          <>
            <div
              className={`flipbook-viewport${isReady ? ' is-ready' : ''}`}
              ref={flipbookMountRef}
            />

            {error && manifest ? (
              <section
                className="static-reader"
                aria-label="Simple page reader"
              >
                <Image
                  src={publicAssetUrl(manifest.pages[currentPage]?.src)}
                  alt={`${manifest.title} ${manifest.edition}, page ${currentPage + 1}`}
                  width={manifest.pageWidth}
                  height={manifest.pageHeight}
                  unoptimized
                />
              </section>
            ) : null}
          </>
        )}

        {!isReady && !error ? (
          <output className="loading-panel" aria-live="polite">
            <span className="loading-monogram" aria-hidden="true">
              T
            </span>
            <p>{statusMessage}</p>
            <div className="loading-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
          </output>
        ) : null}

        {zoom > MIN_ZOOM && manifest ? (
          <dialog
            open
            className="zoom-overlay"
            aria-label={`Zoomed page view at ${zoom}×`}
          >
            <div className="zoom-scroll-area">
              <div className="zoom-spread">
                {zoomPages.map((page) => (
                  <Image
                    key={page.number}
                    src={publicAssetUrl(page.src)}
                    alt={`${manifest.title} ${manifest.edition}, enlarged page ${page.number}`}
                    width={manifest.pageWidth}
                    height={manifest.pageHeight}
                    unoptimized
                    style={{ width: `${Math.round(620 * zoom)}px` }}
                  />
                ))}
              </div>
            </div>
            <button type="button" className="close-zoom" onClick={resetZoom}>
              Close zoom
            </button>
          </dialog>
        ) : null}

        <p className="interaction-hint">
          {orientation === 'portrait'
            ? 'Swipe to turn pages'
            : 'Drag the edge or use the arrows to turn pages'}
        </p>
      </section>

      <nav className="reader-toolbar" aria-label="Publication controls">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous page"
          onClick={goPrevious}
          disabled={!canGoBack}
        >
          <ChevronLeft aria-hidden="true" />
        </button>

        <div className="page-status" aria-live="polite" aria-atomic="true">
          <span>{formatPageNumber(currentPage + 1)}</span>
          <span className="page-divider" aria-hidden="true" />
          <span>{formatPageNumber(manifest?.pageCount ?? 0)}</span>
        </div>

        <button
          type="button"
          className="icon-button"
          aria-label="Next page"
          onClick={goNext}
          disabled={!canGoForward}
        >
          <ChevronRight aria-hidden="true" />
        </button>

        <span className="toolbar-separator" aria-hidden="true" />

        <button
          type="button"
          className="icon-button"
          aria-label="Zoom out"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
        >
          <Minus aria-hidden="true" />
        </button>
        <button
          type="button"
          className="zoom-readout"
          aria-label={`Reset zoom, currently ${zoom} times`}
          onClick={resetZoom}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Zoom in"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
        >
          <Plus aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={() => void toggleFullscreen()}
        >
          {isFullscreen ? (
            <Minimize aria-hidden="true" />
          ) : (
            <Expand aria-hidden="true" />
          )}
        </button>
      </nav>

      <output className="sr-only" aria-live="polite">
        {statusMessage}. Page {currentPage + 1} of {manifest?.pageCount ?? 0}.
      </output>
    </main>
  );
}
