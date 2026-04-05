import fs from 'node:fs';
import path from 'node:path';

const ROUTE_RE = /<Route[^>]*\s+path=(["'])(.*?)\1/g;

const readIfExists = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
};

const discoverRoutes = (rootDir = process.cwd()) => {
  const appPath = path.join(rootDir, 'src', 'App.jsx');
  const appSource = readIfExists(appPath);
  const routes = [];

  if (appSource) {
    let match;
    while ((match = ROUTE_RE.exec(appSource)) !== null) {
      routes.push(match[2]);
    }
  }

  const files = {
    app: fs.existsSync(appPath),
    quoteView: fs.existsSync(path.join(rootDir, 'src', 'pages', 'public', 'QuoteView.jsx')),
    paymentPage: fs.existsSync(path.join(rootDir, 'src', 'pages', 'public', 'PaymentPage.jsx')),
    invoiceView: fs.existsSync(path.join(rootDir, 'src', 'pages', 'public', 'InvoiceView.jsx')),
    contact: fs.existsSync(path.join(rootDir, 'src', 'pages', 'Contact.jsx')),
    thankYou: fs.existsSync(path.join(rootDir, 'src', 'pages', 'ThankYou.jsx')),
  };

  return {
    appPath,
    routes,
    files,
  };
};

export { discoverRoutes };
