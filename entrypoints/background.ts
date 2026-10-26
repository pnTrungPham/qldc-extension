import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  // One app tab: focus it if open, else open it.
  browser.action.onClicked.addListener(async () => {
    const url = browser.runtime.getURL('/app.html');
    const [open] = await browser.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] });
    if (open?.tabId !== undefined && open.tabId >= 0) {
      const tab = await browser.tabs.update(open.tabId, { active: true });
      if (tab?.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
      return;
    }
    await browser.tabs.create({ url });
  });
});
