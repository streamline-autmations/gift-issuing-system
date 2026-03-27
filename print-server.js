const http = require('http');
const { print } = require('pdf-to-printer');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- CONFIGURATION ---
const PRINTER_NAME = 'HP DJ 2130 series'; // <-- 🖨️ Your printer name
const PORT = 4242;
const NETLIFY_APP_URL = 'https://issuing-system.netlify.app';

// --- SERVER LOGIC ---

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', NETLIFY_APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', async () => {
      console.log('Received print job...');
      const tempHtmlPath = path.join(os.tmpdir(), `slip-${Date.now()}.html`);
      const tempPdfPath = path.join(os.tmpdir(), `slip-${Date.now()}.pdf`);

      try {
        // 1. Write the HTML to a temporary file
        fs.writeFileSync(tempHtmlPath, body);

        // 2. Launch Puppeteer to convert HTML to PDF
        console.log('Converting HTML to PDF...');
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Set the viewport to make text sharp and crisp
        // A higher deviceScaleFactor (e.g., 4) produces even sharper text for thermal printers
        await page.setViewport({ width: 302, height: 566, deviceScaleFactor: 4 });
        
        await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });

        // Get the dynamic height of the content to fix the "too long" issue
        const contentHeightMm = await page.evaluate(() => {
          const slip = document.querySelector('.slip-container');
          if (!slip) return 150; // Fallback
          // Calculate height in mm (assuming 96 DPI)
          return Math.ceil((slip.offsetHeight / 96) * 25.4) + 10; // Add 10mm padding
        });
        
        await page.pdf({
          path: tempPdfPath,
          width: '80mm',
          height: `${contentHeightMm}mm`,
          printBackground: true,
          margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
          scale: 1.0 // Set scale to 1.0 for maximum sharpness
        });
        await browser.close();
        console.log('PDF generated successfully.');

        // 3. Print the PDF to the specified printer
        console.log(`Sending PDF to printer: "${PRINTER_NAME}"...`);
        await print(tempPdfPath, { printer: PRINTER_NAME });
        console.log('Print command sent successfully.');

        res.writeHead(200).end('Print job sent');

      } catch (error) {
        console.error('An error occurred during the print process:', error);
        res.writeHead(500).end(`Printing failed: ${error.message}`);
      } finally {
        // 4. Clean up temporary files
        if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
        if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      }
    });
  } else {
    res.writeHead(404).end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('---');
  console.log(`🖨️  Print Server is running.`);
  console.log(`Listening on: http://localhost:${PORT}`);
  console.log(`Configured Printer: "${PRINTER_NAME}"`);
  console.log(`Accepting requests from: ${NETLIFY_APP_URL}`);
  console.log('---');
});
