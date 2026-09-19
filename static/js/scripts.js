const content_dir = 'contents/'
const config_file = 'config.yml'
const section_names = ['home', 'experience', 'works', 'publications'];
const scholar_file = 'scholar.json';

let scholarStats = null;

const CHIP_META = {
    paper: { icon: 'bi-file-earmark-text', cls: '' },
    demo: { icon: 'bi-play-circle', cls: 'pub-chip-demo' },
    code: { icon: 'bi-github', cls: 'pub-chip-code' },
    pdf: { icon: 'bi-file-earmark-pdf', cls: '' },
    arxiv: { icon: 'bi-archive', cls: '' },
    doi: { icon: 'bi-journal-text', cls: '' },
    scholar: { icon: 'bi-quote', cls: '' },
    project: { icon: 'bi-link-45deg', cls: '' },
};


function normalizeTitle(text) {
    return (text || '')
        .toLowerCase()
        .replace(/&ensp;|&emsp;|&nbsp;/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}


function titlesMatch(pageTitle, scholarTitle) {
    const a = normalizeTitle(pageTitle);
    const b = normalizeTitle(scholarTitle);
    if (!a || !b) {
        return false;
    }
    if (a === b || a.includes(b) || b.includes(a)) {
        return true;
    }
    const prefixLen = Math.min(48, a.length, b.length);
    return prefixLen >= 24 && a.slice(0, prefixLen) === b.slice(0, prefixLen);
}


function publicationTitle(li) {
    if (li.dataset.title) {
        return li.dataset.title;
    }
    const clone = li.cloneNode(true);
    clone.querySelectorAll('.pub-cite, .pub-actions, .pub-year').forEach(node => node.remove());
    clone.querySelectorAll('a').forEach(anchor => {
        if (isChipLink(anchor)) {
            anchor.remove();
        }
    });
    return clone.textContent.replace(/\s+/g, ' ').trim();
}


function chipLabel(anchor) {
    return (anchor.textContent || '').trim().replace(/^\[|\]$/g, '');
}


function isChipLink(anchor) {
    return /^(paper|demo|code|pdf|arxiv|doi|scholar|project)$/i.test(chipLabel(anchor));
}


function extractYear(text) {
    const match = (text || '').match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : '';
}


function socialMeta(anchor) {
    const img = anchor.querySelector('img');
    const key = ((img && img.alt) || anchor.textContent || '').toLowerCase();
    if (key.includes('github')) {
        return { icon: 'bi-github', label: 'GitHub', kind: 'github' };
    }
    if (key.includes('scholar')) {
        return { icon: 'bi-mortarboard', label: 'Scholar', kind: 'scholar' };
    }
    if (key.includes('wise')) {
        return { icon: 'bi-wallet2', label: 'Wise', kind: 'wise' };
    }
    if (key.includes('outlook')) {
        return { icon: 'bi-envelope', label: 'Outlook', kind: 'outlook' };
    }
    if (key.includes('gmail')) {
        return { icon: 'bi-envelope-at', label: 'Gmail', kind: 'gmail' };
    }
    return {
        icon: 'bi-link-45deg',
        label: (img && img.alt) ? img.alt : 'Link',
        kind: 'link',
    };
}


function formatHomeTitle() {
    const el = document.getElementById('home-subtitle');
    if (!el || el.dataset.formatted === '1') {
        return;
    }
    const parts = el.textContent.replace(/\u2002/g, ' ').split('|').map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) {
        return;
    }
    el.innerHTML = `<span class="name-en">${parts[0]}</span><span class="name-sep" aria-hidden="true"></span><span class="name-zh">${parts[1]}</span>`;
    el.dataset.formatted = '1';
}


function upgradeBadgeLinks(root) {
    root.querySelectorAll('a').forEach(anchor => {
        if (!anchor.querySelector('img') || anchor.dataset.chip === '1') {
            return;
        }
        const meta = socialMeta(anchor);
        const icon = document.createElement('i');
        icon.className = `bi ${meta.icon}`;
        const label = document.createElement('span');
        label.textContent = meta.label;
        anchor.className = `social-chip social-${meta.kind}`;
        anchor.replaceChildren(icon, label);
        if (!anchor.getAttribute('href').startsWith('mailto:')) {
            anchor.target = '_blank';
            anchor.rel = 'noopener';
        }
        anchor.dataset.chip = '1';
    });
}


function formatHome() {
    const root = document.getElementById('home-md');
    if (!root || root.dataset.formatted === '1') {
        return;
    }
    upgradeBadgeLinks(root);
    root.querySelectorAll('p').forEach(paragraph => {
        if (paragraph.querySelector('.social-chip')) {
            paragraph.classList.add('social-row');
        }
    });

    const grid = document.createElement('div');
    grid.className = 'info-grid';
    Array.from(root.querySelectorAll('h4')).forEach(heading => {
        if (/email/i.test(heading.textContent)) {
            heading.classList.add('info-label');
            return;
        }
        const next = heading.nextElementSibling;
        const item = document.createElement('div');
        item.className = 'info-item';
        const label = document.createElement('div');
        label.className = 'info-label';
        label.textContent = heading.textContent.trim();
        const value = document.createElement('div');
        value.className = 'info-value';
        value.textContent = next ? next.textContent.trim() : '';
        item.append(label, value);
        grid.appendChild(item);
        heading.remove();
        if (next) {
            next.remove();
        }
    });
    if (grid.children.length) {
        root.appendChild(grid);
    }
    root.dataset.formatted = '1';
}


function formatExperience() {
    const root = document.getElementById('experience-md');
    if (!root || root.dataset.formatted === '1') {
        return;
    }
    const role = root.querySelector('h3');
    const companies = Array.from(root.querySelectorAll('h4'));
    if (!role) {
        return;
    }
    const card = document.createElement('div');
    card.className = 'exp-card';
    const title = document.createElement('div');
    title.className = 'exp-role';
    title.textContent = role.textContent.replace(/\*/g, '').trim();
    const list = document.createElement('div');
    list.className = 'exp-companies';
    companies.forEach(company => {
        const item = document.createElement('span');
        item.className = 'exp-company';
        const name = company.textContent.trim();
        item.textContent = name;
        item.dataset.company = name.toLowerCase();
        list.appendChild(item);
    });
    card.append(title, list);
    root.replaceChildren(card);
    root.dataset.formatted = '1';
}


function renderScholarMetrics(data) {
    const el = document.getElementById('scholar-metrics');
    if (!el || !data || typeof data.citations !== 'number') {
        return;
    }
    const profile = data.url || 'https://scholar.google.com/citations?user=Jo7TvUMAAAAJ';
    const updated = data.updated ? data.updated.slice(0, 10) : '';
    el.innerHTML = `
        <a class="scholar-metric" href="${profile}" target="_blank" rel="noopener">
            <span class="label">Citations</span><span class="n">${data.citations}</span>
        </a>
        <a class="scholar-metric" href="${profile}" target="_blank" rel="noopener">
            <span class="label">h-index</span><span class="n">${data.h_index}</span>
        </a>
        <a class="scholar-metric" href="${profile}" target="_blank" rel="noopener">
            <span class="label">i10-index</span><span class="n">${data.i10_index}</span>
        </a>
        ${updated ? `<span class="scholar-updated">Google Scholar · ${updated}</span>` : ''}
    `;
    el.hidden = false;
}


function formatPublicationList() {
    const list = document.querySelector('#publications-md ul, #publications-md ol');
    if (!list) {
        return;
    }
    list.classList.add('pub-list');
    Array.from(list.children).forEach(li => {
        if (li.tagName !== 'LI' || li.dataset.formatted === '1') {
            return;
        }
        const source = li.querySelector('p') || li;
        const links = Array.from(source.querySelectorAll('a'));
        const titleLink = links.find(anchor => !isChipLink(anchor)) || links[0];
        const chips = links.filter(anchor => isChipLink(anchor));
        const titleText = titleLink ? titleLink.textContent.trim() : publicationTitle(li);
        let venue = source.textContent.replace(/\s+/g, ' ').trim();
        if (titleText) {
            venue = venue.replace(titleText, '');
        }
        chips.forEach(chip => {
            venue = venue.replace(chipLabel(chip), '');
        });
        venue = venue.replace(/[\[\]]/g, '').replace(/^[\s.,;:·-]+/, '').replace(/[\s.,;:·-]+$/, '').trim();

        const card = document.createElement('article');
        card.className = 'pub-card';

        const year = document.createElement('div');
        year.className = 'pub-year';
        year.textContent = extractYear(venue) || '—';
        card.appendChild(year);

        if (titleLink) {
            const title = document.createElement('a');
            title.className = 'pub-title';
            title.href = titleLink.href;
            title.target = '_blank';
            title.rel = 'noopener';
            title.textContent = titleText;
            card.appendChild(title);
        } else {
            const title = document.createElement('div');
            title.className = 'pub-title';
            title.textContent = titleText;
            card.appendChild(title);
        }

        if (venue) {
            const venueEl = document.createElement('p');
            venueEl.className = 'pub-venue';
            venueEl.textContent = venue;
            card.appendChild(venueEl);
        }

        const actions = document.createElement('div');
        actions.className = 'pub-actions';
        chips.forEach(chip => {
            const label = chipLabel(chip).toLowerCase();
            const meta = CHIP_META[label] || { icon: 'bi-link-45deg', cls: '' };
            const next = document.createElement('a');
            next.className = `pub-chip ${meta.cls}`.trim();
            next.href = chip.href;
            next.target = '_blank';
            next.rel = 'noopener';
            next.innerHTML = `<i class="bi ${meta.icon}" aria-hidden="true"></i>${chipLabel(chip)}`;
            actions.appendChild(next);
        });
        card.appendChild(actions);

        li.innerHTML = '';
        li.appendChild(card);
        li.dataset.formatted = '1';
        li.dataset.title = titleText;
    });
}


function annotatePublications(data) {
    const root = document.getElementById('publications-md');
    if (!root || !data || !Array.isArray(data.papers)) {
        return;
    }
    formatPublicationList();
    root.querySelectorAll('li').forEach(li => {
        const title = publicationTitle(li);
        const match = data.papers.find(paper => titlesMatch(title, paper.title));
        li.querySelectorAll('.pub-cite').forEach(node => node.remove());
        if (!match || !match.citations) {
            return;
        }
        const actions = li.querySelector('.pub-actions');
        if (!actions) {
            return;
        }
        const link = document.createElement('a');
        link.className = 'pub-cite';
        link.href = match.cited_by_url || match.scholar_url || data.url || 'https://scholar.google.com/citations?user=Jo7TvUMAAAAJ';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = `Cited by ${match.citations}`;
        actions.appendChild(link);
    });
    sortPublications(data);
}


function sortPublications(data) {
    const list = document.querySelector('#publications-md ul, #publications-md ol');
    if (!list || !data || !Array.isArray(data.papers)) {
        return;
    }
    const unmatched = [];
    const matched = [];
    Array.from(list.children).forEach(li => {
        if (li.tagName !== 'LI') {
            return;
        }
        const title = publicationTitle(li);
        const paper = data.papers.find(item => titlesMatch(title, item.title));
        if (paper) {
            matched.push({ li, citations: paper.citations || 0 });
        } else {
            unmatched.push(li);
        }
    });
    matched.sort((a, b) => b.citations - a.citations);
    unmatched.concat(matched.map(item => item.li)).forEach(li => list.appendChild(li));
}


function applyScholarStats() {
    if (!scholarStats) {
        return;
    }
    renderScholarMetrics(scholarStats);
    annotatePublications(scholarStats);
}


function watchSiteStats() {
    const box = document.getElementById('site-stats');
    const uv = document.getElementById('vercount_value_site_uv');
    const pv = document.getElementById('vercount_value_site_pv');
    if (!box || !uv || !pv) {
        return;
    }
    const ready = (el) => /^\d[\d,]*$/.test((el.textContent || '').trim());
    const reveal = () => {
        if (ready(uv) && ready(pv)) {
            box.hidden = false;
            return true;
        }
        return false;
    };
    if (reveal()) {
        return;
    }
    const observer = new MutationObserver(() => {
        if (reveal()) {
            observer.disconnect();
        }
    });
    observer.observe(uv, { childList: true, characterData: true, subtree: true });
    observer.observe(pv, { childList: true, characterData: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
}


window.addEventListener('DOMContentLoaded', event => {

    watchSiteStats();

    // Activate Bootstrap scrollspy on the main nav element
    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            offset: 74,
        });
    };

    // Collapse responsive navbar when toggler is visible
    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(
        document.querySelectorAll('#navbarResponsive .nav-link')
    );
    responsiveNavItems.map(function (responsiveNavItem) {
        responsiveNavItem.addEventListener('click', () => {
            if (window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });


    // Yaml
    fetch(content_dir + config_file)
        .then(response => response.text())
        .then(text => {
            const yml = jsyaml.load(text);
            Object.keys(yml).forEach(key => {
                try {
                    document.getElementById(key).innerHTML = yml[key];
                } catch {
                    console.log("Unknown id and value: " + key + "," + yml[key].toString())
                }

            });
            formatHomeTitle();
        })
        .catch(error => console.log(error));


    // Marked
    marked.use({ mangle: false, headerIds: false })
    section_names.forEach((name, idx) => {
        fetch(content_dir + name + '.md')
            .then(response => response.text())
            .then(markdown => {
                const html = marked.parse(markdown);
                document.getElementById(name + '-md').innerHTML = html;
                if (name === 'home') {
                    formatHome();
                }
                if (name === 'experience') {
                    formatExperience();
                }
                if (name === 'publications') {
                    formatPublicationList();
                }
                applyScholarStats();
            }).then(() => {
                // MathJax
                MathJax.typeset();
            })
            .catch(error => console.log(error));
    })

    fetch(content_dir + scholar_file)
        .then(response => {
            if (!response.ok) {
                throw new Error('scholar.json ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            scholarStats = data;
            applyScholarStats();
        })
        .catch(error => console.log(error));

});
