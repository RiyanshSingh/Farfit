import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('nav.bottom-nav a[href="savings.html"]');
    await page.click('nav.bottom-nav a[href="savings.html"]');
    
    await new Promise(r => setTimeout(r, 1000));
    console.log('--- Triggering Add Expense ---');
    await page.evaluate(() => {
        const btn = document.getElementById('add-expense-trigger');
        if(btn) btn.click();
        else console.log('btn not found in dom');
    });
    await new Promise(r => setTimeout(r, 500));
    
    const visible = await page.evaluate(() => {
        const m = document.getElementById('expense-modal');
        return m ? m.classList.contains('show') : false;
    });
    console.log('Add Expense modal show:', visible);

    console.log('--- Triggering Bell ---');
    await page.evaluate(() => {
        const btn = document.getElementById('bell-trigger');
        if(btn) btn.click();
        else console.log('bell not found in dom');
    });
    await new Promise(r => setTimeout(r, 500));
    
    const bellVisible = await page.evaluate(() => {
        const m = document.getElementById('notification-center');
        return m ? m.classList.contains('show') : false;
    });
    console.log('Bell modal show:', bellVisible);

    await browser.close();
})();
