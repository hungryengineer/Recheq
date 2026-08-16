const fs = require('fs');
const files = {
  'apps/web/src/app/api/settings/keys/[id]/route.ts': ["'@tieout/api/'", "'@tieout/api/src/routes/settings/api-keys/delete.js'"],
  'apps/web/src/app/api/public/[token]/route.ts': ["'@tieout/api/'", "'@tieout/api/src/routes/cases/get.js'"],
  'apps/web/src/app/api/public/[token]/status/route.ts': ["'@tieout/api/'", "'@tieout/api/src/routes/public/status.js'"],
  'apps/web/src/app/api/public/[token]/submit/route.ts': ["'@tieout/api/'", "'@tieout/api/src/routes/public/submit.js'"],
  'apps/web/src/app/api/public/[token]/uan/route.ts': ["'@tieout/api/'", "'@tieout/api/src/routes/public/uan.js'"],
  'apps/web/src/app/api/cases/[id]/documents/[docId]/route.ts': ["'../../../../../lib/server/repository'", "'@/lib/server/repository'"],
  'apps/web/src/app/api/cases/[id]/route.ts': ["'../../../lib/server/projections'", "'@/lib/server/projections'"],
};
for (const [file, [from, to]] of Object.entries(files)) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(from, to);
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  } else {
    console.log('Not found', file);
  }
}
