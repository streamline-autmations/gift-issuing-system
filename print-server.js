const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- CONFIGURATION ---
// IMPORTANT: Set your thermal printer's exact name here.
// To find the name: Go to Windows Settings > Bluetooth & devices > Printers & scanners.
// It must be an exact match, e.g., "POS-58" or "ZDesigner ZD410".
const PRINTER_NAME = 'Microsoft Print to PDF'; // <-- 🖨️ CHANGE THIS to your printer's name

// The port the server will listen on.
const PORT = 4242;

// The URL of your deployed Netlify app.
// This is required for security (CORS) and should match your app's URL.
const NETLIFY_APP_URL = 'https://issuing-system.netlify.app';

// --- SERVER LOGIC (No changes needed below) ---

const server = http.createServer((req, res) => {
  // Set CORS and Private Network Access headers to allow requests from the Netlify app
  res.setHeader('Access-Control-Allow-Origin', NETLIFY_APP_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  // Handle preflight OPTIONS request from the browser
  if (req.method === 'OPTIONS') {
    res.writeHead(204); // No Content
    res.end();
    return;
  }

  // Handle the main print request
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log('Received print job...');

      // 1. Save the incoming HTML to a temporary file
      const tempFilePath = path.join(os.tmpdir(), `slip-${Date.now()}.html`);
      fs.writeFile(tempFilePath, body, (err) => {
        if (err) {
          console.error('Error writing temp file:', err);
          res.writeHead(500);
          res.end('Failed to write temp file');
          return;
        }

        // 2. Execute a PowerShell command to print the HTML file silently to the specified printer
        const command = `powershell -Command "Start-Process -FilePath '${tempFilePath}' -Verb PrintTo -ArgumentList '${PRINTER_NAME}' -PassThru | Wait-Process"`;
        
        console.log(`Executing: Start-Process -Verb PrintTo on "${PRINTER_NAME}"`);

        exec(command, (error, stdout, stderr) => {
          // 3. Clean up (delete) the temporary file after printing
          fs.unlink(tempFilePath, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
          });

          if (error) {
            console.error(`Printing Error: ${error.message}`);
            console.error(`Stderr: ${stderr}`);
            const errorMessage = stderr || error.message;
            // Check for a common error when the printer name is wrong
            if (errorMessage.includes('No printers were found')) {
              console.error(`
CRITICAL: The printer "${PRINTER_NAME}" was not found. Check the name in Windows Settings and update the PRINTER_NAME variable in this script.
`);
              res.writeHead(500);
              res.end(`Printer not found: "${PRINTER_NAME}"`);
            } else {
              res.writeHead(500);
              res.end(`Failed to print. Error: ${errorMessage}`);
            }
            return;
          }

          console.log('Print command sent successfully.');
          res.writeHead(200);
          res.end('Print job sent');
        });
      });
    });
  } else {
    // Respond with 404 for any other requests
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
  console.log('To start, open a terminal in this project and run: node print-server.js');
  console.log('Keep this terminal window open in the background while you work.');
  console.log('---');
});
