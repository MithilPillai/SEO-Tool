const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const validUrl = require("valid-url");
const tldjs = require("tldjs");
const cors = require("cors");

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// app.get("/scrape", async (req, res) => {
//   const url = req.query.url;
//   console.log(url);

app.post("/scrape", async (req, res) => {
  const url = req.body.url;
  console.log(url);

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "Invalid URL provided" });
  }

  try {
    const scrapedData = await scrapeData(url);
    const mobileMetrics = await getPageSpeedMetrics(url, "mobile");
    const desktopMetrics = await getPageSpeedMetrics(url, "desktop");
    const mozData = await fetchMozData(url);;

    displayFormattedData(mozData);

    displayPageSpeedMetrics(mobileMetrics, desktopMetrics);

    res.json({
      meta: scrapedData.meta,
      internalLinks: scrapedData.internalLinks,
      externalLinks: scrapedData.externalLinks,
      brokenLinks: scrapedData.brokenLinks,
      images: scrapedData.images,
      imageAltTags: scrapedData.imageAltTags,
      tagData: scrapedData.tagData,
      seoFriendlyStatus: scrapedData.seoFriendlyStatus,
      hasSSL: scrapedData.hasSSL,
      mobileMetrics,
      desktopMetrics,
      mozData,
    });
  } catch (error) {
    console.error("Error scraping data:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

async function scrapeData(url) {
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

  const metaDescription = $('meta[name="description"]').attr("content");
  const baseDomain = tldjs.getDomain(url);

  const internalLinks = new Set();
  const externalLinks = new Set();
  const images = [];
  const imageAltTags = [];
  const tagData = {};

  $("a").each((index, element) => {
    let href = $(element).attr("href");
    if (href && isValidLink(href)) {
      if (!validUrl.isWebUri(href)) {
        href = new URL(href, url).href;
      }

      const linkDomain = tldjs.getDomain(href);

      if (linkDomain === baseDomain) {
        internalLinks.add(href);
      } else if (linkDomain && href.startsWith("http")) {
        externalLinks.add(href);
      }
    }
  });

  $("img").each((index, element) => {
    const src = $(element).attr("src");
    const alt = $(element).attr("alt");
    const absoluteUrl = new URL(src, url).href;
    images.push({ src: absoluteUrl, alt: alt || "No Alt Tag" });
    if (alt) {
      imageAltTags.push(alt);
    }
  });

  $("h1, h2, h3, h4, h5, h6").each((index, element) => {
    const tagName = element.name;
    const tagText = $(element).text().trim();
    if (!tagData[tagName]) {
      tagData[tagName] = [];
    }
    if (tagText) {
      tagData[tagName].push(tagText);
    }
  });

  const internalLinksArray = [...internalLinks];
  const externalLinksArray = [...externalLinks];
  const imageUrls = images.map((img) => img.src);
  const allLinks = [...internalLinksArray, ...externalLinksArray, ...imageUrls];
  const brokenLinks = await checkBrokenLinks(allLinks);
  const isSEOFriendly = checkSEOFriendly(url);
  const hasSSL = await checkSSL(url);

  let seoFriendlyStatus;
  if (isSEOFriendly) {
    seoFriendlyStatus = `SEO-Friendly: ${url}`;
  } else {
    seoFriendlyStatus = `Non-SEO-Friendly: ${url}`;
  }

  return {
    metaDescription,
    internalLinks: internalLinksArray,
    externalLinks: externalLinksArray,
    images: images.length > 0 ? [...images] : null,
    imageAltTags: imageAltTags.length > 0 ? [...imageAltTags] : null,
    tagData,
    brokenLinks,
    seoFriendlyStatus,
    hasSSL: hasSSL ? "Secured" : "Not Secured",
  };
}

async function getPageSpeedMetrics(url, strategy) {
  try {
    const apiKey = "AIzaSyAUOoXZkYKSB5PRRdfD4AqUUI4N8FDKWrA"; // Replace with your actual API key
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
      url
    )}&key=${apiKey}&strategy=${strategy}`;
    const response = await axios.get(apiUrl);

    if (!response.data.lighthouseResult) {
      console.error(
        `Error fetching ${strategy} PageSpeed metrics:`,
        response.data.error
      );
      return null;
    }

    const { audits } = response.data.lighthouseResult;

    const pageSpeedMetrics = {
      performanceScore:
        response.data.lighthouseResult.categories.performance.score * 100,
      firstContentfulPaint: audits["first-contentful-paint"].displayValue,
      largestContentfulPaint: audits["largest-contentful-paint"].displayValue,
      speedIndex: audits["speed-index"].displayValue,
      timeToInteractive: audits.interactive.displayValue,
      totalBlockingTime: audits["total-blocking-time"].displayValue,
    };

    console.log(`${strategy} PageSpeed Metrics:`, pageSpeedMetrics);

    return { [`${strategy}Metrics`]: pageSpeedMetrics, strategy };
  } catch (error) {
    console.error(
      `Error fetching ${strategy} PageSpeed metrics:`,
      error.message
    );
    return null;
  }
}

function displayPageSpeedMetrics(mobileMetrics, desktopMetrics) {
  if (mobileMetrics) {
    console.log("Mobile PageSpeed Metrics:", mobileMetrics);
  }

  if (desktopMetrics) {
    console.log("Desktop PageSpeed Metrics:", desktopMetrics);
  }
}

async function fetchMozData(url) {
  const accessId = "mozscape-ff795e92f1"; // Replace with your Moz Access ID
  const secretKey = "c750aa30ac76be2a5cd90e6b58a0b0ae"; // Replace with your Moz Secret Key
  const authHeader =
    "Basic " + Buffer.from(`${accessId}:${secretKey}`).toString("base64");

  try {
    const response = await axios({
      method: "POST",
      url: "https://lsapi.seomoz.com/v2/url_metrics",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      data: {
        targets: [url],
        metrics: ["url", "page_authority", "domain_authority", "spam_score"],
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching data from Moz:", error.message);
    return null;
  }
}

function displayFormattedData(data) {
  if (!data || !data.results || data.results.length === 0) {
    console.log('No Moz data available.');
    return;
  }

  data.results.forEach(result => {
    console.log('Page Information:');
        console.log(`URL: ${result.page}`);
        console.log(`Title: ${result.title}`);
        console.log(`Last Crawled: ${result.last_crawled}`);
        console.log(`HTTP Code: ${result.http_code}`);
        console.log(`Pages to Page: ${result.pages_to_page}`);
        console.log(`Nofollow Pages to Page: ${result.nofollow_pages_to_page}`);
        console.log(`Redirect Pages to Page: ${result.redirect_pages_to_page}`);
        console.log(`External Pages to Page: ${result.external_pages_to_page}`);
        console.log(`External Nofollow Pages to Page: ${result.external_nofollow_pages_to_page}`);
        console.log(`External Redirect Pages to Page: ${result.external_redirect_pages_to_page}`);
        console.log(`Deleted Pages to Page: ${result.deleted_pages_to_page}`);
        console.log(`Root Domains to Page: ${result.root_domains_to_page}`);
        console.log(`Indirect Root Domains to Page: ${result.indirect_root_domains_to_page}`);
        console.log(`Deleted Root Domains to Page: ${result.deleted_root_domains_to_page}`);
        console.log(`Nofollow Root Domains to Page: ${result.nofollow_root_domains_to_page}`);
        console.log(`Pages to Subdomain: ${result.pages_to_subdomain}`);
        console.log(`Nofollow Pages to Subdomain: ${result.nofollow_pages_to_subdomain}`);
        console.log(`Redirect Pages to Subdomain: ${result.redirect_pages_to_subdomain}`);
        console.log(`External Pages to Subdomain: ${result.external_pages_to_subdomain}`);
        console.log(`External Nofollow Pages to Subdomain: ${result.external_nofollow_pages_to_subdomain}`);
        console.log(`External Redirect Pages to Subdomain: ${result.external_redirect_pages_to_subdomain}`);
        console.log(`Deleted Pages to Subdomain: ${result.deleted_pages_to_subdomain}`);
        console.log(`Root Domains to Subdomain: ${result.root_domains_to_subdomain}`);
        console.log(`Deleted Root Domains to Subdomain: ${result.deleted_root_domains_to_subdomain}`);
        console.log(`Nofollow Root Domains to Subdomain: ${result.nofollow_root_domains_to_subdomain}`);
        console.log(`Pages to Root Domain: ${result.pages_to_root_domain}`);
        console.log(`Nofollow Pages to Root Domain: ${result.nofollow_pages_to_root_domain}`);
        console.log(`Redirect Pages to Root Domain: ${result.redirect_pages_to_root_domain}`);
        console.log(`External Pages to Root Domain: ${result.external_pages_to_root_domain}`);
        console.log(`External Indirect Pages to Root Domain: ${result.external_indirect_pages_to_root_domain}`);
        console.log(`External Nofollow Pages to Root Domain: ${result.external_nofollow_pages_to_root_domain}`);
        console.log(`External Redirect Pages to Root Domain: ${result.external_redirect_pages_to_root_domain}`);
        console.log(`Deleted Pages to Root Domain: ${result.deleted_pages_to_root_domain}`);
        console.log(`Root Domains to Root Domain: ${result.root_domains_to_root_domain}`);
        console.log(`Indirect Root Domains to Root Domain: ${result.indirect_root_domains_to_root_domain}`);
        console.log(`Deleted Root Domains to Root Domain: ${result.deleted_root_domains_to_root_domain}`);
        console.log(`Nofollow Root Domains to Root Domain: ${result.nofollow_root_domains_to_root_domain}`);
        console.log(`Page Authority: ${result.page_authority}`);
        console.log(`Domain Authority: ${result.domain_authority}`);
        console.log(`Link Propensity: ${result.link_propensity}`);
        console.log(`Spam Score: ${result.spam_score}`);
        console.log(`Root Domains from Page: ${result.root_domains_from_page}`);
        console.log(`Nofollow Root Domains from Page: ${result.nofollow_root_domains_from_page}`);
        console.log(`Pages from Page: ${result.pages_from_page}`);
        console.log(`Nofollow Pages from Page: ${result.nofollow_pages_from_page}`);
        console.log(`Root Domains from Root Domain: ${result.root_domains_from_root_domain}`);
        console.log(`Nofollow Root Domains from Root Domain: ${result.nofollow_root_domains_from_root_domain}`);
        console.log(`Pages from Root Domain: ${result.pages_from_root_domain}`);
        console.log(`Nofollow Pages from Root Domain: ${result.nofollow_pages_from_root_domain}`);
        console.log(`Pages Crawled from Root Domain: ${result.pages_crawled_from_root_domain}`);
        console.log('-----------------------------------');
  });
}

function isValidUrl(url) {
  return validUrl.isWebUri(url);
}

function isValidLink(url) {
  return (
    validUrl.isWebUri(url) &&
    !url.includes("#") &&
    !url.match(/\.(jpg|jpeg|png|pdf|gif|svg)$/i)
  );
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

function checkSEOFriendly(url) {
  const simplifiedUrl = url.replace(/^https?:\/\//, "");

  const containsSpecialCharacters = /[#!%]/.test(simplifiedUrl);
  const isShortEnough = simplifiedUrl.length <= 15;

  return !containsSpecialCharacters && isShortEnough;
}

async function checkSSL(url) {
  return url.startsWith("https://");
}

/////////////////////////////////////////////

// const express = require("express");
// const axios = require("axios");
// const cheerio = require("cheerio");
// const validUrl = require("valid-url");
// const tldjs = require("tldjs");
// const cors = require("cors");

// const { body, validationResult } = require("express-validator");

// const app = express();
// const port = 3001;

// app.use(cors());
// app.use(express.json());

// // app.get("/scrape", async (req, res) => {
// //   const url = req.query.url;
// //   console.log(url)

// app.post("/scrape", async (req, res) => {
//   const url = req.body.url;
//   console.log(url);

//   if (!url || !isValidUrl(url)) {
//     return res.status(400).json({ error: "Invalid URL provided" });
//   }

//   try {
//     const [scrapedData, mobileMetrics, desktopMetrics, mozData] =
//       await Promise.all([
//         scrapeData(url),
//         getPageSpeedMetrics(url, "mobile"),
//         getPageSpeedMetrics(url, "desktop"),
//         fetchMozData(url),
//       ]);

//     displayFormattedData(mozData);

//     displayPageSpeedMetrics(mobileMetrics, desktopMetrics);

//     res.json({ scrapedData, mobileMetrics, desktopMetrics, mozData });
//   } catch (error) {
//     console.error("Error scraping data:", error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });

// async function scrapeData(url) {
//   const response = await axios.get(url);
//   const html = response.data;
//   const $ = cheerio.load(html);

//   const metaDescription = $('meta[name="description"]').attr("content");
//   const baseDomain = tldjs.getDomain(url);

//   const internalLinks = new Set();
//   const externalLinks = new Set();
//   const images = [];
//   const imageAltTags = [];
//   const tagData = {};

//   $("a").each((index, element) => {
//     let href = $(element).attr("href");
//     if (href && isValidLink(href)) {
//       if (!validUrl.isWebUri(href)) {
//         href = new URL(href, url).href;
//       }

//       const linkDomain = tldjs.getDomain(href);

//       if (linkDomain === baseDomain) {
//         internalLinks.add(href);
//       } else if (linkDomain && href.startsWith("http")) {
//         externalLinks.add(href);
//       }
//     }
//   });

//   $("img").each((index, element) => {
//     const src = $(element).attr("src");
//     const alt = $(element).attr("alt");
//     const absoluteUrl = new URL(src, url).href;
//     images.push({ src: absoluteUrl, alt: alt || "No Alt Tag" });
//     if (alt) {
//       imageAltTags.push(alt);
//     }
//   });

//   $("h1, h2, h3, h4, h5, h6").each((index, element) => {
//     const tagName = element.name;
//     const tagText = $(element).text().trim();
//     if (!tagData[tagName]) {
//       tagData[tagName] = [];
//     }
//     if (tagText) {
//       tagData[tagName].push(tagText);
//     }
//   });

//   const internalLinksArray = [...internalLinks];
//   const externalLinksArray = [...externalLinks];
//   const imageUrls = images.map((img) => img.src);
//   const allLinks = [...internalLinksArray, ...externalLinksArray, ...imageUrls];
//   const brokenLinks = await checkBrokenLinks(allLinks);
//   const isSEOFriendly = checkSEOFriendly(url);
//   const hasSSL = await checkSSL(url);

//   let seoFriendlyStatus;
//   if (isSEOFriendly) {
//     seoFriendlyStatus = `SEO-Friendly: ${url}`;
//   } else {
//     seoFriendlyStatus = `Non-SEO-Friendly: ${url}`;
//   }

//   return {
//     metaDescription,
//     internalLinks: internalLinksArray,
//     externalLinks: externalLinksArray,
//     images: images.length > 0 ? [...images] : null,
//     imageAltTags: imageAltTags.length > 0 ? [...imageAltTags] : null,
//     tagData,
//     brokenLinks,
//     seoFriendlyStatus,
//     hasSSL: hasSSL ? "Secured" : "Not Secured",
//   };
// }

// async function getPageSpeedMetrics(url, strategy) {
//   try {
//     const apiKey = "AIzaSyAUOoXZkYKSB5PRRdfD4AqUUI4N8FDKWrA"; // Replace with your actual API key
//     const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
//       url
//     )}&key=${apiKey}&strategy=${strategy}`;
//     const response = await axios.get(apiUrl);

//     if (!response.data.lighthouseResult) {
//       console.error(
//         `Error fetching ${strategy} PageSpeed metrics:`,
//         response.data.error
//       );
//       return null;
//     }

//     const { audits } = response.data.lighthouseResult;

//     const pageSpeedMetrics = {
//       performanceScore:
//         response.data.lighthouseResult.categories.performance.score * 100,
//       firstContentfulPaint: audits["first-contentful-paint"].displayValue,
//       largestContentfulPaint: audits["largest-contentful-paint"].displayValue,
//       speedIndex: audits["speed-index"].displayValue,
//       timeToInteractive: audits.interactive.displayValue,
//       totalBlockingTime: audits["total-blocking-time"].displayValue,
//     };

//     console.log(`${strategy} PageSpeed Metrics:`, pageSpeedMetrics);

//     return { [`${strategy}Metrics`]: pageSpeedMetrics, strategy };
//   } catch (error) {
//     console.error(
//       `Error fetching ${strategy} PageSpeed metrics:`,
//       error.message
//     );
//     return null;
//   }
// }

// function displayPageSpeedMetrics(mobileMetrics, desktopMetrics) {
//   if (mobileMetrics) {
//     console.log("Mobile PageSpeed Metrics:", mobileMetrics);
//   }

//   if (desktopMetrics) {
//     console.log("Desktop PageSpeed Metrics:", desktopMetrics);
//   }
// }

// async function fetchMozData(url) {
//   const accessId = "mozscape-ff795e92f1"; // Replace with your Moz Access ID
//   const secretKey = "c750aa30ac76be2a5cd90e6b58a0b0ae"; // Replace with your Moz Secret Key
//   const authHeader =
//     "Basic " + Buffer.from(`${accessId}:${secretKey}`).toString("base64");

//   try {
//     const response = await axios({
//       method: "POST",
//       url: "https://lsapi.seomoz.com/v2/url_metrics",
//       headers: {
//         Authorization: authHeader,
//         "Content-Type": "application/json",
//       },
//       data: {
//         targets: [url],
//         metrics: ["url", "page_authority", "domain_authority", "spam_score"],
//       },
//     });

//     return response.data;
//   } catch (error) {
//     console.error("Error fetching data from Moz:", error.message);
//     return null;
//   }
// }

// function displayFormattedData(data) {
//   if (!data || !data.results || data.results.length === 0) {
//     console.log('No Moz data available.');
//     return;
//   }

//   data.results.forEach(result => {
//     console.log('Page Information:');
//         console.log(`URL: ${result.page}`);
//         console.log(`Title: ${result.title}`);
//         console.log(`Last Crawled: ${result.last_crawled}`);
//         console.log(`HTTP Code: ${result.http_code}`);
//         console.log(`Pages to Page: ${result.pages_to_page}`);
//         console.log(`Nofollow Pages to Page: ${result.nofollow_pages_to_page}`);
//         console.log(`Redirect Pages to Page: ${result.redirect_pages_to_page}`);
//         console.log(`External Pages to Page: ${result.external_pages_to_page}`);
//         console.log(`External Nofollow Pages to Page: ${result.external_nofollow_pages_to_page}`);
//         console.log(`External Redirect Pages to Page: ${result.external_redirect_pages_to_page}`);
//         console.log(`Deleted Pages to Page: ${result.deleted_pages_to_page}`);
//         console.log(`Root Domains to Page: ${result.root_domains_to_page}`);
//         console.log(`Indirect Root Domains to Page: ${result.indirect_root_domains_to_page}`);
//         console.log(`Deleted Root Domains to Page: ${result.deleted_root_domains_to_page}`);
//         console.log(`Nofollow Root Domains to Page: ${result.nofollow_root_domains_to_page}`);
//         console.log(`Pages to Subdomain: ${result.pages_to_subdomain}`);
//         console.log(`Nofollow Pages to Subdomain: ${result.nofollow_pages_to_subdomain}`);
//         console.log(`Redirect Pages to Subdomain: ${result.redirect_pages_to_subdomain}`);
//         console.log(`External Pages to Subdomain: ${result.external_pages_to_subdomain}`);
//         console.log(`External Nofollow Pages to Subdomain: ${result.external_nofollow_pages_to_subdomain}`);
//         console.log(`External Redirect Pages to Subdomain: ${result.external_redirect_pages_to_subdomain}`);
//         console.log(`Deleted Pages to Subdomain: ${result.deleted_pages_to_subdomain}`);
//         console.log(`Root Domains to Subdomain: ${result.root_domains_to_subdomain}`);
//         console.log(`Deleted Root Domains to Subdomain: ${result.deleted_root_domains_to_subdomain}`);
//         console.log(`Nofollow Root Domains to Subdomain: ${result.nofollow_root_domains_to_subdomain}`);
//         console.log(`Pages to Root Domain: ${result.pages_to_root_domain}`);
//         console.log(`Nofollow Pages to Root Domain: ${result.nofollow_pages_to_root_domain}`);
//         console.log(`Redirect Pages to Root Domain: ${result.redirect_pages_to_root_domain}`);
//         console.log(`External Pages to Root Domain: ${result.external_pages_to_root_domain}`);
//         console.log(`External Indirect Pages to Root Domain: ${result.external_indirect_pages_to_root_domain}`);
//         console.log(`External Nofollow Pages to Root Domain: ${result.external_nofollow_pages_to_root_domain}`);
//         console.log(`External Redirect Pages to Root Domain: ${result.external_redirect_pages_to_root_domain}`);
//         console.log(`Deleted Pages to Root Domain: ${result.deleted_pages_to_root_domain}`);
//         console.log(`Root Domains to Root Domain: ${result.root_domains_to_root_domain}`);
//         console.log(`Indirect Root Domains to Root Domain: ${result.indirect_root_domains_to_root_domain}`);
//         console.log(`Deleted Root Domains to Root Domain: ${result.deleted_root_domains_to_root_domain}`);
//         console.log(`Nofollow Root Domains to Root Domain: ${result.nofollow_root_domains_to_root_domain}`);
//         console.log(`Page Authority: ${result.page_authority}`);
//         console.log(`Domain Authority: ${result.domain_authority}`);
//         console.log(`Link Propensity: ${result.link_propensity}`);
//         console.log(`Spam Score: ${result.spam_score}`);
//         console.log(`Root Domains from Page: ${result.root_domains_from_page}`);
//         console.log(`Nofollow Root Domains from Page: ${result.nofollow_root_domains_from_page}`);
//         console.log(`Pages from Page: ${result.pages_from_page}`);
//         console.log(`Nofollow Pages from Page: ${result.nofollow_pages_from_page}`);
//         console.log(`Root Domains from Root Domain: ${result.root_domains_from_root_domain}`);
//         console.log(`Nofollow Root Domains from Root Domain: ${result.nofollow_root_domains_from_root_domain}`);
//         console.log(`Pages from Root Domain: ${result.pages_from_root_domain}`);
//         console.log(`Nofollow Pages from Root Domain: ${result.nofollow_pages_from_root_domain}`);
//         console.log(`Pages Crawled from Root Domain: ${result.pages_crawled_from_root_domain}`);
//         console.log('-----------------------------------');
//   });
// }

// function isValidUrl(url) {
//   return validUrl.isWebUri(url);
// }

// function isValidLink(url) {
//   return (
//     validUrl.isWebUri(url) &&
//     !url.includes("#") &&
//     !url.match(/\.(jpg|jpeg|png|pdf|gif|svg)$/i)
//   );
// }

// async function checkBrokenLinks(links) {
//   const brokenLinks = [];
//   for (const link of links) {
//     try {
//       const response = await axios.head(link);
//       if (response.status >= 400) {
//         brokenLinks.push(link);
//       }
//     } catch (error) {
//       brokenLinks.push(link);
//     }
//   }
//   return brokenLinks;
// }

// function checkSEOFriendly(url) {
//   const simplifiedUrl = url.replace(/^https?:\/\//, "");

//   const containsSpecialCharacters = /[#!%]/.test(simplifiedUrl);
//   const isShortEnough = simplifiedUrl.length <= 15;

//   return !containsSpecialCharacters && isShortEnough;
// }

// async function checkSSL(url) {
//   return url.startsWith("https://");
// }

////////////////////

// const express = require("express");
// const axios = require("axios");
// const cheerio = require("cheerio");
// const validUrl = require("valid-url");
// const tldjs = require("tldjs");
// const cors = require("cors");

// const { body, validationResult } = require("express-validator");

// const app = express();
// const port = 3001;

// app.use(cors());
// app.use(express.json());

// // app.get("/demo", async (req, res) => {
// //   const url = req.query.url;
// //   console.log(url)
// // });

// app.post("/scrape", async (req, res) => {
//   const url = req.body.url;
//   console.log(url);

//   if (!url || !isValidUrl(url)) {
//     return res.status(400).json({ error: "Invalid URL provided" });
//   }

//   try {
//     const [scrapedData, mobileMetrics, desktopMetrics, mozData] =
//       await Promise.all([
//         scrapeData(url),
//         getPageSpeedMetrics(url, "mobile"),
//         getPageSpeedMetrics(url, "desktop"),
//         fetchMozData(url),
//       ]);

//     displayFormattedData(mozData);

//     displayPageSpeedMetrics(mobileMetrics, desktopMetrics);

//     res.json({ scrapedData, mobileMetrics, desktopMetrics, mozData });
//   } catch (error) {
//     console.error("Error scraping data:", error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });

// async function scrapeData(url) {
//   const response = await axios.get(url);
//   const html = response.data;
//   const $ = cheerio.load(html);

//   const metaDescription = $('meta[name="description"]').attr("content");
//   const baseDomain = tldjs.getDomain(url);

//   const internalLinks = new Set();
//   const externalLinks = new Set();
//   const images = [];
//   const imageAltTags = [];
//   const tagData = {};

//   $("a").each((index, element) => {
//     let href = $(element).attr("href");
//     if (href && isValidLink(href)) {
//       if (!validUrl.isWebUri(href)) {
//         href = new URL(href, url).href;
//       }

//       const linkDomain = tldjs.getDomain(href);

//       if (linkDomain === baseDomain) {
//         internalLinks.add(href);
//       } else if (linkDomain && href.startsWith("http")) {
//         externalLinks.add(href);
//       }
//     }
//   });

//   $("img").each((index, element) => {
//     const src = $(element).attr("src");
//     const alt = $(element).attr("alt");
//     const absoluteUrl = new URL(src, url).href;
//     images.push({ src: absoluteUrl, alt: alt || "No Alt Tag" });
//     if (alt) {
//       imageAltTags.push(alt);
//     }
//   });

//   $("h1, h2, h3, h4, h5, h6").each((index, element) => {
//     const tagName = element.name;
//     const tagText = $(element).text().trim();
//     if (!tagData[tagName]) {
//       tagData[tagName] = [];
//     }
//     if (tagText) {
//       tagData[tagName].push(tagText);
//     }
//   });

//   const internalLinksArray = [...internalLinks];
//   const externalLinksArray = [...externalLinks];
//   const imageUrls = images.map((img) => img.src);
//   const allLinks = [...internalLinksArray, ...externalLinksArray, ...imageUrls];
//   const brokenLinks = await checkBrokenLinks(allLinks);
//   const isSEOFriendly = checkSEOFriendly(url);
//   const hasSSL = await checkSSL(url);

//   let seoFriendlyStatus;
//   if (isSEOFriendly) {
//     seoFriendlyStatus = `SEO-Friendly: ${url}`;
//   } else {
//     seoFriendlyStatus = `Non-SEO-Friendly: ${url}`;
//   }

//   return {
//     metaDescription,
//     internalLinks: internalLinksArray,
//     externalLinks: externalLinksArray,
//     images: images.length > 0 ? [...images] : null,
//     imageAltTags: imageAltTags.length > 0 ? [...imageAltTags] : null,
//     tagData,
//     brokenLinks,
//     seoFriendlyStatus,
//     hasSSL: hasSSL ? "Secured" : "Not Secured",
//   };
// }

// async function getPageSpeedMetrics(url, strategy) {
//   try {
//     const apiKey = "AIzaSyAUOoXZkYKSB5PRRdfD4AqUUI4N8FDKWrA"; // Replace with your actual API key
//     const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
//       url
//     )}&key=${apiKey}&strategy=${strategy}`;
//     const response = await axios.get(apiUrl);

//     if (!response.data.lighthouseResult) {
//       console.error(
//         `Error fetching ${strategy} PageSpeed metrics:`,
//         response.data.error
//       );
//       return null;
//     }

//     const { audits } = response.data.lighthouseResult;

//     const pageSpeedMetrics = {
//       performanceScore:
//         response.data.lighthouseResult.categories.performance.score * 100,
//       firstContentfulPaint: audits["first-contentful-paint"].displayValue,
//       largestContentfulPaint: audits["largest-contentful-paint"].displayValue,
//       speedIndex: audits["speed-index"].displayValue,
//       timeToInteractive: audits.interactive.displayValue,
//       totalBlockingTime: audits["total-blocking-time"].displayValue,
//     };

//     console.log(`${strategy} PageSpeed Metrics:`, pageSpeedMetrics);

//     return { [`${strategy}Metrics`]: pageSpeedMetrics, strategy };
//   } catch (error) {
//     console.error(
//       `Error fetching ${strategy} PageSpeed metrics:`,
//       error.message
//     );
//     return null;
//   }
// }

// function displayPageSpeedMetrics(mobileMetrics, desktopMetrics) {
//   if (mobileMetrics) {
//     console.log("Mobile PageSpeed Metrics:", mobileMetrics);
//   }

//   if (desktopMetrics) {
//     console.log("Desktop PageSpeed Metrics:", desktopMetrics);
//   }
// }

// async function fetchMozData(url) {
//   const accessId = "mozscape-ff795e92f1"; // Replace with your Moz Access ID
//   const secretKey = "c750aa30ac76be2a5cd90e6b58a0b0ae"; // Replace with your Moz Secret Key
//   const authHeader =
//     "Basic " + Buffer.from(`${accessId}:${secretKey}`).toString("base64");

//   try {
//     const response = await axios({
//       method: "POST",
//       url: "https://lsapi.seomoz.com/v2/url_metrics",
//       headers: {
//         Authorization: authHeader,
//         "Content-Type": "application/json",
//       },
//       data: {
//         targets: [url],
//         metrics: ["url", "page_authority", "domain_authority", "spam_score"],
//       },
//     });

//     return response.data;
//   } catch (error) {
//     console.error("Error fetching data from Moz:", error.message);
//     return null;
//   }
// }

// function displayFormattedData(data) {
//   if (!data || !data.results || data.results.length === 0) {
//     console.log("No Moz data available.");
//     return;
//   }

//   data.results.forEach((result) => {
//     console.log("Page Information:");
//     console.log(`URL: ${result.page}`);
//     console.log(`Title: ${result.title}`);
//     console.log(`Last Crawled: ${result.last_crawled}`);
//     console.log(`HTTP Code: ${result.http_code}`);
//     console.log(`Pages to Page: ${result.pages_to_page}`);
//     console.log(`Nofollow Pages to Page: ${result.nofollow_pages_to_page}`);
//     console.log(`Redirect Pages to Page: ${result.redirect_pages_to_page}`);
//     console.log(`External Pages to Page: ${result.external_pages_to_page}`);
//     console.log(
//       `External Nofollow Pages to Page: ${result.external_nofollow_pages_to_page}`
//     );
//     console.log(
//       `External Redirect Pages to Page: ${result.external_redirect_pages_to_page}`
//     );
//     console.log(`Deleted Pages to Page: ${result.deleted_pages_to_page}`);
//     console.log(`Root Domains to Page: ${result.root_domains_to_page}`);
//     console.log(
//       `Indirect Root Domains to Page: ${result.indirect_root_domains_to_page}`
//     );
//     console.log(
//       `Deleted Root Domains to Page: ${result.deleted_root_domains_to_page}`
//     );
//     console.log(
//       `Nofollow Root Domains to Page: ${result.nofollow_root_domains_to_page}`
//     );
//     console.log(`Pages to Subdomain: ${result.pages_to_subdomain}`);
//     console.log(
//       `Nofollow Pages to Subdomain: ${result.nofollow_pages_to_subdomain}`
//     );
//     console.log(
//       `Redirect Pages to Subdomain: ${result.redirect_pages_to_subdomain}`
//     );
//     console.log(
//       `External Pages to Subdomain: ${result.external_pages_to_subdomain}`
//     );
//     console.log(
//       `External Nofollow Pages to Subdomain: ${result.external_nofollow_pages_to_subdomain}`
//     );
//     console.log(
//       `External Redirect Pages to Subdomain: ${result.external_redirect_pages_to_subdomain}`
//     );
//     console.log(
//       `Deleted Pages to Subdomain: ${result.deleted_pages_to_subdomain}`
//     );
//     console.log(
//       `Root Domains to Subdomain: ${result.root_domains_to_subdomain}`
//     );
//     console.log(
//       `Deleted Root Domains to Subdomain: ${result.deleted_root_domains_to_subdomain}`
//     );
//     console.log(
//       `Nofollow Root Domains to Subdomain: ${result.nofollow_root_domains_to_subdomain}`
//     );
//     console.log(`Pages to Root Domain: ${result.pages_to_root_domain}`);
//     console.log(
//       `Nofollow Pages to Root Domain: ${result.nofollow_pages_to_root_domain}`
//     );
//     console.log(
//       `Redirect Pages to Root Domain: ${result.redirect_pages_to_root_domain}`
//     );
//     console.log(
//       `External Pages to Root Domain: ${result.external_pages_to_root_domain}`
//     );
//     console.log(
//       `External Indirect Pages to Root Domain: ${result.external_indirect_pages_to_root_domain}`
//     );
//     console.log(
//       `External Nofollow Pages to Root Domain: ${result.external_nofollow_pages_to_root_domain}`
//     );
//     console.log(
//       `External Redirect Pages to Root Domain: ${result.external_redirect_pages_to_root_domain}`
//     );
//     console.log(
//       `Deleted Pages to Root Domain: ${result.deleted_pages_to_root_domain}`
//     );
//     console.log(
//       `Root Domains to Root Domain: ${result.root_domains_to_root_domain}`
//     );
//     console.log(
//       `Indirect Root Domains to Root Domain: ${result.indirect_root_domains_to_root_domain}`
//     );
//     console.log(
//       `Deleted Root Domains to Root Domain: ${result.deleted_root_domains_to_root_domain}`
//     );
//     console.log(
//       `Nofollow Root Domains to Root Domain: ${result.nofollow_root_domains_to_root_domain}`
//     );
//     console.log(`Page Authority: ${result.page_authority}`);
//     console.log(`Domain Authority: ${result.domain_authority}`);
//     console.log(`Link Propensity: ${result.link_propensity}`);
//     console.log(`Spam Score: ${result.spam_score}`);
//     console.log(`Root Domains from Page: ${result.root_domains_from_page}`);
//     console.log(
//       `Nofollow Root Domains from Page: ${result.nofollow_root_domains_from_page}`
//     );
//     console.log(`Pages from Page: ${result.pages_from_page}`);
//     console.log(`Nofollow Pages from Page: ${result.nofollow_pages_from_page}`);
//     console.log(
//       `Root Domains from Root Domain: ${result.root_domains_from_root_domain}`
//     );
//     console.log(
//       `Nofollow Root Domains from Root Domain: ${result.nofollow_root_domains_from_root_domain}`
//     );
//     console.log(`Pages from Root Domain: ${result.pages_from_root_domain}`);
//     console.log(
//       `Nofollow Pages from Root Domain: ${result.nofollow_pages_from_root_domain}`
//     );
//     console.log(
//       `Pages Crawled from Root Domain: ${result.pages_crawled_from_root_domain}`
//     );
//     console.log("-----------------------------------");
//   });
// }

// function isValidUrl(url) {
//   return validUrl.isWebUri(url);
// }

// function isValidLink(url) {
//   return (
//     validUrl.isWebUri(url) &&
//     !url.includes("#") &&
//     !url.match(/\.(jpg|jpeg|png|pdf|gif|svg)$/i)
//   );
// }

// async function checkBrokenLinks(links) {
//   const brokenLinks = [];
//   for (const link of links) {
//     try {
//       const response = await axios.head(link);
//       if (response.status >= 400) {
//         brokenLinks.push(link);
//       }
//     } catch (error) {
//       brokenLinks.push(link);
//     }
//   }
//   return brokenLinks;
// }

// function checkSEOFriendly(url) {
//   const simplifiedUrl = url.replace(/^https?:\/\//, "");

//   const containsSpecialCharacters = /[#!%]/.test(simplifiedUrl);
//   const isShortEnough = simplifiedUrl.length <= 15;

//   return !containsSpecialCharacters && isShortEnough;
// }

// async function checkSSL(url) {
//   return url.startsWith("https://");
// }

///////////////////////////

