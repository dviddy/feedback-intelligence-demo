// Synthetic closing thoughts are written for the experience described, rather than
// appended from a small generic pool shared by every customer.
export const issueEndings = {
  'Login Failure': [
    'I checked the spelling before trying again.', 'I missed a chance to review the payment before it went out.',
    'The error did not say whether my account was locked.', 'I only needed a quick balance check.',
    'I stopped after the third attempt because I did not want to trigger a lockout.',
    'It worked after I called, but I still do not know why the sign-in failed.',
    'I would like to know which detail the site is rejecting.', 'I came back after work and found the same access problem.',
    'That left me relying on an old balance for the rest of the day.',
    'I could not tell if the trouble was with my password or the website.'
  ],
  'Password Reset Failure': [
    'I checked the spam folder before requesting another link.', 'The second code arrived after the first one had expired.',
    'I still could not review my account after completing the reset.', 'I needed access before a bill was due.',
    'The recovery page gave me no way to see whether the request went through.',
    'I waited for the message and then had to start over.', 'A new link finally arrived, but the older one was already unusable.',
    'I would like the recovery instructions to say how long a code stays valid.'
  ],
  'Identity Verification Failure': [
    'I retook the photo in daylight and received the same response.', 'I was ready to finish opening the account.',
    'The screen did not identify which document detail needed attention.',
    'I could not tell whether the upload failed or the document itself was declined.',
    'The application was saved, but the identity step remained incomplete.',
    'I would like a way to correct the information without starting over.',
    'I set the documents aside and tried again that evening.', 'I ended up asking what form of identification would be accepted.',
    'The photograph looked clear on my phone, which made the rejection confusing.',
    'I had already entered the rest of my application details.'
  ],
  'Card Decline': [
    'I used another way to pay and checked the balance afterward.', 'The cashier could not tell me why it failed.',
    'There was enough money in the account for that purchase.', 'I needed to complete the purchase before leaving.',
    'The same card worked at another store later.', 'I would like to know if there is a temporary block on it.',
    'I was embarrassed to hold up the line while trying again.', 'The decline did not appear in my recent activity.',
    'I could not decide whether it was safe to try the card again.',
    'The merchant asked me to contact the bank for an explanation.'
  ],
  'Transfer Failure': [
    'I checked both accounts before trying a second time.', 'The recipient was expecting the money today.',
    'I could not tell whether the first request had been submitted.', 'I held off on retrying because I did not want two transfers.',
    'The error appeared only after I confirmed the amount.', 'I needed a clear status before arranging another payment.',
    'The destination details were the same ones I had used before.',
    'I looked in activity and found no record of the attempt.',
    'I would like the message to identify what prevented the transfer.',
    'I returned later, but the payment was still not complete.'
  ],
  'Service Wait Time': [
    'I had to leave before anyone picked up.', 'The hold music restarted after I was transferred.',
    'I was trying to resolve a payment question during my break.', 'The agent was helpful once I finally reached one.',
    'A callback estimate would have made it easier to plan.', 'I stayed on the line because the question could not wait.',
    'The queue gave me no indication of my place in line.', 'I had to call back the next morning.',
    'I repeated my question after moving to another agent.', 'The wait took longer than the conversation itself.'
  ],
  'Unexpected Fee': [
    'I checked the account terms and could not find the reason for it.',
    'The amount changed what I thought was available to spend.', 'I would like the charge tied to a specific account event.',
    'I only noticed it while reconciling the statement.', 'The description did not match any service I remember using.',
    'I want to know whether it will appear again next month.',
    'I believed I had met the requirement for avoiding that charge.',
    'A notice before the charge posted would have helped.',
    'The explanation in the fee schedule was hard to apply to my situation.',
    'I am asking because the balance changed without warning.'
  ],
  'Resolution Failure': [
    'I kept the case number because I may need to call again.', 'The promised follow-up date has passed.',
    'I appreciated the agent, but the account still shows the same problem.',
    'I need to know who is responsible for the next action.',
    'Repeating the whole story on another call would be frustrating.',
    'The suggested fix worked briefly and then the issue returned.',
    'I checked the case status and found no update.',
    'The conversation ended before we agreed on a solution.',
    'I would like a clear update on what remains open.',
    'I am waiting to see whether the promised change appears.'
  ],
  'Missing Notification': [
    'I found the transaction only by opening the app.', 'The alert setting still appears to be on.',
    'I wanted to know as soon as the payment posted.', 'A timely message would have helped me confirm the activity.',
    'I checked my phone settings and saw no blocked alerts.', 'The missing message made it harder to track the deposit.',
    'I noticed the charge later in the account history.', 'I would like to know whether alerts are delayed today.'
  ],
  'Performance Issue': [
    'I reopened the app to finish checking the balance.', 'The delay made a quick task take several minutes.',
    'The screen eventually loaded after I stopped tapping.', 'I could not tell whether my last action had registered.',
    'It seemed faster when I tried again later.', 'I was trying to finish before leaving home.',
    'I gave up and checked the account another way.', 'The loading indicator stayed visible through the whole attempt.'
  ],
  'Biometric Authentication Failure': [
    'The password option let me in after the face check failed.', 'I had not changed the phone settings.',
    'I tried the fingerprint twice before switching methods.',
    'I would like to know whether the biometric setting needs to be reset.',
    'The fallback worked, but it added several steps.', 'The prompt kept returning after each attempt.'
  ],
  'Digital Wallet Provisioning Failure': [
    'I was hoping to use the phone for a purchase that afternoon.',
    'The physical card still works, which makes the wallet error confusing.',
    'I reached the verification step and could not get past it.',
    'I would like to know whether the card is eligible for the wallet.',
    'Trying again produced the same setup message.', 'I used the physical card instead.'
  ],
  'Joint Account Digital Access Failure': [
    'I needed to review a shared payment.', 'My partner can still see the account on their device.',
    'The account was visible to me last month.', 'I would like to know whether my access changed.',
    'I checked the account list twice before asking about it.',
    'I can see my individual balance but not the shared balance.'
  ],
  'Transfer Recipient Setup Failure': [
    'I did not want to reenter the recipient details a third time.',
    'The account number was checked before I saved it.',
    'I cannot complete the payment until the payee appears.',
    'I would like the form to point to the field that needs correction.',
    'The setup screen gave no confirmation.', 'The recipient was not in the list when I returned.'
  ],
  'Branch Queue': [
    'I could not tell how many people were ahead of me.',
    'I had to leave and come back later.', 'The employee was helpful once I reached the counter.',
    'A wait estimate would have helped me plan the visit.',
    'The line moved slowly even though my request was simple.',
    'I was trying to finish during my lunch hour.'
  ],
  'Fee Explanation': [
    'I still could not tell which account activity triggered it.',
    'The wording in the message was too broad for my question.',
    'I wanted an example showing when this charge applies.',
    'I had to look up the fee schedule separately.',
    'The email answered the general policy but not my account situation.',
    'I would like the amount and reason stated together.'
  ],
  'Application Friction': [
    'I saved my progress so I could return when I had more time.',
    'The final step did not say which answer needed correction.',
    'I had to reenter information I had already supplied.',
    'A progress indicator would have helped me finish.',
    'I nearly abandoned the account application.',
    'I would like a clear confirmation when the form is complete.',
    'The second attempt went further but still did not submit.',
    'I expected to finish without calling for help.'
  ],
  'Deposit Issue': [
    'I kept the ATM receipt while waiting for the balance to update.',
    'The account activity did not yet show the amount I deposited.',
    'I needed those funds available for a payment.',
    'I would like an estimate of when the deposit will post.',
    'I checked again in the evening and still saw no change.',
    'The machine completed the transaction without an obvious status.'
  ],
  'Decision Delay': [
    'I am holding off on plans until I hear back.',
    'The status message did not give a review date.',
    'I would like to know whether any documents are still needed.',
    'I checked the application status before contacting anyone.',
    'The uncertainty makes it hard to compare my options.',
    'A rough timeline would help me plan.'
  ],
  'Fraud Alert': [
    'I did not want to dismiss a warning without checking the charge.',
    'The message lacked enough transaction detail to respond confidently.',
    'I opened the account to see whether the activity was mine.',
    'A merchant name would have made the alert more useful.',
    'I waited to reply until I could review the card activity.',
    'I would like the alert to say which account it concerns.'
  ],
  'Financial Wellness Coaching Handoff': [
    'I left with a brochure but no appointment information.',
    'The conversation made me interested in the coaching service.',
    'I would like to know who to contact next.',
    'I looked online afterward and could not find the referral.',
    'A follow-up message would help me schedule a session.',
    'I still want the budgeting guidance we discussed.'
  ]
};

export const generalEndings = {
  Positive: [
    'I could see the outcome right away.', 'That saved me another trip.',
    'I appreciated knowing the status before I left.', 'The instructions matched what actually happened.',
    'It felt easy to finish in one sitting.', 'I did not have to repeat any details.',
    'The timing worked well for my schedule.', 'I had everything I needed to continue.',
    'The confirmation made the result easy to trust.', 'I would use that process again.',
    'The answer was specific to my question.', 'It took less time than I had expected.',
    'I knew what to expect afterward.', 'The information was easy to find.',
    'The follow-up arrived when promised.', 'I felt comfortable moving on to the next task.',
    'There were no surprises at the final step.', 'I was glad to avoid an extra call.',
    'The details were clear enough to act on.', 'I could finish without asking someone else.',
    'The account view reflected the change promptly.', 'I left with a useful answer.',
    'It was reassuring to see the request marked complete.', 'The whole exchange was straightforward.',
    'I liked being able to check the result myself.', 'The process made sense on the first try.',
    'The person helping me understood the question.', 'I got the document while I still needed it.',
    'The next action was clear.', 'The update reached me at a good time.',
    'I was able to keep the task moving.', 'The final message explained the outcome.',
    'I did not need to start over.', 'I could make a decision with the information provided.',
    'I appreciated the direct explanation.', 'The service worked as described.',
    'I had enough time to handle the rest of my day.', 'The record was easy to check afterward.',
    'It made a routine account task less stressful.', 'I was done before my appointment.',
    'I knew where to look if I had another question.', 'The response came while it was still useful.',
    'I felt the request had been handled carefully.', 'The sequence of steps was easy to follow.',
    'I was pleased with how the matter ended.', 'The information fit what I was trying to do.',
    'I did not need a second explanation.', 'I could confirm the change before signing out.'
  ],
  Neutral: [
    'I would check the status again later.', 'The result was acceptable for now.',
    'I could continue once I found the right page.', 'I still have a small question about timing.',
    'The information covered most of what I needed.', 'I made a note to confirm the final amount.',
    'I was able to proceed after reading the instructions twice.',
    'I would prefer a clearer confirmation next time.', 'Nothing appears wrong, but the wording could be simpler.',
    'I will wait for the next update before taking action.', 'The task was completed with a little extra effort.',
    'I found the answer after checking another section.', 'I can work with the current process.',
    'A more precise date would be useful.', 'I would like the status shown in one place.',
    'The experience was fine once I understood the labels.',
    'I saved the message so I could refer to it later.', 'I am watching for the final confirmation.',
    'It took a bit longer than I planned.', 'The explanation was adequate, though brief.',
    'I could tell the request was moving forward.', 'I am still comparing the available options.',
    'A small wording change would make it clearer.', 'I will review the account again tomorrow.'
  ],
  Negative: [
    'I had to set the task aside for the day.', 'I still could not confirm the result.',
    'I spent longer on this than the request warranted.', 'I had to look elsewhere for an answer.',
    'I did not know whether another attempt would help.', 'I would like a more specific response.',
    'The uncertainty held up my next step.', 'I came away with the same question.',
    'I needed to call after the self-service steps failed.', 'The correction did not appear when expected.',
    'I was left to piece together what happened.', 'I had to repeat information I already supplied.'
  ]
};

export const assistedEndings = {
  'Contact Center / Phone': [
    'I called support after the online attempt failed.', 'I used the phone line to find out what happened.',
    'A contact center agent helped me continue.', 'I ended up calling because I could not finish digitally.',
    'I spoke with someone by phone about the next step.', 'The digital route stalled, so I phoned for help.',
    'I had to call before I could move forward.', 'I took the account question to the support line.',
    'I used a phone conversation to resolve the uncertainty.', 'I asked an agent on the phone to check the request.'
  ],
  Chat: [
    'I moved to chat when the online steps stopped.', 'A chat agent explained what to try next.',
    'I opened a support chat to check the status.', 'I messaged support after the digital attempt failed.',
    'I used chat to ask whether the request went through.', 'I could only continue after talking with someone in chat.',
    'A chat conversation gave me the next step.', 'I switched to chat for a more specific answer.',
    'I asked support in chat to review the error.', 'I finished by contacting the chat team.'
  ],
  Branch: [
    'I went to a branch after the digital steps failed.', 'I asked for help in person instead.',
    'The branch team helped me check the account.', 'I took the question to a local branch.',
    'I visited a branch to complete the request.', 'The online path stopped, so I spoke with someone at a branch.',
    'I needed an in-person explanation before continuing.', 'I asked a branch employee to review the issue.',
    'I went in person to find out what happened.', 'A branch visit became the next step.'
  ]
};
