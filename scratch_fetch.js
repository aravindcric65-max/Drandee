const http = require("http");
http.get("http://localhost:5000/api/home/feed?mode=for_you", (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.data && parsed.data.items) {
        console.log(JSON.stringify(parsed.data.items.slice(0, 5), null, 2));
      } else {
        console.log(parsed);
      }
    } catch(e) {
      console.log("Error parsing:", e);
    }
  });
}).on("error", (err) => console.log(err));
