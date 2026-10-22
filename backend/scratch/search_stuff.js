const fs = require('fs');
const path = require('path');

function findInFiles(dir, pattern, extension = '.js') {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory() && file !== 'node_modules') {
      results = results.concat(findInFiles(fullPath, pattern, extension));
    } else if (file.endsWith(extension)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.match(pattern)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

console.log("=== QUEUES ===");
console.log(findInFiles(path.join(__dirname, '..'), /bullmq|worker/i));

console.log("\n=== EVENTS ===");
console.log(findInFiles(path.join(__dirname, '..', 'routes'), /watch_start|event|analytics/i));

console.log("\n=== MEDIA ===");
console.log(findInFiles(path.join(__dirname, '..', 'routes'), /imagekit|media|upload/i));
