#!/usr/bin/env node
/**
 * Sync sfdx-project.json versionNumber with package.json version.
 * Called automatically by commit-and-tag-version via .versionrc.json postbump hook.
 *
 * Example: package.json "version": "1.2.0"
 *       → sfdx-project.json "versionNumber": "1.2.0.NEXT"
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const root    = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const sfPath  = path.join(root, 'sfdx-project.json');

const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const project = JSON.parse(fs.readFileSync(sfPath, 'utf8'));

const [major, minor, patch] = pkg.version.split('.');
const newVersion = `${major}.${minor}.${patch}.NEXT`;

project.packageDirectories[0].versionNumber = newVersion;

fs.writeFileSync(sfPath, JSON.stringify(project, null, 2) + '\n');
console.log(`✔ sfdx-project.json versionNumber → ${newVersion}`);
