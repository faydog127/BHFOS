import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = 'c:\\BHFOS\\command-center';
const BRAND_DIR = path.join(ROOT, 'dist', 'assets', 'branding');

const asDataUri = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    'application/octet-stream';
  const b64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${b64}`;
};

const logo = asDataUri(path.join(BRAND_DIR, 'logo-secondary-lockup.png'));
const badgeNadca = asDataUri(path.join(BRAND_DIR, 'badge-nadca.png'));
const badgeSdvosb = asDataUri(path.join(BRAND_DIR, 'badge-sdvosb.png'));
const badgeCleanAir = asDataUri(path.join(BRAND_DIR, 'badge-clean-air.png'));

const invoice = {
  number: '61',
  issueDate: 'April 3, 2026',
  dueDate: 'April 3, 2026',
  billedTo: 'Ala Papanaga',
  items: [
    { description: 'Air Duct Cleaning - System 1', qty: 1, unit: 699.0 },
    { description: 'Dryer Vent Safety Clean', qty: 1, unit: 199.0 },
  ],
  subtotal: 898.0,
  salesTax: 62.86,
  total: 960.86,
  amountDue: 960.86,
  payLink: 'https://app.bhfos.com/pay/309b9892a3805e04b7abbc12c01c5f28',
};

const blocks = {
  positioningTitle: 'Mechanical Hygiene Standards',
  positioningBody:
    'The Vent Guys specializes in indoor air quality and mechanical hygiene, not general HVAC maintenance. ' +
    'Our work targets contamination and airflow restriction inside your system, with documentation you can verify.',
  trust: [
    'NADCA-aligned process and photo-verified results',
    'Veteran-owned, honest scope, no surprise upsells',
    'Focused on health, safety, and system performance',
  ],
  referralTitle: 'Most Customers Call Us When They Notice',
  referral: [
    'Musty or stale odor from vents',
    'Dust returning quickly after cleaning',
    'Allergy symptoms that improve outside but not inside',
    'Recent renovation, move-in, or a water event',
    'Dryer taking longer than normal to fully dry',
  ],
  signature: "Clean air isn't a luxury. It's a baseline.",
};

const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice #${invoice.number}</title>
    <style>
      @page { size: Letter; margin: 0.45in; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
      .shell { border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; }
      .header { background: linear-gradient(90deg, #091e39, #173861); color: #fff; padding: 18px 20px; }
      .headerRow { display:flex; align-items:center; justify-content:space-between; gap: 16px; }
      .logo { height: 44px; width: auto; display: block; }
      .contact { font-size: 12px; line-height: 1.35; text-align: right; }
      .contact a { color:#fff; text-decoration:none; }
      .bar { height: 4px; background: #b52025; }
      .content { padding: 16px 18px 14px 18px; }
      .title { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
      .meta { font-size: 12px; color:#475569; margin-bottom: 14px; }
      .meta strong { color:#0f172a; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align:left; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color:#64748b; padding: 10px 10px; border-bottom: 1px solid #e2e8f0; }
      td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; vertical-align: top; }
      td.num { text-align: center; width: 56px; }
      td.money { text-align: right; width: 110px; white-space: nowrap; }
      td.desc { width: auto; }
      .totals { margin-top: 14px; display:flex; justify-content:flex-end; }
      .totalsBox { width: 280px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; background: #f8fafc; }
      .totRow { display:flex; justify-content:space-between; font-size: 13px; color:#334155; margin: 6px 0; }
      .totFinal { display:flex; justify-content:space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 16px; font-weight: 900; }
      .blocks { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .block { border: 1px solid #e2e8f0; border-radius: 14px; padding: 9px 10px; background: #ffffff; }
      .blockTitle { font-size: 10px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color:#0f172a; margin-bottom: 5px; }
      .blockBody { font-size: 11px; line-height: 1.35; color:#334155; }
      .bullets { margin: 0; padding-left: 16px; font-size: 11px; line-height: 1.35; color:#334155; }
      .bullets li { margin: 3px 0; }
      .signature { margin-top: 8px; font-size: 11px; font-weight: 900; color:#0f172a; }
      .pay { margin-top: 12px; padding: 12px; border-radius: 16px; background: #0b1f3a; color: #fff; display:flex; align-items:center; justify-content:center; }
      .payBtn { display:inline-block; background:#ffffff; color:#0b1f3a; text-decoration:none; font-weight: 900; letter-spacing: 0.02em; padding: 10px 14px; border-radius: 999px; }
      /* Print/PDF: prevent engines from appending raw URLs after link text. */
      @media print { a[href]::after { content: "" !important; } }
      .footer { padding: 14px 20px 18px 20px; background:#fafafa; border-top: 1px solid #e2e8f0; }
      .footRow { display:flex; justify-content:space-between; gap: 16px; align-items:flex-end; }
      .footLeft { font-size: 12px; color:#475569; line-height: 1.45; }
      .footLeft .name { font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; color:#0f172a; font-size: 11px; }
      .badges img { height: 28px; width: auto; margin-left: 10px; opacity: 0.92; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="header">
        <div class="headerRow">
          <img class="logo" src="${logo}" alt="The Vent Guys" />
          <div class="contact">
            <div>2987 Finsterwald Dr<br/>Titusville, FL 32780</div>
            <div><a href="tel:+13213609704">(321) 360-9704</a></div>
            <div><a href="mailto:admin@vent-guys.com">admin@vent-guys.com</a></div>
          </div>
        </div>
      </div>
      <div class="bar"></div>
      <div class="content">
        <div class="title">Invoice #${invoice.number}</div>
        <div class="meta">
          <div><strong>Billed to:</strong> ${invoice.billedTo}</div>
          <div><strong>Issue date:</strong> ${invoice.issueDate}</div>
          <div><strong>Due date:</strong> ${invoice.dueDate}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Unit</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map((it) => {
              const total = it.qty * it.unit;
              return `<tr>
                <td class="desc">${it.description}</td>
                <td class="num">${it.qty}</td>
                <td class="money">${money(it.unit)}</td>
                <td class="money">${money(total)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="totalsBox">
            <div class="totRow"><span>Subtotal</span><strong>${money(invoice.subtotal)}</strong></div>
            <div class="totRow"><span>Sales Tax</span><strong>${money(invoice.salesTax)}</strong></div>
            <div class="totFinal"><span>Total</span><span>${money(invoice.total)}</span></div>
            <div class="totRow"><span>Amount due</span><strong>${money(invoice.amountDue)}</strong></div>
          </div>
        </div>

        <div class="blocks">
          <div class="block">
            <div class="blockTitle">${blocks.positioningTitle}</div>
            <div class="blockBody">${blocks.positioningBody}</div>
          </div>
          <div class="block">
            <div class="blockTitle">Trust and Authority</div>
            <ul class="bullets">${blocks.trust.map((b) => `<li>${b}</li>`).join('')}</ul>
          </div>
          <div class="block">
            <div class="blockTitle">${blocks.referralTitle}</div>
            <ul class="bullets">${blocks.referral.map((b) => `<li>${b}</li>`).join('')}</ul>
            <div class="signature">${blocks.signature}</div>
          </div>
        </div>

        <div class="pay">
          <a class="payBtn" href="${invoice.payLink}">Pay online</a>
        </div>
      </div>

      <div class="footer">
        <div class="footRow">
          <div class="footLeft">
            <div class="name">The Vent Guys</div>
            <div>2987 Finsterwald Dr, Titusville, FL 32780</div>
            <div>admin@vent-guys.com | vent-guys.com</div>
          </div>
          <div class="badges">
            <img src="${badgeNadca}" alt="NADCA Certified" />
            <img src="${badgeSdvosb}" alt="SDVOSB" />
            <img src="${badgeCleanAir}" alt="Clean Air Certified" />
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

const outPath = process.env.OUT_PATH || 'c:\\Users\\ol_ma\\Downloads\\invoice-61-branded-960.86-1page.pdf';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(html, { waitUntil: 'load' });
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.45in', right: '0.45in', bottom: '0.45in', left: '0.45in' },
    preferCSSPageSize: true,
    scale: 0.92,
  });
  fs.writeFileSync(outPath, pdf);
  // eslint-disable-next-line no-console
  console.log(`wrote:${outPath} bytes=${pdf.length}`);
} finally {
  await browser.close();
}
