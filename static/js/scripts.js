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
    const clone = li.cloneNode(true);
    clone.querySelectorAll('.pub-cited').forEach(node => node.remove());
    clone.querySelectorAll('a').forEach(anchor => {
        const label = anchor.textContent.trim().replace(/^\[|\]$/g, '');
        if (/^(paper|demo|code|pdf|arxiv|doi|scholar|project)$/i.test(label)) {
            anchor.remove();
        }
    });
    return clone.textContent.replace(/\s+/g, ' ').trim();
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


function annotatePublications(data) {
    const root = document.getElementById('publications-md');
    if (!root || !data || !Array.isArray(data.papers)) {
        return;
    }
    root.querySelectorAll('li').forEach(li => {
        const title = publicationTitle(li);
        const match = data.papers.find(paper => titlesMatch(title, paper.title));
        li.querySelectorAll('.pub-cited').forEach(node => node.remove());
        if (!match || !match.citations) {
            return;
        }
        const cited = document.createElement('span');
        cited.className = 'pub-cited';
        const link = document.createElement('a');
        link.href = match.cited_by_url || match.scholar_url || data.url || 'https://scholar.google.com/citations?user=Jo7TvUMAAAAJ';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = `Cited by ${match.citations}`;
        cited.appendChild(link);
        const para = li.querySelector('p:last-of-type') || li;
        para.appendChild(cited);
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
