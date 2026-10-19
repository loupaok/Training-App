/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100",
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  exclude: ["/keystatic", "/keystatic/*", "/api/*"],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/keystatic", "/api"],
      },
    ],
  },
};
