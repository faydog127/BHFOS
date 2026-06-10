from __future__ import annotations

import json
from pathlib import Path


def node(
    *,
    id: str,
    name: str,
    node_type: str,
    position: list[int],
    parameters: dict,
    type_version: int = 1,
    continue_on_fail: bool | None = None,
    settings: dict | None = None,
    webhook_id: str | None = None,
) -> dict:
    out: dict = {
        "parameters": parameters,
        "id": id,
        "name": name,
        "type": node_type,
        "typeVersion": type_version,
        "position": position,
    }
    if continue_on_fail is not None:
        out["continueOnFail"] = continue_on_fail
    if settings is not None:
        out["settings"] = settings
    if webhook_id is not None:
        out["webhookId"] = webhook_id
    return out


def main() -> None:
    out_path = Path("tools/n8n/workflows/review-gate-webhook.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    required_review_keys = [
        "artifact_classification",
        "board_route_chosen",
        "what_holds_up",
        "what_breaks",
        "what_is_still_underspecified",
        "minimum_required_changes",
        "revised_prompt_or_next_step_prompt",
        "revised_readiness_level",
        "revised_decision",
        "what_to_do_next",
    ]

    # JS blocks inserted via follow-up patches
    gatekeeper_js = r"""
const headers = ($json && typeof $json === 'object' && $json.headers && typeof $json.headers === 'object') ? $json.headers : {};
const body = ($json && typeof $json === 'object') ? ($json.body ?? {}) : {};

const getHeader = (name) => {
  const target = String(name).toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === target) return v;
  }
  return undefined;
};

const expectedSecret = $env.REVIEW_GATE_SECRET;
if (!expectedSecret || String(expectedSecret).trim() === '') {
  return [{ json: { status:'error', error_type:'config_missing', message:'Missing env var REVIEW_GATE_SECRET', details:'', error_http_code:500 } }];
}

const incomingSecret = getHeader('X-Review-Secret');
if (!incomingSecret || String(incomingSecret).trim() === '' || String(incomingSecret) !== String(expectedSecret)) {
  return [{ json: { status:'error', error_type:'auth_failed', message:'Missing or invalid X-Review-Secret', details:'', error_http_code:401 } }];
}

if (!body || typeof body !== 'object' || Array.isArray(body)) {
  return [{ json: { status:'error', error_type:'validation_failed', message:'Payload must be a flat JSON object', details:'Invalid payload shape', error_http_code:400 } }];
}

const required = ['artifact_id','artifact_title','artifact_type','artifact_version','review_type','submitted_by','content'];
const known = [...required,'source_model','current_stage','intended_outcome','decision_needed_now','risk_level','main_concern','desired_output','submitted_at','high_stakes'];

const normalized = {};
for (const k of known) {
  if (Object.prototype.hasOwnProperty.call(body, k) && body[k] !== null && body[k] !== undefined) normalized[k] = String(body[k]);
}

if (!normalized.submitted_at || normalized.submitted_at.trim() === '') normalized.submitted_at = new Date().toISOString();
if (!normalized.high_stakes || normalized.high_stakes.trim() === '') normalized.high_stakes = 'false';
normalized.high_stakes = normalized.high_stakes.trim().toLowerCase() === 'true' ? 'true' : 'false';

const missing = [];
for (const k of required) {
  const v = normalized[k];
  if (v === undefined || v === null || String(v).trim() === '') missing.push(k);
}

const content = (normalized.content ?? '').trim();
const reasons = [];

if (missing.length) reasons.push(`Missing/empty required fields: ${missing.join(', ')}`);
if (content.length < 150) reasons.push('content must be at least 150 characters after trimming');

const placeholderPatterns = [
  /\b(tbd|todo)\b/i,
  /lorem\s+ipsum/i,
  /\bcoming\s+soon\b/i,
  /\bplaceholder\b/i,
  /^\s*test\s*$/i,
];
for (const pat of placeholderPatterns) {
  if (pat.test(content)) { reasons.push('content appears placeholder-heavy'); break; }
}

const chunks = content.split(/[.!?\n]/g).map(s => s.trim()).filter(s => /[a-zA-Z]/.test(s) && s.length >= 20);
if (chunks.length < 2) reasons.push('content is not substantively reviewable (needs at least 2 meaningful sentences)');

if (reasons.length) {
  const detailsObj = { missing_fields: missing, reasons };
  return [{ json: { status:'error', error_type:'validation_failed', message:'Validation failed', details: JSON.stringify(detailsObj), error_http_code:400 } }];
}

const payload = {};
for (const k of known) {
  if (normalized[k] !== undefined) payload[k] = String(normalized[k]);
}

console.log('review-gate:intake_ok', { artifact_id: payload.artifact_id, artifact_version: payload.artifact_version, high_stakes: payload.high_stakes });
return [{ json: { status:'pass', payload } }];
""".strip()
    decode_contract_js = r"""
const contractText = String($json.contract_text || '').trim();
if (!contractText) {
  const err = ($json && typeof $json === 'object') ? $json.error : undefined;
  const details = err ? String(err) : 'Contract text missing after binary->json conversion';
  return [{ json: { status:'error', error_type:'config_missing', message:'Contract file not readable at /contracts/Review-Board-Operating-System.txt', details, error_http_code:500 } }];
}
return [{ json: { status:'pass', contract_text: contractText } }];
""".strip()
    build_openai_js = f"""
const gate = $items('Gatekeeper')[0]?.json;
const contract = $items('Decode Contract')[0]?.json;
if (!gate || gate.status !== 'pass') return [{{ json: {{ status:'error', error_type:'validation_failed', message:'Gatekeeper missing', details:'', error_http_code:400 }} }}];
if (!contract || contract.status !== 'pass') return [{{ json: {{ status:'error', error_type:'config_missing', message:'Contract missing', details:'', error_http_code:500 }} }}];

const payload = gate.payload;
const contractText = String(contract.contract_text || '').trim();
const forcedHighStakes = payload.high_stakes === 'true';

const requiredKeys = {json.dumps(required_review_keys)};
const allowedDecisions = ['Kill','Park','Prototype','Harden','Pilot','Produce','Scale'];

const driveRoot = String($env.REVIEW_GATE_DRIVE_ROOT_FOLDER_ID || '').trim();
if (!driveRoot) return [{{ json: {{ status:'error', error_type:'config_missing', message:'Missing REVIEW_GATE_DRIVE_ROOT_FOLDER_ID', details:'', error_http_code:500 }} }}];

const system = [
  'You are the Review Board.',
  '',
  'You must follow the canonical Review Board contract below (source of truth):',
  '---',
  contractText || '(EMPTY CONTRACT FILE)',
  '---',
  '',
  'Return ONLY valid JSON.',
  'No markdown.',
  'No commentary.',
  'No extra text.',
  'No extra keys.',
  '',
  `Your JSON MUST have exactly these keys: ${{requiredKeys.join(', ')}}`,
  '',
  'Types (MUST match exactly):',
  '- artifact_classification: string',
  '- board_route_chosen: string',
  '- what_holds_up: array of strings (use [] if none)',
  '- what_breaks: array of strings (use [] if none)',
  '- what_is_still_underspecified: array of strings (use [] if none)',
  '- minimum_required_changes: array of strings (use [] if none)',
  '- revised_prompt_or_next_step_prompt: string',
  '- revised_readiness_level: string',
  `- revised_decision: string (MUST be one of: ${{allowedDecisions.join(', ')}})`,
  '- what_to_do_next: array of strings (use [] if none)',
  '',
  'If you are unsure about a field, return the correct type with a conservative value (e.g. empty array).',
  '',
  forcedHighStakes
    ? 'High-stakes override is TRUE. You MUST set board_route_chosen to exactly: \"High-Stakes Review\".'
    : 'High-stakes override is FALSE. Choose classification and board_route_chosen per the contract.',
].join('\\n');

const user = [
  'Review this artifact intake payload. Use the contract to select classification, route, and produce the required board output.',
  '',
  'INTAKE PAYLOAD (flat JSON):',
  JSON.stringify(payload, null, 2),
].join('\\n');

const openaiBody = {{
  model: 'gpt-5.2-chat-latest',
  messages: [
    {{ role: 'system', content: system }},
    {{ role: 'user', content: user }},
  ],
  response_format: {{ type: 'json_object' }},
}};

return [{{ json: {{ status:'pass', payload, forced_high_stakes: forcedHighStakes, openai_body: openaiBody, drive_root_folder_id: driveRoot }} }}];
""".strip()
    validate_review_js = f"""
const ctx = $items('Build OpenAI Request')[0]?.json;
const forced = !!ctx?.forced_high_stakes;
const requiredKeys = {json.dumps(required_review_keys)};
const allowedDecisions = ['Kill','Park','Prototype','Harden','Pilot','Produce','Scale'];

const res = $json;
if (res && typeof res === 'object' && res.error) {{
  const err = res.error;
  return [{{ json: {{ status:'error', error_type:'openai_failed', message:'OpenAI request failed', details: JSON.stringify({{ message: err.message, code: err.code, status: err.status }}), error_http_code:502 }} }}];
}}

const body = res?.body ?? res;
const content = body?.choices?.[0]?.message?.content;
if (typeof content !== 'string' || !content.trim()) {{
  return [{{ json: {{ status:'error', error_type:'openai_failed', message:'OpenAI returned no message content', details:'', error_http_code:502 }} }}];
}}
if (content.includes('```')) {{
  return [{{ json: {{ status:'error', error_type:'invalid_review_output', message:'LLM returned markdown/code fence; expected raw JSON only', details:'', error_http_code:502 }} }}];
}}

let review;
try {{ review = JSON.parse(content); }} catch (e) {{
  return [{{ json: {{ status:'error', error_type:'invalid_review_output', message:'LLM returned non-JSON', details: String(e?.message || e), error_http_code:502 }} }}];
}}
if (!review || typeof review !== 'object' || Array.isArray(review)) {{
  return [{{ json: {{ status:'error', error_type:'invalid_review_output', message:'LLM JSON must be an object', details:'', error_http_code:502 }} }}];
}}

const missing = requiredKeys.filter(k => !(k in review));
const extras = Object.keys(review).filter(k => !requiredKeys.includes(k));
if (missing.length || extras.length) {{
  return [{{ json: {{ status:'error', error_type:'invalid_review_output', message:'LLM JSON did not match required key contract', details: JSON.stringify({{ missing_keys: missing, extra_keys: extras }}), error_http_code:502 }} }}];
}}

for (const k of ['artifact_classification','board_route_chosen','revised_prompt_or_next_step_prompt','revised_readiness_level','revised_decision']) {{
  if (typeof review[k] !== 'string') return [{{ json: {{ status:'error', error_type:'invalid_review_output', message:`Field ${{k}} must be a string`, details:'', error_http_code:502 }} }}];
}}
for (const k of ['what_holds_up','what_breaks','what_is_still_underspecified','minimum_required_changes','what_to_do_next']) {{
  if (!Array.isArray(review[k])) return [{{ json: {{ status:'error', error_type:'invalid_review_output', message:`Field ${{k}} must be an array`, details:'', error_http_code:502 }} }}];
}}
if (forced && review.board_route_chosen !== 'High-Stakes Review') {{
  return [{{ json: {{ status:'error', error_type:'invalid_review_output', message:'high_stakes override violated; board_route_chosen must be High-Stakes Review', details:'', error_http_code:502 }} }}];
}}
if (!allowedDecisions.includes(review.revised_decision)) {{
  return [{{ json: {{ status:'error', error_type:'invalid_review_output', message:'revised_decision must be one of the decision ladder values', details: JSON.stringify({{ allowed: allowedDecisions, got: review.revised_decision }}), error_http_code:502 }} }}];
}}

console.log('review-gate:review_ok', {{ artifact_id: ctx.payload.artifact_id, revised_decision: review.revised_decision, board_route: review.board_route_chosen }});
return [{{ json: {{ status:'pass', payload: ctx.payload, review, drive_root_folder_id: ctx.drive_root_folder_id }} }}];
""".strip()
    drive_context_js = r"""
const workflowVersion = String($env.REVIEW_WORKFLOW_VERSION || '').trim() || 'unknown';
const payload = $json.payload;
const review = $json.review;
const root = String($json.drive_root_folder_id || '').trim();
if (!root) return [{ json: { status:'error', error_type:'config_missing', message:'Missing REVIEW_GATE_DRIVE_ROOT_FOLDER_ID', details:'', error_http_code:500 } }];

const fileName = `${payload.artifact_id}__v${payload.artifact_version}.json`;
const artifact = {
  metadata: {
    artifact_id: payload.artifact_id,
    artifact_title: payload.artifact_title,
    artifact_version: payload.artifact_version,
    submitted_by: payload.submitted_by,
    submitted_at: payload.submitted_at,
    workflow_version: workflowVersion,
  },
  intake: payload,
  review,
};
const fileContent = JSON.stringify(artifact, null, 2);

return [{ json: { status:'pass', drive_root_folder_id: root, decision_folder_name: review.revised_decision, file_name: fileName, file_content: fileContent, payload, review } }];
""".strip()
    pick_folder_js = r"""
const ctx = $items('Drive Context')[0]?.json;
if (!ctx || ctx.status !== 'pass') return [{ json: { status:'error', error_type:'drive_failed', message:'Drive context missing', details:'', error_http_code:502 } }];
const items = $input.all().map(i => i.json);
const errItem = items.find(j => j && typeof j === 'object' && j.error);
if (errItem) {
  return [{ json: { status:'error', error_type:'drive_failed', message:'Drive folder search failed', details: JSON.stringify(errItem), error_http_code:502 } }];
}
const folders = items.filter(j => j && typeof j === 'object' && typeof j.id === 'string' && j.id && j.name === ctx.decision_folder_name);
if (folders.length > 1) return [{ json: { status:'error', error_type:'drive_failed', message:'Multiple decision folders found; cannot proceed safely', details: JSON.stringify({ decision: ctx.decision_folder_name, folder_ids: folders.map(f => f.id) }), error_http_code:502 } }];
if (folders.length === 1) return [{ json: { status:'found', decision_folder_id: folders[0].id } }];
return [{ json: { status:'create', decision_folder_name: ctx.decision_folder_name, drive_root_folder_id: ctx.drive_root_folder_id } }];
""".strip()
    folder_created_js = r"""
const created = $json;
if (created && typeof created === 'object' && created.error) {
  return [{ json: { status:'error', error_type:'drive_failed', message:'Failed to create decision folder', details: JSON.stringify({ message: created.error.message, name: created.error.name }), error_http_code:502 } }];
}
if (!created || typeof created.id !== 'string' || !created.id) {
  return [{ json: { status:'error', error_type:'drive_failed', message:'Drive did not return created folder id', details:'', error_http_code:502 } }];
}
return [{ json: { status:'found', decision_folder_id: created.id } }];
""".strip()
    dup_check_js = r"""
const ctx = $items('Drive Context')[0]?.json;
const items = $input.all().map(i => i.json);
const errItem = items.find(j => j && typeof j === 'object' && j.error);
if (errItem) {
  return [{ json: { status:'error', error_type:'drive_failed', message:'Drive duplicate check failed', details: JSON.stringify(errItem), error_http_code:502 } }];
}
const found = items.filter(j => j && typeof j === 'object' && typeof j.id === 'string' && j.id);
if (found.length) return [{ json: { status:'error', error_type:'duplicate_submission', message:'Duplicate artifact_id + artifact_version already exists', details: JSON.stringify({ file_name: ctx.file_name, file_ids: found.map(f => f.id) }), error_http_code:409 } }];
return [{ json: { status:'pass' } }];
""".strip()
    drive_created_js = r"""
const created = $json;
if (created && typeof created === 'object' && created.error) {
  return [{ json: { status:'error', error_type:'drive_failed', message:'Drive file creation failed', details: JSON.stringify({ message: created.error.message, name: created.error.name }), error_http_code:502 } }];
}
if (!created || typeof created.id !== 'string' || !created.id) {
  return [{ json: { status:'error', error_type:'drive_failed', message:'Drive did not return file id', details:'', error_http_code:502 } }];
}
return [{ json: { status:'pass', file_id: created.id } }];
""".strip()

    nodes: list[dict] = [
        node(
            id="w1",
            name="Webhook",
            node_type="n8n-nodes-base.webhook",
            type_version=1,
            position=[-900, 0],
            webhook_id="review-gate-webhook",
            parameters={
                "httpMethod": "POST",
                "path": "review-gate",
                "responseMode": "responseNode",
                "options": {},
            },
        ),
        node(
            id="w2",
            name="Gatekeeper",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[-660, 0],
            parameters={"jsCode": gatekeeper_js},
        ),
        node(
            id="w3",
            name="Passed Gate?",
            node_type="n8n-nodes-base.if",
            type_version=1,
            position=[-420, 0],
            parameters={
                "conditions": {
                    "string": [
                        {
                            "value1": "={{ $json.status }}",
                            "operation": "equal",
                            "value2": "pass",
                        }
                    ]
                }
            },
        ),
        node(
            id="w4",
            name="Respond Error",
            node_type="n8n-nodes-base.respondToWebhook",
            type_version=1,
            position=[-180, 200],
            parameters={
                "respondWith": "json",
                "responseBody": "={{ { status: 'error', error_type: $json.error_type || 'unknown_error', message: $json.message || 'An error occurred', details: $json.details || '' } }}",
                "options": {
                    "responseCode": "={{ $json.error_http_code || 500 }}",
                    "responseHeaders": {
                        "entries": [
                            {"name": "Content-Type", "value": "application/json"}
                        ]
                    },
                },
            },
        ),
        node(
            id="w5",
            name="Read Contract",
            node_type="n8n-nodes-base.readBinaryFile",
            type_version=1,
            position=[-180, -120],
            parameters={"filePath": "/contracts/Review-Board-Operating-System.txt"},
            continue_on_fail=True,
        ),
        node(
            id="w5a",
            name="Contract Binary → JSON",
            node_type="n8n-nodes-base.moveBinaryData",
            type_version=1,
            position=[-60, -120],
            parameters={
                "mode": "binaryToJson",
                "setAllData": False,
                "sourceKey": "data",
                "destinationKey": "contract_text",
                "options": {
                    "encoding": "utf8",
                    "keepSource": False,
                    "keepAsBase64": False,
                },
            },
            continue_on_fail=True,
        ),
        node(
            id="w6",
            name="Decode Contract",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[60, -120],
            parameters={"jsCode": decode_contract_js},
        ),
        node(
            id="w7",
            name="Contract OK?",
            node_type="n8n-nodes-base.if",
            type_version=1,
            position=[300, -120],
            parameters={
                "conditions": {
                    "string": [
                        {
                            "value1": "={{ $json.status }}",
                            "operation": "equal",
                            "value2": "pass",
                        }
                    ]
                }
            },
        ),
        node(
            id="w8",
            name="Build OpenAI Request",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[540, -120],
            parameters={"jsCode": build_openai_js},
        ),
        node(
            id="w9",
            name="Has OpenAI Key?",
            node_type="n8n-nodes-base.if",
            type_version=1,
            position=[780, -120],
            parameters={
                "conditions": {
                    "string": [
                        {"value1": "={{ $env.OPENAI_API_KEY }}", "operation": "isNotEmpty"}
                    ]
                }
            },
        ),
        node(
            id="w10",
            name="OpenAI Review (HTTP)",
            node_type="n8n-nodes-base.httpRequest",
            type_version=4,
            position=[1020, -240],
            continue_on_fail=True,
            parameters={
                "method": "POST",
                "url": "https://api.openai.com/v1/chat/completions",
                "authentication": "none",
                "sendHeaders": True,
                "specifyHeaders": "keypair",
                "headerParameters": {
                    "parameters": [
                        {
                            "name": "Authorization",
                            "value": "={{ 'Bearer ' + $env.OPENAI_API_KEY }}",
                        },
                        {"name": "Content-Type", "value": "application/json"},
                    ]
                },
                "sendBody": True,
                "contentType": "json",
                "specifyBody": "json",
                "jsonBody": "={{ $json.openai_body }}",
                "options": {
                    "response": {"response": {"responseFormat": "json", "fullResponse": True}}
                },
            },
        ),
        node(
            id="w11",
            name="Validate Review Output",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[1260, -240],
            parameters={"jsCode": validate_review_js},
        ),
        node(
            id="w12",
            name="Review OK?",
            node_type="n8n-nodes-base.if",
            type_version=1,
            position=[1500, -240],
            parameters={
                "conditions": {
                    "string": [
                        {
                            "value1": "={{ $json.status }}",
                            "operation": "equal",
                            "value2": "pass",
                        }
                    ]
                }
            },
        ),
        node(
            id="w13",
            name="Drive Context",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[1740, -240],
            parameters={"jsCode": drive_context_js},
        ),
        node(
            id="w14",
            name="Drive Context OK?",
            node_type="n8n-nodes-base.if",
            type_version=1,
            position=[1980, -240],
            parameters={
                "conditions": {
                    "string": [
                        {
                            "value1": "={{ $json.status }}",
                            "operation": "equal",
                            "value2": "pass",
                        }
                    ]
                }
            },
        ),
        node(
            id="w15",
            name="Drive Search Decision Folder",
            node_type="n8n-nodes-base.googleDrive",
            type_version=3,
            position=[2220, -360],
            continue_on_fail=True,
            settings={"alwaysOutputData": True},
            parameters={
                "resource": "fileFolder",
                "operation": "search",
                "searchMethod": "query",
                "queryString": "={{ \"mimeType = 'application/vnd.google-apps.folder' and name = '\" + $json.decision_folder_name + \"' and trashed = false\" }}",
                "returnAll": False,
                "limit": 10,
                "filter": {
                    "folderId": {"mode": "id", "value": "={{ $json.drive_root_folder_id }}"},
                    "whatToSearch": "folders",
                    "includeTrashed": False,
                },
            },
        ),
        node(
            id="w16",
            name="Pick or Create Decision Folder",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[2460, -360],
            parameters={"jsCode": pick_folder_js},
        ),
        node(
            id="w17",
            name="Have Folder?",
            node_type="n8n-nodes-base.if",
            type_version=1,
            position=[2700, -360],
            parameters={
                "conditions": {
                    "string": [
                        {
                            "value1": "={{ $json.status }}",
                            "operation": "equal",
                            "value2": "found",
                        }
                    ]
                }
            },
        ),
        node(
            id="w18",
            name="Drive Create Decision Folder",
            node_type="n8n-nodes-base.googleDrive",
            type_version=3,
            position=[2940, -240],
            continue_on_fail=True,
            parameters={
                "resource": "folder",
                "operation": "create",
                "name": "={{ $json.decision_folder_name }}",
                "folderId": {"mode": "id", "value": "={{ $json.drive_root_folder_id }}"},
                "options": {},
            },
        ),
        node(
            id="w19",
            name="Folder Create Result",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[3180, -240],
            parameters={"jsCode": folder_created_js},
        ),
        node(
            id="w20",
            name="Drive Search Duplicate File",
            node_type="n8n-nodes-base.googleDrive",
            type_version=3,
            position=[2940, -480],
            continue_on_fail=True,
            settings={"alwaysOutputData": True},
            parameters={
                "resource": "fileFolder",
                "operation": "search",
                "searchMethod": "query",
                "queryString": "={{ \"name = '\" + $items('Drive Context')[0].json.file_name + \"' and trashed = false\" }}",
                "returnAll": False,
                "limit": 2,
                "filter": {
                    "folderId": {"mode": "id", "value": "={{ $json.decision_folder_id }}"},
                    "whatToSearch": "files",
                    "includeTrashed": False,
                },
            },
        ),
        node(
            id="w21",
            name="Duplicate Check Result",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[3180, -480],
            parameters={"jsCode": dup_check_js},
        ),
        node(
            id="w22",
            name="Not Duplicate?",
            node_type="n8n-nodes-base.if",
            type_version=1,
            position=[3420, -480],
            parameters={
                "conditions": {
                    "string": [
                        {
                            "value1": "={{ $json.status }}",
                            "operation": "equal",
                            "value2": "pass",
                        }
                    ]
                }
            },
        ),
        node(
            id="w23",
            name="Drive Create File",
            node_type="n8n-nodes-base.googleDrive",
            type_version=3,
            position=[3660, -600],
            continue_on_fail=True,
            parameters={
                "resource": "file",
                "operation": "createFromText",
                "content": "={{ $items('Drive Context')[0].json.file_content }}",
                "name": "={{ $items('Drive Context')[0].json.file_name }}",
                "folderId": {
                    "mode": "id",
                    "value": "={{ $items('Pick or Create Decision Folder')[0].json.decision_folder_id || $items('Folder Create Result')[0].json.decision_folder_id }}",
                },
                "options": {},
            },
        ),
        node(
            id="w24",
            name="Drive Create Result",
            node_type="n8n-nodes-base.code",
            type_version=2,
            position=[3900, -600],
            parameters={"jsCode": drive_created_js},
        ),
        node(
            id="w25",
            name="Drive Write OK?",
            node_type="n8n-nodes-base.if",
            type_version=1,
            position=[4140, -600],
            parameters={
                "conditions": {
                    "string": [
                        {
                            "value1": "={{ $json.status }}",
                            "operation": "equal",
                            "value2": "pass",
                        }
                    ]
                }
            },
        ),
        node(
            id="w26",
            name="Respond Success",
            node_type="n8n-nodes-base.respondToWebhook",
            type_version=1,
            position=[4380, -720],
            parameters={
                "respondWith": "json",
                "responseBody": "={{ { status:'success', artifact_id: $items('Drive Context')[0].json.payload.artifact_id, file_id: $json.file_id, reviewed_at: $now.toISO(), review: $items('Drive Context')[0].json.review } }}",
                "options": {
                    "responseCode": 200,
                    "responseHeaders": {
                        "entries": [
                            {"name": "Content-Type", "value": "application/json"}
                        ]
                    },
                },
            },
        ),
    ]

    connections = {
        "Webhook": {"main": [[{"node": "Gatekeeper", "type": "main", "index": 0}]]},
        "Gatekeeper": {"main": [[{"node": "Passed Gate?", "type": "main", "index": 0}]]},
        "Passed Gate?": {
            "main": [
                [{"node": "Read Contract", "type": "main", "index": 0}],
                [{"node": "Respond Error", "type": "main", "index": 0}],
            ]
        },
        "Read Contract": {
            "main": [[{"node": "Contract Binary → JSON", "type": "main", "index": 0}]]
        },
        "Contract Binary → JSON": {
            "main": [[{"node": "Decode Contract", "type": "main", "index": 0}]]
        },
        "Decode Contract": {"main": [[{"node": "Contract OK?", "type": "main", "index": 0}]]},
        "Contract OK?": {
            "main": [
                [{"node": "Build OpenAI Request", "type": "main", "index": 0}],
                [{"node": "Respond Error", "type": "main", "index": 0}],
            ]
        },
        "Build OpenAI Request": {"main": [[{"node": "Has OpenAI Key?", "type": "main", "index": 0}]]},
        "Has OpenAI Key?": {
            "main": [
                [{"node": "OpenAI Review (HTTP)", "type": "main", "index": 0}],
                [{"node": "Respond Error", "type": "main", "index": 0}],
            ]
        },
        "OpenAI Review (HTTP)": {"main": [[{"node": "Validate Review Output", "type": "main", "index": 0}]]},
        "Validate Review Output": {"main": [[{"node": "Review OK?", "type": "main", "index": 0}]]},
        "Review OK?": {
            "main": [
                [{"node": "Drive Context", "type": "main", "index": 0}],
                [{"node": "Respond Error", "type": "main", "index": 0}],
            ]
        },
        "Drive Context": {"main": [[{"node": "Drive Context OK?", "type": "main", "index": 0}]]},
        "Drive Context OK?": {
            "main": [
                [{"node": "Drive Search Decision Folder", "type": "main", "index": 0}],
                [{"node": "Respond Error", "type": "main", "index": 0}],
            ]
        },
        "Drive Search Decision Folder": {
            "main": [
                [
                    {
                        "node": "Pick or Create Decision Folder",
                        "type": "main",
                        "index": 0,
                    }
                ]
            ]
        },
        "Pick or Create Decision Folder": {"main": [[{"node": "Have Folder?", "type": "main", "index": 0}]]},
        "Have Folder?": {
            "main": [
                [{"node": "Drive Search Duplicate File", "type": "main", "index": 0}],
                [{"node": "Drive Create Decision Folder", "type": "main", "index": 0}],
            ]
        },
        "Drive Create Decision Folder": {"main": [[{"node": "Folder Create Result", "type": "main", "index": 0}]]},
        "Folder Create Result": {"main": [[{"node": "Drive Search Duplicate File", "type": "main", "index": 0}]]},
        "Drive Search Duplicate File": {"main": [[{"node": "Duplicate Check Result", "type": "main", "index": 0}]]},
        "Duplicate Check Result": {"main": [[{"node": "Not Duplicate?", "type": "main", "index": 0}]]},
        "Not Duplicate?": {
            "main": [
                [{"node": "Drive Create File", "type": "main", "index": 0}],
                [{"node": "Respond Error", "type": "main", "index": 0}],
            ]
        },
        "Drive Create File": {"main": [[{"node": "Drive Create Result", "type": "main", "index": 0}]]},
        "Drive Create Result": {"main": [[{"node": "Drive Write OK?", "type": "main", "index": 0}]]},
        "Drive Write OK?": {
            "main": [
                [{"node": "Respond Success", "type": "main", "index": 0}],
                [{"node": "Respond Error", "type": "main", "index": 0}],
            ]
        },
    }

    workflow = [
        {
            "name": "Review Gate (Webhook → OpenAI → Drive)",
            "active": False,
            "nodes": nodes,
            "connections": connections,
            "settings": {"executionOrder": "v1"},
            "staticData": None,
            "meta": None,
            "pinData": {},
            "tags": [],
        }
    ]

    out_path.write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
