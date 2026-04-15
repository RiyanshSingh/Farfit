function getShellNav(root: Document | HTMLElement) {
    return root.querySelector('body > nav:not(.bottom-nav), nav:not(.bottom-nav)');
}

function isSharedStylesheet(href: string) {
    return href.includes('fonts.googleapis.com') || href.endsWith('/style.css') || href.endsWith('/responsive.css') || href === 'style.css' || href === 'responsive.css';
}

function normalizeHref(href: string) {
    return new URL(href, window.location.href).pathname;
}

function syncHead(targetDoc: Document) {
    const currentLinks = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    const targetLinks = Array.from(targetDoc.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    const targetHrefs = new Set(targetLinks.map(link => link.href));

    currentLinks.forEach((link) => {
        if (!isSharedStylesheet(link.href) && !targetHrefs.has(link.href)) {
            link.remove();
        }
    });

    targetLinks.forEach((link) => {
        if (!document.head.querySelector(`link[href="${link.href}"]`)) {
            document.head.appendChild(link.cloneNode(true));
        }
    });

    document.title = targetDoc.title;
}

function syncRouteNodes(targetDoc: Document) {
    const currentTopNav = getShellNav(document);
    const targetTopNav = getShellNav(targetDoc);
    if (currentTopNav && targetTopNav) {
        currentTopNav.innerHTML = targetTopNav.innerHTML;
    }

    const currentPage = document.querySelector('.page');
    const targetPage = targetDoc.querySelector('.page');
    if (currentPage && targetPage) {
        currentPage.replaceWith(targetPage.cloneNode(true));
    }

    const currentBottomNav = document.querySelector('nav.bottom-nav');
    const targetBottomNav = targetDoc.querySelector('nav.bottom-nav');
    if (currentBottomNav && targetBottomNav) {
        currentBottomNav.replaceWith(targetBottomNav.cloneNode(true));
    }

    document.querySelectorAll('.modal').forEach((node) => node.remove());
    const anchor = document.querySelector('script[type="module"]');
    Array.from(targetDoc.querySelectorAll('.modal')).forEach((modal) => {
        const clone = modal.cloneNode(true);
        if (anchor?.parentNode) {
            anchor.parentNode.insertBefore(clone, anchor);
        } else {
            document.body.appendChild(clone);
        }
    });
}

async function applyRoute(href: string, pushHistory = true) {
    const path = normalizeHref(href);
    if (path === window.location.pathname && !pushHistory) return;

    document.body.style.opacity = '0.7';
    document.body.style.pointerEvents = 'none';
    document.body.style.transition = 'opacity 0.2s';

    try {
        const res = await fetch(path);
        const html = await res.text();
        const parser = new DOMParser();
        const targetDoc = parser.parseFromString(html, 'text/html');

        syncHead(targetDoc);
        syncRouteNodes(targetDoc);

        if (pushHistory && path !== window.location.pathname) {
            window.history.pushState({}, '', path);
        }

        if ((window as any).initMain) (window as any).initMain();
        if (path.includes('savings') && (window as any).initBudget) (window as any).initBudget();

        window.dispatchEvent(new CustomEvent('spa:view-swapped', { detail: { path } }));
        window.scrollTo(0, 0);
    } catch (err) {
        window.location.href = path;
    } finally {
        document.body.style.opacity = '1';
        document.body.style.pointerEvents = 'auto';
    }
}

export function initSPA() {
    if ((window as any)._spaInitialized) return;
    (window as any)._spaInitialized = true;
    (window as any).spaNavigate = (href: string) => applyRoute(href, true);

    document.addEventListener('mouseover', (e) => {
        const link = (e.target as Element).closest('a');
        if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http')) return;

        const path = normalizeHref(href);
        if (!(window as any)._preloaded) (window as any)._preloaded = new Set();
        if (!(window as any)._preloaded.has(path)) {
            fetch(path);
            (window as any)._preloaded.add(path);
        }
    });

    document.addEventListener('click', (e) => {
        const link = (e.target as Element).closest('a');
        if (!link || e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (link.target === '_blank' || link.hasAttribute('download')) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http')) return;

        e.preventDefault();
        void applyRoute(href, true);
    });

    window.addEventListener('spa-nav', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (typeof detail === 'string') {
            void applyRoute(detail, true);
        }
    });

    window.addEventListener('popstate', () => {
        void applyRoute(window.location.pathname, false);
    });
}
