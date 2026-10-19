export function sampleDraft() {
  return {
    fictional: true, title: 'Autumn Tails Rally Weekend', host: 'Prairie Paws Sport Club', date: '2026-11-21',
    timezone: 'America/Edmonton', venue: 'The Meadow Training Hall', address: 'Fictional venue · Edmonton, Alberta',
    secretary: 'Alex Morgan (sample)', email: 'secretary@example.com', chair: 'Jamie Taylor (sample)',
    trialNumber: '', approved: false, approvalEvidence: '', reviewed: false, theme: 'forest',
    opens: '2026-10-24', closes: '2026-11-14', capacity: 'Limited entry · closes when full', entryUrl: 'https://example.com/entries',
    intro: 'Bring your best teammate. Join us for a welcoming day of Rally, small victories, and very good dogs.',
    timing: 'Doors open 8:00 am · Check-in 8:15 am · General briefing 8:45 am · First event 9:00 am.',
    allowLate: false, dayOf: 'Day-of entries are not offered.', orderNote: 'the final running schedule will accompany your entry confirmation.',
    payment: 'Sample only: payment instructions will be provided by your trial secretary. All fees are listed in Canadian dollars; applicable taxes must be stated before publication.',
    confirmations: 'The secretary will confirm acceptance and payment status by email. Please contact us if you have not received confirmation within five days.',
    facilities: 'Indoor ring with a nonslip surface. Bring clean indoor shoes, a crate, water and your favourite teammate. Parking and accessible washrooms are available. Confirm all facilities before use.',
    accommodations: 'Please include accommodation requests with your entry. The secretary will coordinate a decision with the assigned judge and advise you before trial day.',
    awards: 'Qualifying ribbons for qualifying Rally runs. Optional placement and title ribbons will be confirmed by the host.',
    moveups: 'Request move-ups through the secretary. Availability depends on offered events, applicable CARO requirements and capacity. Same-day move-up policy must be confirmed by the host.',
    refunds: 'Host policy must be reviewed before publication. Mandatory CARO refund provisions apply, including a bitch coming into season after entries close; a veterinary note may be requested.',
    siteRules: 'Keep dogs under control and on leash outside the ring. Give other teams space, clean up after your dog, and follow the venue and trial officials’ directions.',
    waiver: 'DRAFT PLACEHOLDER — Replace with the host’s approved general agreement and participation waiver before publication. This sample text is not a waiver.',
    events: [
      { id: 'e1', round: 1, level: 'Novice', format: 'Regular', stream: 'B', judge: 'Robin Ellis (sample)', exercises: '' },
      { id: 'e2', round: 2, level: 'Intermediate', format: 'Regular', stream: 'B', judge: 'Robin Ellis (sample)', exercises: '' },
      { id: 'e3', round: 3, level: 'Advanced', format: 'Regular', stream: 'B / C', judge: 'Casey Reed (sample)', exercises: '' },
      { id: 'e4', round: 4, level: 'Advanced', format: 'Team', stream: 'B / C', judge: 'Casey Reed (sample)', exercises: '' },
      { id: 'e5', round: 5, level: 'Working', format: 'Working', stream: 'Rookie / Elite', judge: 'Robin Ellis (sample)', exercises: 'Drop on Recall · Retrieve on Flat · Barrel Racing' },
    ],
    fees: [{ label: 'Regular Rally', cents: 2500, unit: 'per dog / event' }, { label: 'Team Rally', cents: 1250, unit: 'per dog / event' }, { label: 'Working', cents: 600, unit: 'per exercise' }, { label: 'FEO', cents: 1500, unit: 'per dog / event' }],
  };
}
