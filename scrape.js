const axios = require('axios');
const cheerio = require('cheerio');
const validUrl = require('valid-url');
const tldjs = require('tldjs');

const baseUrl = 'https://www.stldigital.tech';
const url = `${baseUrl}/`;

async function fetchData() {
    try {
        console.log('----------------------------------------');

        const response = await axios.get(url);

        // Fetch meta description
        const $ = cheerio.load(response.data);
        const metaDescription = $('meta[name="description"]').attr('content');
        console.log('Meta Description:\n', metaDescription);

        // Fetch and log heading tags
        const headingTags = {};
        // Loop through h1, h2, h3, h4, h5, h6 elements
        $('h1, h2, h3, h4, h5, h6').each((index, element) => {
            const tagName = element.name;
            const tagText = $(element).text().trim();
            if (!headingTags[tagName]) {
                headingTags[tagName] = [];
            }
            if (tagText) {
                headingTags[tagName].push(tagText);
            }
        });
        console.log('Heading Tags:', headingTags);

        // Fetch internal and external links, and image URLs
        const internalLinks = new Set();
        const externalLinks = new Set();
        const imageUrls = [];
        // Loop through anchor tags
        $('a').each((index, element) => {
            let href = $(element).attr('href');
            if (href && isValidLink(href)) {
                href = new URL(href, baseUrl).href; // Normalize the link
                const linkDomain = tldjs.getDomain(href);
                if (linkDomain === tldjs.getDomain(baseUrl)) {
                    internalLinks.add(href);
                } else if (linkDomain && href.startsWith('http')) {
                    externalLinks.add(href);
                }
            }
        });
        // Loop through image tags
        $('img').each((index, element) => {
            const src = $(element).attr('src');
            if (src) {
                const absoluteUrl = new URL(src, baseUrl).href; // Normalize the URL
                imageUrls.push(absoluteUrl);
            }
        });
        console.log('Internal Links:', [...internalLinks]);
        console.log('External Links:', [...externalLinks]);
        console.log('Image URLs:', [...imageUrls]);

        // Check for broken links
        await checkBrokenLinks([...internalLinks, ...externalLinks, ...imageUrls]);

        console.log('----------------------------------------');
    } catch (error) {
        console.error('Error making the request:', error.message);
    }
}

async function checkBrokenLinks(links) {
    const results = await Promise.allSettled(links.map(async link => {
        try {
            const response = await axios.get(link, { maxRedirects: 5 }); // Adjust the number of redirects to follow
            return { link, status: response.status };
        } catch (error) {
            return { link, status: error.response ? error.response.status : 'Error' };
        }
    }));

    // Filter out only broken links
    const brokenLinks = results.filter(result => {
        return result.status === 'fulfilled' && result.value.status !== 200;
    });

    console.log('Broken Links:', brokenLinks);
}

function isValidLink(link) {
    // Add any custom validation logic for links
    return link && link.trim().length > 0;
}

fetchData();
