const fs = require('fs');

const transcript = fs.readFileSync('C:/Users/ramku/.gemini/antigravity/brain/4932cb58-fce9-4aa3-8240-980ca3a51ff2/.system_generated/logs/transcript_full.jsonl', 'utf8');
const lines = transcript.split('\n').filter(l => l.trim().length > 0);

for (let i = 0; i < lines.length; i++) {
  try {
    const entry = JSON.parse(lines[i]);
    if (entry.type === 'VIEW_FILE' || entry.type === 'TOOL_RESPONSE' || entry.source === 'SYSTEM') {
      if (entry.content && entry.content.includes('File Path: `file:///C:/Users/ramku/OneDrive/Documents/Drandee/backend/routes/reports.js`')) {
         fs.writeFileSync('C:/Users/ramku/OneDrive/Documents/Drandee/backend/scratch/found_reports.txt', entry.content);
         break;
      }
    }
  } catch (e) {}
}
