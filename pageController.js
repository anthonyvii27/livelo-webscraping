import { pageScraper } from "./pageScraper.js";

export const PageController = async (browserInstance) => {
    try {
        const browser = await browserInstance;
        await pageScraper.scraper(browser);
    } catch(err) {
        console.error("Could not resolve the browser: ", err);
    }
}