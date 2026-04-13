export function initSPA() {
    if ((window as any)._spaInitialized) return;
    (window as any)._spaInitialized = true;

    // Optional: Preload on hover for instant feel
    document.addEventListener('mouseover', (e) => {
        const link = (e.target as Element).closest('a');
        if (link && link.href && !link.href.startsWith('#') && link.href.startsWith(window.location.origin)) {
            if (!(window as any)._preloaded) (window as any)._preloaded = new Set();
            if (!(window as any)._preloaded.has(link.href)) {
                fetch(link.href);
                (window as any)._preloaded.add(link.href);
            }
        }
    });

    document.addEventListener('click', async (e) => {
        const link = (e.target as Element).closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#')) return;

        e.preventDefault();
        
        // Show subtle loading state (Optional, since we fetch instantly)
        document.body.style.opacity = '0.7';
        document.body.style.pointerEvents = 'none';
        document.body.style.transition = 'opacity 0.2s';

        try {
            const res = await fetch(href);
            const html = await res.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Replace page content
            document.body.innerHTML = doc.body.innerHTML;
            document.title = doc.title;

            // Sync CSS
            Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]')).forEach(link => {
                const linkHref = link.getAttribute('href');
                if (linkHref && !document.head.querySelector(`link[href="${linkHref}"]`)) {
                    document.head.appendChild(link.cloneNode(true));
                }
            });

            window.history.pushState({}, '', href);

            // Rebind JS logic based on page
            if (href.includes('savings')) {
                if ((window as any).initBudget) (window as any).initBudget();
            } else {
                if ((window as any).initMain) (window as any).initMain();
            }
            
            window.scrollTo(0, 0);

        } catch (err) {
            window.location.href = href;
        } finally {
            document.body.style.opacity = '1';
            document.body.style.pointerEvents = 'auto';
        }
    });

    window.addEventListener('popstate', async () => {
        const href = window.location.pathname;
        try {
            const res = await fetch(href);
            const html = await res.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            document.body.innerHTML = doc.body.innerHTML;
            document.title = doc.title;

            if (href.includes('savings')) {
                if ((window as any).initBudget) (window as any).initBudget();
            } else {
                if ((window as any).initMain) (window as any).initMain();
            }
        } catch(e) {
            window.location.reload();
        }
    });
}
