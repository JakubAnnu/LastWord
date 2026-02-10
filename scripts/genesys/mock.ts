import { mockBrowserEnvironment as engineMock } from '@gnsx/genesys.js';
import { JSDOM } from 'jsdom';

export function mockBrowserEnvironment() {
  engineMock(JSDOM);
}
