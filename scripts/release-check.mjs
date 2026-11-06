import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {configuration} from './config.mjs';
await configuration('production');
const evidence=JSON.parse(await readFile(new URL('../release-evidence.json',import.meta.url),'utf8'));
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const errors=[];if(evidence.commit!==commit)errors.push('Evidence must describe HEAD.');
if(!evidence.providerLimitsReviewedAt||!evidence.correspondingSourceUrl?.startsWith('https://'))errors.push('Verify provider limits and provide complete encoder corresponding source.');
for(const os of ['Windows','macOS'])for(const browser of ['Chrome','Firefox']){
 const row=evidence.encoder?.find(e=>e.os===os&&e.browser===browser);
 if(!row||row.ramGB<8||row.seconds>600||row.consecutivePreparations<3||!row.cancelPassed||!row.responsive||!row.stagingAssetPassed||!row.referenceLaptop)errors.push(`Encoder gate incomplete: ${browser} on ${os}.`);
}
for(const browser of ['Chrome','Firefox'])if(!evidence.realAccounts?.find(e=>e.browser===browser&&e.twoMusicians&&e.thirdAccountIsolation&&e.passkey&&e.upload&&e.publicExcerptOnly&&e.matchChat&&e.removal&&e.moderation&&e.approvedEventFlow&&e.cleanup))errors.push(`Hosted real-account gate incomplete: ${browser}.`);
for(const key of ['regressionPassed','typescriptPassed','licenseReviewPassed','moderatorDeliveryPassed'])if(!evidence[key])errors.push(`Missing release evidence: ${key}.`);
if(process.argv.includes('--finalize')&&!evidence.productionSmokePassed)errors.push('Production smoke test incomplete.');
if(errors.length)throw Error(errors.join('\n'));console.log(`Release evidence accepted for ${commit}.`);
