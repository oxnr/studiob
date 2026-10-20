import { readFile, writeFile } from 'node:fs/promises';

const food = JSON.parse(await readFile(new URL('../data/menu-food-source.json', import.meta.url), 'utf8'));
const drinks = JSON.parse(await readFile(new URL('../data/menu-drinks-source.json', import.meta.url), 'utf8'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const sections = [...food.sections, ...drinks.sections];
const ids = new Set();

for (const section of sections) {
  const id = `${section.group}-${section.id}`;
  if (!['food','drinks'].includes(section.group) || !section.title || !section.items?.length || ids.has(id)) {
    throw new Error(`Invalid or duplicate menu section: ${id}`);
  }
  ids.add(id);
  for (const item of section.items) {
    if (!item.name || !/^\d+,\d{2}( \/ \d+,\d{2})*$/.test(item.price)) {
      throw new Error(`Missing item or ambiguous price in ${id}: ${item.name}`);
    }
  }
}

function codes(value) {
  return value ? `<small class="menu-codes"><span class="sr-only">Kennzeichnungen laut Karte: </span>${escape(value)}</small>` : '';
}

function renderGroup(group) {
  return sections.filter(section => section.group === group).map((section, index) => `
        <details class="menu-category" id="${group}-${escape(section.id)}"${index === 0 ? ' open' : ''}>
          <summary><span>${escape(section.title)}${codes(section.codes)}</span><span class="category-plus" aria-hidden="true"></span></summary>
          ${section.note ? `<p class="category-note">${escape(section.note)}</p>` : ''}
          <ul class="menu-items">
            ${section.items.map(item => `<li>
              <div class="dish-heading"><h3>${escape(item.name)}${codes(item.codes)}</h3><span class="dish-price">${escape(item.price)} €</span></div>
              ${item.description ? `<p>${escape(item.description)}</p>` : ''}
            </li>`).join('\n            ')}
          </ul>
        </details>`).join('\n');
}

function renderLegend() {
  return [['allergens','Allergene'],['additives','Zusatzstoffe']].map(([key, title]) => `
          <h3>${title}</h3><dl class="menu-legend-list">${food.legend[key].map(item => `<div><dt>${escape(item.code)}</dt><dd>${escape(item.label)}</dd></div>`).join('')}</dl>`).join('');
}

let page = await readFile(new URL('./menu-page.html', import.meta.url), 'utf8');
page = page.replace('<!-- FOOD -->', renderGroup('food')).replace('<!-- DRINKS -->', renderGroup('drinks')).replace('<!-- LEGEND -->', renderLegend());
await writeFile(new URL('../speisekarte.html', import.meta.url), page);
console.log(`Native menu rendered: ${sections.length} categories, ${sections.reduce((sum, section) => sum + section.items.length, 0)} entries.`);
