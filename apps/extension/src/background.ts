import { configureScheduledSync, getScheduledSyncAlarmName, runScheduledTwoWaySync } from "./lib/sync";
import { readSharedCache } from "./lib/storage";

async function configureAlarm() {
  const cache = await readSharedCache();
  await configureScheduledSync(cache.schedule);
}

chrome.runtime.onInstalled.addListener(() => {
  void configureAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  void configureAlarm();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== getScheduledSyncAlarmName()) {
    return;
  }

  void runScheduledTwoWaySync().catch(error => {
    console.error("[memsync] scheduled sync failed", error);
  });
});
