export async function setSidePanelEnabled(tabId, url) {
  if (!tabId || !url) throw new Error(`Invalid tabId: ${tabId} or URL: ${url}`);

  try {
    const tabSidePanel = await chrome.sidePanel.getOptions({ tabId });
    const storedTabOpenKey = tabId.toString();
    const storedTabsOpenHash = await chrome.storage.local.get("tabsOpen");
    const isSidePanelEnabledOptionSet = tabSidePanel?.enabled !== undefined;
    const isTabOpenSet =
      storedTabsOpenHash["tabsOpen"]?.[storedTabOpenKey] !== undefined;
    const shouldTabSidePanelBeEnabled = url.startsWith(
      "https://www.youtube.com/watch"
    );

    if (!isSidePanelEnabledOptionSet && !isTabOpenSet) {
      if (shouldTabSidePanelBeEnabled) {
        await chrome.sidePanel.setOptions({
          tabId,
          path: "src/user-interface/index/sidepanel.html",
          enabled: true,
        });
        await chrome.storage.local.set({
          tabsOpen: {
            ...storedTabsOpenHash["tabsOpen"],
            [storedTabOpenKey]: true,
          },
        });
      } else {
        await chrome.sidePanel.setOptions({ tabId, enabled: false });
        await chrome.storage.local.set({
          tabsOpen: {
            ...storedTabsOpenHash["tabsOpen"],
            [storedTabOpenKey]: false,
          },
        });
      }
      return;
    }

    if (shouldTabSidePanelBeEnabled && !tabSidePanel.enabled) {
      await chrome.sidePanel.setOptions({
        tabId,
        path: "src/user-interface/index/sidepanel.html",
        enabled: true,
      });
      await chrome.storage.local.set({
        tabsOpen: {
          ...storedTabsOpenHash["tabsOpen"],
          [storedTabOpenKey]: true,
        },
      });
    } else if (!shouldTabSidePanelBeEnabled && tabSidePanel.enabled) {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
      await chrome.storage.local.set({
        tabsOpen: {
          ...storedTabsOpenHash["tabsOpen"],
          [storedTabOpenKey]: false,
        },
      });
    }
  } catch (error) {
    console.error("Updating side panel visibility failed:", error);
  }
}
