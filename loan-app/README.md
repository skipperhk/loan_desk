# Personal Loan Desk (v2: shared backend)

## Run locally
    npm install
    ADMIN_PIN=yourpin123 ADMIN_PATH=k7x2-mq9v-t4rw INVITE_CODE=friend npm start
Open http://localhost:3000 (borrowers) and http://localhost:3000/YOUR_ADMIN_PATH (you only)

## Deploy (Render, Railway or Fly.io)
1. Put this folder in a GitHub repo.
2. Create a new Web Service from the repo. Build: `npm install`. Start: `npm start`.
3. Set environment variables: `ADMIN_PIN` (6+ characters, required), `ADMIN_PATH` (12+ random letters/numbers, required: your secret admin address is yoursite.com/THAT-VALUE), `INVITE_CODE` (optional), `DATA_DIR` (path of a persistent disk/volume).
4. Attach a persistent disk/volume and point DATA_DIR at it. Without one, data is wiped on every redeploy.
5. Share your site link + invite code with people you trust.

Data is stored in data.json inside DATA_DIR. Back it up now and then.
