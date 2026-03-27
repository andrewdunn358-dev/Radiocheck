const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIST = '/app/frontend/dist';

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.webp': 'image/webp',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST, urlPath);

  // Try exact file
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serve(res, filePath);
  }

  // Try with .html
  if (fs.existsSync(filePath + '.html')) {
    return serve(res, filePath + '.html');
  }

  // Dynamic route: /chat/tommy -> /chat/[characterId].html
  const chatMatch = urlPath.match(/^\/chat\/[^/]+$/);
  if (chatMatch) {
    const dynFile = path.join(DIST, 'chat', '[characterId].html');
    if (fs.existsSync(dynFile)) return serve(res, dynFile);
  }

  // SPA fallback
  return serve(res, path.join(DIST, 'index.html'));
}).listen(PORT, () => console.log(`Serving on :${PORT}`));

function serve(res, fp) {
  const ext = path.extname(fp);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
}
