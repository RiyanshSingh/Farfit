export function healthianPrompt(title: string, defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.backdropFilter = 'blur(12px)';
        (overlay.style as any).webkitBackdropFilter = 'blur(12px)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '100000';

        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';

        // Create modal box
        const box = document.createElement('div');
        box.style.backgroundColor = isDark ? '#1e293b' : '#fff';
        box.style.borderRadius = '28px';
        box.style.padding = '32px';
        box.style.width = '90%';
        box.style.maxWidth = '400px';
        box.style.boxShadow = isDark ? '0 25px 60px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.1)';
        box.style.border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.02)';

        box.style.transform = 'translateY(20px) scale(0.95)';
        box.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        // Title
        const titleEl = document.createElement('div');
        titleEl.textContent = title;
        titleEl.style.fontSize = '18px';
        titleEl.style.fontWeight = '900';
        titleEl.style.color = isDark ? '#fff' : '#12121a';
        titleEl.style.marginBottom = '20px';

        // Input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        input.style.width = '100%';
        input.style.padding = '16px';
        input.style.borderRadius = '14px';
        input.style.border = isDark ? '1px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0';
        input.style.backgroundColor = isDark ? '#0f172a' : '#fff';
        input.style.fontSize = '16px';
        input.style.fontWeight = '700';
        input.style.color = isDark ? '#fff' : '#12121a';
        input.style.outline = 'none';
        input.style.marginBottom = '24px';
        input.style.boxSizing = 'border-box';
        input.style.fontFamily = 'inherit';
        input.style.transition = 'border-color 0.2s';
        
        input.onfocus = () => { input.style.borderColor = '#1a1a2e'; };
        input.onblur = () => { input.style.borderColor = '#e2e8f0'; };

        // Buttons Container
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'flex-end';
        btnContainer.style.gap = '12px';

        // Cancel Button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '12px 24px';
        cancelBtn.style.borderRadius = '50px';
        cancelBtn.style.border = 'none';
        cancelBtn.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f0f4f6';
        cancelBtn.style.color = isDark ? '#aaa' : '#555';
        cancelBtn.style.fontWeight = '800';
        cancelBtn.style.fontSize = '15px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontFamily = 'inherit';
        cancelBtn.style.transition = 'all 0.2s';
        cancelBtn.onmouseover = () => { cancelBtn.style.backgroundColor = '#e6ecef'; };
        cancelBtn.onmouseleave = () => { cancelBtn.style.backgroundColor = '#f0f4f6'; };
        cancelBtn.onmousedown = () => { cancelBtn.style.transform = 'scale(0.96)'; };
        cancelBtn.onmouseup = () => { cancelBtn.style.transform = 'scale(1)'; };

        // Save Button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.padding = '12px 24px';
        saveBtn.style.borderRadius = '50px';
        saveBtn.style.border = 'none';
        saveBtn.style.backgroundColor = '#1a1a2e';
        saveBtn.style.color = '#fff';
        saveBtn.style.fontWeight = '800';
        saveBtn.style.fontSize = '15px';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.fontFamily = 'inherit';
        saveBtn.style.transition = 'all 0.2s';
        saveBtn.onmouseover = () => { saveBtn.style.boxShadow = '0 6px 15px rgba(0,0,0,0.1)'; };
        saveBtn.onmouseleave = () => { saveBtn.style.boxShadow = 'none'; };
        saveBtn.onmousedown = () => { saveBtn.style.transform = 'scale(0.96)'; };
        saveBtn.onmouseup = () => { saveBtn.style.transform = 'scale(1)'; };

        let resolved = false;
        const cleanup = () => {
            if (resolved) return;
            resolved = true;
            overlay.style.opacity = '0';
            box.style.transform = 'translateY(20px) scale(0.95)';
            setTimeout(() => document.body.removeChild(overlay), 300);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };

        saveBtn.onclick = () => {
            cleanup();
            resolve(input.value);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                cleanup();
                resolve(input.value);
            }
            if (e.key === 'Escape') {
                cleanup();
                resolve(null);
            }
        };

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(saveBtn);

        box.appendChild(titleEl);
        box.appendChild(input);
        box.appendChild(btnContainer);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'translateY(0) scale(1)';
            input.focus();
            input.select();
        });
    });
}

export function healthianConfirm(title: string, message: string = ''): Promise<boolean> {
    return new Promise((resolve) => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed'; overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100%'; overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)'; 
        overlay.style.backdropFilter = 'blur(12px)';
        (overlay.style as any).webkitBackdropFilter = 'blur(12px)';
        overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '100000'; overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.2s ease';

        const box = document.createElement('div');
        box.style.backgroundColor = isDark ? '#1e293b' : '#fff'; 
        box.style.borderRadius = '28px'; box.style.padding = '32px';
        box.style.width = '90%'; box.style.maxWidth = '400px';
        box.style.boxShadow = isDark ? '0 25px 60px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.1)';
        box.style.border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.02)';
        box.style.transform = 'translateY(20px) scale(0.95)'; box.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        const titleEl = document.createElement('div');
        titleEl.textContent = title; titleEl.style.fontSize = '18px'; titleEl.style.fontWeight = '900';
        titleEl.style.color = isDark ? '#fff' : '#12121a'; titleEl.style.marginBottom = message ? '8px' : '20px';


        const msgEl = document.createElement('div');
        msgEl.textContent = message; msgEl.style.fontSize = '14px'; msgEl.style.fontWeight = '600';
        msgEl.style.color = isDark ? '#94a3b8' : '#666'; msgEl.style.marginBottom = '24px';

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex'; btnContainer.style.justifyContent = 'flex-end'; btnContainer.style.gap = '12px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel'; cancelBtn.style.padding = '12px 24px'; cancelBtn.style.borderRadius = '50px';
        cancelBtn.style.border = 'none'; cancelBtn.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f0f4f6'; cancelBtn.style.color = isDark ? '#aaa' : '#555';
        cancelBtn.style.fontWeight = '800'; cancelBtn.style.fontSize = '15px'; cancelBtn.style.cursor = 'pointer';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm'; confirmBtn.style.padding = '12px 24px'; confirmBtn.style.borderRadius = '50px';
        confirmBtn.style.border = 'none'; confirmBtn.style.backgroundColor = '#e03070'; confirmBtn.style.color = '#fff';

        confirmBtn.style.fontWeight = '800'; confirmBtn.style.fontSize = '15px'; confirmBtn.style.cursor = 'pointer';

        let resolved = false;
        const cleanup = () => {
            if (resolved) return; resolved = true;
            overlay.style.opacity = '0'; box.style.transform = 'translateY(20px) scale(0.95)';
            setTimeout(() => document.body.removeChild(overlay), 300);
        };

        cancelBtn.onclick = () => { cleanup(); resolve(false); };
        confirmBtn.onclick = () => { cleanup(); resolve(true); };

        btnContainer.appendChild(cancelBtn); btnContainer.appendChild(confirmBtn);
        box.appendChild(titleEl); if (message) box.appendChild(msgEl); box.appendChild(btnContainer);
        overlay.appendChild(box); document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1'; box.style.transform = 'translateY(0) scale(1)';
        });
    });
}
