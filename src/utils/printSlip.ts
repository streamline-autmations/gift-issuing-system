import type { Employee } from '../types'

interface PrintSlipProps {
  companyName: string
  issuingName: string
  employee: Employee
  items: { slotName: string; itemName: string; isChoice: boolean }[]
}

export const printSlip = ({
  companyName,
  issuingName,
  employee,
  items,
}: PrintSlipProps) => {
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) {
    alert('Please allow popups to print the slip.')
    return
  }

  const now = new Date().toLocaleString()

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
      <div class="checkbox"></div>
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
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        
        .slip-container {
          max-width: 210mm; /* A4 width approx */
          margin: 0 auto;
          border: 1px solid #ccc;
          padding: 40px;
          box-sizing: border-box;
        }

        h1 {
          font-size: 24px;
          font-weight: bold;
          margin: 0 0 5px 0;
          text-transform: uppercase;
          text-align: center;
        }

        h2 {
          font-size: 16px;
          font-weight: normal;
          margin: 0 0 20px 0;
          text-align: center;
          color: #666;
        }

        .divider {
          border-bottom: 2px solid #eee;
          margin: 20px 0;
        }

        .section-title {
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 10px;
        }

        .detail-row {
          display: flex;
          margin-bottom: 5px;
        }

        .label {
          font-weight: 600;
          width: 150px;
        }

        .value {
          flex: 1;
        }

        .item-row {
          display: flex;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f9f9f9;
        }

        .checkbox {
          width: 16px;
          height: 16px;
          border: 2px solid #333;
          margin-right: 15px;
        }

        .slot-name {
          font-weight: 600;
          margin-right: 10px;
        }

        .item-name {
          color: #333;
        }

        .choice-tag {
          font-size: 12px;
          color: #666;
          margin-left: 5px;
          font-style: italic;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 40px;
        }

        .signature-section {
          text-align: right;
          width: 250px;
        }

        .signature-line {
          border-bottom: 1px solid #333;
          margin-bottom: 5px;
          height: 30px;
        }

        .signature-label {
          font-size: 12px;
          font-weight: bold;
        }
        
        .acknowledgment {
            font-size: 10px;
            color: #666;
            margin-top: 5px;
            text-align: right;
        }

        @media print {
          body {
            padding: 0;
            margin: 0;
          }
          .slip-container {
            border: none;
            padding: 20px;
            width: 100%;
            max-width: none;
          }
          @page {
            size: A4;
            margin: 0;
          }
          /* Hide browser UI elements if possible (handled by browser settings mostly) */
        }
      </style>
    </head>
    <body>
      <div class="slip-container">
        <h1>${companyName}</h1>
        <h2>${issuingName}</h2>
        
        <div class="divider"></div>

        <div class="section">
          <div class="section-title">Employee Details</div>
          <div class="detail-row"><span class="label">Employee Number:</span> <span class="value">${employee.employee_number}</span></div>
          <div class="detail-row"><span class="label">Name:</span> <span class="value">${employee.name}</span></div>
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
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
             window.close();
          }, 500);
        }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(htmlContent)
  printWindow.document.close()
}
