import fetch from "node-fetch";
import puppeteer, { Puppeteer } from "puppeteer";
import { LNDetail, SearchResult } from "../types";
import { shuffleArray } from ".";

const BASE_URL = "https://bookmeter.com";

export const searchLN = async (title: string): Promise<SearchResult> => {
    const res = await fetch(encodeURI(`${BASE_URL}/search?keyword=${title}`));
    const data = await res.json();
    const searchResult: SearchResult = data.resources[0].contents.book;

    return searchResult;
};

const findBookInfo = (bookID: string): LNDetail => {
    const titleA = document.querySelector(
        "body > section.books.show > header > div.header__inner > h1"
    );
    const titleText = titleA?.innerHTML;
    const bookMeterLink = `${BASE_URL}/books/${bookID}`;
    const section = document.querySelector(
        "body > section.books.show > div.bm-wrapper > div.bm-wrapper__side > div > section:nth-child(1)"
    );
    const desc = section?.querySelector(
        "div.group__detail > dl > dd.bm-details-side__item.bm-details-side__item--full > div > div > p"
    )?.innerHTML;
    const image = section
        .querySelector("div.group__image > a > img")
        ?.getAttribute("src")
        ?.toString();
    const pageCount = section?.querySelector(
        "div.group__detail > dl > dd:nth-child(4) > span:nth-child(1)"
    )?.innerHTML;
    const author = document.querySelector(
        "body > section.books.show > header > div.header__inner > ul > li > a"
    )?.innerHTML;

    return {
        id: bookID,
        title: titleText,
        link: bookMeterLink,
        desc,
        author,
        image: image || "",
        pageCount,
    };
};

const findBookRecommendations = async (page: puppeteer.Page) => {
    const reccs: string[] = await page.evaluate(() => {
        const listItems = document.querySelectorAll(
            ".sidebars.groups.book > .book__thumbnail > a"
        );
        const recommendationIds: Array<string> = [];
        listItems.forEach((elm) => {
            const link = elm.getAttribute("href");
            if (link) {
                recommendationIds.push(link.replace(/\/books\//, ""));
            }
        });
        return recommendationIds;
    });
    return shuffleArray(reccs);
};

export const showDetailsForLN = async (
    id: string | null = null,
    title = "",
    onlyReccs = false
): Promise<LNDetail | string[]> => {
    let lookupID: string | null = id;
    if (id === null) {
        const res = await searchLN(title);
        lookupID = res.id;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(encodeURI(`${BASE_URL}/books/${lookupID}`));

    if (onlyReccs) {
        return findBookRecommendations(page);
    }

    const results: LNDetail = await page.evaluate(findBookInfo, lookupID);
    browser.close();
    return results;
};