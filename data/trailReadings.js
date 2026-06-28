const trailReadings = {
  25: {
    id: "trail-25",
    unitId: 25,
    unitLabel: "Unit 2 Reading",
    title: "A Clear First Reply",
    level: "A1-A2",
    sourceType: "trail",
    summary: "Practice a short support reply with polite requests for more details.",
    text:
      "Hi Ana, thank you for contacting support. I will check this issue for you. Could you please send me more details about the problem? A screenshot or the exact error message would help. As soon as I have an update, I will let you know."
  },
  6: {
    id: "trail-6",
    unitId: 6,
    title: "Keeping the Customer Updated",
    level: "A2-B1",
    sourceType: "trail",
    summary: "Read a case update and notice how the message explains progress without overpromising.",
    text:
      "Hi Sam, I am still investigating the case with our internal team. We found that the issue happens after the user changes the account settings. I am checking the next steps now. I will share another update as soon as we confirm the cause."
  },
  16: {
    id: "trail-16",
    unitId: 16,
    title: "A Professional Tone",
    level: "B1-B2",
    sourceType: "trail",
    summary: "Read a confident message that stays polite while setting expectations.",
    text:
      "Thank you for your patience while we review this request. At this point, we need to confirm a few technical details before recommending a solution. I understand the urgency, and I will keep you informed as soon as we have a reliable update."
  }
};

function getTrailReading(unitId) {
  return trailReadings[unitId] || trailReadings[25];
}

module.exports = {
  getTrailReading,
  trailReadings
};
