import { PlatformBot } from './platform-bot.mjs';
import { hcpContract } from './platforms/hcp.mjs';
import { lessenContract } from './platforms/lessen.mjs';
import { lulaContract } from './platforms/lula.mjs';
import { bhfosAppContract } from './platforms/bhfos-app.mjs';
import { zrsContract } from './platforms/zrs.mjs';

export const hcpBot = new PlatformBot(hcpContract);
export const lessenBot = new PlatformBot(lessenContract);
export const lulaBot = new PlatformBot(lulaContract);
export const bhfosAppBot = new PlatformBot(bhfosAppContract);
export const zrsBot = new PlatformBot(zrsContract);

export { PlatformBot, reconcileHandoffs } from './platform-bot.mjs';
export { parseManualRelay, prepareBatch } from './intake.mjs';
export { AUTHORITY, SCHEMA_VERSION, BOT_CODE_VERSION } from './core.mjs';
