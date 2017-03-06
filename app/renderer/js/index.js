'use strict';
const path = require('path');
const {remote, ipcRenderer} = require('electron');
const {app} = require('electron').remote;
const JsonDB = require('node-json-db');
const TabGroup = require('electron-tabs');

// everything is const for now, some of these will become let once creating and deleting teams code is done
const db = new JsonDB(app.getPath('userData') + '/domain.json', true, true);
const data = db.getData('/');
const {Menu, MenuItem} = remote;
const menu = Menu.getApplicationMenu();
const teamSwitchShortcutPrefix = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
const tabGroup = new TabGroup();
const teamsSubmenu = [];
const teamsList = data.teams;

// Add the add team button
teamsList.push({
	title: '\uFF0B',
	domain: 'file://' + path.join(__dirname, 'tab.html'),
	iconURL: 'undefined',
	active: (teamsList.length === 0)
});

const tabsList = [];
let setFocusInterval = null;

function setFocus() {
	const tab = tabGroup.getActiveTab();
	if (tab !== null && tab.webview.guestinstance !== document.activeElement.guestinstance) {
		tab.webview.focus();
	} else {
		clearInterval(setFocusInterval);
	}
}

function setFocusToActiveTab() {
	clearInterval(setFocusInterval);
	setFocusInterval = setInterval(setFocus, 100);
}

function switchToTab(accelerator) {
	const index = parseInt(accelerator[accelerator.length - 1], 10) - 1;
	console.log('got index ' + index);
	if (index >= 0 && index < teamsList.length) {
		tabsList[index].activate();
	}
}

function sendAction(action) {
	const tab = tabGroup.getActiveTab();
	if (tab !== null) {
		if (action === 'reload') {
			tab.webview.reload();
			return;
		}
		tab.webview.send(action, tab.webview);
	}
}

ipcRenderer.on('sendToActiveWebview', (e, action) => {
	console.log('Host got ' + action);
	sendAction(action);
});

ipcRenderer.on('setFocusToActiveTab', () => {
	setFocusToActiveTab();
});

// TODO change menu when teams are added removed , rearranged
for (let i = 0; i < Math.min((teamsList.length - 1), 9); i++) {
	teamsSubmenu.push({
		label: teamsList[i].title,
		accelerator: teamSwitchShortcutPrefix + '+' + (i + 1).toString(),
		click(item, focusedWindow) {
			if (focusedWindow) {
				console.log('switch triggered ' + item.accelerator);
				switchToTab(item.accelerator);
			}
		}
	});
}

if (teamsSubmenu.length > 0) {
	// menu breaks on reload, why ?
	const teamsMenuItem = new MenuItem({label: 'Teams', submenu: teamsSubmenu});
	if (menu.items[4].label.toLowerCase() === 'teams') {
		menu.items[4] = teamsMenuItem;
	} else {
		menu.insert(4, teamsMenuItem);
	}
	Menu.setApplicationMenu(menu);
}

document.addEventListener('DOMContentLoaded', () => {
	for (let i = 0; i < teamsList.length; i++) {
		const tabParams = {
			webviewAttributes: {
				preload: path.join(__dirname, 'js', 'preload.js'),
				allowpopus: 'on',
				webpreferences: 'allowDisplayingInsecureContent, plugins=true',
				plugins: 'on'
			},
			closable: false,
			src: teamsList[i].domain,
			active: teamsList[i].active
		};

		if (teamsList[i].iconURL === 'undefined') {
			if (teamsList[i].title === 'undefined' || teamsList[i].title === '') {
				tabParams.title = '?';
			} else {
				tabParams.title = teamsList[i].title[0];
			}
		} else {
			tabParams.iconURL = teamsList[i].iconURL;
			tabParams.title = ' ';
		}
		const tab = tabGroup.addTab(tabParams);
		tab.on('active', () => {
			setFocusToActiveTab();
		});
		tabsList.push(tab);
	}
	setFocusToActiveTab();
}, false);
// document.addEventListener('focus', function(){
//	 setFocusToActiveTab();
// });
