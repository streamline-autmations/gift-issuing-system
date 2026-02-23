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
  const paperWidthMm = 80
  const paperMarginMm = 0

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
        @page {
          size: ${paperWidthMm}mm auto;
          margin: ${paperMarginMm}mm;
        }

        body {
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
          width: ${paperWidthMm}mm;
        }
        
        .slip-container {
          width: ${paperWidthMm}mm;
          margin: 0;
          padding: 4mm 3mm;
          box-sizing: border-box;
        }

        h1 {
          font-size: 14px;
          font-weight: bold;
          margin: 0 0 5px 0;
          text-transform: uppercase;
          text-align: center;
        }

        h2 {
          font-size: 12px;
          font-weight: normal;
          margin: 0 0 6px 0;
          text-align: center;
          color: #666;
        }

        .subline {
          font-size: 11px;
          font-weight: normal;
          margin: 0 0 10px 0;
          text-align: center;
          color: #666;
        }

        .divider {
          border-bottom: 1px dashed #bbb;
          margin: 8px 0;
        }

        .section-title {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 6px;
        }

        .detail-row {
          display: flex;
          margin-bottom: 3px;
          font-size: 11px;
        }

        .label {
          font-weight: 600;
          width: 34mm;
        }

        .value {
          flex: 1;
        }

        .item-row {
          display: flex;
          align-items: center;
          padding: 4px 0;
          border-bottom: 1px dotted #ddd;
        }

        .checkbox {
          width: 12px;
          height: 12px;
          border: 1px solid #333;
          margin-right: 8px;
        }

        .slot-name {
          font-weight: 600;
          margin-right: 6px;
          font-size: 11px;
        }

        .item-name {
          color: #333;
          font-size: 11px;
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
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }

  const doc = iframe.contentDocument
  if (!doc) {
    cleanup()
    return
  }

  doc.open()
  doc.write(htmlContent)
  doc.close()

  const w = iframe.contentWindow
  if (!w) {
    cleanup()
    return
  }

  w.onafterprint = () => {
    cleanup()
    window.focus()
  }

  w.onload = () => {
    w.focus()
    w.print()
    setTimeout(() => {
      window.focus()
    }, 50)
  }
}
