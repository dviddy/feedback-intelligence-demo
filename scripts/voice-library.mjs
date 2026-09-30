// Authored synthetic customer voices. Openings and topic-specific endings are combined
// deterministically; these are demonstration comments, never customer data.
import { issueEndings, generalEndings, assistedEndings } from './voice-endings.mjs';
export const issueOpenings = {
  'Login Failure': [
    "I couldn't log in this morning, even with the password I used yesterday.",
    'Online banking would not accept my usual sign-in details.',
    'I only wanted to check my balance, but the login page kept turning me away.',
    'My username and password worked last week; today neither gets me into the account.',
    'After two sign-in attempts, I was still stuck at the welcome screen.',
    'The website says my credentials are wrong, but I have not changed them.',
    'I was locked out while trying to review a payment.',
    'Every time I sign in, the page sends me back to the beginning.',
    'I could not get past the account access screen before work.',
    'The login stopped working right when I needed a statement.',
    'I entered my details carefully and online banking still refused access.',
    'Signing in has become unpredictable; the same details sometimes fail.'
  ],
  'Password Reset Failure': [
    'The reset link never reached my inbox.', 'I requested a password reset, but the email did not show up.',
    'The reset code expired before I could enter it.', 'I followed the password link and landed back on the same screen.',
    'I changed my password but still could not sign in.', 'The text with the reset code did not arrive.',
    'The password recovery page said it sent an email, but I have nothing to open.',
    'I clicked the reset link and it said the link was invalid.', 'Getting a new password turned into a loop.',
    'I have requested another reset code and the first one still has not appeared.',
    'The recovery steps ended without restoring access.', 'I tried to reset my password before paying a bill and got stuck.'
  ],
  'Identity Verification Failure': [
    'The identity check would not accept my license during account opening.', 'I uploaded my documents twice and verification still failed.',
    'I could not finish the application because the ID step kept rejecting me.', 'The website asked for a clearer photo even after I retook it.',
    'My address matched my documents, but the identity step would not clear.', 'I reached verification and could not tell which detail was wrong.',
    'The document check ended my application without explaining why.', 'My passport photo was declined during the online application.',
    'I tried the identity step again in better light with the same result.', 'The application stopped at the verification screen.',
    'I could not get the ID upload accepted.', 'Verification failed after I entered the information exactly as shown on my ID.'
  ],
  'Card Decline': [
    'My card was declined at the grocery store, although the balance looked fine.', 'A routine card purchase was rejected without any warning.',
    'I tried to pay for gas and the card would not go through.', 'The card worked yesterday but was declined for lunch today.',
    'An online order failed because my card payment was refused.', 'My recurring payment was rejected even though I had available funds.',
    'The terminal declined my card while I was traveling.', 'I had to use another card when this one failed at checkout.',
    'A small purchase was declined and I cannot see a reason in the account.', 'The card keeps working in some places and failing in others.',
    'I could not complete a pharmacy purchase because the card was rejected.', 'The decline message did not tell me what to fix.'
  ],
  'Transfer Failure': [
    "My transfer didn't go through when I submitted it this morning.", 'The payment screen stopped before I could confirm the transfer.',
    'I tried moving money between accounts and got an unexplained error.', 'The external transfer was blocked without a useful reason.',
    'I thought the transfer had submitted, but it never appeared in activity.', 'A scheduled transfer is still pending and I do not know why.',
    'I could not send the payment to my saved recipient.', 'The transfer failed after I checked the amount and account details.',
    'I needed to move funds today, but the submit button would not finish.', 'My transfer request disappeared before I received a confirmation.',
    'The system rejected a transfer I make regularly.', 'I tried again with a smaller amount and the transfer still failed.'
  ],
  'Service Wait Time': [
    'I waited on hold long enough that I had to hang up.', 'The phone queue kept me waiting through my lunch break.',
    'It took a long time to reach someone about a simple question.', 'I requested a callback and did not hear back when expected.',
    'After being transferred, I had to wait all over again.', 'The wait for a support representative was longer than the issue itself.',
    'I stayed on the line because I needed help today, but the queue barely moved.', 'I called twice and spent most of the time waiting.',
    'The support line gave no useful estimate for when someone would answer.', 'I was on hold while trying to resolve a time-sensitive payment question.',
    'The first agent transferred me and the second queue took just as long.', 'I eventually reached someone, but getting there took far too much time.'
  ],
  'Unexpected Fee': [
    'I do not recognize the fee that appeared on my statement.', 'Why was I charged a monthly fee on this account?',
    'A new charge showed up and I cannot find an explanation.', 'I thought this account had no monthly fee, so the charge surprised me.',
    'The fee posted without saying what service it covered.', 'I noticed a charge while reviewing transactions and do not know what triggered it.',
    'My balance is lower because of a fee I did not expect.', 'I would like someone to explain the account charge before it happens again.',
    'The statement lists a fee, but the description is too vague to understand.', 'I was not expecting to pay for this account this month.',
    'The fee amount is small, but I still need to know why it was taken.', 'I cannot match the charge on my account to anything in the fee schedule.'
  ],
  'Resolution Failure': [
    'I spoke with support, but my original issue is still open.', 'The call ended without a clear resolution or next step.',
    'I have explained this twice and the problem has not been fixed.', 'The representative was courteous, yet the case remains unresolved.',
    'I was told someone would follow up, but I am still waiting.', 'My question was passed along and I have not received an answer.',
    'The conversation helped me understand the issue but did not solve it.', 'I called back because the first solution did not work.',
    'The case was marked complete even though I still need help.', 'I left the call unsure who owns the remaining work.',
    'The promised fix did not show up on my account.', 'Support suggested a step that led me back to the same problem.'
  ],
  'Missing Notification': [
    'I never got the transaction notification I expected.', 'The app showed the payment, but no alert came through.',
    'I only noticed the activity when I checked the account myself.', 'A deposit posted without the usual message.',
    'I have alerts turned on and still did not receive one for this charge.', 'The notification arrived too late to be useful.',
    'I was expecting a text after the transfer and nothing appeared.', 'The app did not tell me when the transaction completed.'
  ],
  'Performance Issue': [
    'The app was slow when I needed to check a payment.', 'Each screen took a while to load this morning.',
    'I waited for the balance to refresh and finally gave up.', 'The mobile app paused halfway through a routine task.',
    'Opening transactions took much longer than usual.', 'The app felt unresponsive while I was trying to finish.',
    'I had to reopen the app because it stalled.', 'The loading screen stayed up longer than I expected.'
  ],
  'Biometric Authentication Failure': [
    'Face sign-in stopped recognizing me today.', 'The fingerprint prompt failed and sent me to the password screen.',
    'I used to open the app with biometrics, but that shortcut no longer works.', 'The app asked for my face several times and still refused access.',
    'Biometric sign-in failed while I was trying to check a transaction.', 'My fingerprint was rejected even after I cleaned the sensor.',
    'Biometric sign-in failed again after I updated the app.', 'I had to type my password because biometric sign-in failed.'
  ],
  'Digital Wallet Provisioning Failure': [
    'I could not add my card to the digital wallet.', 'Wallet setup stopped while verifying my card.',
    'The add-card step failed on my phone.', 'My card appears in the app but will not provision to the wallet.',
    'I tried to set up tap-to-pay and got an error.', 'The wallet says this card cannot be added right now.',
    'I entered the card information and wallet setup never finished.', 'The verification step for mobile payments did not complete.'
  ],
  'Joint Account Digital Access Failure': [
    'The joint account is missing when I sign in.', 'I can see my own account online but not the shared one.',
    'My partner can view the joint balance and I cannot.', 'The shared account disappeared from online banking.',
    'I signed in to review a joint payment, but that account was not listed.', 'The joint account tile never loaded for me.',
    'I have access to the shared account in person, but it is absent online.', 'I cannot find the joint statement in my digital view.'
  ],
  'Transfer Recipient Setup Failure': [
    'I could not save a new transfer recipient.', 'The payee details vanished before I could confirm them.',
    'Adding a recipient failed after I entered the routing information.', 'I need to send money to someone new, but setup keeps stopping.',
    'The recipient form would not accept details that looked correct.', 'My new payee did not appear after I saved it.',
    'I tried to add the same recipient twice without success.', 'Recipient setup ended with an error and no guidance.'
  ],
  'Branch Queue': [
    'There was a long line at the branch when I arrived.', 'I waited at the counter before anyone could help.',
    'The branch visit took longer than I had planned.', 'I had to stand in line for a straightforward request.',
    'The queue moved slowly during my visit.', 'I could not tell how long the branch wait would be.'
  ],
  'Fee Explanation': [
    'The email described the fee but did not explain why it applied to me.', 'I read the fee explanation and still have the same question.',
    'The notice used terms I did not understand.', 'I need a clearer breakdown of the charge in the message.',
    'The answer about fees was too general for my account.', 'I could not tell from the email how to avoid this fee next time.'
  ],
  'Application Friction': [
    'The account application took more steps than I expected.', 'I had to restart the form after it lost my answers.',
    'I could not tell which fields were still required.', 'The online application was hard to finish on the first try.',
    'I reached the final page and was sent back to an earlier section.', 'The form asked me for the same details twice.',
    'Opening an account online felt more complicated than it should.', 'I paused the application because the next step was unclear.'
  ],
  'Deposit Issue': [
    'My ATM deposit has not shown up in the balance yet.', 'The machine accepted my deposit, but I cannot see it in activity.',
    'I need to know when the deposited funds will be available.', 'The deposit receipt and account balance do not match.',
    'I made a deposit and expected an update sooner.', 'The ATM finished the transaction without showing a clear status.'
  ],
  'Decision Delay': [
    'I have not heard when a loan decision will be made.', 'The application update gave no timeline for a decision.',
    'I need an estimate before making plans, but the message is vague.', 'I am waiting for a lending decision and do not know the next step.',
    'The status email did not say how much longer review might take.', 'I applied last week and still cannot tell where things stand.'
  ],
  'Fraud Alert': [
    'The fraud alert did not say which transaction it was about.', 'I received a security text but lacked enough detail to respond.',
    'The alert worried me because I could not identify the charge.', 'I needed more context before deciding whether the activity was mine.',
    'The fraud message told me to act without explaining what happened.', 'I could not tell if the warning related to my card or account.'
  ],
  'Financial Wellness Coaching Handoff': [
    'The branch suggested financial coaching, but I do not know how to book it.', 'I was referred for budgeting help without a clear next step.',
    'The coaching recommendation sounded useful, yet I could not find the contact details.', 'I left the branch unsure how to follow up on the financial guidance.',
    'I would like the coaching conversation, but the referral stopped there.', 'The next step after the branch referral was not clear to me.'
  ]
};

const general = {
  Positive: [
    'I handled my account request without needing any extra help.', 'The person I spoke with explained my options clearly.',
    'Taking care of this was easier than I expected.', 'The request went through quickly and I knew it was complete.',
    'I got a useful confirmation as soon as the task was finished.', 'The steps made it simple to find the information I needed.',
    'I appreciated how clearly the timeline was explained.', 'Someone answered my question the first time I asked.',
    'The account update appeared promptly and matched what I expected.', 'The details were easy to review.',
    'The support team gave me a practical next step.', 'I finished everything in one interaction.',
    'The follow-up arrived when promised and made sense.', 'I could see the status without calling anyone.',
    'The explanation was short, clear, and useful.', 'The steps were straightforward today.',
    'I found the information I needed quickly.', 'The representative listened and resolved my question.',
    'I liked getting confirmation before finishing.', 'The process worked smoothly from beginning to end.',
    'I was able to handle this on my own.', 'The information arrived at the right time.',
    'The account update was clear and easy to follow.', 'I knew exactly what would happen after submitting.',
    'I got through the account task sooner than I expected.', 'The explanation answered the question I had brought in.',
    'I was able to check the result without making a call.', 'The response arrived while I was still working on it.',
    'I found the right information on my first try.', 'It was simple to confirm the request had been handled.',
    'The steps were short enough to complete during a break.', 'I knew where things stood at each point.',
    'I appreciated the prompt follow-up.', 'The service was easy to use today.',
    'My question was resolved in one conversation.', 'I could see the change reflected in the account.',
    'The directions were practical and easy to follow.', 'I was pleased to get a clear answer.',
    'I finished the request without any surprises.', 'The update gave me confidence to move ahead.',
    'I did not have to chase down a confirmation.', 'The outcome matched what I was told to expect.',
    'I could manage the task without a second visit.', 'The details were presented in a way I understood.',
    'I was able to make my decision promptly.', 'The interaction felt organized from start to finish.',
    'I got the information before I needed to make another choice.', 'The account status was easy to verify afterward.'
  ],
  Neutral: [
    'I completed the request, though I had to look around for the next step.', 'The information was there, but it took some reading to find it.',
    'The service worked; a clearer timeline would help.', 'I received an answer and still have one follow-up question.',
    'The transaction finished, although the confirmation could be clearer.', 'I got what I needed after checking two different screens.',
    'The form was manageable, but a little more guidance would help.', 'I was able to finish once I understood the wording.',
    'The conversation was fine, though I expected a shorter wait.', 'The account update made sense after I read it twice.',
    'I found the feature eventually and would make it easier to locate.', 'The response covered the basics but not my specific situation.',
    'Everything appears correct so far; I am waiting for the final notice.', 'The process was acceptable, just less direct than I expected.',
    'I can see the status now, but I would like more detail.', 'The payment was recorded and I am checking when it will settle.',
    'I handled the task today and noted a few confusing labels.', 'The instructions were enough to continue, though not especially clear.',
    'The request went through, and I am waiting for the final update.',
    'I found the answer after checking another part of the account.',
    'The process made sense once I saw the second screen.',
    'I could finish, though I had expected fewer steps.',
    'The timing was acceptable but hard to predict.',
    'I understood the result after looking at the details again.',
    'The response covered the main point and left a small question.',
    'I completed it and would prefer a clearer status message.',
    'The instructions were usable after I read them carefully.',
    'I got the information but had to piece together the order.',
    'The task is done; I will confirm the final amount later.',
    'The service was adequate for what I needed today.'
  ],
  Negative: [
    'I needed a simple answer and ended up making several attempts.', 'The request took longer than expected for a routine task.',
    'I could not find enough information to finish confidently.', 'I reached the last step and still did not know what to do.',
    'The explanation left out the detail I needed.', 'I had to repeat the same question before getting a response.',
    'The process was harder to follow than it should have been.', 'I spent extra time correcting information that was already right.',
    'I left the interaction unsure whether the request was complete.', 'The message did not help me resolve the question.'
  ]
};

const occurrences = new Map();
export function createComment({ trend, sentiment, migratedTo, index }) {
  const key = trend || `General ${sentiment}`;
  const ordinal = occurrences.get(key) || 0;
  occurrences.set(key, ordinal + 1);
  const openings = trend ? issueOpenings[trend] : general[sentiment];
  if (!openings) throw new Error(`Missing synthetic voice for ${key}`);
  const parts = [openings[ordinal % openings.length]];
  const endings = trend ? issueEndings[trend] : generalEndings[sentiment];
  if (!endings) throw new Error(`Missing synthetic endings for ${key}`);
  const cycle = Math.floor(ordinal / openings.length);
  const [openingStep, cycleStep] = trend ? [7, 11] :
    sentiment === 'Positive' ? [8, 13] : sentiment === 'Neutral' ? [1, 7] : [1, 1];
  const endingIndex = ((ordinal % openings.length) * openingStep + cycle * cycleStep) % endings.length;
  const firstUse = ordinal < openings.length;
  if (!firstUse || (ordinal + index) % 2 !== 0) parts.push(endings[endingIndex]);
  if ((ordinal + index) % 7 === 0 && !firstUse)
    parts.push(endings[(endingIndex + 5) % endings.length]);
  if (migratedTo) {
    const choices = assistedEndings[migratedTo];
    parts.push(choices[(ordinal * 7 + index) % choices.length]);
  }
  return parts.join(' ');
}
