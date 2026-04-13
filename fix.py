import json

html = """<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Health Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="responsive.css">
    <script>
        (function() {
            var t = localStorage.getItem('healthian_theme') || 'light';
            if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        })();
    </script>
    <style>
        .spa-view { display: none; }
        .spa-view.active { display: block; }
    </style>
</head>

<body>

    <nav>
        <svg class="logo" viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="25" stroke="#5bbcd6" stroke-width="2" />
            <path d="M10 26 Q18 14 26 26 Q34 38 42 26" stroke="#5bbcd6" stroke-width="2.5" stroke-linecap="round" />
            <path d="M10 30 Q18 18 26 30 Q34 42 42 30" stroke="#a8dce8" stroke-width="2" stroke-linecap="round" />
        </svg>

        <div class="nav-links">
            <a href="#" class="nav-spa-link active" data-page="home">
                <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Home
            </a>
            <a href="#" class="nav-spa-link" data-page="health">
                <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Health
            </a>
            <a href="#" class="nav-spa-link" data-page="exercises">
                <svg viewBox="0 0 24 24"><path d="M20.5 13.5l-7 7a2 2 0 0 1-2.8 0L2 12V2h10l8.5 8.5a2 2 0 0 1 0 2.8z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                Exercises
            </a>
            <a href="#" class="nav-spa-link" data-page="savings">
                <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                Savings
            </a>
        </div>

        <div class="nav-right">
            <span class="greeting">Hello, Riyansh </span>
            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80"
                class="avatar" alt="User" id="settings-trigger" style="cursor:pointer;" title="Profile Settings">
            <div style="position:relative; display:flex; align-items:center;">
                <button class="bell-btn" id="bell-trigger">
                    <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    <span id="unread-count" class="notification-badge" style="display:none;">0</span>
                </button>
            </div>
        </div>
    </nav>
"""

with open("index.html", "w") as f:
    f.write(html)
