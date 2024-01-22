
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const validUrl = require('valid-url');
const tldjs = require('tldjs');

const app = express();
const port = 3001;

app.use(express.json());

app.get('/scrape', async (req, res) => {
  const url = req.query.url;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  try {
    const scrapedData = await scrapeData(url);
    res.json(scrapedData);
  } catch (error) {
    console.error('Error scraping data:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

async function scrapeData(url) {
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

  const metaDescription = $('meta[name="description"]').attr('content');
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

  const allLinks = [...internalLinks, ...externalLinks, ...Array.from(imageUrls)];
  const brokenLinks = await checkBrokenLinks(allLinks);

  return {
    metaDescription,
    internalLinks: [...internalLinks],
    externalLinks: [...externalLinks],
    imageUrls: [...imageUrls],
    tagData,
    brokenLinks,
  };
}

function isValidUrl(url) {
  return validUrl.isWebUri(url);
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

