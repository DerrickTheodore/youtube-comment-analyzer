chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => {
    console.log("Side panel behavior set successfully");
  })
  .catch((error) => console.error("Setting panel behavior", error));
