import { Hono } from 'hono';
import { bodyParse } from 'hono/body-parse';
import { basicAuth } from 'hono/basic-auth'

import { link, listGroup, render } from './html';
import wikiPage from './wikiPage';
import wikiSearch, { searchWords } from './wikiSearch';

// see wrangler.toml
declare const BASICAUTH_USERNAME: string;
declare const BASICAUTH_PASSWORD: string;

function authMiddleware() {
  return basicAuth({
    username: BASICAUTH_USERNAME,
    password: BASICAUTH_PASSWORD,
  });
}

function getUser(req: Request): string | null {

  const authHeader = req.headers.get('Authorization');
  const basicPrefix = 'Basic ';

  if (!authHeader?.startsWith(basicPrefix)) {
    return null;
  }

  try {
    const userPass = authHeader.substring(basicPrefix.length);
    const user = atob(userPass).split(':')[0];
    return user || null;
  } catch {
    return null;
  }
}

const app = new Hono();

app.get('/', (ctx) => {
  return ctx.redirect('/_home');
});

app.get('/_help', async (ctx) => {
  return ctx.html(wikiPage.showHelp());
})

app.get('/_index', async (ctx) => {
  const pageNames = await wikiPage.list();
  const htmlList = listGroup(pageNames.map((name) => link(name)));
  return ctx.html(render('Wiki Index', `<h2 class="text-primary">Wiki Index</h2>${htmlList}`));
})

app.get('/_search', async (ctx) => {
  const query = searchWords(ctx.req.query('q'));
  const hits = await wikiSearch.find(query);
  let html = '<p>no hits :(</p>'
  if (0 < hits.length) {
    html = listGroup(hits.map((pageName) => link(pageName)));
  }
  return ctx.html(render('Search Results', `<h2 class="text-primary">Search Results (${query})</h2>${html}`));
})

app.get('/:pageName', async (ctx) => {
  const pageName = ctx.req.param('pageName');
  const edit = ctx.req.query().hasOwnProperty('edit');
  const html = edit ? wikiPage.edit(pageName) : wikiPage.show(pageName);
  return ctx.html(await html);
});

app.post('/:pageName', authMiddleware(), bodyParse(), async (ctx) => {
  const pageName = ctx.req.param('pageName');
  const user = getUser(ctx.req);
  if (20 < pageName.length) {
    return ctx.text(`page name too long (${pageName.length}), 20 characters is the limit`, 414);
  }
  const { content } = ctx.req.parsedBody;
  if (640 < content.length) {
    return ctx.text(`page content too long (${content.length}), 640 bytes ought to be enough for anyone`, 413)
  }
  const html = await wikiPage.save(pageName, content);
  console.info(`user '${user}' updated /${pageName}`);
  await wikiSearch.index(pageName, content);
  return ctx.html(html);
});

app.fire();

addEventListener('scheduled', event => {
  event.waitUntil(onScheduleEvent(event));
});

async function onScheduleEvent(event: ScheduledEvent) {
  switch (event.cron) {
    case '*/60 * * * *':
      await reIndex();
      break;
  }
  console.log('cron processed');
}

async function reIndex(): Promise<void> {

  const pageNames = await wikiPage.list();
  console.log(`re-indexing wiki pages (${pageNames.join(', ')})`);

  // collect current contents
  const pages: Record<string, string> = {};
  for (const pageName of pageNames) {
    const { content } = await wikiPage.get(pageName);
    pages[pageName] = content;
  }

  // clear index and re-fill from new page content
  await wikiSearch.clear();
  for (const [name, content] of Object.entries(pages)) {
    await wikiSearch.index(name, content);
  }
}
