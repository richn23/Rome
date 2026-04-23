/**
 * Starter guidance content for speakers and learners.
 * Seeded into the /guidance Firestore collection by the Seed page.
 * Admin can edit the body text in-app after seeding.
 *
 * Body uses blank lines to separate paragraphs. Lines starting with "- "
 * are rendered as a bulleted list. Lines starting with "## " are rendered
 * as subheadings. Everything else is a paragraph.
 */

export type GuidanceSeed = {
  audience: "speaker" | "learner";
  slug: string;
  title: string;
  summary: string;
  order: number;
  body: string;
};

export const SPEAKER_GUIDANCE: GuidanceSeed[] = [
  {
    audience: "speaker",
    slug: "welcome",
    order: 1,
    title: "Welcome to SpeakSpace",
    summary:
      "What you're here to do, and why learners chose you over a classroom.",
    body: `SpeakSpace is a conversation platform, not a classroom. Learners come to you to practise speaking a language with a friendly native — not to be taught formal grammar or graded on homework.

Your job is to hold a natural, encouraging conversation at the right level, gently correct where it helps, and leave the learner feeling more confident than when they started.

## What learners value most

- Feeling safe to make mistakes
- A conversation partner who listens more than lectures
- Gentle, in-the-moment corrections, not long grammar explanations
- Warmth, curiosity, and patience

You don't need a teaching qualification. You need to be kind, interested in people, and a native speaker of the language you're offering.`,
  },
  {
    audience: "speaker",
    slug: "rules-and-conduct",
    order: 2,
    title: "Rules and conduct",
    summary: "Ground rules for every session. Short but important.",
    body: `These apply on every call, without exception:

- Treat every learner with respect. No shouting, sarcasm, or mocking.
- No romantic, flirty, or sexual content. Keep the conversation professional and friendly.
- No politics, religion, or strong personal opinions unless the learner brings it up and wants to practise discussing it.
- No discriminatory language of any kind.
- Start on time. If you are going to be late, message the learner in chat.
- Show up presentable, in a quiet place, with your camera on.
- Do not share personal contact details (phone, email, other platforms). All contact stays on SpeakSpace.
- Do not record the session. SpeakSpace does not record either.
- If a learner makes you uncomfortable, end the session politely and flag it to the admin team.

Breaking these rules can lead to your account being suspended.`,
  },
  {
    audience: "speaker",
    slug: "how-to-run-a-great-session",
    order: 3,
    title: "How to run a great session",
    summary: "A simple structure for 30- or 45-minute sessions.",
    body: `You don't need a lesson plan. A light structure works better than a rigid one.

## The first two minutes

- Say hello, use the learner's name.
- Ask an easy opener: how their day is going, what they've been up to.
- This warms them up and gives you a feel for their level before you pick a topic.

## The middle (roughly 20–35 minutes)

- Pick a topic from the session panel, or follow what the learner wants to talk about.
- Ask open questions (what, why, how, tell me about…) instead of yes/no questions.
- Let them talk. Aim for them speaking around 70% of the time.
- When they stumble, give the word or phrase and move on — don't stop to explain the grammar.
- Use the Speaker Notes panel to jot down anything worth feeding back at the end.

## The last few minutes

- Recap one or two things they did well.
- Mention one thing to try next time, framed as encouragement.
- Thank them and end the session.

Keep it warm. People remember how a conversation felt long after they've forgotten what you said.`,
  },
  {
    audience: "speaker",
    slug: "challenge-up",
    order: 4,
    title: "Challenge Up — what to do",
    summary:
      "When a learner asks to be pushed, here's how to push them without overwhelming them.",
    body: `If a learner ticks the Challenge Up box when booking, you'll see an amber "Challenge Up" badge on the booking and a reminder in your session notes panel.

It means they want a harder session than their level would normally suggest.

## What to actually do differently

- Start at their normal level for the first couple of minutes so they feel settled.
- Then lean into richer vocabulary — use one or two words a step above their level in each turn.
- Ask why / how / what if questions rather than simple factual ones.
- Don't switch topics — go deeper on the one you're on.
- Correct a little more than usual, especially on patterns you hear repeating.

## What not to do

- Don't race through the session to prove it's harder.
- Don't use slang or idioms they won't recognise without explaining them.
- Don't make them feel they've failed. Challenge is meant to feel stretching, not punishing.

If it clearly isn't landing, quietly dial it back. Their experience matters more than the label on the booking.`,
  },
  {
    audience: "speaker",
    slug: "levels-explained",
    order: 5,
    title: "Levels explained",
    summary:
      "SpeakSpace uses four friendly tiers, not CEFR. Here's what each one means.",
    body: `We don't use CEFR codes (A1, B2 etc.) because most learners don't know them. Instead we use four tiers, each with a lower and upper band.

## Beginner (lower) — 1a

Knows a handful of words and phrases. Can introduce themselves with effort. Expect long pauses and one-word answers. Your job is mostly reassurance.

## Beginner (upper) — 1b

Can put short sentences together. Still searching for basic words. Can talk about simple topics like food, family, weekend plans.

## Developing (lower) — 2a

Can hold a slow conversation on familiar topics. Frequent grammar mistakes, but the meaning usually comes through. Needs patience and clear, simple speech from you.

## Developing (upper) — 2b

Can talk about most everyday topics without getting stuck. Still makes grammar mistakes but recovers quickly. Ready for gentle correction.

## Confident (lower) — 3a

Comfortable on familiar topics, can handle a broader range of subjects with effort. Can discuss opinions and reasons.

## Confident (upper) — 3b

Handles most topics well, including abstract ones. Grammar is mostly solid. Can manage longer stretches of talking. Good vocabulary, though still gaps on specialised subjects.

## Fluent (lower) — 4a

Speaks naturally on almost any topic. Small grammar slips, occasional gaps in vocabulary. You can speak at near-natural speed.

## Fluent (upper) — 4b

Essentially proficient. Use them like a near-native conversation partner. Help them polish idiom, register, and specialised vocabulary.

Speak a half-step simpler than the learner's level to start — it's easier to step up than to step down.`,
  },
  {
    audience: "speaker",
    slug: "pay-and-sessions",
    order: 6,
    title: "Pay, ratings, and session flow",
    summary: "How you get paid, how ratings work, and what to do if tech fails.",
    body: `## How pay works

SpeakSpace takes a percentage of each session. You keep the rest. Your rate per hour is set on your profile. Sessions end when either person clicks End Session, and pay is calculated from the minutes actually spoken.

Payouts are processed monthly. You'll see your session earnings on your dashboard.

## Ratings

Learners rate you 1–5 after each session. Your average shows on your profile and affects how prominently you appear in search.

Higher ratings come from warmth and encouragement, not from being the hardest teacher.

## If the tech fails

- If the video breaks, reload the page. Your session stays active for 30 seconds.
- If the learner drops off, wait two minutes, then end the session. The learner will not be charged for the break.
- If you can't rejoin, message them through chat if it's working, otherwise just end the session and flag it to admin.`,
  },
  {
    audience: "speaker",
    slug: "faqs",
    order: 7,
    title: "Speaker FAQs",
    summary: "Quick answers to the questions speakers ask most.",
    body: `## Do I need a teaching qualification?

No. SpeakSpace is a conversation platform. You need to be a native speaker and a friendly, patient person.

## Can I prepare materials in advance?

You can, and a topic panel with prompt questions appears during the call. Most speakers find the structure light-touch — the conversation usually leads itself if you follow the learner's interests.

## What if I don't click with a learner?

It happens. Keep the session professional, end on time, and leave a brief, neutral rating note. You don't have to accept a repeat booking.

## A learner is asking for my WhatsApp / email. What do I do?

Decline politely. Say all contact needs to stay on the platform. Flag it in your next admin check-in if it's persistent.

## I need to cancel a session. How?

Go to the session in your upcoming list and cancel. Give as much notice as you can — last-minute cancellations affect your rating and may cost you future bookings.

## The learner seems very nervous. Any tips?

Go slower. Smile. Ask them about something easy and personal — pets, food, where they grew up. Let them hear their own voice in the language for a few minutes before pushing anything harder.`,
  },
];

export const LEARNER_GUIDANCE: GuidanceSeed[] = [
  {
    audience: "learner",
    slug: "getting-started",
    order: 1,
    title: "Getting started",
    summary: "How SpeakSpace works and how to book your first session.",
    body: `SpeakSpace connects you with native speakers for conversation practice. It's not a classroom — there are no grades, no homework, and no lectures. Just real conversation in the language you're learning.

## How to book

- Go to Available Now to see speakers who are online right now.
- Or go to Scheduled to pick a slot in the coming days.
- Pick the speaker and duration (30 or 45 minutes), confirm, and you'll land in a waiting room.
- Once the speaker admits you, the video call starts.

## What to expect on your first call

- A friendly hello. Your speaker will chat with you for a minute or two to get a feel for your level.
- A topic prompt on the side of the screen. Use it if you get stuck, ignore it if you don't.
- Lots of listening and gentle correction — not a grammar lesson.
- Either of you can end the call when you're done.

You'll feel nervous the first time. Everyone does. That passes after about ten minutes on your first call, and almost entirely by your second.`,
  },
  {
    audience: "learner",
    slug: "get-the-most-from-sessions",
    order: 2,
    title: "Get the most from your sessions",
    summary: "Simple habits that turn a nice chat into real progress.",
    body: `## Come with something to talk about

Spend two minutes before each session thinking of one story to tell. Something that happened this week, a film you watched, a problem at work. Having one thing ready means you never freeze on "how are you?"

## Ask for the words you don't know

If you're searching for a word, say so in the language (or English if you must). Your speaker will give it to you. Try to use it again in the next few minutes.

## Don't apologise for mistakes

Mistakes are the work. Your speaker is not judging them and neither should you. Keep going; correctness arrives with practice.

## Book regularly

Two 30-minute sessions a week beats one 60-minute session every fortnight. Frequency matters more than length.

## Try different speakers

Each native speaker has a different accent, rhythm, and vocabulary. Variety makes your listening skills flexible.`,
  },
  {
    audience: "learner",
    slug: "challenge-up",
    order: 3,
    title: "Challenge Up — when to use it",
    summary: "Asking to be pushed, and when to save it for another day.",
    body: `When you book a session, you can tick "Challenge Up". It tells your speaker you want a harder session than your level would normally get.

## Use it when

- You're feeling confident and want to stretch.
- Your current level is starting to feel a bit too easy.
- You're preparing for something specific — an interview, a trip, a conversation you're nervous about.

## Skip it when

- You're tired or stressed. Challenge Up should feel like a good kind of hard, not a bad one.
- It's your first session with this speaker. Let them get to know your normal level first.
- You've just moved up a tier. Settle in before adding more pressure.

Your speaker sees a small note that you've asked to be pushed. They'll still start gently, then ramp up the difficulty once you're warmed in.`,
  },
  {
    audience: "learner",
    slug: "levels-explained",
    order: 4,
    title: "Levels explained",
    summary:
      "The four tiers — in plain language, so you can pick the one that fits.",
    body: `SpeakSpace doesn't use technical codes like A1 or B2. Instead we use four friendly tiers, each with a lower and upper band.

## Beginner

You know some words and phrases. You can say hello, introduce yourself with effort, and point at things on a menu. Full sentences are a stretch.

## Developing

You can have a slow conversation about familiar things — family, food, your weekend. You still pause a lot to find words, and grammar slips through, but people mostly understand you.

## Confident

You can talk about most everyday topics without getting stuck, and you can give opinions and reasons. You still have gaps on unusual subjects, but you don't freeze.

## Fluent

You can hold almost any conversation at near-natural speed. Small slips remain, and you might lack specialist vocabulary, but speaking feels comfortable.

Each tier has a lower and upper band — so if you're between Developing and Confident, you'd pick Developing (upper).

## Picking the right one

Go a step lower than your instinct says. It's easier — and more enjoyable — to be at the top of a tier than scraping along at the bottom of the one above. You can always move up later, or use Challenge Up when you want to push.`,
  },
  {
    audience: "learner",
    slug: "conduct-and-safety",
    order: 5,
    title: "Conduct and safety",
    summary: "What to expect, and what to do if something feels off.",
    body: `Sessions should always feel safe and professional. Here's what's expected from both sides.

## What speakers should do

- Be on time, presentable, and in a quiet place.
- Keep the conversation professional — no flirty, romantic, or inappropriate content.
- Correct kindly, not harshly.
- Never ask for your personal contact details (phone, email, other apps).

## What's expected from you

- Be on time. If you can't make it, cancel as early as you can.
- Be respectful. Speakers are people, not a service you've paid to receive complaints from.
- Keep the call in a quiet space where you can speak freely.
- Don't share your personal contact details either — keep everything on SpeakSpace.

## If something feels wrong

End the session. You can always end it — either person can, at any time. Then flag the speaker through the admin team. We take this seriously.

You'll never be charged for a session you ended because of conduct.`,
  },
  {
    audience: "learner",
    slug: "faqs",
    order: 6,
    title: "Learner FAQs",
    summary: "Quick answers to what learners ask most.",
    body: `## I can barely speak. Can I still book?

Yes. Pick Beginner (lower) as your level and book a patient speaker. You don't need to say much — your speaker will lead gently.

## How often should I practise?

Little and often beats a lot occasionally. Two 30-minute sessions a week is a good rhythm for most people.

## What if the speaker is too fast?

Say so. You can say "slower please" or "repeat please" in your language — or in English — and they will. A good speaker will already be watching for this, but don't hesitate to ask.

## I don't feel like I'm improving. What do I do?

Change something. Try a different speaker, a different topic, a different time of day, or a shorter session. Progress isn't always visible week to week, but you'll notice it over a month or two.

## Can I have the same speaker every time?

Yes. Favourite them on their card and they'll appear in your Favourites tab. You'll also get a notification when they come online.

## The speaker didn't show up. Do I still pay?

No. If a speaker doesn't admit you within a few minutes, cancel the booking from the waiting room. You won't be charged.`,
  },
];

export const ALL_GUIDANCE: GuidanceSeed[] = [
  ...SPEAKER_GUIDANCE,
  ...LEARNER_GUIDANCE,
];
