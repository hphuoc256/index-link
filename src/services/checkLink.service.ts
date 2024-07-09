import { Inject, Injectable } from '@nestjs/common';
import { AxiosService } from './axios.service';
import { SinbyteRepositoryInterface } from '../repositories/sinbyte.interface.repository';
import puppeteer, { Browser, Page } from 'puppeteer';
import {
  CheckIndexExternalResponseType,
  CheckLinkResponseType,
  IndexSinbyteDto,
  IndexSinbyteResponseType,
} from '../types/check-link';
import { AxiosResponse } from 'axios';
import { Sinbyte } from '../entities/sinbyte.entity';
import { MyLoggerService } from '../modules/logger/logger.service';

@Injectable()
export class CheckLinkService {
  private readonly url: string;
  private readonly apikey: string;
  private readonly timeout: number;
  constructor(
    @Inject('SinbyteRepositoryInterface')
    private readonly sinbyteRepo: SinbyteRepositoryInterface,
    private logger: MyLoggerService,
  ) {
    this.url = 'https://app.sinbyte.com/api/indexing/';
    this.apikey = 'pp74xezyqu6gxjn1bzj0udygiompcb0titotlwu7';
    this.timeout = 20000;
  }

  private removeTrailingSlash(url: string): string {
    // Kiểm tra nếu có dấu / ở cuối chuỗi
    if (url.charAt(url.length - 1) === '/') {
      // Nếu có, loại bỏ dấu /
      return url.slice(0, -1);
    }
    // Nếu không có dấu / ở cuối, trả về nguyên chuỗi
    return url;
  }

  /* public async send(
    link: string,
    domain: string,
    timeout = 0,
  ): Promise<CheckLinkResponseType> {
    const browser: Browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: null,
    });
    const domainParse: string = this.removeTrailingSlash(domain);
    try {
      console.log(timeout);
      const page: Page = await browser.newPage();
      await page.goto(link, {
        waitUntil: 'networkidle2',
        timeout: timeout === 0 ? 0 : timeout,
      });
      await page.waitForSelector('a');
      const result: CheckLinkResponseType = await page.evaluate(
        (domainParse: string) => {
          const anchorTags: NodeListOf<HTMLAnchorElement> =
            document.querySelectorAll('a');
          if (!anchorTags?.length) {
            return { status: 'no', message: 'Domain không tìm thấy' };
          }

          let domainFound: boolean = false;
          let isFollow: boolean = false;
          let isIndex: boolean = false;
          const domainResult: string = domainParse.replace(/^https?:\/\//, '');
          for (const anchorTag of anchorTags) {
            const href: string = anchorTag.getAttribute('href');
            const metaTags: NodeListOf<Element> = document.querySelectorAll(
              'meta[name="robots"]',
            );
            if (metaTags && metaTags.length) {
              metaTags.forEach((metaTag) => {
                const metaContent: string = metaTag.getAttribute('content');
                if (metaContent) {
                  const values: string[] = metaContent.split(',');
                  if (values && values.length) {
                    for (const value of values) {
                      if (value.toLowerCase().trim() === 'follow') {
                        isFollow = true;
                      }
                      if (value.toLowerCase().trim() === 'index') {
                        isIndex = true;
                      }
                    }
                  }
                }
              });
            }

            if (!href) {
              continue; // Skip to the next anchorTag if href is not present
            }
            let hrefParse: string = '';
            if (href.charAt(href.length - 1) === '/') {
              hrefParse = href.slice(0, -1);
            } else {
              hrefParse = href;
            }
            const hrefResult: string = hrefParse.replace(/^https?:\/\//, '');

            if (hrefResult.includes(domainResult)) {
              domainFound = true;
            }
          }

          // If the loop completes without returning, it means AnchorText was not found
          if (domainFound) {
            return {
              status: 'ok',
              message: 'Succeed',
              isIndex: isIndex,
              isFollow: isFollow,
            };
          } else {
            return {
              status: 'no',
              message: 'Domain không tìm thấy',
              isIndex: isIndex,
              isFollow: isFollow,
            };
          }
        },
        domainParse,
      );
      await browser.close();
      if (!result) {
        return {
          status: 'no',
          message: 'Failed',
          isIndex: false,
          isFollow: false,
        };
      }
      return result;
    } catch (error) {
      await browser.close();
      return {
        status: 'no',
        message: 'Web không phản hồi',
        isIndex: false,
        isFollow: false,
      };
    }
  }*/

  public async send(
    link: string,
    domain: string,
    keywords: string[] = [],
    timeout = 0,
  ): Promise<CheckLinkResponseType> {
    const browser: Browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: null,
    });
    const domainParse: string = this.removeTrailingSlash(domain);
    let domainResult: string = domainParse.replace(/^https?:\/\//, '');
    if (domainResult.includes('www.')) {
      domainResult = domainResult.slice(4);
    }

    try {
      const page: Page = await browser.newPage();

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537');

      await page.goto(link, {
        waitUntil: 'networkidle0',
        timeout: timeout,
      });
      
      await page.waitForSelector('a');

      const initialCheckResult = await this.checkLinksOnPage(
        page,
        domainResult,
      );

      if (initialCheckResult.status === 'ok') {
        await browser.close();
        return initialCheckResult;
      } else if (keywords.length > 0) {
        let keywordResult: CheckLinkResponseType;
        for (const keyword of keywords) {
          keywordResult = await this.checkKeywordOnPage(
            page,
            keyword,
            domainResult,
            browser,
          );

          if (keywordResult.status === 'ok') {
            await browser.close();
            return keywordResult;
          }
        }
        await browser.close();
        return keywordResult;
      }

      await browser.close();
      return {
        status: 'no',
        message: 'Failed',
        isIndex: false,
        isFollow: false,
      };
    } catch (error) {
      this.logger.warn(error.message, 'CheckLinkService.send')
      await browser.close();
      return {
        status: 'no',
        message: 'Web không phản hồi',
        isIndex: false,
        isFollow: false,
      };
    }
  }

  private async checkLinksOnPage(
    page: Page,
    domainResult: string,
  ): Promise<CheckLinkResponseType> {
    return await page.evaluate((domainResult: string) => {
      const anchorTags: NodeListOf<HTMLAnchorElement> =
        document.querySelectorAll('a');
      if (!anchorTags?.length) {
        return {
          status: 'no',
          message: 'Domain không tìm thấy',
          isIndex: false,
          isFollow: false,
        };
      }

      let domainFound = false;
      let isFollow = false;
      let isIndex = false;

      const metaTags = document.querySelectorAll('meta[name="robots"]');
      metaTags.forEach((metaTag) => {
        const content = metaTag.getAttribute('content');
        if (content) {
          const values = content.split(',');
          values.forEach((value) => {
            const trimmedValue = value.toLowerCase().trim();
            if (trimmedValue === 'follow') isFollow = true;
            if (trimmedValue === 'index') isIndex = true;
          });
        }
      });

      anchorTags.forEach((anchorTag) => {
        const href = anchorTag.getAttribute('href');
        if (href) {
          const hrefResult = href
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '');
          if (hrefResult.includes(domainResult)) {
            domainFound = true;
          }
        }
      });

      if (domainFound) {
        return {
          status: 'ok',
          message: 'Succeed',
          isIndex: isIndex,
          isFollow: isFollow,
        };
      } else {
        return {
          status: 'no',
          message: 'Domain không tìm thấy',
          isIndex: isIndex,
          isFollow: isFollow,
        };
      }
    }, domainResult);
  }

  private async checkKeywordOnPage(
    page: Page,
    keyword: string,
    domainResult: string,
    browser: Browser,
  ): Promise<CheckLinkResponseType> {
    const links: string[] = await page.evaluate((keyword: string) => {
      const anchorTags: NodeListOf<HTMLAnchorElement> =
        document.querySelectorAll('a');
      const links: string[] = [];
      const currentDomain = window.location.origin;
      anchorTags.forEach((anchorTag) => {
        if (anchorTag.textContent.includes(keyword)) {
          let href = anchorTag.getAttribute('href');
          if (href) {
            if (href.startsWith('/')) {
              href = currentDomain + href;
            }
            links.push(href);
          }
        }
      });
      return links;
    }, keyword);

    let found = false;

    for (const link of links) {
      const newPage = await browser.newPage();
      await newPage.goto(link, { waitUntil: 'networkidle2' });

      const checkResult: CheckLinkResponseType = await this.checkLinksOnPage(
        newPage,
        domainResult,
      );
      await newPage.close();

      if (checkResult.status === 'ok') {
        found = true;
        return checkResult;
      }
    }

    if (!found && links.length === 0) {
      return {
        status: 'no',
        message: `Không tìm thấy liên kết nào chứa từ khóa`,
        isIndex: false,
        isFollow: false,
      };
    }

    if (!found && links.length > 0) {
      return {
        status: 'no',
        message: `Không tìm thấy tên miền ${domainResult} trong các liên kết tầng 2`,
        isIndex: false,
        isFollow: false,
      };
    }

    return {
      status: 'no',
      message: `Keyword ${keyword} không tìm thấy`,
      isIndex: false,
      isFollow: false,
    };
  }

  async checkIndexExternal(
    link: string,
  ): Promise<CheckIndexExternalResponseType> {
    try {
      const browser: Browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const url: string = `https://www.google.com/search?q=site:${link}`;
      const page: Page = await browser.newPage();
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });
      // await page.waitForTimeout('#search');
      const flag: boolean = await page.evaluate((): boolean => {
        return document.querySelectorAll('#search div.MjjYud').length > 0;
      });
      await browser.close();

      if (!flag) {
        return { status: 'no', message: 'NO INDEXED' };
      }
      return { status: 'ok', message: 'Succeed' };
    } catch (e) {
      return { status: 'no', message: e.message };
    }
  }

  public async indexSinbyte(
    link: string,
    leaderId: string,
  ): Promise<AxiosResponse<any, any> | IndexSinbyteResponseType> {
    try {
      const sinbyte: Sinbyte = await this.sinbyteRepo.findOneByCondition({
        leaderId: leaderId,
      });
      if (sinbyte) {
        const data: IndexSinbyteDto = {
          apikey: sinbyte.apiKey,
          name: 'OKVIP INDEXBACKLINK',
          dripfeed: '1',
          urls: [link],
        };

        const response = await AxiosService.instance().axios.post(
          this.url,
          data,
        );
        return response || { status: 'no', message: 'Failed' };
      }
    } catch (e) {
      return { status: 'no', message: 'INDEX FAIL' };
    }
  }
}
