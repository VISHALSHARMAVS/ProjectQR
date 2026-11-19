import { formatTableLabel, money } from '../lib/format';
import type { OrderRecord } from '../types';

export function printOrderReceipt(
  order: OrderRecord,
  restaurantName = 'Restaurant',
  type: 'KOT' | 'BILL' = 'KOT',
  gstin?: string,
  gstPercentage = 5
) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const dateStr = new Date(order.createdAt).toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'medium'
  });

  const isKot = type === 'KOT';

  const taxablePaise = gstPercentage > 0
    ? Math.round((order.totalPaise * 100) / (100 + gstPercentage))
    : order.totalPaise;
  const gstPaise = order.totalPaise - taxablePaise;
  const cgstPaise = Math.round(gstPaise / 2);
  const sgstPaise = gstPaise - cgstPaise;
  const halfRate = (gstPercentage / 2).toFixed(1).replace(/\.0$/, '');

  const itemsHtml = order.items.map((item) => `
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px; font-size: 13px; line-height: 1.3;">
      <div style="flex: 1; padding-right: 8px;">
        <div style="font-weight: bold;">
          ${item.quantity} × ${item.name} ${item.selectedVariant ? `(${item.selectedVariant.name})` : ''}
        </div>
        ${item.selectedAddons && item.selectedAddons.length > 0 ? `
          <div style="font-size: 11px; color: #444; margin-left: 12px;">
            + ${item.selectedAddons.map((a) => a.name).join(', ')}
          </div>
        ` : ''}
        ${item.notes ? `
          <div style="font-size: 11px; font-style: italic; color: #111; margin-left: 12px;">
            *Note: ${item.notes}*
          </div>
        ` : ''}
      </div>
      ${!isKot ? `<div style="font-weight: 600; white-space: nowrap;">${money(item.subtotalPaise)}</div>` : ''}
    </div>
  `).join('');

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${type} - ${order.orderNumber}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace, monospace;
            width: 72mm;
            margin: 0 auto;
            padding: 8px 4px 16px;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .divider-double { border-top: 2px solid #000; margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="center">
          <div style="font-size: 18px; font-weight: 900; text-transform: uppercase;">
            ${restaurantName}
          </div>
          ${!isKot && gstin ? `
            <div style="font-size: 11px; font-weight: bold; margin-top: 2px; letter-spacing: 0.5px;">
              GSTIN: ${gstin}
            </div>
          ` : ''}
          <div style="font-size: 14px; font-weight: bold; margin-top: 2px; letter-spacing: 1px;">
            --- ${isKot ? 'KITCHEN ORDER TICKET (KOT)' : 'TAX INVOICE / GUEST BILL'} ---
          </div>
        </div>

        <div class="divider"></div>

        <div style="font-size: 13px; display: flex; justify-content: space-between;">
          <span><strong>${formatTableLabel(order.table.label)}</strong></span>
          <span><strong>${order.orderNumber}</strong></span>
        </div>
        <div style="font-size: 11px; margin-top: 3px; color: #333;">
          Time: ${dateStr}
        </div>

        ${order.notes ? `
          <div style="margin-top: 4px; padding: 4px; background: #eee; font-size: 12px; font-weight: bold;">
            Table Note: ${order.notes}
          </div>
        ` : ''}

        <div class="divider"></div>

        <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; display: flex; justify-content: space-between;">
          <span>ITEM</span>
          ${!isKot ? '<span>AMOUNT</span>' : ''}
        </div>

        <div class="divider"></div>

        ${itemsHtml}

        <div class="divider-double"></div>

        ${!isKot ? `
          ${gstPercentage > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
              <span>Net Taxable Subtotal:</span>
              <span>${money(taxablePaise)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
              <span>CGST (${halfRate}%):</span>
              <span>${money(cgstPaise)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
              <span>SGST (${halfRate}%):</span>
              <span>${money(sgstPaise)}</span>
            </div>
            <div class="divider"></div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900;">
            <span>TOTAL AMOUNT:</span>
            <span>${money(order.totalPaise)}</span>
          </div>
          <div style="font-size: 10px; color: #555; text-align: right; margin-top: 2px;">
            (Prices are inclusive of all taxes)
          </div>
          <div class="divider"></div>
          <div class="center" style="font-size: 11px; margin-top: 8px;">
            Thank you for dining with us!
          </div>
        ` : `
          <div class="center" style="font-size: 12px; font-weight: bold;">
            [ End of KOT ]
          </div>
        `}
      </body>
    </html>
  `;

  doc.open();
  doc.write(content);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}
