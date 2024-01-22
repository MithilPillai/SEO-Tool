const axios = require('axios');
const cheerio = require('cheerio');
const validUrl = require('valid-url');
const tldjs = require('tldjs'); // Ensure this package is installed

async function fetchPageData(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const metaDescription = $('meta[name="description"]').attr('content');
    console.log('Meta Description:', metaDescription);

    const baseDomain = tldjs.getDomain(url);
    const internalLinks = new Set();
    const externalLinks = new Set();
    const imageUrls = new Set();
    const tagData = {};

    $('a').each((index, element) => {
      let href = $(element).attr('href');
      if (href && isValidLink(href)) {
        if (!validUrl.isWebUri(href)) {
          href = new URL(href, url).href;
        }

        const linkDomain = tldjs.getDomain(href);

        if (linkDomain === baseDomain) {
          internalLinks.add(href);
        } else if (linkDomain && href.startsWith('http')) {
          externalLinks.add(href);
        }
      }
    });

    $('img').each((index, element) => {
      const src = $(element).attr('src');
      if (src) {
        const absoluteUrl = new URL(src, url).href;
        imageUrls.add(absoluteUrl);
      }
    });

    $('h1, h2, h3, h4, h5, h6').each((index, element) => {
      const tagName = element.name;
      const tagText = $(element).text().trim();
      if (!tagData[tagName]) {
        tagData[tagName] = [];
      }
      if (tagText) {
        tagData[tagName].push(tagText);
      }
    });

    console.log('Internal Links:', [...internalLinks]);
    console.log('External Links:', [...externalLinks]);
    console.log('Image URLs:', [...imageUrls]);
    console.log('Tag Data:', tagData);

    const allLinks = [...internalLinks, ...externalLinks, ...Array.from(imageUrls)];
    const brokenLinks = await checkBrokenLinks(allLinks);
    console.log('Broken Links:', brokenLinks);
  } catch (error) {
    console.error('Error fetching page data:', error.message);
  }
}

function isValidLink(url) {
  return validUrl.isWebUri(url) && !url.includes('#') && !url.match(/\.(jpg|jpeg|png|pdf|gif|svg)$/i);
}

async function checkBrokenLinks(links) {
  const brokenLinks = [];
  for (const link of links) {
    try {
      const response = await axios.head(link);
      if (response.status >= 400) {
        brokenLinks.push(link);
      }
    } catch (error) {
      brokenLinks.push(link);
    }
  }
  return brokenLinks;
}

const targetUrl = 'https://stldigital.tech';
fetchPageData(targetUrl);
