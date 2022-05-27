import showdown from 'showdown';

import { render } from './html';

declare const PAGES: KVNamespace;

async function save(name: string, content: string): Promise<string> {
    await PAGES.put(name, content);
    return render(name, showHTML(name, content), name);
}

async function edit(name: string): Promise<string> {
    const { content } = await get(name);
    return render(name, editHTML(name, content), name);
}

async function show(name: string): Promise<string> {
    const content = await PAGES.get(name);
    const html = (content === null) ? editHTML(name, '') : showHTML(name, content);
    return render(name, html, name)
}

async function list(): Promise<string[]> {
    return (await PAGES.list()).keys.map(k => k.name);
}

async function get(name: string): Promise<{ name: string, content: string }> {
    const content = (await PAGES.get(name)) || '';
    return { name, content };
}

function showHelp(): string {
    const html = markdown(`
Hello, this is a [[wiki]]!

You can edit any page. Pages are written in [Markdown](https://daringfireball.net/projects/markdown/)
with extra syntax for links internal to this page (as on Wikipedia, a word in double square brackets is a wiki-link).
 
Create new pages by visiting them, perhaps by creating a link to them first.
`);
    return (render('Help', html));
}

export default { save, show, edit, list, get, showHelp };

function markdown(code: string): string {
    return new showdown.Converter().makeHtml(wiki2md(code));
}

function wiki2md(code: string): string {
    return code.replace(/\[\[([^\]]*)\]\]/ig, '[$1]($1)')
}

function showHTML(name: string, content: string): string {
    return `
<h1 class="text-primary">${name}</h1>
${markdown(content)}
`;
}

function editHTML(name: string, content: string): string {
    return `
<h1 class="text-primary">${name} <small class="text-muted">(editing)</small></h1>
<form method="post" action="/${name}">
  <div class="form-group">
    <textarea class="form-control" id="pageContent" name="content" rows="10">${content}</textarea>
  </div>
  <div class="form-group">
    <button type="submit" class="btn btn-primary">Save</button>
    <a class="btn btn-secondary" href="/${name}" role="button">Cancel</a>
  </div>
</form>
`;
}
