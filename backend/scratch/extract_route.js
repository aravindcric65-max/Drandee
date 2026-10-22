const fs = require('fs');
const lines = fs.readFileSync('C:/Users/ramku/.gemini/antigravity/brain/4932cb58-fce9-4aa3-8240-980ca3a51ff2/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('router.post("/post/:postId"')) {
    console.log(lines[i].substring(0, 2000));
  }
}
