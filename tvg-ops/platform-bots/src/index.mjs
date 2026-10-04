import { PlatformBot } from './platform-bot.mjs';
import { hcpContract } from './platforms/hcp.mjs';
import { lessenContract } from './platforms/lessen.mjs';
import { lulaContract } from './platforms/lula.mjs';

export const hcpBot = new PlatformBot(hcpContract);
export const lessenBot = new PlatformBot(lessenContract);
export const lulaBot = new PlatformBot(lulaContract);

export { PlatformBot } from './platform-bot.mjs';
export { AUTHORITY, UNKNOWN } from './core.mjs';
