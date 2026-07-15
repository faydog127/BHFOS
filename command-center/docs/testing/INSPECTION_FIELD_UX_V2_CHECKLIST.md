# Inspection Field UX v2 — Manual Field Test Checklist

Branch: `feature/inspection-field-ux-v2`  
Goal: complete an inspection on a phone without CRM side trips.

## TEST A — EXISTING CUSTOMER

- [ ] Open or create an inspection from a job/queue
- [ ] Customer / Lead & Property step shows linked customer and address when present
- [ ] Search finds an existing customer by name
- [ ] Select the correct property/service address when multiple exist
- [ ] Take live photos with **Take Photo**
- [ ] Review findings with Keep / Edit / Remove
- [ ] Select one Service Recommendation on the phone
- [ ] Generate Report from Review & Finish
- [ ] Confirm no CRM editor visit was required

## TEST B — NEW LEAD

- [ ] Search for a person who does not exist
- [ ] See **Customer not found** and **Add new lead**
- [ ] Enter minimum name + phone + service address
- [ ] Confirm possible duplicates are shown when phone/email/name/address match
- [ ] Save lead and verify automatic return to the inspection
- [ ] Confirm the new record is selected and address is populated
- [ ] Continue to Photos without losing inspection progress

## TEST C — PHONE LIBRARY

- [ ] Choose From Library selects one photo
- [ ] Choose From Library selects multiple photos
- [ ] Upload phone-camera images
- [ ] Upload Ferret / HEIC images from the library
- [ ] Confirm orientation and quality review still work
- [ ] Confirm upload status uses plain language
- [ ] Link evidence to findings
- [ ] Generate report

## TEST D — INTERRUPTION

- [ ] Begin inspection and upload evidence
- [ ] Navigate away / lock phone
- [ ] Return to the inspection
- [ ] Confirm customer, photos, labels, and recommendation persist
- [ ] Simulate failed upload and retry
- [ ] Finish report

## TEST E — BLOCKERS

- [ ] Keep a finding with no photo
- [ ] Confirm immediate “This finding needs a photo”
- [ ] Use **Add or select photo**
- [ ] Confirm the exact finding opens/highlights
- [ ] Confirm the warning clears after linking
- [ ] Confirm blocker wording has no technical database terms

## MEASURE

Record for one complete field run:

| Measure | Value |
| --- | --- |
| Time from final photo to report-ready |  |
| Required taps after evidence capture |  |
| Required text edits |  |
| Blockers encountered |  |
| CRM side trips |  |
| Technical wording seen (Y/N) |  |
| PDF required rewrite (Y/N) |  |

## TARGET

- No CRM side trip
- No technical blocker language
- No duplicate approval labels
- No hunting for the affected record
- Library upload works
- Recommendation completed on the phone
- Report-ready within about five minutes after evidence capture
