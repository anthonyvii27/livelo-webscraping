import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const LIMITER = 5;
const MIN_POINTS = 1;
const URI = "https://www.livelo.com.br/ganhe-pontos-compre-e-pontue";

const getDOMElementTextValue = async (page, target, fallbackValue = "") => {
    if (await page.$(target) !== null)
        return await page.$eval(target, text => text.textContent);

    return fallbackValue;
}

const getDOMElementImageAltValue = async (page, target, fallbackValue) => {
    if (await page.$(target) !== null)
        return await page.$eval(target, img => img.alt);

    return fallbackValue;
}

const pagePromise = (browser, link) => new Promise(async(resolve, _) => {
    let dataObj = {};
    const specifiedStorePage = await browser.newPage();

    await specifiedStorePage.goto(link);

    try {
        await specifiedStorePage.waitForSelector(".parity__card--info_container");

        dataObj["store"] = await getDOMElementImageAltValue(specifiedStorePage, "#img-bannerParityLogo");
        dataObj["rules"] = await getDOMElementTextValue(specifiedStorePage, ".banner__blocktext-text", "Consulte o regulamento");
        dataObj["currency"] = await getDOMElementTextValue(specifiedStorePage, 'span[data-bind="text: currency"]');
        dataObj["value"] = await getDOMElementTextValue(specifiedStorePage, 'span[data-bind="text: value"]');
        dataObj["separator"] = await getDOMElementTextValue(specifiedStorePage, 'span[data-bind="text: separator"]');
        dataObj["parity"] = await getDOMElementTextValue(specifiedStorePage, 'span[data-bind="text: parity"]');
        dataObj["url"] = link;
    } catch {
        console.warn(`An error has occured in ${link}`);
    }

    resolve(dataObj);
    await specifiedStorePage.close();
});

export const pageScraper = {
    url: URI,
    async scraper(browser) {
        const initialPage = await browser.newPage();
        console.log(`Navigating to ${this.url}...`);

        await initialPage.goto(this.url);
        await initialPage.waitForSelector("div#div-parity");

        const urls = await initialPage.$$eval("div#div-parity", links => links.map(el => el.querySelector(".button__knowmore > a").href));

        const scrapedData = [];
        const pageLimiter = Number(LIMITER) >= urls.length ? urls.length : LIMITER;

        for(let i=0; i < pageLimiter; i++) {
            console.log(`[${i + 1}/${pageLimiter}] - Getting data from ${urls[i]}`);
            const currentPageData = await pagePromise(browser, urls[i]);

            scrapedData.push({
                store: currentPageData.store,
                rules: currentPageData.rules,
                points: `${currentPageData.currency} ${currentPageData.value} ${currentPageData.separator} ${currentPageData.parity}`,
                maxPoints: currentPageData.parity,
                url: currentPageData.url,
            });
        }

        const filteredScrapedData = scrapedData.filter(item => Boolean(item.maxPoints) && Number(item.maxPoints.split(" ")[0]) >= MIN_POINTS);

        if(filteredScrapedData.length > 0) {
            const messageList = [];
            for(let index in filteredScrapedData) {
                messageList.push(`*Loja:* ${filteredScrapedData[index].store}\n*Pontos:* ${filteredScrapedData[index].points}\n*Regras:* ${filteredScrapedData[index].rules}\n\n[Link para acesso](${filteredScrapedData[index].url})`);
            }

            if(messageList.length !== 0) {
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&parse_mode=Markdown`, {
                    text: messageList.join(`\n\n-------\n\n`)
                })
            }
        } else {
            console.warn("No promotions were found for these parameters");
        }
    }
}