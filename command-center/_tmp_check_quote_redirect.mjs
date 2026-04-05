const url = "https://wwyxohjnyqnegzbxtuxs.supabase.co/functions/v1/public-quote-approve?token=5178f915-1bbb-418a-8370-9d8f3d507c8b&quote_id=2fcd98f7-0f88-459c-a3d4-227d4837f5ba&tenant_id=tvg&action=approved";
const res = await fetch(url, { redirect: "manual" });
console.log(JSON.stringify({
  status: res.status,
  location: res.headers.get("location"),
  contentType: res.headers.get("content-type")
}, null, 2));
