#!/usr/bin/env node
/**
 * Bruno Extension Numeric Sorting Patch
 * 
 * Automatically patches the VS Code / Antigravity IDE Bruno extension to sort
 * test collections, folders, and request files by natural numerical order
 * instead of string length or lexicographical order.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function findBrunoExtensionDir() {
  const homeDir = os.homedir();
  const searchRoots = [
    path.join(homeDir, '.antigravity-ide', 'extensions'),
    path.join(homeDir, '.vscode', 'extensions'),
    path.join(homeDir, '.cursor', 'extensions')
  ];

  for (const root of searchRoots) {
    if (fs.existsSync(root)) {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('bruno-api-client.bruno-')) {
          const candidate = path.join(root, entry.name);
          const extFile = path.join(candidate, 'dist', 'extension.js');
          if (fs.existsSync(extFile)) {
            return candidate;
          }
        }
      }
    }
  }
  return null;
}

function backupFile(filePath) {
  const bakPath = `${filePath}.bak`;
  if (!fs.existsSync(bakPath)) {
    fs.copyFileSync(filePath, bakPath);
    console.log(`[Backup] Created backup: ${bakPath}`);
  }
}

function patchExtensionJs(extDir) {
  const extFile = path.join(extDir, 'dist', 'extension.js');
  if (!fs.existsSync(extFile)) {
    console.error(`[Error] File not found: ${extFile}`);
    return false;
  }

  backupFile(extFile);
  let content = fs.readFileSync(extFile, 'utf8');
  let modified = false;

  // 1. Fix performInitialScan directory sort by length
  const old1 = 'pt.sort((It,Ot)=>It.length-Ot.length);for(let It of pt)await this.handleDirectoryAdd(It,ct,ut);let gt=[],yt=[];for(let It of mt)yJ(It,ut)||ez(It,ut)||i9(It,ut)||rz(It,ut)||tz(It,ut)?gt.push(It):yt.push(It);';
  const new1 = 'pt.sort((It,Ot)=>(It.split(/[\\\\/]/).length-Ot.split(/[\\\\/]/).length)||It.localeCompare(Ot,void 0,{numeric:!0}));for(let It of pt)await this.handleDirectoryAdd(It,ct,ut);let gt=[],yt=[];for(let It of mt)yJ(It,ut)||ez(It,ut)||i9(It,ut)||rz(It,ut)||tz(It,ut)?gt.push(It):yt.push(It);yt.sort((It,Ot)=>It.localeCompare(Ot,void 0,{numeric:!0}));';

  if (content.includes(old1)) {
    content = content.replace(old1, new1);
    modified = true;
    console.log('[Patch] Fixed performInitialScan directory & request files sorting');
  } else {
    console.log('[Skip] performInitialScan sorting already patched or signature changed');
  }

  // 2. Fix loadFullCollection directory sort by length
  const old2 = 'yt.sort((zt,Gt)=>zt.length-Gt.length);for(let zt of yt)await this.handleDirectoryAddWithSender(zt,ct,ut,ht);let vt=[],bt=[];for(let zt of gt)yJ(zt,ut)||ez(zt,ut)||i9(zt,ut)||rz(zt,ut)||tz(zt,ut)?vt.push(zt):bt.push(zt);';
  const new2 = 'yt.sort((zt,Gt)=>(zt.split(/[\\\\/]/).length-Gt.split(/[\\\\/]/).length)||zt.localeCompare(Gt,void 0,{numeric:!0}));for(let zt of yt)await this.handleDirectoryAddWithSender(zt,ct,ut,ht);let vt=[],bt=[];for(let zt of gt)yJ(zt,ut)||ez(zt,ut)||i9(zt,ut)||rz(zt,ut)||tz(zt,ut)?vt.push(zt):bt.push(zt);bt.sort((zt,Gt)=>zt.localeCompare(Gt,void 0,{numeric:!0}));';

  if (content.includes(old2)) {
    content = content.replace(old2, new2);
    modified = true;
    console.log('[Patch] Fixed loadFullCollection directory & request files sorting');
  } else {
    console.log('[Skip] loadFullCollection sorting already patched or signature changed');
  }

  // 3. Fix scanDirectoryRecursive readdirSync natural sort
  const old3 = 'let gt=mg.default.readdirSync(pt,{withFileTypes:!0});';
  const new3 = 'let gt=mg.default.readdirSync(pt,{withFileTypes:!0}).sort((It,Ot)=>It.name.localeCompare(Ot.name,void 0,{numeric:!0}));';

  if (content.includes(old3)) {
    content = content.replace(old3, new3);
    modified = true;
    console.log('[Patch] Added natural numerical sorting to scanDirectoryRecursive');
  } else {
    console.log('[Skip] scanDirectoryRecursive sorting already patched or signature changed');
  }

  // 4. Ensure numeric sorting in other localeCompare calls in extension.js
  const pairs = [
    ['Tt.name.localeCompare(Mt.name)', 'Tt.name.localeCompare(Mt.name,void 0,{numeric:!0})'],
    ['vt.name.localeCompare(bt.name)', 'vt.name.localeCompare(bt.name,void 0,{numeric:!0})'],
    ['St.name.localeCompare(wt.name)', 'St.name.localeCompare(wt.name,void 0,{numeric:!0})']
  ];

  for (const [oldCall, newCall] of pairs) {
    if (content.includes(oldCall)) {
      content = content.replace(oldCall, newCall);
      modified = true;
      console.log(`[Patch] Updated localeCompare call: ${oldCall}`);
    }
  }

  if (modified) {
    fs.writeFileSync(extFile, content, 'utf8');
    console.log('[Success] Successfully patched dist/extension.js');
  } else {
    console.log('[Info] dist/extension.js requires no modifications');
  }

  return true;
}

function patchRunnerComponent(extDir) {
  const runnerFile = path.join(extDir, 'dist', 'webview', 'static', 'js', 'async', '1645.js');
  if (!fs.existsSync(runnerFile)) {
    console.log(`[Warn] Runner chunk not found at: ${runnerFile}`);
    return false;
  }

  backupFile(runnerFile);
  let content = fs.readFileSync(runnerFile, 'utf8');

  const oldRunner = 'v=(0,l.useCallback)((e,t)=>{let s=[],r=["http-request","graphql-request"],l=t=>{(null==t?void 0:t.length)&&t.forEach(t=>{var a;if((0,c.Y2)(t)&&r.includes(t.type)&&!t.isTransient){let r=i.Ay.relative(e.pathname,i.Ay.dirname(t.pathname));s.push({...t,folderPath:("."!==r?r:"").replace(/\\\\/g,"/")})}(null==(a=t.items)?void 0:a.length)&&l(t.items)})};return l(t),s},[]);';
  const newRunner = 'v=(0,l.useCallback)((e,t)=>{let s=[],r=["http-request","graphql-request"],l=t=>{(null==t?void 0:t.length)&&[...t].sort((A,B)=>{let aF=Boolean(A.items),bF=Boolean(B.items);if(aF!==bF)return aF?-1:1;let aS=typeof A.seq=="number"&&Number.isFinite(A.seq)?A.seq:null,bS=typeof B.seq=="number"&&Number.isFinite(B.seq)?B.seq:null;if(aS!==null&&bS!==null&&aS!==bS)return aS-bS;return(A.name||"").localeCompare(B.name||"",void 0,{numeric:!0})}).forEach(t=>{var a;if((0,c.Y2)(t)&&r.includes(t.type)&&!t.isTransient){let r=i.Ay.relative(e.pathname,i.Ay.dirname(t.pathname));s.push({...t,folderPath:("."!==r?r:"").replace(/\\\\/g,"/")})}(null==(a=t.items)?void 0:a.length)&&l(t.items)})};return l(t),s},[]);';

  if (content.includes(oldRunner)) {
    content = content.replace(oldRunner, newRunner);
    fs.writeFileSync(runnerFile, content, 'utf8');
    console.log('[Success] Successfully patched dist/webview/static/js/async/1645.js (Collection Runner UI)');
    return true;
  } else {
    console.log('[Skip] Collection Runner component already patched or signature changed');
    return false;
  }
}

function verifySyntax(extDir) {
  const extFile = path.join(extDir, 'dist', 'extension.js');
  const runnerFile = path.join(extDir, 'dist', 'webview', 'static', 'js', 'async', '1645.js');

  try {
    execSync(`node -c "${extFile}"`);
    console.log('[Syntax Check] dist/extension.js syntax is valid');
  } catch (err) {
    console.error('[Syntax Error] Failed validating dist/extension.js', err.message);
  }

  if (fs.existsSync(runnerFile)) {
    try {
      execSync(`node -c "${runnerFile}"`);
      console.log('[Syntax Check] dist/webview/static/js/async/1645.js syntax is valid');
    } catch (err) {
      console.error('[Syntax Error] Failed validating runner chunk', err.message);
    }
  }
}

function main() {
  console.log('=== Bruno Extension Sorting Patcher ===');
  const extDir = findBrunoExtensionDir();

  if (!extDir) {
    console.error('[Error] Could not find installed Bruno extension directory.');
    process.exit(1);
  }

  console.log(`[Target] Found Bruno extension at: ${extDir}`);
  patchExtensionJs(extDir);
  patchRunnerComponent(extDir);
  verifySyntax(extDir);
  console.log('=== Done! Please reload IDE window (Developer: Reload Window) ===');
}

main();
