/**
 * This file is part of Domotz Agent.
 * Copyright (C) 2018  Domotz Ltd
 *
 * Domotz Agent is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Domotz Agent is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Domotz Agent.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Created by Alessio Sanfratello <alessio@domotz.com> on 02/10/18.
 */

 const MODULE_NAME = 'PLATFORM';
 const PUBLIC_SNAP = 'domotzpro-agent-publicstore';
 const PRIVATE_SNAP = 'domotzpro-agent';
 
 
 const q = require('q');
 
 function factory (fs) {
  
     function isVirtualBox () {
         console.info('%s - Checking Virtual Box platform...', MODULE_NAME);
         if (process.env.SNAP_COMMON && process.env.SNAP_COMMON.length > 0) {
             var snapConfigFilePath = process.env.SNAP_COMMON + '/etc/virtual_spec.json';
             if (fs.existsSync(snapConfigFilePath)) {
                 console.info('%s - Virtual Box platform recognized', MODULE_NAME);
                 return true;
             }
         }
         console.info('%s - Virtual Box config not found', MODULE_NAME);
         return false;
     }
 
     function getFullPlatform () {
         var fullPlatform = process.env.DPLATFORM;
 
         if (fullPlatform === 'ubuntu_core') {
             var snapName = process.env.SNAP_NAME;
 
             switch (snapName) {
                 case PUBLIC_SNAP:
                     fullPlatform = isVirtualBox() ? 'ubuntu_core_virtualbox' : 'ubuntu_core_public';
                     break;
                 case PRIVATE_SNAP:
                     fullPlatform = 'ubuntu_core_private';
                     break;
                 default:
                     console.warn('%s - SNAP name "%s" not recognized', MODULE_NAME, snapName);
                     break;
             }
         }
         console.info('%s - full_platform is: %s', MODULE_NAME, fullPlatform);
         return fullPlatform;
     }
 
     function isSlow () {
         return process.env.DPLATFORM === 'ubuntu_core' || process.env.DPLATFORM === 'luxul';
     }
 
     function isWindows () {
         return process.env.DPLATFORM === 'win';
     }
 
     function getNodeVersion () {
         return process.version;
     }
 
     function isNodeVersionZero () {
         return getNodeVersion().charAt(1) === '0';
     }
 
     function isUbuntuCore () {
         return process.env.DPLATFORM === 'ubuntu_core';
     }
 
     function needsSudo () {
         try {
             return process.getuid() !== 0;
         } catch (e) { // Windows platform does not have getuid, and doesn't need sudo
             return false;
         }
     }
 
     function getWindowsShell () {
         return process.env.DOMOTZ_ROOT_DIR + '\\lib\\portable-git\\bin\\domotz_bash.exe';
     }
 
 
     function supportsDomainAccountAuth() {
         return !isNodeVersionZero();
     }
 
     return {
         isVirtualBox: isVirtualBox,
         isWindows: isWindows,
         isUbuntuCore: isUbuntuCore,
         getFullPlatform: getFullPlatform,
         isNodeVersionZero: isNodeVersionZero,
         getNodeVersion: getNodeVersion,
         isSlow: isSlow,
         needsSudo: needsSudo,
         getWindowsShell: getWindowsShell,
         //test only
         supportsDomainAccountAuth: supportsDomainAccountAuth
     };
 }
 
 
 module.exports.factory = factory;
 