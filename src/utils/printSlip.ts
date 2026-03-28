import type { Employee } from '../types'

export interface PrintSlipProps {
  companyName: string
  issuingName: string
  mineName: string
  issuedAt: string
  employee: Employee
  items: { slotName: string; itemName: string; isChoice: boolean }[]
}

/**
 * Generates the full HTML string for a distribution slip.
 * Used by both the print function and the in-browser preview page.
 */
export function generateSlipHtml({
  companyName,
  issuingName,
  mineName,
  issuedAt,
  employee,
  items,
}: PrintSlipProps): string {
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

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Issue Slip - ${employee.employee_number}</title>
      <style>
        @page {
          size: ${paperWidthMm}mm auto;
          margin: ${paperMarginMm}mm;
        }

        * {
          color: #000000 !important;
        }

        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #000000;
          width: ${paperWidthMm}mm;
          background: white;
          font-weight: 700;
          -webkit-print-color-adjust: exact;
        }

        .slip-container {
          width: ${paperWidthMm}mm;
          margin: 0;
          padding: 1mm;
          box-sizing: border-box;
          border: 1px solid white;
        }

        h1 {
          display: none;
        }

        h2 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 2px 0;
          text-align: center;
          color: #000000;
        }

        .subline {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 6px 0;
          text-align: center;
          color: #000000;
        }

        .divider {
          border-bottom: 2px solid #000000;
          margin: 4px 0;
        }

        .section-title {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 4px;
          text-decoration: underline;
          color: #000000;
        }

        .detail-row {
          display: flex;
          margin-bottom: 2px;
          font-size: 14px;
          color: #000000;
        }

        .label {
          font-weight: 700;
          width: 28mm;
          color: #000000;
        }

        .value {
          flex: 1;
          font-weight: 700;
          color: #000000;
        }

        .item-row {
          display: flex;
          align-items: center;
          padding: 2px 0;
        }

        .quantity {
          font-weight: 700;
          font-size: 15px;
          margin-right: 8px;
          width: 18px;
          color: #000000;
        }

        .slot-name {
          font-weight: 700;
          margin-right: 4px;
          font-size: 14px;
          color: #000000;
        }

        .item-name {
          font-size: 14px;
          font-weight: 700;
          color: #000000;
        }

        .choice-tag {
          font-size: 12px;
          margin-left: 4px;
          font-weight: 700;
          color: #000000;
        }

        .footer {
          margin-top: 8px;
        }

        .timestamp {
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
          color: #000000;
        }

        .signature-section {
          text-align: left;
          margin-top: 20px;
        }

        .signature-line {
          border-bottom: 2px solid #000000;
          margin-bottom: 2px;
          height: 50px;
          width: 80%;
        }

        .signature-label {
          font-size: 12px;
          font-weight: 700;
          color: #000000;
        }

        .acknowledgment {
          font-size: 11px;
          margin-top: 2px;
          font-weight: 700;
          color: #000000;
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
  `
}

export const printSlip = (props: PrintSlipProps) => {
  const htmlContent = generateSlipHtml(props)

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
        alert(`Printing failed: ${text}`);
      });
    } else {
      console.log('Print job sent to local server successfully.');
    }
  })
  .catch(err => {
    console.error('Failed to connect to the local print server:', err);
    alert('Could not connect to the local print server. Is it running?');
  });
}
