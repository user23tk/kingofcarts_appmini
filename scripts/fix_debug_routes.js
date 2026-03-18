const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const debugApiDir = path.resolve(__dirname, '../app/api/debug');

walkDir(debugApiDir, function(filePath) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace import
    // Note: there might be single or double quotes
    content = content.replace(/import\s+\{\s*createClient\s*\}\s+from\s+["']@\/lib\/supabase\/server["']/g, 'import { createAdminClient } from "@/lib/supabase/admin-singleton"');
    
    // Replace await createClient() with createAdminClient()
    content = content.replace(/await\s+createClient\(\)/g, 'createAdminClient()');
    
    // We also might have const supabase = createClient() without await
    content = content.replace(/createClient\(\)/g, 'createAdminClient()');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
