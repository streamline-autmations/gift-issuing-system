const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- CONFIGURATION ---
// IMPORTANT: Set your thermal printer's exact name here.
// To find the name: Go to Windows Settings > Bluetooth & devices > Printers & scanners.
const PRINTER_NAME = 'HP DJ 2130 series';

// The port the server will listen on.
const PORT = 4242;

// The URL of your deployed Netlify app.
const NETLIFY_APP_URL = 'https://issuing-system.netlify.app';

// --- SERVER LOGIC ---

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', NETLIFY_APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', async () => {
      console.log('Received print job...');

      const tempHtmlPath = path.join(os.tmpdir(), `slip-${Date.now()}.html`);
      const tempPdfPath = tempHtmlPath.replace('.html', '.pdf');

      try {
        // 1. Save HTML to temp file
        fs.writeFileSync(tempHtmlPath, body);

        // 2. Use puppeteer to convert HTML to PDF
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Set the viewport to make text sharp and crisp
        // Higher deviceScaleFactor for high-res output
        await page.setViewport({ width: 400, height: 100, deviceScaleFactor: 5 });
        
        await page.goto(`file:///${tempHtmlPath}`, { waitUntil: 'networkidle0' });

        // Get the dynamic height of the content
        const contentHeightMm = await page.evaluate(() => {
          const slip = document.querySelector('.slip-container');
          if (!slip) return 150;
          // Return exact height in mm
          return Math.ceil((slip.scrollHeight / 96) * 25.4) + 1; 
        });

        await page.pdf({
          path: tempPdfPath,
          width: '80mm',
          height: `${contentHeightMm}mm`,
          printBackground: true,
          margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
          scale: 1.0,
          pageRanges: '1',
          displayHeaderFooter: false,
          preferCSSPageSize: true
        });
        await browser.close();
        console.log('PDF generated successfully.');

        // 3. Send PDF to printer using pdf-to-printer
        const printer = require('pdf-to-printer');
        await printer.print(tempPdfPath, { printer: PRINTER_NAME });
        console.log(`Print job sent to "${PRINTER_NAME}" successfully.`);

        // 4. Clean up temp files
        fs.unlinkSync(tempHtmlPath);
        fs.unlinkSync(tempPdfPath);

        res.writeHead(200);
        res.end('Print job sent');

      } catch (error) {
        console.error('Printing failed:', error.message);

        // Clean up temp files if they exist
        try { if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath); } catch {}
        try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch {}

        res.writeHead(500);
        res.end(`Failed to print: ${error.message}`);
      }
    });

  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('---');
  console.log(`🖨️  Print Server is running.`);
  console.log(`Listening on: http://localhost:${PORT}`);
  console.log(`Configured Printer: "${PRINTER_NAME}"`);
  console.log(`Accepting requests from: ${NETLIFY_APP_URL}`);
  console.log('---');
  console.log('Keep this terminal window open while you work.');
  console.log('---');
});
