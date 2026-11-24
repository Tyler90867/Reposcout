# RepoScout

Paste a public GitHub repository link and get a saved "launch brief": what the
product does, who it is for, and up to five competitors, each with a source
link. Built on [DeepSpace](https://deep.space).

**Live app:** https://reposcout.app.space

## What it does

1. You sign in and paste a link such as `https://github.com/honojs/hono`.
2. RepoScout saves a brief for it and fills it in.
3. You can reopen the brief later, or delete it. Briefs survive a refresh, and
   each user sees only their own.

## How a brief is made

Everything below runs on the server, in one action called `generateBrief`
(`src/actions/index.ts`). Each step saves its result before the next one
starts, so a later failure never throws away what already worked. Running the
action again picks up at the first unfinished step.

| Step | DeepSpace integration | What it does |
| --- | --- | --- |
| 1. Read the repository | `github/get-repository`, `github/get-repository-readme` | Gets the description, stars, language, topics, and README text. |
| 2. Write the summary | `anthropic/chat-completion` (model `claude-haiku-5-5`) | Writes "what it does" and "who it is for", using only the facts from step 1. |
| 3. Find competitors | `exa/search`, then `anthropic/chat-completion` | Searches the web, then asks the AI which competitors the search results name. |

## No made-up competitors

The AI is never allowed to write a link. It only answers "this competitor is
named in search result number 3". The server then checks, in plain code:

- the number points at a real search result, and the link is copied from it
- the competitor's name really appears in that page's title or text
- it is not the product itself, and not a repeat

Anything that fails a check is dropped. If nothing is left, the brief says
"RepoScout could not confirm any competitors for this repository from a web
search. It does not make them up."

If a repository has no description and no README, the AI and the search are
skipped and the brief says there was nothing to read.

## What DeepSpace handles

- **Sign-in:** DeepSpace's built-in auth. There is no custom login code.
- **Saved data:** DeepSpace records. A brief is one record in the `briefs`
  collection (`src/schemas/briefs-schema.ts`).
- **Permissions:** the `briefs` rules are `read: 'own'`, `update: 'own'`,
  `delete: 'own'`, enforced on the server. The `generateBrief` action also
  checks that the brief belongs to the caller.
- **Integrations and billing:** all three services are called on the server
  through DeepSpace. There are no API keys in this repository or in the
  browser code.

## Errors the app explains

- A link that is not a GitHub repository link (checked before anything is saved)
- A repository that does not exist or is private
- GitHub, the AI, or the search failing or taking too long
- An AI answer the server cannot read
- The daily limit (10 briefs per user per day)

## Safety

- Text from GitHub and from web pages is shown as plain text. It is never run
  as HTML or code.
- Only normal `http` and `https` links are shown as links.
- Text sent to the AI is marked as data, not instructions.
- A daily limit per user caps what one account can spend.

## Project map

| File | What it does |
| --- | --- |
| `src/actions/index.ts` | The `generateBrief` flow: ownership check, daily limit, then the three steps |
| `src/actions/github.ts` | Step 1 |
| `src/actions/ai.ts` | Step 2, and the shared helper for calling the AI |
| `src/actions/competitors.ts` | Step 3, including the checks above |
| `src/actions/usage.ts` | The daily limit |
| `src/schemas/briefs-schema.ts` | What a brief looks like and who may read or change it |
| `src/pages/(app)/(protected)/briefs/index.tsx` | The page with the form and the list of saved briefs |
| `src/pages/(app)/(protected)/briefs/[id].tsx` | The page for one brief |
| `src/components/Competitors.tsx` | The competitor list and the "none confirmed" message |
| `NOTES.md` | The build log, phase by phase |

## Run it locally

You need Node.js and a DeepSpace account.

```
npm install
npx deepspace auth login
npx deepspace dev start
```

Then open http://localhost:5173

## Tests

| Command | What it runs |
| --- | --- |
| `npm run test:unit` | 74 unit tests with fake services. Free, no network. |
| `npx deepspace test run e2e` | Browser tests against a local server, signed in as two test accounts. One test uses the real GitHub, AI, and search services and spends about one credit. |
| `npx playwright test -c tests/live.config.ts` | The same browser tests against the live site. |

The browser tests need two DeepSpace test accounts. They include a check that
a second user cannot see or change the first user's brief.

## Known limits

- The source link is the page that names the competitor, often a comparison
  article. It is not the competitor's own website.
- The name check proves the name is on the linked page. It does not prove the
  page is right. The one-line descriptions are AI-written and can contain
  mistakes, and the app says so next to the list.
- Failures of GitHub, the AI, and the search are tested with fake services
  only, because the real ones did not fail during testing.
- Tested in Chromium only.

## How it was built

I'm Tyler Ogden. I built RepoScout as a DeepSpace build exercise, in five
phases, using Claude (an AI coding agent) as a pair programmer.

- **My part:** I chose the idea and the scope, set up the project (DeepSpace
  login, dev server, this repository, and the first deploy), held the build to
  its rules, and reviewed and approved every phase, push, and deploy. I added two requirements along
  the way: content from GitHub is treated as untrusted text, and each user has
  a daily limit. I tested the foundation, the GitHub step, and the AI summary
  step by hand on my computer. On the live site I tested sign-in, save, refresh,
  and delete, and generated a full brief with competitors for one of my own
  repositories.
- **Claude's part:** Claude wrote most of the code and all of the automated
  tests under my direction, and ran the checks after every step.

`NOTES.md` is the build log: what was done in each phase, the problems that
came up and how they were fixed, and what was and was not tested.
