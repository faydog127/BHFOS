/**
 * Seeds minimal SmartDocs templates by calling Supabase REST.
 * Run: node supabase/tests/node/seed/seed_templates_via_rest.js
 */

var CONFIG = require("../config.js");
var helpers = require("../helpers.js");

async function main() {
  // Template 1
  var t1 = {
    id: "CONFIRM-AIR-CHECK",
    name: "Free Air Check Confirmation",
    version: "1.0",
    category: "booking",
    audience: ["homeowner"],
    channels: ["email", "sms"],
    subject: "Your Free Air Check is confirmed for {{appt_date}} at {{appt_time}}",
    body_html: "<p>Hi {{first_name}}, your appointment is confirmed at {{address}} on {{appt_date}} {{appt_time}}. Prep: {{prep_tips_url}}</p><p>— {{rep_name}}</p>",
    body_text: "Hi {{first_name}}, confirmed for {{appt_date}} {{appt_time}} at {{address}}. Prep: {{prep_tips_url}} — {{rep_name}}",
    sms_fallback: "Hi {{first_name}}, confirmed for {{appt_date}} {{appt_time}}. Prep: {{prep_tips_url}} — {{rep_name}}",
    required_fields: ["first_name","address","appt_date","appt_time","prep_tips_url","rep_name"],
    attachments: {},
    active: true
  };

  var t2 = {
    id: "REQUEST-REVIEW",
    name: "Review Request",
    version: "1.0",
    category: "review",
    audience: ["homeowner"],
    channels: ["email", "sms"],
    subject: "How was your experience with The Vent Guys?",
    body_html: "<p>Hi {{first_name}}, could you share a quick review? <a href=\"{{review_link}}\">Review link</a></p>",
    body_text: "Hi {{first_name}}, review us here: {{review_link}}",
    sms_fallback: "Hi {{first_name}}, review us here: {{review_link}}",
    required_fields: ["first_name","review_link"],
    attachments: {},
    active: true
  };

  var ins = await helpers.restInsert("doc_templates", [t1, t2]);
  if (ins.status >= 200 && ins.status < 300) {
    console.log("Seeded templates via REST:", ins.json);
  } else {
    console.log("Template seed failed:", ins.status, ins.json);
    process.exit(1);
  }
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});