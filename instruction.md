# Portal Operating Guide

This walkthrough describes the exact steps operational contributors and admins should follow when using the Granville Biomedical quiz portal.

## 1. Prerequisites (both roles)

1. Make sure your account has the correct Firebase custom claim:
   - `operational` for content contributors.
   - `admin` for reviewers/publishers.
2. Sign out/in after the claim changes so the portal refreshes your token.
3. Confirm you can reach the portal URL and that a logout button appears in the header once signed in.

## 2. Operational Workflow

1. **Sign in** at `/login`.
2. **Dashboard overview**
   - You can edit existing questions (but not delete live ones).
   - The top-right header shows your email and a logout button.
3. **Generate new questions (optional)**
   - Visit `/quiz-generator`.
   - Enter a prompt, choose level/user types, and click “Generate Questions”.
   - Review each AI-generated question; click **Save** or **Save All**. Because you are operational, saved items go into a new staging batch (you will see the batch ID in the confirmation dialog).
4. **Manual edits / bulk upload**
   - Use “Add Question” or “Bulk Upload” on the dashboard. Every create/update/delete submits a single-item staging batch unless you are editing live data as an admin.
5. **Manage “My Submissions”**
   - Scroll below the dashboard table to find **My Submissions** (visible only to operational users).
   - Click **View** to inspect a batch, **Resubmit** if a reviewer requested changes, or **Delete** to remove an entire staging batch that you created.
6. **Edit staged questions**
   - After clicking **View**, choose **Edit** next to a staged question to adjust text/options before resubmitting.
7. **Logout** via the header when finished.

## 3. Admin Workflow

1. **Sign in** at `/login` (header confirms you are logged in).
2. **Dashboard access**
   - You can edit and delete live questions directly (Delete button appears only for admins).
3. **Review staging**
   - Navigate to `/admin-review`.
   - The left table lists all staging batches with a stable “No.” column. Use **View** to load details, then choose **Approve** or **Reject**.
   - Approving publishes staged changes to `quizQuestions`. Rejecting stores the note and sends the batch back to the submitter.
4. **Post-review cleanup**
   - After a batch has been approved or rejected for at least 14 days, a **Delete** button appears in the Admin Review table. Use it to remove the batch plus its staged questions and keep the staging area clean.
5. **Logout** via the header when finished.

## 4. Troubleshooting

- “Missing or insufficient permissions” usually means the account lacks the required custom claim or the Firestore rules haven’t been deployed.
- If an operational user cannot see **My Submissions**, ensure their Firebase user has the `operational` claim and they have refreshed their login.
- If the Admin Review delete button is missing, verify the batch was approved/rejected at least 14 days ago.
- Confirm `.env.local` credentials point to the same Firebase project as the service account used for custom claims.

## 5. Quick Reference

| Action                            | Operational  | Admin  
| ---                               | ---          | ---    
| View dashboard / generator        | ✅           | ✅ 
| Delete live questions             | ❌           | ✅ 
| Submit new/edited questions       | ✅ (staging) | ✅ (live or staging) 
| View My Submissions               | ✅           | ❌ 
| Delete own staging batch          | ✅           | ❌ *(use Admin Review cleanup instead)* 
| Access Admin Review               | ❌           | ✅ 
| Approve/reject staging batches    | ❌           | ✅ 
| Delete staging batch after 14d    | ❌           | ✅ (via Admin Review) 

Use this guide alongside `README.md` whenever onboarding a new teammate or revisiting the workflow.
