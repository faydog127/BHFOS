// Define options for call wrap-up form fields
export const WRAP_UP_FORM_OPTIONS = {
  scripts: [
    { label: "Intro - Permit Pull", value: "INTRO_PERMIT" },
    { label: "Intro - IAQ Complaint", value: "INTRO_IAQ" },
    { label: "Follow-Up - Warm Lead", value: "FOLLOWUP_WARM" },
  ],
  results: [
    { label: "Reached Decision Maker", value: "REACHED_DM" },
    { label: "Left Voicemail", value: "VOICEMAIL" },
    { label: "Qualified – Interested", value: "QUAL_INT" },
    { label: "Qualified – Not a Fit", value: "QUAL_NOT" },
    { label: "No Show / Reschedule", value: "NO_SHOW" },
    { label: "Wrong Number / Disconnected", value: "WRONG_NUM" },
  ],
  nextSteps: [
    { label: "Schedule Follow-Up Call", value: "TASK_CALL" },
    { label: "Send Proposal", value: "TASK_PROPOSAL" },
    { label: "Email Follow-Up", value: "TASK_EMAIL" },
    { label: "SMS Text Reminder", value: "TASK_SMS" },
    { label: "Schedule Site Visit / Meeting", value: "TASK_SITE" },
    { label: "No Further Action", value: "NO_ACTION" },
  ],
};