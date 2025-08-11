const resp = await fetch("https://api.xiaozhi.me/mcp/endpoints/list?endpoint_ids=agent_480256", {
  "headers": {
    "accept": "*/*",
    "accept-language": "en,en-US;q=0.9",
    "authorization": "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwidXNlcm5hbWUiOiIrODYxNTk2ODE0ODYwOSIsInRlbGVwaG9uZSI6Iis4NjE1OSoqKio4NjA5Iiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTQyMjg5OTIsImV4cCI6MTc2MjAwNDk5Mn0.eIXCcmRPFeqaANUJQSX5T2_XrGo-byuatnbuKC4x4DOMWg0QhyOmPhsHDbNEO-Tg9JsE2ir1EzEBKutUcDc3TA",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "Referer": "https://xiaozhi.me/"
  },
  "body": null,
  "method": "GET"
});
console.log((await resp.json()).endpoints[0].tools);
