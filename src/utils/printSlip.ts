import type { Employee } from '../types'

interface PrintSlipProps {
  companyName: string
  issuingName: string
  mineName: string
  issuedAt: string
  employee: Employee
  items: { slotName: string; itemName: string; isChoice: boolean }[]
}

export const printSlip = ({
  companyName,
  issuingName,
  mineName,
  issuedAt,
  employee,
  items,
}: PrintSlipProps) => {
  // SET PRINTER SIZE HERE:
  // Standard thermal printer (till printer) is usually 58mm or 80mm.
  // Change paperWidthMm to 80 if you have a larger printer.
  const paperWidthMm = 80 
  const paperMarginMm = 2

  const now = new Date(issuedAt).toLocaleString()

  const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || '—'

  const extraDataHtml = employee.extra_data
    ? Object.entries(employee.extra_data)
        .map(
          ([key, value]) =>
            `<div class="detail-row"><span class="label">${key}:</span> <span class="value">${value}</span></div>`
        )
        .join('')
    : ''

  const itemsHtml = items
    .map(
      (item) => `
    <div class="item-row">
      <div class="quantity">1x</div>
      <div class="item-details">
        <span class="slot-name">${item.slotName}</span>
        <span class="item-name">${item.itemName}</span>
        ${item.isChoice ? '<span class="choice-tag">(Choice)</span>' : ''}
      </div>
    </div>
  `
    )
    .join('')

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Issue Slip - ${employee.employee_number}</title>
      <style>
        @page {
          size: ${paperWidthMm}mm auto;
          margin: ${paperMarginMm}mm;
        }

        body {
          font-family: 'Courier New', Courier, monospace;
          margin: 0;
          padding: 0;
          color: #000;
          width: ${paperWidthMm}mm;
          background: white;
          font-weight: bold; /* Make everything bold for clarity */
        }
        
        .slip-container {
          width: ${paperWidthMm}mm;
          margin: 0;
          padding: 1mm;
          box-sizing: border-box;
          border: 1px solid white; /* Force content boundary */
        }

        h1 {
          display: none; /* Hide Company Name */
        }

        h2 {
          font-size: 16px;
          font-weight: 900;
          margin: 0 0 2px 0;
          text-align: center;
        }

        .subline {
          font-size: 14px;
          font-weight: 900;
          margin: 0 0 6px 0;
          text-align: center;
        }

        .divider {
          border-bottom: 2px solid #000;
          margin: 4px 0;
        }

        .section-title {
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 4px;
          text-decoration: underline;
        }

        .detail-row {
          display: flex;
          margin-bottom: 2px;
          font-size: 13px;
        }

        .label {
          font-weight: 900;
          width: 28mm;
        }

        .value {
          flex: 1;
          font-weight: 900;
        }

        .item-row {
          display: flex;
          align-items: center;
          padding: 2px 0;
        }

        .quantity {
          font-weight: 900;
          font-size: 14px;
          margin-right: 8px;
          width: 18px;
        }

        .slot-name {
          font-weight: 900;
          margin-right: 4px;
          font-size: 13px;
        }

        .item-name {
          font-size: 13px;
          font-weight: 900;
        }

        .choice-tag {
          font-size: 11px;
          margin-left: 4px;
          font-weight: 900;
        }

        .footer {
          margin-top: 8px;
        }

        .timestamp {
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .signature-section {
          text-align: left;
          margin-top: 5px;
        }

        .signature-line {
          border-bottom: 2px solid #000;
          margin-bottom: 2px;
          height: 30px;
          width: 80%;
        }

        .signature-label {
          font-size: 11px;
          font-weight: 900;
        }
        
        .acknowledgment {
          font-size: 10px;
          margin-top: 2px;
          font-weight: 900;
        }
      </style>
    </head>
    <body>
      <div class="slip-container">
        <h1>${companyName}</h1>
        <h2>${issuingName}</h2>
        <div class="subline">${mineName}</div>
        
        <div class="divider"></div>

        <div class="section">
          <div class="section-title">Employee Details</div>
          <div class="detail-row"><span class="label">Employee Number:</span> <span class="value">${employee.employee_number}</span></div>
          <div class="detail-row"><span class="label">Name:</span> <span class="value">${fullName}</span></div>
          ${extraDataHtml}
        </div>

        <div class="divider"></div>

        <div class="section">
          <div class="section-title">Items Received</div>
          ${itemsHtml}
        </div>

        <div class="divider"></div>

        <div class="footer">
          <div class="timestamp">
            Issued: ${now}
          </div>
          <div class="signature-section">
            <div class="signature-line"></div>
            <div class="signature-label">Recipient Signature</div>
            <div class="acknowledgment">I acknowledge receipt of the listed items.</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send the HTML content to the local print server
  fetch('http://localhost:4242/print', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/html',
    },
    body: htmlContent,
  })
  .then(response => {
    if (!response.ok) {
      response.text().then(text => {
        console.error('Print server error:', text);
        // Optional: Show a user-facing error message
        alert(`Printing failed: ${text}`);
      });
    } else {
      console.log('Print job sent to local server successfully.');
    }
  })
  .catch(err => {
    console.error('Failed to connect to the local print server:', err);
    // Optional: Show a user-facing error message
    alert('Could not connect to the local print server. Is it running?');
  });
}
