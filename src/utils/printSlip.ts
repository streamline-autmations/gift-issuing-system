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
        }
        
        .slip-container {
          width: ${paperWidthMm}mm;
          margin: 0;
          padding: 2mm 1mm;
          box-sizing: border-box;
        }

        h1 {
          display: none; /* Hide Company Name */
        }

        h2 {
          font-size: 14px;
          font-weight: bold;
          margin: 0 0 2px 0;
          text-align: center;
        }

        .subline {
          font-size: 12px;
          font-weight: bold;
          margin: 0 0 8px 0;
          text-align: center;
        }

        .divider {
          border-bottom: 1px dashed #000;
          margin: 4px 0;
        }

        .section-title {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .detail-row {
          display: flex;
          margin-bottom: 2px;
          font-size: 12px;
        }

        .label {
          font-weight: bold;
          width: 30mm;
        }

        .value {
          flex: 1;
        }

        .item-row {
          display: flex;
          align-items: center;
          padding: 3px 0;
        }

        .quantity {
          font-weight: bold;
          font-size: 12px;
          margin-right: 10px;
          width: 20px;
        }

        .slot-name {
          font-weight: bold;
          margin-right: 4px;
          font-size: 12px;
        }

        .item-name {
          font-size: 12px;
        }

        .choice-tag {
          font-size: 10px;
          color: #666;
          margin-left: 4px;
          font-style: italic;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 10px;
        }

        .signature-section {
          text-align: right;
          width: 45mm;
        }

        .signature-line {
          border-bottom: 1px solid #333;
          margin-bottom: 5px;
          height: 18px;
        }

        .signature-label {
          font-size: 10px;
          font-weight: bold;
        }
        
        .acknowledgment {
          font-size: 9px;
          color: #666;
          margin-top: 3px;
          text-align: right;
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
