# Setting Up FinTrack on a New Mac

This guide starts from a Mac with nothing installed. When you finish, you'll have FinTrack running with your own data, and optionally your credit cards and brokerage syncing through your own Plaid account.

**Time:** about 20 minutes for the app. Add about 15 minutes for Plaid, plus however long Plaid takes to approve production access.

---

## Before you start

- **You need your own Plaid account.** Don't borrow someone else's API keys. Any bank you link would land in their Plaid account and use up their free connections.
- **Start with empty data.** Never copy another person's `data/` folder or `.env` file.
- Plaid is **optional**. Without it, you can still track your bank, HYSA, stocks and ETFs by entering numbers by hand. Only automatic syncing of cards and brokerages needs Plaid.

---

## Step 1: Install the developer tools

Open **Terminal** (press `⌘ Space`, type "Terminal", press Return).

**1a. Install Git** (used to download the code):

```bash
xcode-select --install
```

Click **Install** in the window that appears and wait for it to finish. If it says the tools are already installed, that's fine; move on.

**1b. Install Node.js:** go to [nodejs.org](https://nodejs.org), download the **LTS** installer, and run it.

**1c. Check that both installed.** Close Terminal, open it again, and run:

```bash
git --version
node --version
```

Each command should print a version number. If you get `command not found`, redo that install.

---

## Step 2: Download and start FinTrack

```bash
cd ~/Desktop
git clone https://github.com/NielParekh/FinTrack.git
cd FinTrack
npm install
npm run dev
```

`npm install` takes a minute or two. Warnings in yellow are normal. After `npm run dev`, the FinTrack window opens by itself.

> To start the app later, open Terminal and run `cd ~/Desktop/FinTrack && npm run dev`.
> Quit it by closing the window, or press `Ctrl C` in Terminal.

---

## Step 3: Enter your numbers

These pages work right away without Plaid:

| Page | What to enter |
|---|---|
| **Investing → Bank** | Your checking account balance |
| **Investing → HYSA** | Your high-yield savings balance |
| **Investing → Stocks** | Your stock positions. Live prices come from Yahoo Finance automatically. |
| **Investing → ETFs** | Your ETF holdings, entered by hand, unless you link a brokerage in Step 6 |
| **Spending → Overview** | Expenses you add by hand |

The **Dashboard** starts drawing your net worth trend from today.

If you don't want Plaid, **you're done.** Do skim [Backing up](#backing-up) at the end, though.

---

## Step 4: Create a Plaid account

Plaid is the service FinTrack uses to read your card and brokerage transactions. Your bank login goes straight to Plaid in your browser. FinTrack never sees it.

1. Sign up at **[dashboard.plaid.com](https://dashboard.plaid.com/signup)**. Plaid will ask for a company name; your own name works fine for personal use.
2. Go to **Developers → Keys**.
3. Copy two values and keep them somewhere private:
   - `client_id`
   - the **Sandbox** secret

> 🔒 Treat these keys like passwords. Don't paste them into chats or emails, and don't commit them to Git.

---

## Step 5: Try it with fake data (Sandbox)

Sandbox is Plaid's test mode. It uses fake banks, so you can confirm everything works before linking real accounts.

**5a. Create your settings file.** In Terminal, from the `FinTrack` folder:

```bash
cp .env.example .env
open -e .env
```

TextEdit opens the file. Fill in your keys:

```
PLAID_CLIENT_ID=paste_your_client_id
PLAID_SECRET=paste_your_sandbox_secret
PLAID_ENV=sandbox
```

Save and close it.

**5b. Restart the app.** Press `Ctrl C` in Terminal, then run `npm run dev` again.

**5c. Link a fake card:**

1. Go to **Spending → Linked Cards → + Link a card**.
2. Your web browser opens Plaid. Pick any bank and log in with:
   - Username: `user_good`
   - Password: `pass_good`
   - If it asks for a code, enter `1234`
3. Go back to FinTrack. Within a few seconds the card appears and fake transactions fill in.

**5d. Remove the test card** using the 🗑️ button next to it. Do this **before** you switch to real accounts, because sandbox links stop working once you change modes.

---

## Step 6: Connect your real accounts (Production)

**6a. Get production access.** In the Plaid dashboard, follow the prompts to request **Production** access. The free **Trial** plan covers personal use and includes **10 connections**. Fill in the company and app profile. Some banks that use OAuth logins (Chase, for example) need an extra approval step in the dashboard, and that can take a few days.

**6b. Swap in your production secret.** Copy the **Production** secret from **Developers → Keys**, then open `.env` again (`open -e .env`) and change two lines:

```
PLAID_SECRET=paste_your_production_secret
PLAID_ENV=production
```

Restart the app.

**6c. Link your accounts:**

- **Credit cards:** go to **Spending → Linked Cards → + Link a card**. FinTrack pulls up to 2 years of history.
- **Brokerage** (e.g. Wealthfront, Robinhood): go to **Investing → ETFs → + Link brokerage**. Holdings sync automatically. If the brokerage also has a cash account, that balance fills in **HYSA** using the same connection.

> ⚠️ **Plaid connections can't be reused.** The Trial plan counts every connection you've *ever* made, so unlinking and relinking the same bank uses up a slot permanently.
> If a card shows **Needs re-link**, click **Re-link**. **Don't** delete it and add it again.

From now on, FinTrack syncs everything each time it opens and shows a summary of what changed.

---

## Optional: Install it as a regular Mac app

If you'd rather click an icon than use Terminal, build an installer:

```bash
cd ~/Desktop/FinTrack
npm run dist
```

Then open the `.dmg` from the `dist/` folder and drag **FinTrack** into **Applications**.

**Things to know:**

- **First launch:** macOS will block the app because it isn't signed by a registered Apple developer. Go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.
- **The installed app keeps its data and settings in a different folder:**
  `~/Library/Application Support/fintrack/`
  Copy your `.env` there:
  ```bash
  cp ~/Desktop/FinTrack/.env ~/Library/Application\ Support/fintrack/.env
  ```
- **Pick one way of running the app before linking real accounts.** Plaid logins are encrypted with your Mac's Keychain, and the Terminal version and the installed app can't read each other's. If you plan to use the installed app, build and install it *first*, then do Step 6 inside it.
- To move your hand-entered numbers from the Terminal version to the installed app, use **Settings → Backup & Restore**. Export in one and restore in the other.

---

## Backing up

All your data lives only on this Mac. Use **Settings → Backup & Restore** now and then, and keep the backup file somewhere **other than this computer** (iCloud Drive, a USB stick and so on).

Linked bank connections are tied to this Mac. If you restore a backup on a different computer, you'll need to re-link those accounts there.

---

## Getting updates

```bash
cd ~/Desktop/FinTrack
git pull
npm install
```

Then start the app as usual. If you use the installed app, run `npm run dist` again and reinstall it.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `command not found: npm` or `git` | Redo Step 1, then close and reopen Terminal. |
| "Plaid keys missing" | `.env` is missing or in the wrong place. For the Terminal version it goes in the `FinTrack` folder. For the installed app it goes in `~/Library/Application Support/fintrack/`. Restart after you fix it. |
| The browser opens but linking never finishes | Finish the whole flow in the browser within 15 minutes, or click **Cancel linking** and try again. |
| A bank says it's not supported, or OAuth fails in Production | That bank probably still needs approval in the Plaid dashboard (Step 6a). |
| A card shows **Needs re-link** | Click **Re-link**. Don't unlink it. |
| The installed app misbehaves | Check the log at `~/Library/Logs/FinTrack/main.log`. Keys and tokens are blanked out in it. |
