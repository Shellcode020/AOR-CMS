
(() => {
  'use strict';

  const FALLBACK = [
    { id: 1, name: 'Classic AO', categories: [] },
    { id: 2, name: 'Notum Wars', categories: [] },
    { id: 3, name: 'Shadowlands', categories: [] },
    { id: 4, name: 'Alien Invasion', categories: [] },
    { id: 5, name: 'Lost Eden', categories: [] },
    { id: 6, name: 'Legacy of the Xan', categories: [] },
    { id: 7, name: 'Nostalgia', categories: [] }
  ];

  const $ = id => document.getElementById(id);
  const links = $('expansionLinks');
  const categoryList = $('categoryList');
  const search = $('guideSearch');

  let expansions = FALLBACK;
  let selectedId = 1;
  const openCategories = new Set();

  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));

  const countGuides = list =>
    (list || []).reduce(
      (count, category) =>
        count + (category.guides || []).filter(guide => guide.url).length,
      0
    );

  function renderSidebar() {
    links.innerHTML = expansions.map(expansion => `
      <a
        class="expansion-link ${Number(expansion.id) === selectedId ? 'active' : ''}"
        href="#expansion-${Number(expansion.id)}"
        data-expansion="${Number(expansion.id)}"
      >
        <span>${esc(expansion.name)}</span>
        <span class="expansion-arrow">›</span>
      </a>
    `).join('');
  }

  function render() {
    const expansion =
      expansions.find(item => Number(item.id) === selectedId) ||
      expansions[0];

    if (!expansion) return;

    selectedId = Number(expansion.id);
    renderSidebar();

    $('selectedExpansion').textContent = expansion.name;
    $('expansionDescription').textContent =
      'Select a category to browse its guides.';
    $('guideCount').textContent =
      `${countGuides(expansion.categories)} guides in this expansion`;

    const categories = Array.isArray(expansion.categories)
      ? expansion.categories
      : [];

    const term = search.value.trim().toLowerCase();

    const filtered = categories.map(category => ({
      ...category,
      guides: (category.guides || []).filter(guide =>
        !term ||
        `${guide.title || ''} ${guide.description || ''} ${category.name || ''}`
          .toLowerCase()
          .includes(term)
      )
    })).filter(category =>
      !term ||
      category.name.toLowerCase().includes(term) ||
      category.guides.length
    );

    if (!categories.length) {
      categoryList.innerHTML = `
        <div class="guides-empty">
          <div class="empty-symbol">✧</div>
          <h3>Guide library not populated yet</h3>
          <p>Guides are currently not loaded. Please try again later.</p>
        </div>`;
      return;
    }

    if (!filtered.length) {
      categoryList.innerHTML = `
        <div class="guides-empty">
          <h3>No matching guides</h3>
          <p>Try another search term.</p>
        </div>`;
      return;
    }

    categoryList.innerHTML = filtered.map((category, index) => {
      const categoryKey = `${selectedId}:${category.name}`;
      const isOpen = Boolean(term) || openCategories.has(categoryKey);
      const panelId = `category-guides-${selectedId}-${index}`;
      const guides = category.guides || [];

      return `
        <section class="guide-category">
          <button
            type="button"
            class="category-toggle"
            aria-expanded="${isOpen}"
            aria-controls="${panelId}"
          >
            <span>${esc(category.name)}</span>
            <span class="category-count">
              ${guides.length} ${guides.length === 1 ? 'guide' : 'guides'}
            </span>
            <span class="chevron">›</span>
          </button>

          <div
            class="category-guides"
            id="${panelId}"
            ${isOpen ? '' : 'hidden'}
          >
            ${guides.length
              ? guides.map(guide => `
                <a
                  class="guide-link"
                  href="${esc(guide.url)}"
                  data-guide-url="${esc(guide.url)}"
                  data-guide-title="${esc(guide.title)}"
                >
                  <span class="guide-mark">›</span>
                  <span>
                    ${esc(guide.title)}
                    ${guide.description
                      ? `<span class="guide-description">${esc(guide.description)}</span>`
                      : ''}
                  </span>
                </a>
              `).join('')
              : '<p class="guide-description">No guides were found in this category.</p>'
            }
          </div>
        </section>`;
    }).join('');
  }

  async function showGuide(url, title) {
    const guideUrl = new URL(url, document.baseURI);

    categoryList.innerHTML = `
      <div class="guide-reader">
        <button type="button" class="guide-reader-back" data-guide-back>
          ← Back to guides
        </button>
        <div class="guides-empty">
          <div class="empty-symbol">✧</div>
          <h3>Loading guide…</h3>
          <p>${esc(title)}</p>
        </div>
      </div>`;

    try {
      const response = await fetch(guideUrl.href, {
  cache: 'no-store'
});

      if (!response.ok) {
        throw new Error(`Guide request failed: ${response.status}`);
      }

      const html = await response.text();
      const documentFromGuide = new DOMParser().parseFromString(
        html,
        'text/html'
      );

      const article = documentFromGuide.querySelector('.article-content');

      if (!article) {
        throw new Error('The guide article content could not be found.');
      }

      // Resolve image paths against the original guide file location.
      article.querySelectorAll('img[src]').forEach(img => {
        img.src = new URL(img.getAttribute('src'), guideUrl).href;
        img.loading = 'lazy';
      });

      // Resolve article links against the guide file location.
      article.querySelectorAll('a[href]').forEach(anchor => {
        anchor.href = new URL(anchor.getAttribute('href'), guideUrl).href;
      });

      categoryList.innerHTML = `
        <article class="guide-reader">
          <button type="button" class="guide-reader-back" data-guide-back>
            ← Back to guides
          </button>

          <div class="guide-reader-heading">
            <p class="eyebrow">COMMUNITY GUIDE</p>
            <h2>${esc(title)}</h2>
          </div>

          <div class="guide-reader-content"></div>

          <button type="button" class="guide-reader-back" data-guide-back>
            ← Back to guides
          </button>
        </article>`;

      categoryList.querySelector('.guide-reader-content')
        .appendChild(article);

      categoryList.scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (error) {
      console.error('Unable to load guide:', error);

      categoryList.innerHTML = `
        <div class="guide-reader">
          <button type="button" class="guide-reader-back" data-guide-back>
            ← Back to guides
          </button>
          <div class="guides-empty">
            <h3>Unable to load this guide</h3>
            <p>Please try again. The guide file may be missing or unavailable.</p>
          </div>
        </div>`;
    }
  }

  // One delegated click handler also supports links inside loaded articles.
  categoryList.addEventListener('click', event => {
    const backButton = event.target.closest('[data-guide-back]');

    if (backButton) {
      render();
      return;
    }

    const categoryButton = event.target.closest('.category-toggle');

    if (categoryButton) {
      const panel = $(categoryButton.getAttribute('aria-controls'));
      const isOpen = categoryButton.getAttribute('aria-expanded') === 'true';

      categoryButton.setAttribute('aria-expanded', String(!isOpen));
      panel.hidden = isOpen;

      const categoryName =
        categoryButton.querySelector('span')?.textContent || '';

      const categoryKey = `${selectedId}:${categoryName}`;

      if (isOpen) openCategories.delete(categoryKey);
      else openCategories.add(categoryKey);

      return;
    }

    const guideLink = event.target.closest('a[href]');

    if (!guideLink) return;

    const guideUrl = new URL(guideLink.href, document.baseURI);

    // Guide links in the category list.
    if (guideLink.hasAttribute('data-guide-url')) {
      event.preventDefault();

      showGuide(
        guideLink.dataset.guideUrl,
        guideLink.dataset.guideTitle
      );

      return;
    }

    // Internal guide-to-guide links inside an article.
    if (/\/guides\/guide-[\w-]+\.html$/i.test(guideUrl.pathname)) {
      event.preventDefault();

      const title = guideLink.textContent.trim() || 'Guide';

      showGuide(guideUrl.href, title);
    }
  });

  links.addEventListener('click', event => {
    const link = event.target.closest('[data-expansion]');

    if (!link) return;

    event.preventDefault();

    selectedId = Number(link.dataset.expansion);
    search.value = '';
    openCategories.clear();
    render();
  });

  search.addEventListener('input', render);

  fetch('assets/data/json/guides.json', {
  cache: 'no-store'
})
    .then(response => {
      if (!response.ok) throw new Error('No guide data');
      return response.json();
    })
    .then(data => {
      if (Array.isArray(data.expansions) && data.expansions.length) {
        expansions = data.expansions;
      }

      render();
    })
    .catch(error => {
      console.error('Unable to load guide index:', error);
      render();
    });
})();
