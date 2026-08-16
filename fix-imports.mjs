import fs from 'fs';
import path from 'path';

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
      let text = fs.readFileSync(p, 'utf8');
      
      // Append .js to @tieout/api/src/ imports if they don't have it
      let newText = text.replace(/(@tieout\/api\/src\/[^'"]+?)(?<!\.js)(['"])/g, '$1.js$2');
      
      if (text !== newText) {
        fs.writeFileSync(p, newText);
        console.log('Fixed', p);
      }
    }
  });
}

walk('apps/web/src');
