export const LEAGUE = {
  name: 'Top of the Falls',
  shortName: 'TOTF',
  tagline: 'Great Falls Pool Challenge List',
  region: 'Great Falls, MT',
  facebookPageName: 'Top of the Falls Facebook page',
  contact: 'Carl Higgins',
  sponsorBars: ['Silver Spur', 'Lido', 'Black Eagle Country Club'],
  envelopeDropLocations: ['Silver Spur', 'Lido', 'Black Eagle Country Club'],
  matchFeePerPlayer: 5,
  challengeResponseHours: 48,
  matchPlayDays: 10,
  weeklyChallengeLimit: 2,
  lowerSeedWinCooldownHours: 24,
  schedulingWashCooldownHours: 24,
  lossCooldownDays: 7,
  inactiveDropSpots: 2,
  inactiveReviewDays: 30,
  inactiveRemovalReviewDays: 90,
  minRace: 6,
  saratogaTopN: 20,
  disciplines: [
    { value: '8 Ball', emoji: '🎱', desc: 'BCA rules · magic rack allowed' },
    { value: '9 Ball', emoji: '🔵', desc: 'Modified BCA · call the 9 · no magic rack' },
    { value: '10 Ball', emoji: '🟡', desc: 'Pro call-shot rules · magic rack allowed' },
    { value: 'Saratoga', emoji: '🎯', desc: 'Allowed for Top 20 matches only' },
  ],
  // Detailed gameplay rules for each discipline (challenger picks the game).
  gameRules: [
    {
      game: '8 Ball',
      rules: [
        'BCA rules.',
        'Magic rack allowed.',
        'Scratch on the break: ball in hand anywhere.',
        'Scratch on the 8 is not a loss — it is ball in hand to your opponent. Exception: if you make the 8 and scratch, it is a loss.',
      ],
    },
    {
      game: '9 Ball',
      rules: [
        'Modified BCA rules.',
        'No magic rack.',
        'The 9 on the break is good in the top two pockets only.',
        'You must call the 9.',
        'No three-foul rule.',
      ],
    },
    {
      game: '10 Ball',
      rules: [
        'Pro "call shot" rules.',
        'Magic rack allowed.',
        'A 10 made early by carom or combo, if called, is not a win — the 10 is spotted and the player continues to shoot.',
        'Rack: 1 at the front, 10 in the middle, the rest random.',
        'No three-foul rule.',
      ],
    },
    {
      game: 'Saratoga',
      rules: [
        'Allowed in the Top 20 only.',
      ],
    },
  ],
  rulesSummary: [
    'You must be approved to enter the list.',
    'All games are rack-your-own. Players lag for the break; the winner breaks unless both players agree otherwise.',
    'First player to challenge gets the first chance.',
    'Top 11: you may challenge one spot up. Spots 12 and below: you may challenge up to two spots, but if no open player is in range and the open player is directly i