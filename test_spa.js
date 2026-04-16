import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/');
    
    // wait for load
    await page.waitForSelector('nav.bottom-nav a[href="savings.html"]');
    
    // click savings
    await page.click('nav.bottom-nav a[href="savings.html"]');
    
    // wait for spa swap (add-expense-trigger should appear)
    await page.waitForSelector('#add-expense-trigger');
    
    // click add expense
    await page.click('#add-expense-trigger');
    
    // check if it has class 'show'
    await new Promise(r => setTimeout(r, 500));
    const isModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('expense-modal');
        return modal && modal.classList.contains('show');
    });
    console.log('Add Expense modal visible after SPA:', isModalVisible);

    const isBellVisible = await page.evaluate(() => {
        const bell = document.getElementById('bell-trigger');
        if (bell) bell.click();
        const center = document.getElementById('notification-center');
        return center && center.classList.contains('show');
    });
    console.log('Bell modal visible after SPA:', isBellVisible);

    // Get all modals to debug
    const modals = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.modal')).map(m => m.id);
    });
    console.log('Modals in DOM:', modals);

    await browser.close();
})();
