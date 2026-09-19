const content_dir = 'contents/'
const config_file = 'config.yml'
const section_names = ['home', 'experience', 'publications'];
const scholar_file = 'scholar.json';

let scholarStats = null;


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
    clone.querySelectorAll('.pub-cite, .pub-actions').forEach(node => node.remove());
    clone.querySelectorAll('a').forEach(anchor => {
        const label = chipLabel(anchor);
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
            const next = document.createElement('a');
            next.className = 'pub-chip';
            if (chipLabel(chip).toLowerCase() === 'demo') {
                next.classList.add('pub-chip-demo');
            }
            next.href = chip.href;
            next.target = '_blank';
            next.rel = 'noopener';
            next.textContent = chipLabel(chip);
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


window.addEventListener('DOMContentLoaded', event => {

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

            })
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
